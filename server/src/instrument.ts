// Sentry initialization. Imported FIRST in index.ts so the SDK can instrument
// other modules. No-op when SENTRY_DSN is unset (local/dev), so it's safe to
// always import.
import 'dotenv/config';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN, // undefined => SDK disabled, fully no-op
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1 // light performance sampling
});
