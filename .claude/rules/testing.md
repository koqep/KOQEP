# Test Kuralları

- Her davranış değişikliği en az bir testle gelir.
- Test adı davranışı anlatır: `reddeder_süresi_dolmuş_token`.
- Servis katmanı: birim test. API katmanı: entegrasyon testi. Kritik akış: 1 e2e.
- Mock'u sadece dış sınırlarda kullan (ağ, saat, rastgelelik). Kendi kodunu mock'lama.
- Bug bulunduğunda önce hatayı gösteren test yazılır, sonra düzeltilir.
- Testler paralel çalışabilir olmalı; paylaşılan global durum yok.
