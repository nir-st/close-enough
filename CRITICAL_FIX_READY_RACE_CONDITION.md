# Critical Bug Fix: Game Stuck After Second Question

## Bug Description
After answering the second question, all players clicked "Ready" and the game displayed "All players ready! Moving to next question..." but then got stuck and didn't proceed.

## Root Cause
**Race condition with duplicate "all ready" processing.**

There were TWO separate code paths that both checked if all players were ready and both would try to call `gameService.nextQuestion()`:

1. **Player-ready handler** (line ~395): When a player clicks ready
2. **Bot-ready handler** (line ~582): When bots auto-mark ready after question ends

### What happened:
1. Human player clicks "Ready" → triggers check
2. Bot marks ready a split second later → triggers SAME check
3. Both paths call `nextQuestion()` nearly simultaneously
4. First call succeeds and changes state to 'question'
5. Second call fails or causes undefined behavior
6. Game gets stuck in inconsistent state

## Solution
Added a **processing flag** to prevent duplicate handling:

```typescript
interface Room {
  // ... other fields
  isProcessingReady: boolean; // NEW: Prevent race condition
}
```

### How it works:
1. When first "all ready" check passes → set `isProcessingReady = true`
2. Any subsequent "all ready" checks see the flag and skip processing
3. After question starts successfully → reset `isProcessingReady = false`

### Changes:
- **server/src/models/Game.ts**: Added `isProcessingReady` flag to Room interface
- **server/src/services/RoomService.ts**: Initialize flag to `false` in createRoom
- **server/src/handlers/socketHandlers.ts**: 
  - Check `!room.isProcessingReady` before processing in player-ready handler
  - Check `!room.isProcessingReady` before processing in bot-ready handler
  - Set flag to `true` when starting to process
  - Reset flag to `false` after successfully sending next question

## Testing
1. Start game with 2+ players (or 1 player + bots)
2. Answer first question
3. All players click "Ready"
4. ✅ Should proceed to question 2
5. Answer second question  
6. All players click "Ready"
7. ✅ Should proceed to question 3 (not get stuck!)
8. Continue through all questions
9. ✅ Game should complete normally

## Prevention
This flag pattern prevents ALL race conditions where multiple async handlers might try to advance game state simultaneously.
