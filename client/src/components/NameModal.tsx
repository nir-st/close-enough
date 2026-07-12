import { useState, useEffect, useRef } from 'react';
import './NameModal.css';

interface NameModalProps {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
}

function NameModal({ title, placeholder = 'Enter your name', defaultValue = '', onSubmit, onCancel }: NameModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="name-modal-overlay">
      <div className="name-modal-card">
        <h2 className="name-modal-title">{title}</h2>
        <input
          ref={inputRef}
          className="name-modal-input"
          type="text"
          placeholder={placeholder}
          value={value}
          maxLength={20}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <div className="name-modal-actions">
          {onCancel && (
            <button className="btn-secondary name-modal-cancel" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            className="btn-primary name-modal-submit"
            onClick={handleSubmit}
            disabled={!value.trim()}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default NameModal;
