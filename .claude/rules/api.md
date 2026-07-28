---
paths:
  - "src/api/**"
  - "src/routes/**"
---

# API Kuralları

- Her endpoint girdiyi şema ile doğrular (class-validator DTO). Doğrulanmamış girdi servise geçmez.
- Handler'da iş mantığı yok: doğrula → servis çağır → yanıtı biçimlendir.
- Hata yanıt formatı sabit: `{ error: { code, message } }`. Stack trace dışarı sızmaz.
- Yeni endpoint = OpenAPI şeması + entegrasyon testi. İkisi olmadan merge edilmez.
- Kırıcı değişiklik yerine versiyonla.
- Yazma işlemleri idempotent olacak şekilde tasarlanır (idempotency key).
