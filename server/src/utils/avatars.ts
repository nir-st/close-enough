// Pool of emoji avatars for players
const AVATAR_POOL = [
  '🐶', '🐱', '🐼', '🦊', '🐻', '🐸', '🦁', '🐯', '🐨', '🐷',
  '🐮', '🐔', '🦉', '🐧', '🦋', '🐙', '🦀', '🐠', '🦈', '🦖',
  '🚀', '⭐', '🎨', '🎭', '🎪', '🎸', '🎮', '🎲', '🎯', '🎳'
];

const usedAvatars = new Set<string>();

/**
 * Get a random avatar that hasn't been used yet
 * If all avatars are used, resets and starts over
 */
export function getRandomAvatar(): string {
  // If all avatars used, reset
  if (usedAvatars.size >= AVATAR_POOL.length) {
    usedAvatars.clear();
  }

  // Get available avatars
  const available = AVATAR_POOL.filter(avatar => !usedAvatars.has(avatar));

  // Pick random one
  const avatar = available[Math.floor(Math.random() * available.length)];
  usedAvatars.add(avatar);

  return avatar;
}

/**
 * Release an avatar back to the pool when a player leaves
 */
export function releaseAvatar(avatar: string): void {
  usedAvatars.delete(avatar);
}

/**
 * Reset all avatars (useful when starting a new game)
 */
export function resetAvatars(): void {
  usedAvatars.clear();
}
