---
paths:
  - "src/api/**"
  - "src/auth/**"
  - "src/db/**"
---

# Güvenlik Kuralları

- Sır (secret) asla koda veya log'a yazılmaz; ortam değişkeninden okunur.
- SQL her zaman parametreli. String birleştirerek sorgu kurulmaz.
- Yetkilendirme kontrolü servis katmanında, sadece UI'da gizleyerek değil.
- Kullanıcı girdisi log'a yazılmadan önce temizlenir; PII log'lanmaz.
- Şifreler argon2id/bcrypt ile hash'lenir; kendi kripto'nu yazma.
- Telefon numarası hiçbir akışta toplanmaz — PII yükümlülüğü kabul edilmedi (ADR-0002 dışı, PRD kararı).
- TOTP zorunlu değil, opsiyonel; açılırken kurtarma kodu üretilir — kurtarmasız kilitlenme yok.
- Davet oluşturma ve kullanma kullanıcı başına rate-limit'li (sybil/brigading önlemi).
- Yeni oda oluşturma kullanıcı başına günde 1 ile sınırlı.
- WS ve API istekleri kullanıcı, IP ve bağlantı bazında rate-limit'li.
- Markdown render'ı allowlist ile sanitize edilir; CSP inline script'e izin vermez.
- Mesaj düzenleme geçmişi sadece mesajın yazarına ve moderatörlere açık — asla herkese açık, asla teşhir amaçlı kullanılmaz.
- Moderasyon aksiyonları (susturma/yasaklama) etkilenen kullanıcıya şeffaftır — shadow ban yok.
- Sohbet komutu olarak gizli/yetki yükseltici komut yok (ör. `/sudo`) — hiçbir komut UI'da görünmeyen bir yetki değişikliği yapmaz.
- Yeni bağımlılık eklemeden önce sor; güvenlik yüzeyi genişletir.
