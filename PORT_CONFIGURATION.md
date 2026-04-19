# Port Configuration Summary

## Current Setup (Fixed)

### Backend Server
- **Port:** 3000
- **Config:** `server/.env` → `PORT=3000`
- **Code:** `server/src/index.ts` → `const PORT = process.env.PORT || 3000`
- **Purpose:** Handles Socket.IO connections and game logic

### Frontend Client (Vite Dev Server)
- **Port:** 5173
- **Config:** `client/vite.config.ts` → `port: 5173`
- **Config:** `server/.env` → `CLIENT_PORT=5173`
- **Purpose:** Serves React application to browsers

### Socket Connection
- **Client → Server:** Port 3000
- **Config:** `client/.env` → `VITE_SERVER_URL=http://192.168.10.10:3000`
- **Code:** `client/src/services/socket.ts` → Uses VITE_SERVER_URL

### QR Code URL
- **Generated URL:** `http://192.168.10.10:5173/join/{roomCode}`
- **Code:** `server/src/handlers/socketHandlers.ts:19-20`
- Uses `CLIENT_PORT` from server/.env (defaults to 5173)

## How It Works

1. **Host opens laptop browser:**
   - Navigates to `http://localhost:5173` or `http://192.168.10.10:5173`
   - React app loads from Vite dev server (port 5173)
   - Socket.IO client connects to backend (port 3000)
   - Creates room, QR code generated with port 5173

2. **Player scans QR code on phone:**
   - QR code contains: `http://192.168.10.10:5173/join/{roomCode}`
   - Phone loads React app from Vite dev server (port 5173)
   - Socket.IO client connects to backend (port 3000)
   - Joins room via socket connection

## Important Notes

✅ **Both ports must be accessible from mobile devices:**
- Port 5173: For loading the React app (Vite dev server)
- Port 3000: For Socket.IO real-time communication

✅ **Firewall settings:**
- Allow inbound connections on ports 3000 and 5173
- Ensure laptop and phone are on the same WiFi network

✅ **After changing .env files:**
- Always restart the server: `cd server && npm run dev`
- Always restart the client: `cd client && npm run dev`

## Troubleshooting

**"Reconnecting" message on phone:**
- Check if port 3000 is accessible: `http://192.168.10.10:3000/health`
- Check firewall settings
- Verify both devices on same network

**QR code shows wrong port:**
- Check `server/.env` → `CLIENT_PORT=5173`
- Restart the server

**Can't load page from QR code:**
- Check if port 5173 is accessible: `http://192.168.10.10:5173`
- Verify Vite dev server is running
- Check `client/vite.config.ts` has `host: true`
