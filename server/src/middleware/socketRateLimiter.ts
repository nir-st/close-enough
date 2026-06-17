// Sliding-window per-socket rate limiter.
// Call allow() before processing any event — returns false if the rate is exceeded.
// Call cleanup() on socket disconnect to free memory.

const windows = new Map<string, Map<string, number[]>>();

export function allow(socketId: string, event: string, maxEvents: number, windowMs: number): boolean {
  let perSocket = windows.get(socketId);
  if (!perSocket) { perSocket = new Map(); windows.set(socketId, perSocket); }

  const now = Date.now();
  const log = (perSocket.get(event) || []).filter(t => now - t < windowMs);

  if (log.length >= maxEvents) return false;

  log.push(now);
  perSocket.set(event, log);
  return true;
}

export function cleanup(socketId: string): void {
  windows.delete(socketId);
}
