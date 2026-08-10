import * as Sentry from "@sentry/nextjs";

// M6 Slice B: bkz. instrumentation-client.ts - aynı minimal kapsam.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});
