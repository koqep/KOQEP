---
name: new-endpoint
description: Yeni bir HTTP endpoint eklerken kullanılır. Şema doğrulama, servis katmanı, hata formatı, OpenAPI ve test adımlarını kapsar. Kullanıcı yeni API yolu, route veya endpoint eklemekten bahsettiğinde tetiklenir.
---

# Yeni Endpoint Ekleme

Sırayı bozma:

1. **Sözleşme önce.** Request/response şemasını yaz. Bana göster, onay al.
2. **Servis.** İş mantığını `src/services/` içine yaz. HTTP'den habersiz olmalı.
3. **Servis testi.** Mutlu yol + en az 2 hata yolu.
4. **Handler.** `src/api/` içinde: doğrula → servis çağır → biçimlendir. Mantık yok.
5. **Entegrasyon testi.** 200, 400 (geçersiz girdi), 401/403 (yetki) durumları.
6. **OpenAPI** şemasını güncelle.
7. `<test komutu>` ve `<lint komutu>` çalıştır, yeşile getir.

Yaygın hatalar:
- Yetki kontrolünü handler'da bırakmak → servis katmanında olmalı
- Hata formatını uydurmak → `{ error: { code, message } }`
- Testleri en sona bırakmak
