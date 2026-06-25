// Google Cast integration for Close Enough.
//
// Two roles share one custom message namespace:
//  - SENDER  = the normal web app on a phone. Casts the game to a TV, then
//              receives the room code and joins as a player.
//  - RECEIVER = the /cast page that loads on the Chromecast. Creates the room
//              as host, shows the lobby/QR, and broadcasts the room code.
//
// The App ID maps to the receiver URL registered at cast.google.com/publish.
// The namespace is just a channel name; it must match on both ends.

export const CAST_APP_ID = import.meta.env.VITE_CAST_APP_ID || 'A754A1BE';
export const CAST_NAMESPACE = 'urn:x-cast:com.closeenough.game';

// Messages exchanged over the namespace
export type CastMessage =
  | { type: 'room-ready'; roomCode: string } // receiver -> sender
  | { type: 'request-room' };                // sender -> receiver (ask for current code)

let senderScriptLoading: Promise<void> | null = null;

// The Google Cast web sender does not exist on iOS — neither Safari nor
// Chrome-for-iOS can cast from a web page. Detect so we can show guidance
// instead of a button that always fails. Covers iPadOS 13+ (reports as Mac).
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// ── Sender (phone) ───────────────────────────────────────────────────────────

// Load the Cast Sender framework and initialize the CastContext. Resolves to
// true if the Cast API is available in this browser (Chrome / Cast-capable),
// false otherwise (e.g. Firefox, iOS Safari) so callers can hide the button.
export function loadCastSender(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  if (!senderScriptLoading) {
    senderScriptLoading = new Promise<void>((resolve) => {
      window.__onGCastApiAvailable = (isAvailable: boolean) => {
        if (isAvailable) {
          cast.framework.CastContext.getInstance().setOptions({
            receiverApplicationId: CAST_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
          });
        }
        resolve();
      };
      const s = document.createElement('script');
      s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      s.async = true;
      document.head.appendChild(s);
    });
  }

  return senderScriptLoading.then(() => {
    try {
      return !!(window.cast && cast.framework && cast.framework.CastContext);
    } catch {
      return false;
    }
  });
}

// Start a cast session (opens the device picker). Returns the active session.
// After the session starts, repeatedly asks the receiver for the room code
// (the receiver may not have created it yet if it's still loading).
export async function requestCastSession(): Promise<any> {
  const context = cast.framework.CastContext.getInstance();
  await context.requestSession();
  const session = context.getCurrentSession();
  if (session) {
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      try { session.sendMessage(CAST_NAMESPACE, JSON.stringify({ type: 'request-room' })); } catch { /* not ready */ }
      if (attempts >= 15) clearInterval(poll); // stop after 15s
    }, 1000);
    // Store the interval so onRoomReady can clear it once the code arrives
    (session as any).__roomPoll = poll;
  }
  return session;
}

// Extract the raw Cast error code (for logging).
export function castErrorCode(err: any): string {
  if (typeof err === 'string') return err;
  return err?.code || err?.description || err?.message || 'unknown';
}

// Map a Cast error to a human-readable message.
export function describeCastError(err: any): string {
  const code = castErrorCode(err);
  switch (code) {
    case 'cancel':
      return ''; // user dismissed the picker — not an error worth showing
    case 'receiver_unavailable':
      return 'No compatible Cast device found. Until the receiver app is published, the TV must be registered as a test device AND rebooted.';
    case 'timeout':
      return 'Cast timed out. Make sure the TV is on and on the same Wi-Fi.';
    case 'api_not_initialized':
      return 'Cast isn’t ready yet — try again in a moment.';
    case 'session_error':
      return 'Could not start the Cast session (the receiver may have failed to load).';
    default:
      return `Cast error: ${code}`;
  }
}

// Listen for the room code coming back from the receiver. Returns an unsubscribe.
export function onRoomReady(handler: (roomCode: string) => void): () => void {
  const context = cast.framework.CastContext.getInstance();

  const attach = (session: any) => {
    if (!session) return;
    session.addMessageListener(CAST_NAMESPACE, (_ns: string, msg: string) => {
      try {
        const data: CastMessage = typeof msg === 'string' ? JSON.parse(msg) : msg;
        if (data.type === 'room-ready') {
          if ((session as any).__roomPoll) clearInterval((session as any).__roomPoll);
          handler(data.roomCode);
        }
      } catch { /* ignore malformed */ }
    });
    try { session.sendMessage(CAST_NAMESPACE, JSON.stringify({ type: 'request-room' })); } catch { /* not ready */ }
  };

  // Attach to an existing session and to any future session.
  attach(context.getCurrentSession());
  const listener = (event: any) => {
    if (event.sessionState === cast.framework.SessionState.SESSION_STARTED ||
        event.sessionState === cast.framework.SessionState.SESSION_RESUMED) {
      attach(context.getCurrentSession());
    }
  };
  context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, listener);

  return () => context.removeEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, listener);
}
