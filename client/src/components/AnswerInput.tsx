import { useState } from 'react';
import './AnswerInput.css';

interface AnswerInputProps {
  onSubmit: (answer: number) => void;
  disabled?: boolean;
  hasAnswered?: boolean;
}

function AnswerInput({ onSubmit, disabled, hasAnswered }: AnswerInputProps) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    const numAnswer = parseFloat(answer);
    if (isNaN(numAnswer)) {
      alert('Please enter a valid number');
      return;
    }
    onSubmit(numAnswer);
  };

  if (hasAnswered) {
    return (
      <div className="answer-submitted">
        <div className="checkmark">✓</div>
        <p>Answer Submitted!</p>
        <p className="waiting-text">Waiting for other players...</p>
      </div>
    );
  }

  return (
    <div className="answer-input-container">
      <input
        type="number"
        className="answer-input"
        placeholder="Enter your answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
        disabled={disabled}
        autoFocus
      />
      <button
        className="btn-primary submit-btn"
        onClick={handleSubmit}
        disabled={disabled || !answer}
      >
        Submit Answer
      </button>
    </div>
  );
}

export default AnswerInput;
