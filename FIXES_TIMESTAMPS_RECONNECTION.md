# Fixes for Timestamps and Phone Reconnection

## Fix 1: Add Timestamps to Logs

### Create new file: `server/src/utils/logger.ts`
```typescript
// Helper function to get formatted timestamp
export function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `[${hours}:${minutes}:${seconds}.${ms}]`;
}

// Wrap console.log to add timestamps
const originalLog = console.log;
console.log = function(...args: any[]) {
  originalLog(getTimestamp(), ...args);
};

const originalError = console.error;
console.error = function(...args: any[]) {
  originalError(getTimestamp(), ...args);
};

const originalWarn = console.warn;
console.warn = function(...args: any[]) {
  originalWarn(getTimestamp(), ...args);
};
```

### Update `server/src/index.ts` - Add import at the top:
```typescript
import './utils/logger'; // Add this line after other imports
```

### Update Socket.io config in `server/src/index.ts`:
Change:
```typescript
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
```

To:
```typescript
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000, // Send ping every 10 seconds
  pingTimeout: 5000,   // Wait 5 seconds for pong response
  upgradeTimeout: 30000 // Allow 30 seconds for connection upgrade
});
```

## Fix 2: Phone Reconnection

### Update `client/src/services/socket.ts`:
Replace the entire `connect()` method with:
```typescript
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
```

### Update `client/src/stores/gameStore.ts`:
Find:
```typescript
socket.on('disconnect', () => {
  set({ connected: false });
});
```

Replace with:
```typescript
socket.on('disconnect', () => {
  set({ connected: false });
  console.log('⚠️  Connection lost, will attempt to reconnect...');
});

socket.on('reconnect', () => {
  set({ connected: true });
  console.log('✅ Reconnected successfully!');
});
```

### Update `client/src/pages/Play.tsx`:
1. Add `connected` to the destructured values (around line 19):
```typescript
const {
  connectSocket,
  joinRoom,
  gameState,
  playerName,
  currentQuestion,
  hasAnswered,
  submitAnswer,
  roundResult,
  finalResults,
  players,
  playerId,
  connected  // Add this
} = useGameStore();
```

2. Add reconnection banner in the return statement (around line 47):
```typescript
return (
  <div className="play-container">
    {!connected && (
      <div className="connection-lost-banner">
        🔄 Reconnecting...
      </div>
    )}

    <div className="play-header">
      // ... rest of code
```

### Update `client/src/pages/Play.css`:
Add at the top:
```css
.play-container {
  min-height: 100vh;
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
  position: relative;
}

.connection-lost-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #ed8936;
  color: white;
  text-align: center;
  padding: 12px;
  font-weight: 600;
  z-index: 1000;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

## After Applying Changes

**Restart both server and client!**

Now you should have:
✅ Timestamps in all server logs: `[12:34:56.789] 🔌 Client connected: xyz...`
✅ Phone stays connected even when screen turns off
✅ Visual "🔄 Reconnecting..." banner when connection is lost
✅ Automatic reconnection with infinite retries
