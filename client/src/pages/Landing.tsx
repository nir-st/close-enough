import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { loadCastSender, requestCastSession, onRoomReady, castErrorCode, describeCastError, isIOS } from '../services/cast';

const IS_IOS = isIOS();
import './Landing.css';

function Landing() {
  const navigate = useNavigate();
  const { connectSocket, createRoom, roomCode: storeRoomCode } = useGameStore();
  const [castAvailable, setCastAvailable] = useState(false);
  const [casting, setCasting] = useState(false);
  const [castError, setCastError] = useState('');

  useEffect(() => {
    connectSocket();
  }, [connectSocket]);

  useEffect(() => {
    // When WE create a room (laptop host), go to the host screen.
    if (storeRoomCode) {
      navigate(`/host/${storeRoomCode}`);
    }
  }, [storeRoomCode, navigate]);

  // Set up Cast: show the button if the browser supports Cast, and when the
  // TV (receiver) hands back a room code, join it as a player on this phone.
  useEffect(() => {
    if (IS_IOS) return; // web Cast sender is unsupported on iOS — don't load it
    let unsubscribe: (() => void) | undefined;
    loadCastSender().then((available) => {
      setCastAvailable(available);
      if (available) {
        unsubscribe = onRoomReady((code) => {
          navigate(`/play/${code}`);
        });
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [navigate]);

  const handleCreateRoom = () => {
    createRoom('Host'); // Host doesn't need a name
  };

  const handleCast = async () => {
    try {
      setCasting(true);
      setCastError('');
      const session = await requestCastSession();
      // Session started — the room-code poll is running. If onRoomReady
      // fires we'll navigate; if it never does, reset after 15s so the
      // button isn't stuck forever.
      if (session) {
        setTimeout(() => setCasting(false), 15000);
      } else {
        setCasting(false);
      }
    } catch (err) {
      console.error('Cast failed:', castErrorCode(err), err);
      setCastError(describeCastError(err));
      setCasting(false);
    }
  };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1 className="title">Close Enough</h1>
        <p className="subtitle">The trivia game where being close counts!</p>

        <div className="mode-selection">
          <button
            className="btn-primary mode-btn"
            onClick={handleCreateRoom}
          >
            🎮 Create New Game
          </button>

          {castAvailable && (
            <button
              className="btn-secondary mode-btn"
              onClick={handleCast}
              disabled={casting}
            >
              {casting ? '📺 Connecting to TV…' : '📺 Play on TV'}
            </button>
          )}
        </div>

        {IS_IOS && (
          <p className="cast-note">
            📺 Casting to a TV isn’t supported on iPhone or iPad. To play on a TV,
            open this page in Chrome on Android or a computer.
          </p>
        )}

        {castError && <p className="cast-error">{castError}</p>}
      </div>
    </div>
  );
}

export default Landing;
