import { GameSettings as Settings } from '../types/game';
import './GameSettings.css';

interface GameSettingsProps {
  settings: Settings;
  onUpdate: (settings: Partial<Settings>) => void;
  disabled?: boolean;
}

function GameSettings({ settings, onUpdate, disabled }: GameSettingsProps) {
  const questionCountOptions = [
    { value: 10, label: '10 Questions' },
    { value: 5, label: '5 Questions' }
  ];

  const difficultyOptions = [
    { value: 'mixed', label: 'Mixed Difficulty' },
    { value: 'easy', label: 'Easy Only' },
    { value: 'medium', label: 'Medium Only' },
    { value: 'hard', label: 'Hard Only' }
  ];

  const timeOptions = [
    { value: 15, label: '15 seconds' },
    { value: 30, label: '30 seconds' },
    { value: 45, label: '45 seconds' },
    { value: 60, label: '60 seconds' }
  ];

  return (
    <div className="game-settings">
      <h3>Game Settings</h3>

      <div className="setting-group">
        <label>Number of Questions:</label>
        <select
          value={settings.questionCount}
          onChange={(e) => onUpdate({ questionCount: Number(e.target.value) as 5 | 10 })}
          disabled={disabled}
        >
          {questionCountOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label>Difficulty:</label>
        <select
          value={settings.difficulty}
          onChange={(e) => onUpdate({ difficulty: e.target.value as Settings['difficulty'] })}
          disabled={disabled}
        >
          {difficultyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label>Time per Question:</label>
        <select
          value={settings.timePerQuestion}
          onChange={(e) => onUpdate({ timePerQuestion: Number(e.target.value) as 15 | 30 | 45 | 60 })}
          disabled={disabled}
        >
          {timeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label>Category:</label>
        <select
          value={settings.categoryFilter}
          onChange={(e) => onUpdate({ categoryFilter: e.target.value })}
          disabled={disabled}
        >
          <option value="mixed">Mixed Categories</option>
          <option value="Geography">Geography</option>
          <option value="History">History</option>
          <option value="Science">Science</option>
          <option value="Sports">Sports</option>
          <option value="Pop Culture">Pop Culture</option>
          <option value="Israel">Israel</option>
        </select>
      </div>
    </div>
  );
}

export default GameSettings;
