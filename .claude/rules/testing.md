# Test Kuralları

- Her davranış değişikliği en az bir testle gelir.
- Test adı davranışı anlatır: `reddeder_süresi_dolmuş_token`.
- Servis katmanı: birim test. API katmanı: entegrasyon testi. Kritik akış: 1 e2e.
- Mock'u sadece dış sınırlarda kullan (ağ, saat, rastgelelik). Kendi kodunu mock'lama.
- Bug bulunduğunda önce hatayı gösteren test yazılır, sonra düzeltilir.
- Testler paralel çalışabilir olmalı; paylaşılan global durum yok.
- `apps/api/test/*.e2e-spec.ts` gerçek `/auth/signup`'ı (doğrudan ya da içeriden
  tetikleyen bir akışla) çağırıyorsa `EmailService`'i MUTLAKA
  `apps/api/test/support/email-service-mock.ts`'deki `buildEmailServiceMock()`
  ile `overrideProvider` et — CI'daki `RESEND_API_KEY` sahte, mock'lanmazsa
  gerçek Resend çağrısı 401 ile patlar (bu hata iki kez tekrarlandı).
- Aynı dosyalar gerçek `/auth/signup` ya da `/auth/password-reset/confirm`
  çağırıyorsa (yeni bir şifre SET edildiği HER yer) `PasswordPolicyService`'i
  de MUTLAKA `apps/api/test/support/password-policy-mock.ts`'deki
  `buildPasswordPolicyServiceMock()` ile `overrideProvider` et — mock'lanmazsa
  gerçek `api.pwnedpasswords.com`'a gider (yavaş/kırılgan, üçüncü bir partiyi
  otomatik test koşumlarından dövmek de sorunlu). EmailService kuralıyla AYNI
  ciddiyette (M7a Slice F'de 5 mevcut dosyada bu satır atlanmıştı, hepsi
  düzeltildi).
