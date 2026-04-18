# Close Enough - Multiplayer Trivia Game

A local network multiplayer trivia game where players answer numeric questions and the closest answer wins!

## Features

- 🎮 Local network gameplay (no cloud needed)
- 📱 Mobile-friendly player interface
- 💻 Host controls from laptop/TV
- 🎯 Proximity-based scoring (closest wins, exact match = double points)
- ⚙️ Configurable game settings (question count, difficulty, time limits)
- 🏆 Real-time scoring and leaderboards
- ✅ QR code joining for easy mobile access

## Tech Stack

**Backend:**
- Node.js + TypeScript
- Express
- Socket.io
- In-memory storage (no database)

**Frontend:**
- React + TypeScript
- Vite
- React Router
- Zustand (state management)
- Socket.io client
- QR Code generation

## Setup

### Prerequisites
- Node.js (v18+)
- npm

### Installation

1. **Install server dependencies:**
```bash
cd server
npm install
```

2. **Install client dependencies:**
```bash
cd client
npm install
```

### Running the Game

1. **Start the server:**
```bash
cd server
npm run dev
```

The server will start on `http://localhost:3000` and display your local network IP.

2. **Start the client (in a new terminal):**
```bash
cd client
npm run dev
```

The client will start on `http://localhost:5173`.

### How to Play

1. **Host Setup:**
   - Open `http://localhost:5173` on your laptop
   - Click "Host a Game"
   - Enter your name
   - A QR code and room code will appear
   - Connect your laptop to a TV (optional) for better visibility
   - Configure game settings (question count, difficulty, time per question)

2. **Players Join:**
   - Players scan the QR code with their phones OR
   - Navigate to the game URL and enter the room code manually
   - Enter their name to join

3. **Start Game:**
   - Once all players have joined (minimum 2), the host clicks "Start Game"
   - Questions appear on the host screen (large format)
   - Players submit numeric answers on their phones within the time limit

4. **Scoring:**
   - **Easy questions:** 3 points (closest), 6 points (exact)
   - **Medium questions:** 5 points (closest), 10 points (exact)
   - **Hard questions:** 10 points (closest), 20 points (exact)

5. **Game End:**
   - After all questions, final leaderboard is shown
   - Host can end the game to start a new one

## Game Configurations

Host can choose from 8 different configurations:

**Default Options:**
- 10 questions (5 easy, 3 medium, 2 hard) - Mixed categories
- 5 questions (2 easy, 2 medium, 1 hard) - Mixed categories

**Single Difficulty Options:**
- 10 or 5 questions - all easy/medium/hard
- Mixed or single category

**Time Options:**
- 15, 30, 45, or 60 seconds per question

## Project Structure

```
close-enough/
├── server/
│   ├── src/
│   │   ├── index.ts              # Server entry point
│   │   ├── models/               # TypeScript interfaces
│   │   ├── services/             # Game logic services
│   │   ├── handlers/             # Socket.io event handlers
│   │   └── data/
│   │       └── questions.json    # Question bank
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.tsx               # Router setup
│   │   ├── pages/                # Landing, Host, Play pages
│   │   ├── components/           # Reusable UI components
│   │   ├── stores/               # Zustand state management
│   │   ├── services/             # Socket.io client
│   │   └── types/                # TypeScript interfaces
│   └── package.json
└── README.md
```

## Adding Questions

Edit `server/src/data/questions.json`:

```json
{
  "id": "unique_id",
  "categories": ["Category1", "Category2"],
  "difficulty": "easy|medium|hard",
  "text": "Your question here?",
  "correctAnswer": 42,
  "unit": "optional unit (e.g., 'years', 'km')"
}
```

## Troubleshooting

**Players can't join:**
- Ensure all devices are on the same WiFi network
- Check firewall settings (ports 3000 and 5173 need to be accessible)
- Use the local IP address shown in server console, not localhost

**QR code not working:**
- Try entering the room code manually
- Verify the server URL in the QR code is accessible from mobile devices

**Game state issues:**
- Refresh all client browsers
- Restart the server (only one game can run at a time)

## Development

**Server:**
- `npm run dev` - Development with hot reload
- `npm run build` - Build TypeScript
- `npm start` - Run production build

**Client:**
- `npm run dev` - Development with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Future Enhancements (Phase 2 & 3)

- Player reconnection handling
- Enhanced animations and sound effects
- Power-ups
- Custom question categories
- Spectator mode

## License

MIT
