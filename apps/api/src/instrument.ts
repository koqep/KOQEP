import * as Sentry from '@sentry/nestjs';

// M6 Slice B: RequestData entegrasyonunun varsayılanları (data/headers/
// cookies hepsi TRUE, sendDefaultPii'den BAĞIMSIZ) node_modules'daki gerçek
// SDK kaynağı okunarak doğrulandı (@sentry/core/build/cjs/integrations/
// requestdata.js) - auth.controller.ts düz metin şifre/JWT header'ları
// taşıyan istekler aldığı için bu, entegrasyon seviyesinde AÇIKÇA
// kapatılıyor, sadece beforeSend'e güvenilmiyor.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Geçici tanı aracı: Sentry SDK'sı VARSAYILAN OLARAK hiçbir şey console'a
  // yazmıyor (node_modules'daki gerçek kaynağı okunarak doğrulandı -
  // debug.log/warn çağrıları bir internal "enabled" flag'ine bağlı, bu flag
  // SADECE debug:true ile açılıyor) - DSN gerçekten okunuyor mu, event
  // gerçekten gönderiliyor mu görmek için env var ile açılıp kapatılabilir,
  // kod değişikliği/redeploy gerektirmez. Render dashboard'unda
  // SENTRY_DEBUG=true ekleyip redeploy et, Logs sekmesinde "Sentry Logger"
  // ile başlayan satırları ara.
  debug: process.env.SENTRY_DEBUG === 'true',
  integrations: (defaultIntegrations) =>
    defaultIntegrations.map((integration) =>
      integration.name === 'RequestData'
        ? Sentry.requestDataIntegration({
            include: { data: false, headers: false, cookies: false, ip: false },
          })
        : integration,
    ),
  // İkinci savunma katmanı - event objesi başka bir yoldan (breadcrumb,
  // context) PII taşırsa son çare.
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.headers;
      delete event.request.cookies;
    }
    return event;
  },
});
