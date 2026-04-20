import { Server, Socket } from 'socket.io';
import { roomService } from '../services/RoomService';
import { gameService } from '../services/GameService';
import { botService } from '../services/BotService';
import { localIP } from '../index';

export function setupSocketHandlers(io: Server) {
  // Periodic cleanup of long-disconnected players (every 60 seconds)
  setInterval(() => {
    roomService.cleanupDisconnectedPlayers();
  }, 60000);

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Create room
    socket.on('create-room', ({ playerName }: { playerName: string }) => {
      try {
        const room = roomService.createRoom(playerName, socket.id);
        const clientPort = process.env.CLIENT_PORT || 5173;
        const joinUrl = `http://${localIP}:${clientPort}/join/${room.code}`;

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

    // Join room
    socket.on('join-room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      try {
        console.log(`🔔 Join request: ${playerName} trying to join ${roomCode} (socket: ${socket.id})`);

        const room = roomService.getRoomByCode(roomCode);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        let player;
        const isReconnecting = roomService.isPlayerNameTaken(roomCode, playerName);

        if (isReconnecting) {
          // Reconnect existing player
          player = roomService.reconnectPlayer(roomCode, playerName, socket.id);
          if (!player) {
            socket.emit('error', { message: 'Failed to reconnect' });
            return;
          }
          console.log(`🔄 ${playerName} reconnected to room ${roomCode}`);
        } else {
          // New player joining
          player = roomService.addPlayer(roomCode, playerName, socket.id);
          if (!player) {
            socket.emit('error', { message: 'Failed to join room' });
            return;
          }
          console.log(`✅ ${playerName} joined room ${roomCode} (${room.players.length} players total)`);
        }

        socket.join(room.id);

        // Notify the player they joined/reconnected
        socket.emit('player-joined', {
          playerId: player.id,
          roomId: room.id,
          players: room.players,
          gameState: room.state,
          reconnected: isReconnecting
        });

        // If reconnecting mid-game, send current game state
        if (isReconnecting && room.state !== 'waiting') {
          // Send current question if in question/answering phase
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

              // Check if player already submitted answer
              const hasAnswered = room.answers.has(player.id);
              if (hasAnswered) {
                socket.emit('answer-already-submitted', {});
              }
            }
          }

          // Send results if in results phase
          if (room.state === 'results') {
            // Player will see results when they're broadcast
            // Send current ready state
            socket.emit('player-ready-update', {
              playerId: player.id,
              playerName: player.name,
              readyCount: room.readyPlayers.size,
              totalCount: room.players.filter(p => p.connected).length,
              readyPlayerIds: Array.from(room.readyPlayers)
            });
          }
        }

        // Notify all other players in the room
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

    // Update game settings
    socket.on('update-settings', ({ settings }: { settings: any }) => {
      try {
        const room = roomService.getRoom();
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if this socket is the host
        if (socket.id !== room.hostId) {
          socket.emit('error', { message: 'Only host can update settings' });
          return;
        }

        roomService.updateSettings(settings);

        // Broadcast updated settings to all players
        io.to(room.id).emit('settings-updated', { settings: room.settings });

        console.log(`⚙️  Settings updated:`, room.settings);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error updating settings:', error.message);
      }
    });

    // Add bots
    socket.on('add-bots', ({ count }: { count: number }) => {
      try {
        const room = roomService.getRoom();
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if this socket is the host
        if (socket.id !== room.hostId) {
          socket.emit('error', { message: 'Only host can add bots' });
          return;
        }

        const bots = roomService.addBots(count);

        // Notify all players about new bots
        io.to(room.id).emit('bots-added', {
          bots,
          players: room.players
        });

        console.log(`🤖 Added ${bots.length} bots to room ${room.code}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error adding bots:', error.message);
      }
    });

    // Remove bots
    socket.on('remove-bots', () => {
      try {
        const room = roomService.getRoom();
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if this socket is the host
        if (socket.id !== room.hostId) {
          socket.emit('error', { message: 'Only host can remove bots' });
          return;
        }

        roomService.removeBots();

        // Notify all players about bot removal
        io.to(room.id).emit('bots-removed', {
          players: room.players
        });

        console.log(`🤖 Removed all bots from room ${room.code}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error removing bots:', error.message);
      }
    });

    // Start game
    socket.on('start-game', () => {
      try {
        const room = roomService.getRoom();
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if this socket is the host
        if (socket.id !== room.hostId) {
          socket.emit('error', { message: 'Only host can start the game' });
          return;
        }

        gameService.startGame(room.id);

        // Notify all players game has started
        io.to(room.id).emit('game-started', {});

        console.log(`🎮 Game started in room ${room.code}`);

        // Start first question after a brief delay
        setTimeout(() => {
          sendCurrentQuestion(io, room.id);
        }, 2000);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error starting game:', error.message);
      }
    });

    // Start answering phase
    socket.on('start-answering', () => {
      const room = roomService.getRoom();
      if (!room) return;

      try {
        gameService.startAnswering(room.id);
        console.log(`⏱️  Answering phase started for question ${room.currentQuestionIndex + 1}`);
      } catch (error: any) {
        console.error('❌ Error starting answering phase:', error.message);
      }
    });

    // Submit answer
    socket.on('submit-answer', ({ answer }: { answer: number }) => {
      try {
        const player = roomService.getPlayerBySocketId(socket.id);
        if (!player) {
          socket.emit('error', { message: 'Player not found' });
          return;
        }

        const room = roomService.getRoom();
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        gameService.submitAnswer(room.id, player.id, answer);

        // Confirm to the player
        socket.emit('answer-received', { playerId: player.id });

        // Notify host about answer submission
        socket.to(room.id).emit('answer-received', { playerId: player.id });

        console.log(`📝 ${player.name} submitted answer: ${answer}`);

        // Check if all players have answered
        if (gameService.haveAllPlayersAnswered(room)) {
          console.log(`✅ All players answered, ending question`);
          endCurrentQuestion(io, room.id);
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error submitting answer:', error.message);
      }
    });

    // Timer expired (force end question)
    socket.on('timer-expired', () => {
      const room = roomService.getRoom();
      if (!room || room.state !== 'answering') return;

      // Check if this socket is the host
      if (socket.id !== room.hostId) return;

      console.log(`⏰ Timer expired for question ${room.currentQuestionIndex + 1}`);
      endCurrentQuestion(io, room.id);
    });

    // Next question
    socket.on('next-question', () => {
      try {
        const room = roomService.getRoom();
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if this socket is the host
        if (socket.id !== room.hostId) {
          socket.emit('error', { message: 'Only host can proceed to next question' });
          return;
        }

        // Clear ready state
        roomService.clearReadyPlayers();

        gameService.nextQuestion(room.id);

        if (room.state === 'question') {
          // More questions remaining
          setTimeout(() => {
            sendCurrentQuestion(io, room.id);
          }, 1000);
        } else if (room.state === 'finished') {
          // Game finished
          const results = gameService.getFinalResults(room.id);
          io.to(room.id).emit('game-ended', results);
          console.log(`🏆 Game ended in room ${room.code}`);
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error moving to next question:', error.message);
      }
    });

    // Player ready for next question
    socket.on('player-ready', ({ playerId }: { playerId: string }) => {
      try {
        // First try to find by provided playerId, fallback to socket.id
        let player = roomService.getPlayerById(playerId);

        if (!player) {
          // Fallback: try finding by socket ID (for backward compatibility)
          player = roomService.getPlayerBySocketId(socket.id);
        }

        if (!player) {
          socket.emit('error', { message: 'Player not found' });
          return;
        }

        const room = roomService.getRoom();
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Mark player as ready
        roomService.markPlayerReady(player.id);

        // Notify everyone about ready status update
        const readyCount = room.readyPlayers.size;
        const connectedCount = room.players.filter(p => p.connected).length;

        io.to(room.id).emit('player-ready-update', {
          playerId: player.id,
          playerName: player.name,
          readyCount,
          totalCount: connectedCount,
          readyPlayerIds: Array.from(room.readyPlayers)
        });

        console.log(`✅ ${player.name} is ready (${readyCount}/${connectedCount})`);

        // If all players are ready, proceed to next question
        if (roomService.areAllPlayersReady() && !room.isProcessingReady) {
          room.isProcessingReady = true; // Prevent duplicate processing
          console.log(`🎯 All players ready! Moving to next question`);

          // Clear ready state
          roomService.clearReadyPlayers();

          // Brief delay before proceeding
          setTimeout(() => {
            gameService.nextQuestion(room.id);

            if (room.state === 'question') {
              // More questions remaining
              setTimeout(() => {
                sendCurrentQuestion(io, room.id);
                room.isProcessingReady = false; // Reset flag after processing complete
              }, 1000);
            } else if (room.state === 'finished') {
              // Game finished
              const results = gameService.getFinalResults(room.id);
              io.to(room.id).emit('game-ended', results);
              console.log(`🏆 Game ended in room ${room.code}`);
              room.isProcessingReady = false; // Reset flag
            }
          }, 1000);
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error marking player ready:', error.message);
      }
    });

    // End game
    socket.on('end-game', () => {
      try {
        const room = roomService.getRoom();
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if this socket is the host
        if (socket.id !== room.hostId) {
          socket.emit('error', { message: 'Only host can end the game' });
          return;
        }

        gameService.endGame(room.id);
        io.to(room.id).emit('game-ended', { reason: 'Host ended the game' });

        console.log(`🛑 Game ended by host in room ${room.code}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error ending game:', error.message);
      }
    });

    // Kick player
    socket.on('kick-player', ({ playerId }: { playerId: string }) => {
      try {
        const room = roomService.getRoom();
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if this socket is the host
        if (socket.id !== room.hostId) {
          socket.emit('error', { message: 'Only host can kick players' });
          return;
        }

        const player = roomService.getPlayerById(playerId);
        if (!player) {
          socket.emit('error', { message: 'Player not found' });
          return;
        }

        // Remove player
        roomService.removePlayer(playerId);

        // Notify the kicked player
        io.to(player.socketId).emit('kicked', {
          message: 'You have been kicked by the host'
        });

        // Notify all remaining players
        io.to(room.id).emit('player-left', {
          playerId: player.id,
          playerName: player.name,
          players: room.players
        });

        console.log(`👢 ${player.name} was kicked from room ${room.code}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        console.error('❌ Error kicking player:', error.message);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      const player = roomService.getPlayerBySocketId(socket.id);
      if (player) {
        const room = roomService.getRoom();

        // Mark player as disconnected (don't remove)
        roomService.markPlayerDisconnected(socket.id);

        if (room) {
          // Notify others that player went offline
          io.to(room.id).emit('player-disconnected', {
            playerId: player.id,
            playerName: player.name,
            players: room.players
          });

          console.log(`⚠️  ${player.name} disconnected from room ${room.code} (marked offline)`);
        }
      }
    });
  });

  // Helper: Send current question to all players
  function sendCurrentQuestion(io: Server, roomId: string) {
    const room = roomService.getRoom();
    if (!room || room.id !== roomId) return;

    const question = gameService.getCurrentQuestion(room);
    if (!question) return;

    io.to(roomId).emit('question-started', {
      question,
      timeLimit: room.settings.timePerQuestion
    });

    console.log(`❓ Question ${question.questionNumber}/${question.totalQuestions}: ${question.text}`);

    // Automatically start answering phase after showing question briefly
    setTimeout(() => {
      gameService.startAnswering(roomId);
      io.to(roomId).emit('answering-started', {});

      // Submit bot answers
      const currentQ = room.questions[room.currentQuestionIndex];
      botService.submitBotAnswers(room, currentQ, (botId, answer) => {
        try {
          gameService.submitAnswer(room.id, botId, answer);
          console.log(`🤖 Bot ${room.players.find(p => p.id === botId)?.name} submitted: ${answer}`);

          // Check if all players have answered
          if (gameService.haveAllPlayersAnswered(room)) {
            console.log(`✅ All players answered, ending question`);
            endCurrentQuestion(io, room.id);
          }
        } catch (error) {
          console.error('❌ Error submitting bot answer:', error);
        }
      });
    }, 3000); // 3 second delay to show question before accepting answers
  }

  // Helper: End current question and send results
  function endCurrentQuestion(io: Server, roomId: string) {
    try {
      const results = gameService.endQuestion(roomId);
      io.to(roomId).emit('question-ended', results);

      console.log(`📊 Question ended. Winner: ${results.winner?.playerName || 'None'}`);

      // Make bots ready after a delay
      const room = roomService.getRoom();
      if (room) {
        botService.markBotsReady(room, (botId) => {
          roomService.markPlayerReady(botId);

          const readyCount = room.readyPlayers.size;
          const connectedCount = room.players.filter(p => p.connected).length;

          io.to(room.id).emit('player-ready-update', {
            playerId: botId,
            playerName: room.players.find(p => p.id === botId)?.name || 'Bot',
            readyCount,
            totalCount: connectedCount,
            readyPlayerIds: Array.from(room.readyPlayers)
          });

          // If all players are ready, proceed to next question
          if (roomService.areAllPlayersReady() && !room.isProcessingReady) {
            room.isProcessingReady = true; // Prevent duplicate processing
            console.log(`🎯 All players ready! Moving to next question`);

            roomService.clearReadyPlayers();

            setTimeout(() => {
              gameService.nextQuestion(room.id);

              if (room.state === 'question') {
                setTimeout(() => {
                  sendCurrentQuestion(io, room.id);
                  room.isProcessingReady = false; // Reset flag after processing complete
                }, 1000);
              } else if (room.state === 'finished') {
                const finalResults = gameService.getFinalResults(room.id);
                io.to(room.id).emit('game-ended', finalResults);
                console.log(`🏆 Game ended in room ${room.code}`);
                room.isProcessingReady = false; // Reset flag
              }
            }, 1000);
          }
        });
      }
    } catch (error: any) {
      console.error('❌ Error ending question:', error.message);
    }
  }
}
