export function validatePlayerName(name: unknown): string | null {
  if (typeof name !== 'string') return 'Name must be a string';
  if (!name.trim()) return 'Name cannot be empty';
  if (name.trim().length > 30) return 'Name too long (max 30 characters)';
  return null;
}

export function validateRoomCode(code: unknown): string | null {
  if (typeof code !== 'string') return 'Invalid room code';
  if (!/^[A-Z2-9]{6}$/.test(code)) return 'Invalid room code';
  return null;
}

export function validateAnswer(answer: unknown): string | null {
  if (typeof answer !== 'number') return 'Answer must be a number';
  if (!isFinite(answer)) return 'Answer must be a finite number';
  if (Math.abs(answer) > 1e15) return 'Answer out of range';
  return null;
}

export function validateSettings(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return 'Invalid settings';
  const s = settings as Record<string, unknown>;
  if (s.questionCount !== undefined && ![5, 10].includes(s.questionCount as number))
    return 'Invalid question count';
  if (s.difficulty !== undefined && !['mixed', 'easy', 'medium', 'hard'].includes(s.difficulty as string))
    return 'Invalid difficulty';
  if (s.timePerQuestion !== undefined && ![15, 30, 45, 60].includes(s.timePerQuestion as number))
    return 'Invalid time per question';
  if (s.categoryFilter !== undefined && (typeof s.categoryFilter !== 'string' || s.categoryFilter.length > 50))
    return 'Invalid category';
  return null;
}

export function validateBotCount(count: unknown): string | null {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 5)
    return 'Bot count must be between 1 and 5';
  return null;
}
