import { Room, Player, GameSettings } from '../models/Game';
import { getRandomAvatar, releaseAvatar } from '../utils/avatars';

class RoomService {
  private activeRoom: Room | null = null;

  // Room code generation
  private generateRoomCode(): string {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
    const CODE_LENGTH = 6;
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    return code;
  }

  // Create a new room
  createRoom(hostName: string, hostSocketId: string): Room {
    // Block if game already in progress
    if (this.activeRoom) {
      throw new Error('Game already in progress');
    }

    const room: Room = {
      id: this.generateRoomId(),
      code: this.generateRoomCode(),
      hostId: hostSocketId, // Just store the socket ID, don't create a player
      players: [], // Host is NOT a player
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
      createdAt: new Date()
    };

    this.activeRoom = room;
    return room;
  }

  // Get active room
  getRoom(): Room | null {
    return this.activeRoom;
  }

  // Get room by code
  getRoomByCode(code: string): Room | null {
    if (this.activeRoom && this.activeRoom.code === code) {
      return this.activeRoom;
    }
    return null;
  }

  // Add player to room (only during waiting phase)
  addPlayer(roomCode: string, playerName: string, socketId: string): Player | null {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return null;
    }

    // Only allow new players in waiting phase
    if (room.state !== 'waiting') {
      throw new Error("Can't join game in progress");
    }

    // Check if room is full (max 10 players)
    if (room.players.length >= 10) {
      throw new Error('Room is full');
    }

    const player: Player = {
      id: this.generatePlayerId(),
      name: playerName,
      socketId,
      score: 0,
      isHost: false,
      connected: true,
      avatar: getRandomAvatar(),
      lastSeen: new Date()
    };

    room.players.push(player);
    return player;
  }

  // Remove player from room
  removePlayer(playerId: string): void {
    if (!this.activeRoom) return;

    const playerIndex = this.activeRoom.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      const player = this.activeRoom.players[playerIndex];

      // Release avatar back to pool
      releaseAvatar(player.avatar);

      this.activeRoom.players.splice(playerIndex, 1);

      // If no players left, clear the room
      if (this.activeRoom.players.length === 0) {
        this.clearRoom();
      }
    }
  }

  // Update player socket ID (for reconnection)
  updatePlayerSocketId(playerId: string, socketId: string): void {
    if (!this.activeRoom) return;

    const player = this.activeRoom.players.find(p => p.id === playerId);
    if (player) {
      player.socketId = socketId;
      player.connected = true;
    }
  }

  // Mark player as disconnected
  markPlayerDisconnected(socketId: string): void {
    if (!this.activeRoom) return;

    const player = this.activeRoom.players.find(p => p.socketId === socketId);
    if (player) {
      player.connected = false;
      player.lastSeen = new Date();
    }
  }

  // Reconnect a player (find by name and update socket ID)
  reconnectPlayer(roomCode: string, playerName: string, socketId: string): Player | null {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return null;
    }

    // Find existing player by name (allow reconnection during game)
    const player = room.players.find(p => p.name === playerName);
    if (!player) {
      return null;
    }

    // Update socket ID and mark as connected
    player.socketId = socketId;
    player.connected = true;
    player.lastSeen = new Date();

    return player;
  }

  // Check if player name already exists in room (for reconnection)
  isPlayerNameTaken(roomCode: string, playerName: string): boolean {
    const room = this.getRoomByCode(roomCode);
    if (!room) return false;

    return room.players.some(p => p.name === playerName);
  }

  // Get player by socket ID
  getPlayerBySocketId(socketId: string): Player | null {
    if (!this.activeRoom) return null;
    return this.activeRoom.players.find(p => p.socketId === socketId) || null;
  }

  // Get player by ID
  getPlayerById(playerId: string): Player | null {
    if (!this.activeRoom) return null;
    return this.activeRoom.players.find(p => p.id === playerId) || null;
  }

  // Update game settings
  updateSettings(settings: Partial<GameSettings>): void {
    if (!this.activeRoom) return;
    if (this.activeRoom.state !== 'waiting') {
      throw new Error('Cannot change settings after game has started');
    }
    this.activeRoom.settings = { ...this.activeRoom.settings, ...settings };
  }

  // Clear room (game ended)
  clearRoom(): void {
    this.activeRoom = null;
  }

  // Clean up players disconnected for more than 5 minutes
  cleanupDisconnectedPlayers(): void {
    if (!this.activeRoom) return;

    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = new Date();

    const playersToRemove: string[] = [];

    this.activeRoom.players.forEach(player => {
      if (!player.connected) {
        const timeSinceLastSeen = now.getTime() - player.lastSeen.getTime();
        if (timeSinceLastSeen > FIVE_MINUTES) {
          playersToRemove.push(player.id);
        }
      }
    });

    // Remove expired players
    playersToRemove.forEach(playerId => {
      const player = this.activeRoom?.players.find(p => p.id === playerId);
      if (player) {
        releaseAvatar(player.avatar);
        this.activeRoom!.players = this.activeRoom!.players.filter(p => p.id !== playerId);
      }
    });

    // If no players left, clear the room
    if (this.activeRoom && this.activeRoom.players.length === 0) {
      this.clearRoom();
    }
  }

  // Helper: Generate unique player ID
  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper: Generate unique room ID
  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const roomService = new RoomService();
