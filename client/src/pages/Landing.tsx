import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { loadCastSender, requestCastSession, onRoomReady, castErrorCode, describeCastError } from '../services/cast';
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
      await requestCastSession(); // opens device picker; receiver creates the room
    } catch (err) {
      console.error('Cast failed:', castErrorCode(err), err);
      setCastError(describeCastError(err)); // empty string for user-cancel
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

        {castError && <p className="cast-error">{castError}</p>}
      </div>
    </div>
  );
}

export default Landing;
