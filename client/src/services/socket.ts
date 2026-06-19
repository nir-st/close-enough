import { io, Socket } from 'socket.io-client';

// Resolve the Socket.io server URL:
// 1. Explicit override via VITE_SERVER_URL (used for custom dev setups).
// 2. Production: same origin as the page (Railway serves client + server together,
//    so window.location.origin is correct — https + the right port automatically).
// 3. Local dev: the page is served by Vite on :5173, but the server runs on :3000,
//    so target the same host on :3000 (works for localhost and LAN mobile testing).
const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD
    ? window.location.origin
    : `http://${window.location.hostname}:3000`);

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // Keep trying to reconnect
        timeout: 20000,
        forceNew: false,
        autoConnect: true
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to server');
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from server:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected, manually reconnect
          this.socket?.connect();
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected to server after', attemptNumber, 'attempts');
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Reconnection attempt', attemptNumber);
      });

      this.socket.on('error', (error: any) => {
        console.error('Socket error:', error);
      });
    }

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
