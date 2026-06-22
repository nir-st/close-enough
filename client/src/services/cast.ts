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
export async function requestCastSession(): Promise<any> {
  const context = cast.framework.CastContext.getInstance();
  await context.requestSession();
  return context.getCurrentSession();
}

// Listen for the room code coming back from the receiver. Returns an unsubscribe.
export function onRoomReady(handler: (roomCode: string) => void): () => void {
  const context = cast.framework.CastContext.getInstance();

  const attach = (session: any) => {
    if (!session) return;
    session.addMessageListener(CAST_NAMESPACE, (_ns: string, msg: string) => {
      try {
        const data: CastMessage = typeof msg === 'string' ? JSON.parse(msg) : msg;
        if (data.type === 'room-ready') handler(data.roomCode);
      } catch { /* ignore malformed */ }
    });
    // Ask the receiver to (re)send the current room code in case it created the
    // room before we attached the listener.
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
