import { Server, Socket } from 'socket.io';
import { roomService } from '../services/RoomService';
import { gameService } from '../services/GameService';
import { botService } from '../services/BotService';
import { localIP } from '../index';
import { config } from '../config';
import * as rl from '../middleware/socketRateLimiter';
import {
  validatePlayerName,
  validateRoomCode,
  validateAnswer,
  validateSettings,
  validateBotCount
} from '../middleware/validation';

// Look up the room for a socket using the roomCode stored on socket.data
function getRoomForSocket(socket: Socket) {
  const code: string | undefined = socket.data.roomCode;
  return code ? roomService.getRoom(code) : null;
}

export function setupSocketHandlers(io: Server) {
  // Periodic cleanup of long-disconnected players (every 60 seconds)
  setInterval(() => {
    roomService.cleanupDisconnectedPlayers();
  }, 60000);

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // ── Create room ──────────────────────────────────────────────────────────
    socket.on('create-room', ({ playerName }: { playerName: string }) => {
      if (!rl.allow(socket.id, 'create-room', 5, 15 * 60_000)) {
        socket.emit('error', { message: 'Too many rooms created. Please wait.' });
        return;
      }
      try {
        const room = roomService.createRoom(playerName, socket.id);
        const joinUrl = config.APP_URL
          ? `${config.APP_URL}/join/${room.code}`
          : `http://${localIP}:${config.CLIENT_PORT}/join/${room.code}`;

        socket.data.roomCode = room.code;
        socket.join(room.id);

        socket.emit('room-created', {
          roomId: room.id,
          roomCode: room.code,
          playerId: room.hostId,
          joinUrl,
          settings: room.settings
        });

        console.log(`✅ Room created: ${room.code} by ${playerName}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error creating room:', error.message);
      }
    });

    // ── Join room ────────────────────────────────────────────────────────────
    socket.on('join-room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      if (!rl.allow(socket.id, 'join-room', 10, 60_000)) {
        socket.emit('error', { message: 'Too many join attempts. Please wait.' });
        return;
      }
      const codeErr = validateRoomCode(roomCode);
      if (codeErr) { socket.emit('error', { message: codeErr }); return; }
      const nameErr = validatePlayerName(playerName);
      if (nameErr) { socket.emit('error', { message: nameErr }); return; }
      try {
        const trimmedName = playerName.trim();
        playerName = trimmedName;

        console.log(`🔔 Join request: ${playerName} trying to join ${roomCode} (socket: ${socket.id})`);

        const room = roomService.getRoomByCode(roomCode);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const isReconnecting = roomService.isPlayerNameTaken(roomCode, playerName);
        let player;

        if (isReconnecting) {
          player = roomService.reconnectPlayer(roomCode, playerName, socket.id);
          if (!player) {
            socket.emit('error', { message: 'Failed to reconnect' });
            return;
          }
          console.log(`🔄 ${playerName} reconnected to room ${roomCode}`);
        } else {
          player = roomService.addPlayer(roomCode, playerName, socket.id);
          if (!player) {
            socket.emit('error', { message: 'Failed to join room' });
            return;
          }
          console.log(`✅ ${playerName} joined room ${roomCode} (${room.players.length} players)`);
        }

        socket.data.roomCode = roomCode;
        socket.join(room.id);

        socket.emit('player-joined', {
          playerId: player.id,
          roomId: room.id,
          players: room.players,
          gameState: room.state,
          reconnected: isReconnecting
        });

        // Restore state for reconnecting mid-game players
        if (isReconnecting && room.state !== 'waiting') {
          if ((room.state === 'question' || room.state === 'answering') && room.currentQuestionIndex < room.questions.length) {
            const question = room.questions[room.currentQuestionIndex];
            socket.emit('question-started', {
              question: {
                id: question.id,
                categories: question.categories,
                difficulty: question.difficulty,
                text: question.text,
                unit: question.unit,
                questionNumber: room.currentQuestionIndex + 1,
                totalQuestions: room.questions.length
              },
              timeLimit: room.settings.timePerQuestion
            });

            if (room.state === 'answering') {
              socket.emit('answering-started', {});
              if (room.answers.has(player.id)) {
                socket.emit('answer-already-submitted', {});
              }
            }
          }

          if (room.state === 'results') {
            if (room.lastRoundResult) socket.emit('question-ended', room.lastRoundResult);
            if (room.answerRevealed) socket.emit('answer-revealed', {});
            socket.emit('player-ready-update', {
              playerId: player.id,
              playerName: player.name,
              readyCount: room.readyPlayers.size,
              totalCount: room.players.filter(p => p.connected).length,
              readyPlayerIds: Array.from(room.readyPlayers)
            });
          }
        }

        socket.to(room.id).emit('player-joined', {
          player,
          players: room.players,
          reconnected: isReconnecting
        });

      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error joining room:', error.message);
      }
    });

    // ── Update settings ──────────────────────────────────────────────────────
    socket.on('update-settings', ({ settings }: { settings: any }) => {
      const err = validateSettings(settings);
      if (err) { socket.emit('error', { message: err }); return; }
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        if (socket.id !== room.hostId) { socket.emit('error', { message: 'Only host can update settings' }); return; }

        roomService.updateSettings(settings, room.code);
        io.to(room.id).emit('settings-updated', { settings: room.settings });
        console.log(`⚙️  Settings updated in ${room.code}:`, room.settings);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error updating settings:', error.message);
      }
    });

    // ── Add bots ─────────────────────────────────────────────────────────────
    socket.on('add-bots', ({ count }: { count: number }) => {
      const err = validateBotCount(count);
      if (err) { socket.emit('error', { message: err }); return; }
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        if (socket.id !== room.hostId) { socket.emit('error', { message: 'Only host can add bots' }); return; }

        const bots = roomService.addBots(count, room.code);
        io.to(room.id).emit('bots-added', { bots, players: room.players });
        console.log(`🤖 Added ${bots.length} bots to room ${room.code}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error adding bots:', error.message);
      }
    });

    // ── Remove bots ──────────────────────────────────────────────────────────
    socket.on('remove-bots', () => {
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        if (socket.id !== room.hostId) { socket.emit('error', { message: 'Only host can remove bots' }); return; }

        roomService.removeBots(room.code);
        io.to(room.id).emit('bots-removed', { players: room.players });
        console.log(`🤖 Removed all bots from room ${room.code}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error removing bots:', error.message);
      }
    });

    // ── Start game ───────────────────────────────────────────────────────────
    socket.on('start-game', () => {
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        if (socket.id !== room.hostId) { socket.emit('error', { message: 'Only host can start the game' }); return; }

        gameService.startGame(room.code);
        io.to(room.id).emit('game-started', {});
        console.log(`🎮 Game started in room ${room.code}`);

        setTimeout(() => { sendCurrentQuestion(io, room.code); }, 2000);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error starting game:', error.message);
      }
    });

    // ── Start answering phase ────────────────────────────────────────────────
    socket.on('start-answering', () => {
      const room = getRoomForSocket(socket);
      if (!room) return;
      try {
        gameService.startAnswering(room.code);
        console.log(`⏱️  Answering phase started for question ${room.currentQuestionIndex + 1} in ${room.code}`);
      } catch (error: any) {
        console.error('❌ Error starting answering phase:', error.message);
      }
    });

    // ── Submit answer ────────────────────────────────────────────────────────
    socket.on('submit-answer', ({ answer }: { answer: number }) => {
      const err = validateAnswer(answer);
      if (err) { socket.emit('error', { message: err }); return; }
      if (!rl.allow(socket.id, 'submit-answer', 2, 60_000)) {
        socket.emit('error', { message: 'Answer already submitted' });
        return;
      }
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

        const player = roomService.getPlayerBySocketId(socket.id, room.code);
        if (!player) { socket.emit('error', { message: 'Player not found' }); return; }

        gameService.submitAnswer(room.code, player.id, answer);
        socket.emit('answer-received', { playerId: player.id });
        socket.to(room.id).emit('answer-received', { playerId: player.id });
        console.log(`📝 ${player.name} submitted answer: ${answer} in ${room.code}`);

        if (gameService.haveAllPlayersAnswered(room)) {
          console.log(`✅ All players answered in ${room.code}, ending question`);
          endCurrentQuestion(io, room.code);
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error submitting answer:', error.message);
      }
    });

    // ── Timer expired ────────────────────────────────────────────────────────
    socket.on('timer-expired', () => {
      const room = getRoomForSocket(socket);
      if (!room || room.state !== 'answering' || socket.id !== room.hostId) return;
      console.log(`⏰ Timer expired for question ${room.currentQuestionIndex + 1} in ${room.code}`);
      endCurrentQuestion(io, room.code);
    });

    // ── Next question ────────────────────────────────────────────────────────
    socket.on('next-question', () => {
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        if (socket.id !== room.hostId) { socket.emit('error', { message: 'Only host can proceed' }); return; }

        roomService.clearReadyPlayers(room.code);
        gameService.nextQuestion(room.code);

        if (room.state === 'question') {
          setTimeout(() => { sendCurrentQuestion(io, room.code); }, 1000);
        } else if (room.state === 'finished') {
          const results = gameService.getFinalResults(room.code);
          io.to(room.id).emit('game-ended', results);
          console.log(`🏆 Game ended in room ${room.code}`);
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error moving to next question:', error.message);
      }
    });

    // ── Player ready ─────────────────────────────────────────────────────────
    socket.on('player-ready', ({ playerId }: { playerId: string }) => {
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

        let player = roomService.getPlayerById(playerId, room.code);
        if (!player) player = roomService.getPlayerBySocketId(socket.id, room.code);
        if (!player) { socket.emit('error', { message: 'Player not found' }); return; }

        roomService.markPlayerReady(player.id, room.code);

        const readyCount = room.readyPlayers.size;
        const connectedCount = room.players.filter(p => p.connected).length;

        io.to(room.id).emit('player-ready-update', {
          playerId: player.id,
          playerName: player.name,
          readyCount,
          totalCount: connectedCount,
          readyPlayerIds: Array.from(room.readyPlayers)
        });

        console.log(`✅ ${player.name} is ready (${readyCount}/${connectedCount}) in ${room.code}`);

        if (roomService.areAllPlayersReady(room.code) && connectedCount >= 2 && !room.isProcessingReady) {
          room.isProcessingReady = true;
          roomService.clearReadyPlayers(room.code);

          setTimeout(() => {
            gameService.nextQuestion(room.code);
            if (room.state === 'question') {
              setTimeout(() => {
                sendCurrentQuestion(io, room.code);
                room.isProcessingReady = false;
              }, 1000);
            } else if (room.state === 'finished') {
              const results = gameService.getFinalResults(room.code);
              io.to(room.id).emit('game-ended', results);
              console.log(`🏆 Game ended in room ${room.code}`);
              room.isProcessingReady = false;
            }
          }, 1000);
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error marking player ready:', error.message);
      }
    });

    // ── Reveal done (animation complete on host) ─────────────────────────────
    socket.on('reveal-done', () => {
      const room = getRoomForSocket(socket);
      if (!room || socket.id !== room.hostId) return;

      room.answerRevealed = true;
      io.to(room.id).emit('answer-revealed', {});
      console.log(`🎬 Answer revealed in room ${room.code}`);

      if (room.lastRoundResult?.isLastQuestion) {
        setTimeout(() => {
          try {
            gameService.nextQuestion(room.code);
            const results = gameService.getFinalResults(room.code);
            io.to(room.id).emit('game-ended', results);
            console.log(`🏆 Game ended (last question auto-advance) in room ${room.code}`);
          } catch (e: any) {
            console.error('❌ Auto-advance error:', e.message);
          }
        }, 5000);
      }
    });

    // ── Restart game ─────────────────────────────────────────────────────────
    socket.on('restart-game', () => {
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        if (socket.id !== room.hostId) { socket.emit('error', { message: 'Only host can restart' }); return; }

        roomService.restartGame(room.code);
        io.to(room.id).emit('game-restarted', { players: room.players, settings: room.settings });
        console.log(`🔄 Game restarted in room ${room.code}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error restarting game:', error.message);
      }
    });

    // ── End game ─────────────────────────────────────────────────────────────
    socket.on('end-game', () => {
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        if (socket.id !== room.hostId) { socket.emit('error', { message: 'Only host can end the game' }); return; }

        io.to(room.id).emit('game-ended', { reason: 'Host ended the game' });
        roomService.deleteRoom(room.code);
        console.log(`🛑 Game ended by host in room ${room.code}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error ending game:', error.message);
      }
    });

    // ── Kick player ──────────────────────────────────────────────────────────
    socket.on('kick-player', ({ playerId }: { playerId: string }) => {
      try {
        const room = getRoomForSocket(socket);
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        if (socket.id !== room.hostId) { socket.emit('error', { message: 'Only host can kick players' }); return; }

        const player = roomService.getPlayerById(playerId, room.code);
        if (!player) { socket.emit('error', { message: 'Player not found' }); return; }

        io.to(player.socketId).emit('kicked', { message: 'You have been kicked by the host' });
        roomService.removePlayer(playerId, room.code);
        io.to(room.id).emit('player-left', { playerId: player.id, playerName: player.name, players: room.players });
        console.log(`👢 ${player.name} was kicked from room ${room.code}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error kicking player:', error.message);
      }
    });

    // ── Report question ──────────────────────────────────────────────────────
    socket.on('report-question', ({ questionId, questionText, playerName }: { questionId: string; questionText: string; playerName: string }) => {
      if (!rl.allow(socket.id, 'report-question', 3, 60 * 60_000)) {
        socket.emit('error', { message: 'Report limit reached' });
        return;
      }
      if (typeof questionId !== 'string' || typeof questionText !== 'string') return;
      console.log(`🚩 REPORTED_QUESTION id=${questionId} text="${questionText}" player="${playerName}" time=${new Date().toISOString()}`);
      socket.emit('question-reported', { success: true });
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      rl.cleanup(socket.id);
      console.log(`🔌 Client disconnected: ${socket.id}`);

      const roomCode: string | undefined = socket.data.roomCode;
      if (!roomCode) return;

      const room = roomService.getRoom(roomCode);
      if (!room) return;

      const player = roomService.getPlayerBySocketId(socket.id, roomCode);
      if (player) {
        roomService.markPlayerDisconnected(socket.id, roomCode);
        io.to(room.id).emit('player-disconnected', {
          playerId: player.id,
          playerName: player.name,
          players: room.players
        });
        console.log(`⚠️  ${player.name} disconnected from room ${roomCode} (marked offline)`);
      } else {
        // Host disconnected — if no players remain, clean up the room
        if (socket.id === room.hostId && room.players.length === 0) {
          roomService.deleteRoom(roomCode);
          console.log(`🗑️  Room ${roomCode} deleted — host left with no players`);
        }
      }
    });
  });

  // ── Helper: send current question to all in room ───────────────────────────
  function sendCurrentQuestion(io: Server, roomCode: string) {
    const room = roomService.getRoom(roomCode);
    if (!room) return;

    const question = gameService.getCurrentQuestion(room);
    if (!question) return;

    io.to(room.id).emit('question-started', { question, timeLimit: room.settings.timePerQuestion });
    console.log(`❓ [${roomCode}] Q${question.questionNumber}/${question.totalQuestions}: ${question.text}`);

    setTimeout(() => {
      gameService.startAnswering(room.code);
      io.to(room.id).emit('answering-started', {});

      const currentQ = room.questions[room.currentQuestionIndex];
      botService.submitBotAnswers(room, currentQ, (botId, answer) => {
        try {
          gameService.submitAnswer(room.code, botId, answer);
          console.log(`🤖 [${roomCode}] Bot ${room.players.find(p => p.id === botId)?.name} answered: ${answer}`);
          if (gameService.haveAllPlayersAnswered(room)) {
            console.log(`✅ [${roomCode}] All players answered, ending question`);
            endCurrentQuestion(io, roomCode);
          }
        } catch (error) {
          console.error('❌ Error submitting bot answer:', error);
        }
      });
    }, 3000);
  }

  // ── Helper: end question and send results ──────────────────────────────────
  function endCurrentQuestion(io: Server, roomCode: string) {
    const room = roomService.getRoom(roomCode);
    if (!room) return;

    try {
      const results = gameService.endQuestion(room.code);
      io.to(room.id).emit('question-ended', results);
      console.log(`📊 [${roomCode}] Question ended. Winner: ${results.winner?.playerName || 'None'}`);

      botService.markBotsReady(room, (botId) => {
        roomService.markPlayerReady(botId, roomCode);

        const readyCount = room.readyPlayers.size;
        const connectedCount = room.players.filter(p => p.connected).length;

        io.to(room.id).emit('player-ready-update', {
          playerId: botId,
          playerName: room.players.find(p => p.id === botId)?.name || 'Bot',
          readyCount,
          totalCount: connectedCount,
          readyPlayerIds: Array.from(room.readyPlayers)
        });

        if (roomService.areAllPlayersReady(roomCode) && connectedCount >= 2 && !room.isProcessingReady) {
          room.isProcessingReady = true;
          roomService.clearReadyPlayers(roomCode);

          setTimeout(() => {
            gameService.nextQuestion(room.code);
            if (room.state === 'question') {
              setTimeout(() => {
                sendCurrentQuestion(io, roomCode);
                room.isProcessingReady = false;
              }, 1000);
            } else if (room.state === 'finished') {
              const finalResults = gameService.getFinalResults(room.code);
              io.to(room.id).emit('game-ended', finalResults);
              console.log(`🏆 [${roomCode}] Game ended`);
              room.isProcessingReady = false;
            }
          }, 1000);
        }
      });
    } catch (error: any) {
      console.error('❌ Error ending question:', error.message);
    }
  }
}
