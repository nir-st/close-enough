import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import './utils/logger';
import { setupSocketHandlers } from './handlers/socketHandlers';
import { config } from './config';
import { roomService } from './services/RoomService';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.isProduction ? (config.APP_URL || false) : '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  upgradeTimeout: 30000
});

app.use(helmet({ contentSecurityPolicy: false })); // CSP off — we serve our own SPA assets
app.use(cors({ origin: config.isProduction ? (config.APP_URL || false) : '*' }));
app.use(express.json());

// HTTP rate limiting
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

// ── Local IP detection (used for QR codes in local mode) ─────────────────────
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) return alias.address;
    }
  }
  return 'localhost';
}

export const localIP = getLocalIP();

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const mem = process.memoryUsage();
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  res.json({
    status: 'ok',
    rooms: roomService.getRoomCount(),
    activePlayers: roomService.getTotalPlayerCount(),
    uptime: Math.floor(process.uptime()),
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    localIP,
    port: config.PORT,
    clientDist,
    clientDistExists: require('fs').existsSync(clientDist),
    indexExists: require('fs').existsSync(path.join(clientDist, 'index.html'))
  });
});

// ── Static client (production only) ──────────────────────────────────────────
if (config.isProduction) {
  // server/dist is two levels below the repo root; client/dist is at repo root level
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));

  // React Router catch-all — must come AFTER /health and socket.io
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Socket.io ─────────────────────────────────────────────────────────────────
setupSocketHandlers(io);

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(config.PORT, () => {
  console.log('\n🎮 Close Enough Server Running!');
  console.log('================================');
  if (config.isProduction) {
    console.log(`Production: ${config.APP_URL || `port ${config.PORT}`}`);
  } else {
    console.log(`Local:   http://localhost:${config.PORT}`);
    console.log(`Network: http://${localIP}:${config.PORT}`);
  }
  console.log('================================\n');
});

export { io };
