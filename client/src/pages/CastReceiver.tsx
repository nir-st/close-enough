import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { CAST_NAMESPACE } from '../services/cast';
import CastHost from './CastHost';

// Keep the TV screen awake for the duration of the cast session.
function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;

    const acquire = async () => {
      try { lock = await navigator.wakeLock.request('screen'); } catch { /* TV may deny */ }
    };

    acquire();
    // Re-acquire after the tab comes back to the foreground (lock is released on hide)
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release();
    };
  }, []);
}

// This page is loaded ON the Chromecast (the receiver). It:
//  1. Initializes the CAF receiver context + custom message channel.
//  2. Connects to the game server and creates a room as host.
//  3. Broadcasts the room code to the casting phone (sender).
//  4. Renders the normal Host screen (QR/lobby + game) for the TV.
function CastReceiver() {
  useWakeLock();
  const { connectSocket, createRoom, roomCode } = useGameStore();
  const ctxRef = useRef<any>(null);
  const startedRef = useRef(false);
  const latestCodeRef = useRef<string | null>(null);

  // Boot the receiver SDK + create the room (once).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const initReceiver = () => {
      try {
        const ctx = cast.framework.CastReceiverContext.getInstance();
        ctxRef.current = ctx;

        // A sender can ask for the current room code (in case it attached its
        // listener after we'd already created the room).
        ctx.addCustomMessageListener(CAST_NAMESPACE, (event: any) => {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data?.type === 'request-room' && latestCodeRef.current) {
            ctx.sendCustomMessage(CAST_NAMESPACE, event.senderId, {
              type: 'room-ready',
              roomCode: latestCodeRef.current
            });
          }
        });

        // When a new sender connects, hand it the room code if we have one.
        ctx.addEventListener(cast.framework.system.EventType.SENDER_CONNECTED, (event: any) => {
          if (latestCodeRef.current) {
            ctx.sendCustomMessage(CAST_NAMESPACE, event.senderId, {
              type: 'room-ready',
              roomCode: latestCodeRef.current
            });
          }
        });

        const options = new cast.framework.CastReceiverOptions();
        options.disableIdleTimeout = true; // no media playback — keep the receiver alive
        ctx.start(options);
      } catch (err) {
        console.error('Cast receiver init failed:', err);
      }

      // Create the room as host regardless of Cast init outcome, so the page is
      // still usable if opened directly in a browser for debugging.
      connectSocket();
      createRoom('TV');
    };

    // The CAF receiver framework loads from gstatic.
    if (window.cast && cast.framework) {
      initReceiver();
    } else {
      const s = document.createElement('script');
      s.src = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';
      s.async = true;
      s.onload = initReceiver;
      s.onerror = () => { console.error('Failed to load Cast receiver SDK'); connectSocket(); createRoom('TV'); };
      document.head.appendChild(s);
    }
  }, [connectSocket, createRoom]);

  // Broadcast the room code to all connected senders once it exists.
  useEffect(() => {
    if (!roomCode) return;
    latestCodeRef.current = roomCode;
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      const senders = ctx.getSenders ? ctx.getSenders() : [];
      senders.forEach((sender: any) =>
        ctx.sendCustomMessage(CAST_NAMESPACE, sender.id, { type: 'room-ready', roomCode })
      );
    } catch (err) {
      console.error('Failed to broadcast room code:', err);
    }
  }, [roomCode]);

  if (!roomCode) {
    return (
      <div className="cast-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ fontSize: 48, color: 'white' }}>Close Enough</h1>
        <p style={{ fontSize: 28, color: 'rgba(255,255,255,0.85)', marginTop: 16 }}>
          Starting up…
        </p>
      </div>
    );
  }

  return <CastHost roomCode={roomCode} />;
}

export default CastReceiver;
