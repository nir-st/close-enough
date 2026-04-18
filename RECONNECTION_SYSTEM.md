# Reconnection System Implementation

## Summary

Implemented a robust reconnection system that:
- **Marks players as offline** instead of removing them when they disconnect
- **Automatically reconnects** players using their stored name
- **Handles mid-game disconnections** gracefully
- **Cleans up** players who are offline for more than 5 minutes
- **Only removes players** when kicked by host or after 5 minutes of being offline

## How It Works

### 1. Disconnect Behavior (OLD vs NEW)

**OLD Behavior:**
- Player disconnects → immediately removed from room
- All other players notified with `player-left`
- Player's avatar released back to pool
- Reconnection impossible (room not found or new player created)

**NEW Behavior:**
- Player disconnects → marked as `connected: false`
- `lastSeen` timestamp updated
- All other players notified with `player-disconnected`
- Player stays in room with avatar reserved
- Can reconnect anytime within 5 minutes

### 2. Reconnection Flow

**Client Side:**
1. When player joins room, their name is stored in `localStorage` with key `player_name_${roomCode}`
2. If player disconnects and reopens browser:
   - Client checks for stored name
   - If found, automatically reconnects without prompting
   - If not found (first time), prompts for name

**Server Side:**
1. Server receives `join-room` with `playerName`
2. Checks if `playerName` already exists in room (`isPlayerNameTaken`)
3. If exists → calls `reconnectPlayer()`:
   - Updates `socketId` to new connection
   - Marks `connected: true`
   - Updates `lastSeen` timestamp
   - Sends back existing player data with all their progress
4. If doesn't exist → creates new player (only in waiting phase)

### 3. Mid-Game Reconnection

When a player reconnects during an active game:
- Server sends current game state via `player-joined` event with `reconnected: true`
- If in question/answering phase → sends current question
- If in results phase → will see results when question ends
- Player's score and avatar are preserved
- Can continue playing from where they left off

### 4. Cleanup System

A periodic job runs every 60 seconds checking for stale disconnections:
- Finds all disconnected players
- Checks if they've been offline for more than 5 minutes
- If yes → removes player and releases avatar
- If room becomes empty → clears the room

### 5. LocalStorage Management

Player name is stored when:
- Player first joins a room

Player name is cleared when:
- Player is kicked by host
- Game ends (finished state)
- Player explicitly leaves

This ensures:
- Seamless reconnection after accidental disconnects
- Clean slate for new games
- No stale data after being kicked

## Files Changed

### Server Files

1. **server/src/models/Game.ts**
   - Added `lastSeen: Date` to Player interface

2. **server/src/services/RoomService.ts**
   - Updated `addPlayer()` - adds `lastSeen` timestamp
   - Updated `markPlayerDisconnected()` - sets `connected: false` and updates `lastSeen`
   - Added `reconnectPlayer()` - finds player by name and updates socket
   - Added `isPlayerNameTaken()` - checks if player name exists in room
   - Added `cleanupDisconnectedPlayers()` - removes players offline >5 min

3. **server/src/handlers/socketHandlers.ts**
   - Added periodic cleanup job (every 60s)
   - Updated `join-room` handler:
     - Checks for existing player (reconnection)
     - Calls `reconnectPlayer()` or `addPlayer()` accordingly
     - Sends current game state for mid-game reconnections
     - Emits `reconnected: true` flag
   - Updated `disconnect` handler:
     - Calls `markPlayerDisconnected()` instead of `removePlayer()`
     - Emits `player-disconnected` instead of `player-left`

### Client Files

1. **client/src/stores/gameStore.ts**
   - Updated `joinRoom()` - stores player name in localStorage
   - Updated `setPlayerJoined()` - handles `reconnected` flag and restores game state
   - Added `player-disconnected` event listener
   - Updated `kicked` handler - clears localStorage
   - Updated `setGameEnded()` - clears localStorage

2. **client/src/pages/Play.tsx**
   - Updated join logic:
     - Checks localStorage for stored name first
     - Auto-reconnects if name found
     - Only prompts if no stored name

3. **client/src/components/PlayerList.tsx**
   - Changed offline badge text from "Offline" to "Reconnecting..."

4. **client/src/components/PlayerList.css**
   - Updated `.disconnected` styling (70% opacity instead of 50%)
   - Added pulsing animation to "Reconnecting..." badge

## Testing Scenarios

### Scenario 1: Phone Screen Goes Off (Main Issue)
1. Player joins on phone
2. Screen turns off → player disconnected
3. Screen turns back on → browser still open
4. **Expected:** Player automatically reconnects, sees current game state
5. **Result:** Player shows as "Reconnecting..." briefly, then back to normal

### Scenario 2: Browser Closed and Reopened
1. Player joins on phone
2. Close browser completely
3. Reopen browser and go back to game URL
4. **Expected:** Auto-reconnects without name prompt
5. **Result:** Seamlessly rejoins with same score and avatar

### Scenario 3: Mid-Game Disconnect
1. Player submits answer
2. Connection lost
3. Question ends and results show
4. Player reconnects during results phase
5. **Expected:** Sees results, can continue to next question
6. **Result:** All scores preserved, game continues normally

### Scenario 4: Long Disconnect (>5 min)
1. Player disconnects
2. Wait 5+ minutes
3. Try to reconnect
4. **Expected:** Player removed from room, must join as new player
5. **Result:** Room might not exist or need to create new player

### Scenario 5: Host Kicks Offline Player
1. Player goes offline
2. Host clicks ❌ to kick
3. Player tries to reconnect
4. **Expected:** Cannot reconnect, room not found or kicked message
5. **Result:** localStorage cleared, can't rejoin same room

## Benefits

✅ **Seamless mobile experience** - screen turning off doesn't kick you out
✅ **Mid-game reconnection** - can rejoin during active questions
✅ **Score preservation** - all progress is kept
✅ **Avatar consistency** - same emoji throughout
✅ **No spam prompts** - auto-reconnects without asking name again
✅ **Clean management** - host still has control to kick players
✅ **Automatic cleanup** - stale players removed after 5 minutes

## Edge Cases Handled

1. **Player disconnects before answering** - can reconnect and still answer
2. **Player disconnects after answering** - answer is preserved, scores calculated normally
3. **All players disconnect** - room stays active for 5 minutes
4. **Player kicked while offline** - localStorage cleared, can't reconnect
5. **Game ends while offline** - localStorage cleared on reconnection
6. **Multiple reconnection attempts** - only latest socket is active

## Implementation Notes

- Uses player `name` as unique identifier for reconnection (not socket.id)
- 5-minute timeout is generous but prevents room hoarding
- localStorage scoped to room code to prevent cross-room issues
- Periodic cleanup runs in background, no performance impact
- All existing features (kick, avatars, scoring) work seamlessly with reconnection
