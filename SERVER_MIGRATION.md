# Server Migration Plan — Close Enough

A comprehensive plan for migrating from a local-WiFi-only setup to a
production cloud server, with Google Cast SDK support and full robustness.

---

## Context & Goals

**Current setup:** Node.js server runs on a laptop. Players connect via QR
code on the same WiFi. Host screen is displayed on the laptop.

**Target setup:**
- Server runs in the cloud (Railway or Render)
- Any phone opens the web app, taps a Cast button, and the TV becomes the
  host screen — independently, no tab needs to stay open
- All phones (including the one that cast) join as players
- Local mode is preserved for development and offline use
- The system is secure, configurable, and handles multiple simultaneous games

---

## Phase 1 — Multiple Simultaneous Games

**This is the biggest code change and must be done first.**

### Problem
`RoomService` has a single `private activeRoom: Room | null`. The entire
server can only host one game at a time.

### Changes

**RoomService**
- Replace `activeRoom` with `private rooms: Map<roomCode, Room>`
- All methods that currently take no args now receive `roomCode`
- `getRoom(roomCode)` replaces `getRoom()`
- `clearRoom()` becomes `deleteRoom(roomCode)`
- Add `getRoomCount()` for monitoring
- Add `lastActivity: Date` field to Room, updated on every significant event

**Socket Handlers**
- Tag each socket when it joins a room: `socket.data.roomCode = room.code`
- Add helper: `getRoomForSocket(socket)` → looks up room via `socket.data.roomCode`
- Every handler that calls `roomService.getRoom()` (currently no-arg) is
  updated to use `getRoomForSocket(socket)` instead
- GameService / ScoreService / BotService: no changes needed — they already
  receive a Room object

**Room cleanup rules**
- Destroyed when: all players disconnected for > `PLAYER_DISCONNECT_GRACE_MINUTES`
- Destroyed when: TTL exceeded (see Phase 5)
- Destroyed when: host disconnects and no players remain

---

## Phase 2 — Server Serves the Client (Deployment Prerequisite)

### Changes

**Express static serving**
- Server serves `client/dist/` as static files
- Catch-all route: all unknown paths return `index.html` (React Router support)
- Result: one deployment artifact, one thing to run

**Build pipeline**
- Root `package.json` with a `build` script:
  1. `npm install` in both `client/` and `server/`
  2. `vite build` in `client/` → outputs to `client/dist/`
  3. `tsc` in `server/` → outputs to `server/dist/`
- `npm start` runs `node server/dist/index.js`
- Local dev unchanged: run `server/` and `client/` dev servers separately

**QR code / join URL fix**
- Currently generates `http://192.168.x.x:5173/join/...`
- In production: use `APP_URL` env var → `https://yourdomain.com/join/...`
- In local mode: keep current IP detection behavior
- Detection: `if (process.env.APP_URL) use it; else detect local IP`

**Local mode preservation**
- `LOCAL_MODE=true` env var keeps current behavior (local IP, no HTTPS)
- The existing local `.env` file in `client/` stays as-is
- Developers run locally exactly as they do today

---

## Phase 3 — Security

### Input Validation (server-side, trust nothing from client)

All validation happens in socket handlers before any logic runs:

| Input | Rule |
|---|---|
| Player name | Non-empty after trim, max 30 chars |
| Room code | Must match `/^[A-Z2-9]{6}$/` exactly |
| Answer value | Must be a finite number, within −10¹⁵ to 10¹⁵ |
| Settings values | Whitelist: questionCount ∈ {5,10}, difficulty ∈ allowed set, etc. |
| Report text | Max 500 chars, rate-limited per player |

### HTTP Rate Limiting (`express-rate-limit` package)

| Endpoint | Limit |
|---|---|
| General | 200 requests / minute / IP |
| Room creation | 5 rooms / 15 minutes / IP |

### Socket.io Rate Limiting (custom middleware)

| Event | Limit |
|---|---|
| `create-room` | 5 / 15 min / IP |
| `join-room` | 10 / minute / IP |
| `submit-answer` | 1 / question / player (enforced by game state too) |
| `report-question` | 3 / game / player |
| Any event | 60 events / 10 sec / socket (generic guard) |

### CORS

- Production: only allow requests from `APP_URL`
- Local mode: allow `*` (current behavior)

### HTTP Security Headers

- Add `helmet.js` — one line, prevents XSS, clickjacking, content sniffing, etc.

### What We Don't Need

- User authentication — the room code is the access control. Codes are
  unguessable enough for a party game.
- HTTPS certificate management — Railway/Render handle this automatically.

---

## Phase 4 — Deploy to Railway

### Steps

1. Push repo to GitHub (already there)
2. Create account at railway.app
3. New project → "Deploy from GitHub repo" → select the repo
4. Set environment variables in Railway dashboard (see below)
5. Railway auto-deploys on every push to `main`
6. Add a custom domain (optional, Railway provides a free `.railway.app` subdomain)

### Environment Variables

```
NODE_ENV=production
PORT=3000                          # Railway sets this automatically
APP_URL=https://yourdomain.com     # Your Railway subdomain or custom domain

# Game limits
MAX_ROOMS=100
MAX_PLAYERS_PER_ROOM=10
MAX_ROOMS_PER_IP=3
ROOM_TTL_MINUTES=120

# Rate limits
RATE_LIMIT_ROOM_CREATE_PER_15MIN=5
RATE_LIMIT_JOIN_PER_MIN=10
RATE_LIMIT_SOCKET_EVENTS_PER_10SEC=60

# Player lifecycle
PLAYER_DISCONNECT_GRACE_MINUTES=5
```

All values have sensible hardcoded defaults so nothing breaks if a variable
is missing.

---

## Phase 5 — Robustness & Monitoring

### Room TTL and Idle Detection

- `room.lastActivity` timestamp updated on: player join, answer submitted,
  game start, any host action
- Background job every 5 minutes: expire rooms idle > `ROOM_TTL_MINUTES`
- On expiry: broadcast `game-ended` with reason "Session expired", then delete room
- Players see a user-friendly message and can start a new game

### Graceful Shutdown

- Listen for `SIGTERM` (sent by Railway before killing the process)
- Broadcast "server restarting in a moment" to all active rooms
- Stop accepting new connections
- Allow 5 seconds for existing connections to drain
- Then exit cleanly

### Health Endpoint (expand existing `/health`)

```json
{
  "status": "ok",
  "rooms": 12,
  "activePlayers": 47,
  "uptime": 3600,
  "memoryMB": 142,
  "version": "1.0.0"
}
```

Use this for uptime monitoring (UptimeRobot free tier pings it every 5 min).

### Logging

- Structured log lines with: timestamp, room code, event type, player count
- Railway captures stdout — no extra setup needed
- Log on: room created/destroyed, game started/ended, errors
- Never log player names in error paths (basic privacy)

### Error Handling

- All socket handlers already wrapped in try/catch — keep this
- Add global `process.on('uncaughtException')` handler: log the error, but
  do not crash (a single bad socket event should never take down the server)
- Socket errors are caught per-connection and never propagate upward

---

## Phase 6 — Google Cast SDK

**Requires a deployed server (Phase 4) before starting this phase.**

### How It Works

The Chromecast has its own Chrome browser. When you initiate a cast, it
loads a URL on the Chromecast — the "Cast Receiver" page. That page runs
independently on the TV. The phone that started the cast is the "sender" —
it can exchange messages with the receiver but doesn't need to keep a tab
open or stay on the page.

### Registration

1. Go to [cast.google.com/publish](https://cast.google.com/publish)
2. Register a new Styled Media Receiver (or Custom Receiver)
3. Set Receiver URL to `https://yourdomain.com/cast`
4. Get an App ID (e.g. `AB12CD34`)
5. Register test devices for immediate dev/test access
   (Production approval takes ~3 days)
6. Store App ID in env var: `CAST_APP_ID=AB12CD34`

### What Gets Built

**Cast Receiver page** (`/cast` route in React)
- The existing host page, with Cast Receiver SDK initialized on mount
- When the Chromecast loads this page:
  1. It connects to the game server as the host socket
  2. Creates a room automatically
  3. Shows the QR code and waiting screen (normal host UI)
  4. Sends the room code back to the sender phone via Cast messaging channel

**Cast Sender** (added to the main web app)
- Google provides a `<google-cast-launcher>` web component — drop it in
  and the familiar cast icon appears automatically
- Add the Cast SDK script to `index.html`
- When the user taps cast:
  1. SDK discovers Chromecast devices on the network
  2. Connects and tells the Chromecast to load the receiver URL
  3. Receiver creates a room and sends back the room code
  4. Sender phone automatically navigates to the join URL
  5. Phone is now a player — can be locked or used for other things
- Cast button is automatically hidden if no Cast devices are available

**Start Game flow**
- The first player to join sees a "Start Game" button (or it appears after
  enough players join)
- Alternatively: TV remote can interact with the host screen for the
  one-time Start action
- After game starts: everything is automatic (player-ready system,
  auto-advance, animations) — no further interaction with the TV needed

### Non-Cast Fallback

- If no Chromecast available: current flow works as-is (laptop + browser,
  or Smart TV browser, or AirPlay screen mirroring)
- Cast button simply doesn't appear if Cast SDK finds no devices
- No degradation for non-Cast users

### Full Cast User Flow (Production)

```
1. Open closenough.app on phone
2. Tap cast icon → pick TV from list (takes ~2 seconds)
3. TV loads independently, creates a room, shows QR code
4. Phone automatically joins as a player
5. Share QR code or room code with other players
6. Everyone joins → tap Start Game
7. TV shows questions, animations, scores — completely on its own
8. All phones are players, no phone needs to stay on any particular screen
```

---

## Horizontal Scaling (Future, If Needed)

The current in-memory room store works perfectly for a single server
instance and will handle hundreds of concurrent players comfortably.

If load ever justifies multiple server instances:
- Switch room store from `Map<roomCode, Room>` to **Redis**
- Add the Socket.io Redis adapter for cross-instance broadcasting
- This is a well-understood pattern and a clean migration because the room
  store is behind the `RoomService` interface

Design the `RoomService` interface cleanly now so the backing store can be
swapped without touching any socket handler code.

---

## Recommended Order of Work

```
Phase 1 — Multiple rooms            Biggest refactor, unblocks everything
Phase 2 — Static serving + build    Prerequisite for deployment
Phase 3 — Security basics           Must be done before going public
Phase 4 — Deploy to Railway         Get it live
Phase 5 — Robustness + monitoring   TTL, health check, graceful shutdown
Phase 6 — Google Cast SDK           Requires live server; register app first
                                    (3-day approval) while doing Phases 1-5
```

Phases 1–4: ~1–2 days of focused work
Phase 5: a few hours
Phase 6: ~half a day of code + Cast registration/approval wait

---

## Files That Will Change

| File | What Changes |
|---|---|
| `server/src/services/RoomService.ts` | Map of rooms instead of single room |
| `server/src/handlers/socketHandlers.ts` | Use `getRoomForSocket()`, add rate limiting, add `reveal-done` room routing |
| `server/src/index.ts` | Static file serving, security middleware, env config |
| `server/src/models/Game.ts` | Add `lastActivity` to Room |
| `client/src/services/socket.ts` | Cast SDK integration (Phase 6) |
| `client/src/pages/Landing.tsx` | Cast button (Phase 6) |
| `client/src/App.tsx` | Add `/cast` route (Phase 6) |
| `package.json` (root, new) | Root build + start scripts |

New files:
| File | Purpose |
|---|---|
| `server/src/config.ts` | Centralised env-var config with defaults |
| `server/src/middleware/rateLimiter.ts` | HTTP + socket rate limiting |
| `railway.toml` | Railway deployment config |
| `client/src/pages/CastReceiver.tsx` | Cast receiver page (Phase 6) |
