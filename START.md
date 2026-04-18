# Quick Start Instructions

## Current Network Configuration
- Server IP: `192.168.10.9:3000`
- Client IP: `192.168.10.9:5173`

## To Start Playing:

### 1. Start the Client (Terminal 1)
```bash
cd client
npm run dev
```

### 2. Create a Game (Laptop)
1. Open `http://localhost:5173` in your laptop browser
2. Click "Create New Game"
3. Configure settings
4. QR code will display

### 3. Join from Phone
Scan the QR code - it should load: `http://192.168.10.9:5173/join/{CODE}`

**Important:** 
- Make sure your phone and laptop are on the same WiFi network
- The client server must be accessible at `192.168.10.9:5173`
- If your IP changes, update `client/.env` file with new IP

## Troubleshooting

If QR code still doesn't work:
1. Check firewall settings (allow port 5173)
2. Manually type the URL on your phone: `http://192.168.10.9:5173/join/{CODE}`
3. Verify you can access `http://192.168.10.9:5173` from your phone's browser

The server is already running! Just start the client and test.
