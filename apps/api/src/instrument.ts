import * as Sentry from '@sentry/nestjs';

// M6 Slice B: RequestData entegrasyonunun varsayılanları (data/headers/
// cookies hepsi TRUE, sendDefaultPii'den BAĞIMSIZ) node_modules'daki gerçek
// SDK kaynağı okunarak doğrulandı (@sentry/core/build/cjs/integrations/
// requestdata.js) - auth.controller.ts düz metin şifre/JWT header'ları
// taşıyan istekler aldığı için bu, entegrasyon seviyesinde AÇIKÇA
// kapatılıyor, sadece beforeSend'e güvenilmiyor.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
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
