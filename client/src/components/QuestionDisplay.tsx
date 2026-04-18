import { Question } from '../types/game';
import './QuestionDisplay.css';

interface QuestionDisplayProps {
  question: Question;
  large?: boolean;
}

function QuestionDisplay({ question, large = false }: QuestionDisplayProps) {
  const getDifficultyBadge = (difficulty: string) => {
    const badges = {
      easy: { emoji: '🟢', label: 'Easy', color: '#48bb78' },
      medium: { emoji: '🟡', label: 'Medium', color: '#ed8936' },
      hard: { emoji: '🔴', label: 'Hard', color: '#f56565' }
    };
    return badges[difficulty as keyof typeof badges] || badges.easy;
  };

  const badge = getDifficultyBadge(question.difficulty);

  return (
    <div className={`question-display ${large ? 'large' : ''}`}>
      <div className="question-header">
        <div className="question-number">
          Question {question.questionNumber}/{question.totalQuestions}
        </div>
        <div className="badges">
          {question.categories && question.categories.length > 0 && (
            <span className="category-badge">{question.categories[0]}</span>
          )}
          <span className="difficulty-badge" style={{ background: badge.color }}>
            {badge.emoji} {badge.label}
          </span>
        </div>
      </div>
      <div className="question-text">{question.text}</div>
      {question.unit && <div className="question-unit">Answer in: {question.unit}</div>}
    </div>
  );
}

export default QuestionDisplay;
