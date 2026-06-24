import { create } from 'zustand';
import { Socket } from 'socket.io-client';
import { socketService } from '../services/socket';
import {
  Player,
  Question,
  GameSettings,
  GameState,
  RoundResult,
  FinalResults
} from '../types/game';

interface GameStore {
  // Connection state
  socket: Socket | null;
  connected: boolean;

  // Room state
  roomId: string | null;
  roomCode: string | null;
  joinUrl: string | null;

  // Player state
  playerId: string | null;
  playerName: string | null;
  isHost: boolean;
  adminId: string | null;

  // Game state
  gameState: GameState;
  players: Player[];
  settings: GameSettings;

  // Question state
  currentQuestion: Question | null;
  timeRemaining: number;
  hasAnswered: boolean;
  myAnswer: number | null;
  answeredPlayerIds: string[];

  // Results state
  roundResult: RoundResult | null;
  finalResults: FinalResults | null;
  readyPlayerIds: string[];
  readyCount: number;
  totalCount: number;

  // Notification (transient in-game messages)
  notification: string | null;

  // True after host's animation completes — enables ready buttons on players
  answerRevealed: boolean;

  // Actions
  connectSocket: () => void;
  createRoom: (playerName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  startGame: () => void;
  submitAnswer: (answer: number) => void;
  nextQuestion: () => void;
  markReady: () => void;
  addBots: (count: number) => void;
  removeBots: () => void;
  endGame: () => void;
  restartGame: () => void;
  reportQuestion: (questionId: string, questionText: string) => void;
  kickPlayer: (playerId: string) => void;
  reset: () => void;

  // Internal state setters
  setRoomCreated: (data: any) => void;
  setPlayerJoined: (data: any) => void;
  setSettingsUpdated: (settings: GameSettings) => void;
  setGameStarted: () => void;
  setQuestionStarted: (data: any) => void;
  setAnsweringStarted: () => void;
  setAnswerReceived: (data: any) => void;
  setQuestionEnded: (result: RoundResult) => void;
  setGameEnded: (results: FinalResults) => void;
  setPlayerLeft: (data: any) => void;
  setTimeRemaining: (time: number) => void;
  showNotification: (message: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  socket: null,
  connected: false,
  roomId: null,
  roomCode: null,
  joinUrl: null,
  playerId: null,
  playerName: null,
  isHost: false,
  adminId: null,
  gameState: 'waiting',
  players: [],
  settings: {
    questionCount: 10,
    difficulty: 'mixed',
    categoryFilter: 'mixed',
    timePerQuestion: 30
  },
  currentQuestion: null,
  timeRemaining: 0,
  hasAnswered: false,
  myAnswer: null,
  answeredPlayerIds: [],
  roundResult: null,
  finalResults: null,
  readyPlayerIds: [],
  readyCount: 0,
  totalCount: 0,
  notification: null,
  answerRevealed: false,

  // Connect to socket and setup listeners
  connectSocket: () => {
    const socket = socketService.connect();

    socket.on('connect', () => {
      set({ connected: true });
      // `connect` fires on the initial connection AND on every reconnection
      // (in socket.io v4 the `reconnect` event lives on the Manager, not the
      // socket, so a `socket.on('reconnect')` handler never fires). If we were
      // already in a room as a player, re-emit join-room so the server attaches
      // this new socket id to our existing player and restores game state.
      // On the very first connect roomCode/playerName are still null (joinRoom
      // hasn't run yet), so this only triggers on genuine reconnects.
      const { roomCode, playerName, isHost } = get();
      if (roomCode && isHost) {
        console.log('🔄 Host reconnected — re-attaching to room', roomCode);
        socket.emit('host-reconnect', { roomCode });
      } else if (roomCode && playerName) {
        console.log('🔄 Reconnected — rejoining room', roomCode);
        socket.emit('join-room', { roomCode, playerName });
      }
    });

    socket.on('disconnect', () => {
      set({ connected: false });
      console.log('⚠️  Connection lost, will attempt to reconnect...');
    });

    socket.on('room-created', (data) => {
      get().setRoomCreated(data);
    });

    // Host re-attached after a reconnect — restore lobby/game state. Any
    // in-progress screen (question/results) is restored by the follow-up events.
    socket.on('host-reconnected', (data) => {
      console.log('✅ Host re-attached to room', data.roomCode);
      set({
        connected: true,
        roomId: data.roomId,
        roomCode: data.roomCode,
        joinUrl: data.joinUrl,
        settings: data.settings,
        players: data.players,
        gameState: data.gameState || get().gameState,
        adminId: data.adminId ?? get().adminId
      });
    });

    socket.on('admin-changed', (data: { adminId: string | null }) => {
      set({ adminId: data.adminId });
    });

    // Room is genuinely gone (reaped after the grace period). Send the host home.
    socket.on('host-reconnect-failed', (data) => {
      console.warn('🚫 Host reconnect failed:', data?.message);
      window.location.href = '/';
    });

    // A player's view: the host display dropped. Informational only — the server
    // keeps the game running; the host has a grace period to come back.
    socket.on('host-disconnected', () => {
      get().showNotification('Host disconnected — reconnecting…');
    });

    socket.on('player-joined', (data) => {
      get().setPlayerJoined(data);
    });

    socket.on('settings-updated', (data) => {
      get().setSettingsUpdated(data.settings);
    });

    socket.on('game-started', () => {
      get().setGameStarted();
    });

    socket.on('question-started', (data) => {
      get().setQuestionStarted(data);
    });

    socket.on('answering-started', () => {
      get().setAnsweringStarted();
    });

    socket.on('answer-received', (data) => {
      get().setAnswerReceived(data);
    });

    socket.on('answer-already-submitted', () => {
      // Player reconnected after already submitting answer
      set({ hasAnswered: true });
      console.log('✅ You already submitted an answer for this question');
    });

    socket.on('question-ended', (result) => {
      get().setQuestionEnded(result);
    });

    socket.on('game-ended', (results) => {
      get().setGameEnded(results);
    });

    socket.on('player-left', (data) => {
      get().setPlayerLeft(data);
    });

    socket.on('player-ready-update', (data) => {
      set({
        readyPlayerIds: data.readyPlayerIds,
        readyCount: data.readyCount,
        totalCount: data.totalCount
      });
      console.log(`✅ ${data.playerName} is ready (${data.readyCount}/${data.totalCount})`);
    });

    socket.on('bots-added', (data) => {
      set({ players: data.players });
      console.log(`🤖 ${data.bots.length} bots added`);
    });

    socket.on('bots-removed', (data) => {
      set({ players: data.players });
      console.log(`🤖 All bots removed`);
    });

    socket.on('player-disconnected', (data) => {
      console.log(`⚠️  ${data.playerName} went offline`);
      set({ players: data.players });
      const { gameState } = get();
      if (gameState !== 'waiting') {
        get().showNotification(`${data.playerName} disconnected`);
      }
    });

    socket.on('answer-revealed', () => {
      set({ answerRevealed: true });
    });

    socket.on('game-restarted', (data) => {
      set({
        gameState: 'waiting',
        players: data.players,
        settings: data.settings,
        currentQuestion: null,
        roundResult: null,
        finalResults: null,
        hasAnswered: false,
        myAnswer: null,
        answeredPlayerIds: [],
        readyPlayerIds: [],
        readyCount: 0,
        totalCount: 0,
        timeRemaining: 0,
        answerRevealed: false
      });
    });

    socket.on('error', (error) => {
      console.error('Server error:', error.message);
      alert(error.message);
    });

    socket.on('kicked', (data) => {
      alert(data.message);
      // Clear stored name
      const roomCode = get().roomCode;
      if (roomCode) {
        localStorage.removeItem(`player_name_${roomCode}`);
      }
      // Redirect to landing page
      window.location.href = '/';
    });

    set({ socket });
  },

  // Create room
  createRoom: (playerName: string) => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('create-room', { playerName });
    set({ playerName, isHost: true });
  },

  // Join room
  joinRoom: (roomCode: string, playerName: string) => {
    const { socket } = get();
    if (!socket) return;

    // Store player name in localStorage for reconnection
    localStorage.setItem(`player_name_${roomCode}`, playerName);

    socket.emit('join-room', { roomCode, playerName });
    set({ playerName, roomCode, isHost: false });
  },

  // Update settings
  updateSettings: (newSettings: Partial<GameSettings>) => {
    const { socket, settings } = get();
    if (!socket) return;

    const updatedSettings = { ...settings, ...newSettings };
    socket.emit('update-settings', { settings: updatedSettings });
  },

  // Start game
  startGame: () => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('start-game');
  },

  // Submit answer
  submitAnswer: (answer: number) => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('submit-answer', { answer });
    set({ hasAnswered: true, myAnswer: answer });
  },

  // Next question
  nextQuestion: () => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('next-question');
    set({ hasAnswered: false, myAnswer: null, roundResult: null, readyPlayerIds: [], readyCount: 0, totalCount: 0 });
  },

  // Mark player ready for next question
  markReady: () => {
    const { socket, playerId } = get();
    if (!socket || !playerId) return;

    socket.emit('player-ready', { playerId });
  },

  // Add bots
  addBots: (count: number) => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('add-bots', { count });
  },

  // Remove bots
  removeBots: () => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('remove-bots');
  },

  // End game (clears room)
  endGame: () => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('end-game');
  },

  // Restart game (same room, reset to waiting)
  restartGame: () => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('restart-game');
  },

  // Report a bad question
  reportQuestion: (questionId: string, questionText: string) => {
    const { socket, playerName } = get();
    if (!socket) return;
    socket.emit('report-question', { questionId, questionText, playerName: playerName || 'Unknown' });
  },

  // Kick player
  kickPlayer: (playerId: string) => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('kick-player', { playerId });
  },

  // Reset store
  reset: () => {
    set({
      roomId: null,
      roomCode: null,
      joinUrl: null,
      playerId: null,
      playerName: null,
      isHost: false,
      adminId: null,
      gameState: 'waiting',
      players: [],
      settings: {
        questionCount: 10,
        difficulty: 'mixed',
        categoryFilter: 'mixed',
        timePerQuestion: 30
      },
      currentQuestion: null,
      timeRemaining: 0,
      hasAnswered: false,
      myAnswer: null,
      roundResult: null,
      finalResults: null
    });
  },

  // Socket event handlers
  setRoomCreated: (data) => {
    set({
      roomId: data.roomId,
      roomCode: data.roomCode,
      playerId: data.playerId,
      joinUrl: data.joinUrl,
      settings: data.settings,
      adminId: data.adminId ?? null
    });
  },

  setPlayerJoined: (data) => {
    if (data.playerId && !get().playerId) {
      // Fresh first-time join
      set({
        playerId: data.playerId,
        roomId: data.roomId,
        players: data.players,
        gameState: data.gameState || get().gameState,
        adminId: data.adminId ?? get().adminId
      });
    } else if (data.playerId) {
      // Our own reconnection — update players + game state from server
      set({
        players: data.players,
        gameState: data.gameState || get().gameState,
        adminId: data.adminId ?? get().adminId
      });
      console.log('✅ Reconnected to game in progress');
    } else {
      // Another player joined or reconnected
      set({ players: data.players, adminId: data.adminId ?? get().adminId });
      const { gameState } = get();
      if (data.reconnected && gameState !== 'waiting') {
        get().showNotification(`${data.player?.name} reconnected`);
        console.log(`🔄 ${data.player?.name} reconnected`);
      }
    }
  },

  setSettingsUpdated: (settings) => {
    set({ settings });
  },

  setGameStarted: () => {
    set({ gameState: 'question' });
  },

  setQuestionStarted: (data) => {
    set({
      gameState: 'question',
      currentQuestion: data.question,
      timeRemaining: data.timeLimit,
      hasAnswered: false,
      myAnswer: null,
      answeredPlayerIds: [],
      readyPlayerIds: [],
      readyCount: 0,
      totalCount: 0,
      answerRevealed: false
    });
  },

  setAnsweringStarted: () => {
    set({ gameState: 'answering', answeredPlayerIds: [] });
  },

  setAnswerReceived: (data) => {
    // Mark that a player has answered (could show who has answered)
    console.log('Answer received from:', data.playerId);
    set({
      answeredPlayerIds: [...get().answeredPlayerIds, data.playerId]
    });
  },

  setQuestionEnded: (result) => {
    set({
      gameState: 'results',
      roundResult: result,
      readyPlayerIds: [],
      readyCount: 0,
      totalCount: 0,
      // Update players with new scores
      players: get().players.map(p => {
        const playerResult = result.results.find(r => r.playerId === p.id);
        return playerResult ? { ...p, score: playerResult.totalScore } : p;
      })
    });
  },

  setGameEnded: (results) => {
    // Clear stored player name
    const roomCode = get().roomCode;
    if (roomCode) {
      localStorage.removeItem(`player_name_${roomCode}`);
    }

    set({
      gameState: 'finished',
      finalResults: results,
      players: results.leaderboard
    });
  },

  setPlayerLeft: (data) => {
    // Update players list from server (player already removed)
    set({ players: data.players });
  },

  setTimeRemaining: (time) => {
    set({ timeRemaining: time });
  },

  showNotification: (message: string) => {
    set({ notification: message });
    setTimeout(() => {
      // Only clear if still the same notification
      if (get().notification === message) {
        set({ notification: null });
      }
    }, 3000);
  }
}));
