import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import './Landing.css';

function Landing() {
  const navigate = useNavigate();
  const { connectSocket, createRoom, roomCode: storeRoomCode } = useGameStore();

  useEffect(() => {
    connectSocket();
  }, [connectSocket]);

  useEffect(() => {
    // When room is created, navigate to host page
    if (storeRoomCode) {
      navigate(`/host/${storeRoomCode}`);
    }
  }, [storeRoomCode, navigate]);

  const handleCreateRoom = () => {
    createRoom('Host'); // Host doesn't need a name
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
        </div>
      </div>
    </div>
  );
}

export default Landing;
