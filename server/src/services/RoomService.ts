import { Room, Player, GameSettings } from '../models/Game';
import { getRandomAvatar, releaseAvatar } from '../utils/avatars';

class RoomService {
  private rooms: Map<string, Room> = new Map();

  // ─── Room lifecycle ────────────────────────────────────────────────────────

  createRoom(hostName: string, hostSocketId: string): Room {
    const code = this.generateUniqueCode();
    const room: Room = {
      id: this.generateRoomId(),
      code,
      hostId: hostSocketId,
      players: [],
      state: 'waiting',
      settings: {
        questionCount: 10,
        difficulty: 'mixed',
        categoryFilter: 'mixed',
        timePerQuestion: 30
      },
      currentQuestionIndex: 0,
      questions: [],
      answers: new Map(),
      readyPlayers: new Set(),
      isProcessingReady: false,
      answerRevealed: false,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.rooms.set(code, room);
    return room;
  }

  getRoom(roomCode: string): Room | null {
    return this.rooms.get(roomCode) || null;
  }

  // Alias kept for call sites that use it
  getRoomByCode(code: string): Room | null {
    return this.rooms.get(code) || null;
  }

  deleteRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.players.forEach(p => releaseAvatar(p.avatar));
      this.rooms.delete(roomCode);
    }
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getTotalPlayerCount(): number {
    let count = 0;
    this.rooms.forEach(r => { count += r.players.filter(p => p.connected).length; });
    return count;
  }

  touch(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) room.lastActivity = new Date();
  }

  // ─── Player management ────────────────────────────────────────────────────

  addPlayer(roomCode: string, playerName: string, socketId: string): Player | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    if (room.state !== 'waiting') throw new Error("Can't join game in progress");
    if (room.players.length >= 10) throw new Error('Room is full');

    const player: Player = {
      id: this.generatePlayerId(),
      name: playerName,
      socketId,
      score: 0,
      isHost: false,
      connected: true,
      avatar: getRandomAvatar(),
      lastSeen: new Date(),
      isBot: false
    };

    room.players.push(player);
    room.lastActivity = new Date();
    return player;
  }

  removePlayer(playerId: string, roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const index = room.players.findIndex(p => p.id === playerId);
    if (index === -1) return;

    releaseAvatar(room.players[index].avatar);
    room.players.splice(index, 1);

    if (room.players.length === 0) {
      this.deleteRoom(roomCode);
    }
  }

  reconnectPlayer(roomCode: string, playerName: string, socketId: string): Player | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.name === playerName);
    if (!player) return null;

    player.socketId = socketId;
    player.connected = true;
    player.lastSeen = new Date();
    room.lastActivity = new Date();
    return player;
  }

  isPlayerNameTaken(roomCode: string, playerName: string): boolean {
    const room = this.rooms.get(roomCode);
    return room ? room.players.some(p => p.name === playerName) : false;
  }

  getPlayerBySocketId(socketId: string, roomCode: string): Player | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return room.players.find(p => p.socketId === socketId) || null;
  }

  getPlayerById(playerId: string, roomCode: string): Player | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return room.players.find(p => p.id === playerId) || null;
  }

  updatePlayerSocketId(playerId: string, socketId: string, roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.socketId = socketId;
      player.connected = true;
    }
  }

  markPlayerDisconnected(socketId: string, roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socketId);
    if (player) {
      player.connected = false;
      player.lastSeen = new Date();
    }
  }

  // ─── Settings & state ─────────────────────────────────────────────────────

  updateSettings(settings: Partial<GameSettings>, roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    if (room.state !== 'waiting') throw new Error('Cannot change settings after game has started');
    room.settings = { ...room.settings, ...settings };
    room.lastActivity = new Date();
  }

  markPlayerReady(playerId: string, roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) room.readyPlayers.add(playerId);
  }

  areAllPlayersReady(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    const connected = room.players.filter(p => p.connected);
    return connected.length > 0 && connected.every(p => room.readyPlayers.has(p.id));
  }

  clearReadyPlayers(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.readyPlayers.clear();
      room.answerRevealed = false;
    }
  }

  restartGame(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.state = 'waiting';
    room.currentQuestionIndex = 0;
    room.questions = [];
    room.answers.clear();
    room.readyPlayers.clear();
    room.isProcessingReady = false;
    room.questionStartTime = undefined;
    room.lastRoundResult = undefined;
    room.answerRevealed = false;
    room.lastActivity = new Date();

    room.players.forEach(p => { p.score = 0; });
  }

  // ─── Bots ──────────────────────────────────────────────────────────────────

  addBots(count: number, roomCode: string): Player[] {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    if (room.state !== 'waiting') throw new Error("Can't add bots after game has started");

    const botNames = [
      'Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Epsilon',
      'Bot Zeta', 'Bot Eta', 'Bot Theta', 'Bot Iota', 'Bot Kappa'
    ];

    const bots: Player[] = [];
    const slots = 10 - room.players.length;
    const toAdd = Math.min(count, slots, botNames.length);

    for (let i = 0; i < toAdd; i++) {
      const bot: Player = {
        id: this.generatePlayerId(),
        name: botNames[i],
        socketId: 'bot',
        score: 0,
        isHost: false,
        connected: true,
        avatar: getRandomAvatar(),
        lastSeen: new Date(),
        isBot: true
      };
      room.players.push(bot);
      bots.push(bot);
    }

    return bots;
  }

  removeBots(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const bots = room.players.filter(p => p.isBot);
    bots.forEach(b => releaseAvatar(b.avatar));
    room.players = room.players.filter(p => !p.isBot);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  // Called every 60s — removes players gone > 5 min, deletes empty rooms
  cleanupDisconnectedPlayers(): void {
    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = Date.now();

    for (const [code, room] of this.rooms) {
      const stale = room.players.filter(
        p => !p.connected && now - p.lastSeen.getTime() > FIVE_MINUTES
      );
      stale.forEach(p => {
        releaseAvatar(p.avatar);
        room.players = room.players.filter(q => q.id !== p.id);
      });

      if (room.players.length === 0) {
        this.rooms.delete(code);
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private generateUniqueCode(): string {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const roomService = new RoomService();
