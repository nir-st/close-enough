const env = process.env;

export const config = {
  PORT:                  parseInt(env.PORT || '3000'),
  NODE_ENV:              env.NODE_ENV || 'development',
  isProduction:          env.NODE_ENV === 'production',

  // Public URL of the app (set on Railway/Render). Used to build QR join links.
  // In local mode leave unset — local IP detection is used instead.
  APP_URL:               env.APP_URL || null,

  // In local dev the client runs on a separate port
  CLIENT_PORT:           parseInt(env.CLIENT_PORT || '5173'),

  // Game limits
  MAX_ROOMS:             parseInt(env.MAX_ROOMS || '100'),
  MAX_PLAYERS_PER_ROOM:  parseInt(env.MAX_PLAYERS_PER_ROOM || '10'),
  ROOM_TTL_MINUTES:      parseInt(env.ROOM_TTL_MINUTES || '120'),
  PLAYER_DISCONNECT_GRACE_MINUTES: parseInt(env.PLAYER_DISCONNECT_GRACE_MINUTES || '5'),
};
