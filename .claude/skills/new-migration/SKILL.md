---
name: new-migration
description: Veritabanı şema değişikliği yaparken kullanılır. Expand/contract disiplini, Prisma migration üretimi, rollback planı ve geriye dönük uyumluluk kontrolünü kapsar. Kullanıcı yeni tablo, yeni kolon, şema değişikliği veya migration eklemekten bahsettiğinde tetiklenir.
---

# Yeni Migration

Sırayı bozma:

1. **`docs/DATA-MODEL.md`'yi oku.** Değişiklik mevcut varlık/ilişki modeliyle çelişiyor mu kontrol et; çelişiyorsa önce orada konuş.
2. **Expand/contract.** Tek adımda kırıcı değişiklik yok:
   - Expand: yeni kolon/tablo nullable veya default'lu eklenir, kod henüz kullanmaz.
   - Migrate: kod yeni alanı okur/yazar, eskiyle birlikte çalışır.
   - Contract: eski alan/kolon ayrı bir migration'da kaldırılır.
3. **Migration'ı Prisma ile üret** (`npx prisma migrate dev --name <ad>`). El ile SQL yazma — bu `CLAUDE.md`'nin değişmez kuralı.
4. **Geriye dönük uyumluluk kontrolü:** mevcut prod verisiyle migration çalışır mı? NOT NULL kolonu default'suz eklemek mevcut satırları kırar.
5. **Kilit kontrolü:** büyük tabloda kilitleyen bir işlem var mı (ör. büyük tabloya index eklemek)? Varsa `CONCURRENTLY` veya eşdeğerini kullan.
6. **Rollback planını** migration dosyasının başına tek satır yorum olarak yaz — bu "nasıl geri alınır" bilgisi, CLAUDE.md'nin yorum yasağının istisnasına girer.
7. Testi migration'a karşı çalıştır; mümkünse forward + rollback ikisini de dene.

Yaygın hatalar:
- Elle SQL çalıştırmak → yasak.
- Migration + kod değişikliğini aynı deploy'da zorunlu tutmak → expand/contract'ı atlamak.
- Rollback planı yazmadan merge etmek.
