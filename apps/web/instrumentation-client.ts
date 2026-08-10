import * as Sentry from "@sentry/nextjs";

// M6 Slice B: sadece hata yakalama - session replay/performans tracing
// bilerek KURULMADI (replay çok daha büyük bir PII yüzeyi, tracing "bir şey
// bozuldu mu" uyarısından farklı bir özellik, ikisi de milestone'un
// "sağlamlaştırma, özellik değil" duruşuyla çelişir).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});

// SDK'nın build sırasında istediği zorunlu hook - navigasyon span'ları
// oluşturuyor ama tracesSampleRate: 0 olduğu için hiçbiri gönderilmiyor,
// tracing'i AÇMIYOR.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
