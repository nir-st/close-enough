# Monitoring & Metrics — Close Enough

A guide to what you get for free vs. what needs a little code for
production observability.

---

## What Railway Gives You for Free (Zero Code)

Once deployed on Railway, the dashboard automatically provides:

- **CPU & memory usage** — graphs over time
- **HTTP request count and latency** — how fast your server responds
- **Crash detection** — automatic restarts on process exit
- **Full log viewer with search** — every `console.log` from the server
- **Deploy history** — know exactly which version is live at any moment

This covers "is the server alive and healthy?" with no changes to the codebase.

---

## Error Tracking — Add Sentry (2 Lines of Code)

For errors, stack traces, and "something broke in production" alerts,
**Sentry** is the standard tool. The free tier is generous enough for a
side project indefinitely.

**Install:**
```bash
npm install @sentry/node
```

**Initialize (add to `server/src/index.ts` before anything else):**
```typescript
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

From that moment, Sentry automatically captures:
- Every unhandled exception with full stack trace and context
- Unhandled promise rejections
- Which room/event was involved when it crashed
- How often each unique error occurs
- Performance slowdowns in handlers
- Email alerts when new error types appear

The Sentry web dashboard groups errors, shows frequency trends, and
lets you mark issues as resolved. Add `SENTRY_DSN` to Railway env vars —
get the value from sentry.io after creating a free project.

---

## Game-Level Metrics — Needs a Little Code

Railway doesn't know about application-level concepts like "how many games
were played today." There are two approaches:

### Option A — Structured Logs (Easy, No Extra Service)

Replace plain `console.log` with structured JSON at key moments.
Railway's log viewer can search and filter these:

```typescript
// server/src/services/GameService.ts

// When a game starts:
console.log(JSON.stringify({
  event: "game_started",
  roomCode: room.code,
  playerCount: room.players.length,
  difficulty: room.settings.difficulty,
  category: room.settings.categoryFilter || "all",
  timestamp: new Date().toISOString()
}));

// When a game ends:
console.log(JSON.stringify({
  event: "game_ended",
  roomCode: room.code,
  durationMinutes: Math.round((Date.now() - room.createdAt.getTime()) / 60000),
  questionCount: room.questions.length,
  playerCount: room.players.length,
  timestamp: new Date().toISOString()
}));

// When a room is created:
console.log(JSON.stringify({
  event: "room_created",
  roomCode: room.code,
  timestamp: new Date().toISOString()
}));
```

You can then search Railway logs for `"event":"game_started"` and count
lines to see total games. Not a beautiful dashboard, but functional and
adds almost no code.

### Option B — PostHog (Free Tier, Real Dashboard)

PostHog is a product analytics service with a generous free tier and a
real dashboard (charts, funnels, totals over time).

**Install:**
```bash
npm install posthog-node
```

**Use it:**
```typescript
import { PostHog } from 'posthog-node';
const posthog = new PostHog(process.env.POSTHOG_API_KEY!);

// Call at key moments:
posthog.capture({
  distinctId: room.code,
  event: 'game_started',
  properties: {
    playerCount: room.players.length,
    difficulty: room.settings.difficulty,
    category: room.settings.categoryFilter || 'all'
  }
});
```

The PostHog dashboard then gives you: total events per day, breakdowns
by category/difficulty, trends over time — without building anything
yourself. Add `POSTHOG_API_KEY` to Railway env vars.

---

## Uptime Alerting — UptimeRobot (Free, Zero Code)

Sign up at **uptimerobot.com** (free), add a new HTTP monitor pointing
at your `/health` endpoint:

```
https://yourdomain.com/health
```

UptimeRobot pings it every 5 minutes. If it returns anything other than
`200 OK`, you get an email (and optionally SMS). No code needed beyond
the `/health` endpoint already planned in `SERVER_MIGRATION.md`.

---

## Lag / Performance Monitoring

- **Sentry** includes performance monitoring — it can track how long
  socket handlers take and alert on slow operations.
- **Railway** shows HTTP response latency in the dashboard.
- For Socket.io specifically: Socket.io has built-in ping/pong — you can
  log `socket.conn.transport.socket._pingInterval` or listen to the
  `ping`/`pong` events to track client latency if needed.

For most cases, Sentry performance + Railway latency graphs is more
than enough.

---

## Summary: Recommended Setup

| What | Tool | Code needed |
|---|---|---|
| Server health, CPU, memory | Railway dashboard | None |
| Errors & crashes | Sentry | 2 lines |
| Uptime alerts | UptimeRobot | None (needs `/health` endpoint) |
| Game event counts | Structured JSON logs | ~10 lines in GameService |
| Nice analytics dashboard | PostHog (add later) | ~5 lines |
| Lag / slow responses | Sentry performance | Included with Sentry |

**Start with Sentry + UptimeRobot.** That covers "is something broken
and am I down?" — the things that matter most when first going live.
Add PostHog later when you want to understand usage patterns.

---

## Environment Variables to Add

```
# Error tracking
SENTRY_DSN=https://...@sentry.io/...

# Product analytics (optional, add later)
POSTHOG_API_KEY=phc_...
```

Both have sensible behavior if the variable is missing: if `SENTRY_DSN`
is undefined, `Sentry.init()` is a no-op. Wrap the PostHog client in a
null-check. This way local development is not affected.
