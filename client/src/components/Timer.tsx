import { useEffect } from 'react';
import './Timer.css';

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
  onExpire: () => void;
}

function Timer({ timeRemaining, totalTime, onExpire }: TimerProps) {
  useEffect(() => {
    if (timeRemaining <= 0) {
      onExpire();
    }
  }, [timeRemaining, onExpire]);

  const percentage = (timeRemaining / totalTime) * 100;
  const isLow = percentage < 30;
  const isVeryLow = percentage < 10;

  return (
    <div className="timer-container">
      <div className={`timer ${isLow ? 'low' : ''} ${isVeryLow ? 'very-low' : ''}`}>
        <div className="timer-value">{timeRemaining}s</div>
        <div className="timer-bar-container">
          <div
            className="timer-bar"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default Timer;
