# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-08-21
**M7a TAMAMEN KAPANDI (2026-08-19), M0-M6 TAMAMLANDI.** M7b (cila) sürüyor — Slice E, H2, D2, I2 TAMAMLANDI (D2'nin push'u kullanıcı onayında, I2 push'a hazır). Kalan tek dilim: D1 (rate limit, Faz 1 trafiği bekliyor) — milestone TAMAMEN KAPANMADI. Detaylar `docs/milestones/M7b-scale-polish.md`'nin Plan notları.

## Şu an ne çalışıyor
- **M0-M6 + M7a (Slice A-J) TAMAMEN BİTTİ.** Detaylar kendi milestone dosyalarının Plan notları bölümlerinde. M7a'nın tek kalıntısı: Postgres RAM/CPU/depolama ölçülemedi — `docs/BACKLOG.md` A18'e somut tetikleyiciyle ertelendi.
- **2026-08-20 — M7b Slice E+H2 TAMAMLANDI, ikisi de merge oldu (PR #68, #69).** Oda keşfi aktiviteye göre sıralı + taslak kalıcılığı + zalgo koruması + tıklanabilir linkler (E); geri bildirim linki (`ussasa155@gmail.com`, `docs/BACKLOG.md` A19) + moderatör pinlenmiş oda duyurusu (H2).
- **2026-08-21 — M7b Slice D2 (moderasyon sebebi/bildirimi + kendi mesajını silme + "düzenlendi" göstergesi) TAMAMLANDI, push kullanıcı onayında.** `MuteUserDto`/`RemoveContentDto` artık ZORUNLU bir `reason` alıyor (`User.muteReason`, `ModerationAuditLog.reason`), `MessagesGateway.notifyContentRemoved` yazara hedefe-özel bir WS bildirimi (`moderation:content-removed`). `MessagesService.deleteOwnMessage` — `editMessage`'ın aynı iskeleti ama `assertNotMuted` YOK (silme yeni içerik eklemiyor). `Message.editedAt` SADECE `editMessage` set ediyor. **ÖNEMLİ — bu dilim geriye dönük UYUMSUZ:** `reason` zorunlu hale gelince mevcut deploy edilmiş frontend'in reason'sız çağrısı 400 döner — Render (API) + Vercel (web) ARKA ARKAYA deploy edilmeli, aralarında sustur/içerik-kaldır kullanılmamalı.
- **2026-08-21 — M7b Slice I2 (TR→EN UI geçişi bitirildi, BACKLOG A15) TAMAMLANDI, push kullanıcı onayında.** `apps/web/app/**/*.tsx` + `apps/web/e2e/**` (22 dosya) + `apps/web/e2e-fullstack/**` (8 dosya) İngilizceye çevrildi, `<html lang="tr">`→`"en"`. SADECE frontend kapsandı — backend'in ~30 Türkçe hata mesajı bilerek dışarıda, `docs/BACKLOG.md` A20'ye somut tetikleyiciyle not düşüldü. 9 commit yerel kaldı, kullanıcı tek seferde push edip PR açacak.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend + Sentry.

## Şu an üzerinde çalışılan
- **Görev:** M7b Slice D2'nin (`m7b/slice-d2-appeal-self-delete-edited-indicator`) VE Slice I2'nin (`m7b/slice-i2-en-ui-translation`, 9 commit) push'u kullanıcının onayında.
- **Sonraki adım:** Kullanıcı push edip PR açtıktan sonra: D2 merge'i SONRASI Render+Vercel'i ARKA ARKAYA deploy et (yukarıdaki not). Sonra kalan tek dilim D1 — Faz 1 gerçek trafiği bekliyor, founder'ın ilk 2-3 haftanın log'larını gözden geçirmesi gerekiyor.

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.
- `GET /rooms?scope=all` (moderasyon) sayfalanmıyor — somut tetikleyici `docs/BACKLOG.md` A16'da.
- `AuthService.verifyCurrentPassword` hesap kilidi KORUMASI ALMIYOR — somut tetikleyici `THREAT-MODEL.md`'nin açık maddesinde.
- Render Postgres'in RAM/CPU/depolamasının 500 kullanıcıya yeteceği ÖLÇÜLEMEDİ — somut tetikleyici `docs/BACKLOG.md` A18'de.
- Geri bildirim `mailto:` hedefi kişisel gelen kutusu — somut tetikleyici `docs/BACKLOG.md` A19'da.
- Moderasyon eylemlerinde SEBEP artık var ama itiraz/dispute yolu YOK — `THREAT-MODEL.md` satır 41, founder Faz 1 moderasyon hacmine göre erkene çekip çekmeyeceğine karar verecek.

## Yakın zamanda alınan kararlar
- Access token bellek-içi (React state), refresh token httpOnly cookie'de — bkz. ADR-0002 + Addendum.
- 2026-08-19 — production `DATABASE_URL`'ine `connection_limit=30` EKLENDİ (founder, doğrulanmış: `max_connections=100`, Basic-256mb).
- 2026-08-21 — mute/içerik-kaldırma `reason`'ı ZORUNLU (opsiyonel değil) — AC "bildirim SEBEP içeriyor" diyor; self-delete mute kontrolü YOK (yeni içerik eklemiyor).

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula.
- `.env`/`.env.*` dosyaları `Read`/`cat` için engelli; `@prisma/client` import edilince `.env`'i ayrıca sessizce (yeniden) yükler.
- `apps/web/e2e/support/auth-mocks.ts` paylaşılan fixture — yeni auth-akışı testi yazarken kopyalamak yerine BUNU kullan/genişlet.
- `prisma migrate dev` migration dosyasını hemen uyguluyor — elle SQL eklemek için önce `--create-only` kullan.
- NestJS WS gateway'lerinde: `WsException` DIŞINDAKİ her şey jenerik hataya çevrilir; `.emit` disconnect'te ack'i kaybeder, `.timeout()` şart.
- Plan modundayken `ExitPlanMode` SADECE "implementasyona başla" onayı DEĞİL — plan dosyası dışındaki HER dosyayı düzenlemenin tek kilidi.
- Test harness üretim davranışını EKSİK yansıtıyor: (1) `apps/web` Playwright `next start` kullanıyor — kod değişikliğinden SONRA `npm run build` şart. (2) `apps/api`'nin e2e `TestingModule`'ü `ValidationPipe`'ı ÇALIŞTIRMAZ — bir DTO alanını ZORUNLU yaparken, ValidationPipe olmayan dosyalarda `@Body()` hiç gönderilmemişse `undefined` döner, `dto.alan` erişimi 400 DEĞİL ham bir TypeError/500 üretir (M7b Slice D2'de `moderation.e2e-spec.ts`'te gerçekleşti).
- Playwright: `page.route("**/rooms", ...)` sondaki `**` OLMADIĞI için query-string'li çağrıları eşleştirmez; `getByText`/`getByRole` `exact:true` OLMADAN substring eşleşir — RoomHeader'a HER SAYFADA görünen bir buton/link (`clickable-links.spec.ts`) ya da genel bir kelime (`hesabı sil` vs `sil`, `message-delete.spec.ts`) yeni bir seçiciyle çakışabilir, `exact:true` ya da daha dar bir filtre kullan.
- Paylaşılan dev odasını kullanan fullstack testlerde bir metni SAYFA GENELİNDE (`page.getByText`) değil, İLGİLİ SATIRA (`row.getByText`) daraltarak ara — aynı oda geçmişinde AYNI test session'ının BAŞKA bir dosyasının bıraktığı içerik (ör. "(düzenlendi)") yanlışlıkla eşleşebilir (M7b Slice D2'de `message-self-delete.spec.ts`'te gerçekleşti).
- Yerel Postgres'i `DROP DATABASE`+`migrate deploy`+`db:seed` ile "CI'daki gibi taze" sanma — CI (`ci.yml`) seed'den SONRA ayrıca `db:backfill-totp-secrets`+`db:backfill-room-members` çalıştırıyor; atlanırsa `listRooms` boş döner, WS `'ready'` hiç gelmez, composer sonsuza dek disabled kalır.
