import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import './utils/logger'; // Import logger to enable timestamps
import { setupSocketHandlers } from './handlers/socketHandlers';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for local network
    methods: ['GET', 'POST']
  },
  pingInterval: 10000, // Send ping every 10 seconds
  pingTimeout: 5000,   // Wait 5 seconds for pong response
  upgradeTimeout: 30000 // Allow 30 seconds for connection upgrade
});

// Middleware
app.use(cors());
app.use(express.json());

// Get local IP address for QR code generation
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const alias of iface) {
      // Skip internal and non-IPv4 addresses
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    localIP,
    port: PORT
  });
});

// Setup Socket.io handlers
setupSocketHandlers(io);

// Start server
httpServer.listen(PORT, () => {
  console.log('\n🎮 Close Enough Server Running!');
  console.log('================================');
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://${localIP}:${PORT}`);
  console.log('================================\n');
});

export { io, localIP };
