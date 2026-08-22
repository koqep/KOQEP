# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-08-21
**M7a TAMAMEN KAPANDI (2026-08-19), M0-M6 TAMAMLANDI.** M7b (cila) — Slice E/H2/D2/I2 TAMAMLANDI ve MERGE OLDU (PR #68-71). Kalan tek dilim: D1 (rate limit, Faz 1 trafiği bekliyor) — milestone TAMAMEN KAPANMADI. **M6b (5651 trafik logu, sadece kapsam gözden geçirmesi, kod dilimleri başlamadı) + M6c (mesaj içeriği anonimleştirme) açıldı. M6c Slice A (manuel talep kanalı) MERGE OLDU (PR #74). M6c Slice B (hesap silme anında kullanıcı seçimi — GERÇEK KOD dilimi) TAMAMLANDI, push kullanıcı onayında.** Detaylar `docs/milestones/M7b-scale-polish.md`, `docs/milestones/M6b-traffic-log-5651.md`, `docs/milestones/M6c-message-content-anonymization.md`'nin Plan notları.

## Şu an ne çalışıyor
- **M0-M6 + M7a (Slice A-J) TAMAMEN BİTTİ.** M7a'nın tek kalıntısı: Postgres RAM/CPU/depolama ölçülemedi — `docs/BACKLOG.md` A18'e somut tetikleyiciyle ertelendi.
- **M7b Slice E/H2/D2/I2 TAMAMLANDI ve main'e MERGE OLDU (PR #68-71).** Oda keşfi + taslak kalıcılığı + zalgo koruması + tıklanabilir linkler (E); geri bildirim linki + moderatör oda duyurusu (H2); moderasyon sebebi/bildirimi + kendi mesajını silme + "düzenlendi" göstergesi (D2 — **ÖNEMLİ, hâlâ geçerli:** `reason` zorunlu hale geldiği için Render+Vercel deploy'ları ARKA ARKAYA yapılmalıydı, D2 merge olduğuna göre bu adım zaten tamamlanmış olmalı, aksi doğrulanmadıysa kontrol et); TR→EN UI geçişi (I2, BACKLOG A15 kapandı, A20 backend mesajları için açıldı).
- **2026-08-21 — M6b (5651 trafik logu, 18 ay saklama) + M6c (mesaj içeriği anonimleştirme) açıldı, scope-review'ları MERGE OLDU (PR #72, #73).** M6b: proxy/IP zinciri, `TrafficLog` şeması, bütünlük (nitelikli zaman damgası mı kendi hash'imiz mi — avukata bağlı), depolama ~5.3GB (Basic-256mb'nin 5GB limitine yakın/aşıyor) — kod dilimleri HENÜZ başlamadı. M6c: `deleteAccount()` mesaj İÇERİĞİNE hiç dokunmuyor, avukat "satır bazlı, kim görebiliyor değil kişi belirlenebiliyor mu" dedi — 3 dilim (manuel talep kanalı/kullanıcı seçimi varsayılan açık/otomatik regex+backfill).
- **2026-08-21 — M6c Slice A (manuel talep kanalı) TAMAMLANDI ve MERGE OLDU (PR #74).** `docs/RUNBOOK.md` §3.8 — docs-only, kod yok.
- **2026-08-21 — M6c Slice B (hesap silme anında kullanıcı seçimi) TAMAMLANDI, push kullanıcı onayında.** `DeleteAccountDto.redactMessageContent`, `AuthService.deleteAccount` artık `$transaction` içinde (authorId hâlâ doluyken) `Message.content`/`MessageEdit.previousContent`/`Report.reportedContent`'i `AUTHOR_DELETED_CONTENT`'e redakte ediyor, `user.delete()` en son. `DeleteAccountView.tsx`'e checkbox (varsayılan açık). WS yayını YOK (kapsam dışı, bilerek).
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend + Sentry.

## Şu an üzerinde çalışılan
- **Görev:** M6c Slice B'nin (`m6c/slice-b-user-choice-redaction`) push'u kullanıcının onayında.
- **Sonraki adım:** M6c Slice C (otomatik regex taraması + geçmişe dönük backfill) kendi plan-modu turunu bekliyor. M6b'nin kod dilimleri founder'ın Render/Cloudflare proxy doğrulaması + Senaryo A/B kararını bekliyor, henüz başlamadı. D1 (rate limit) Faz 1 gerçek trafiğini bekliyor.

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
- Paylaşılan dev odasını kullanan fullstack testlerde bir metni SAYFA GENELİNDE (`page.getByText`) değil, İLGİLİ SATIRA (`row.getByText`) daraltarak ara — aynı oda geçmişinde AYNI test session'ının BAŞKA bir dosyasının bıraktığı içerik (ör. "(düzenlendi)") yanlışlıkla eşleşebilir (M7b Slice D2'de `message-self-delete.spec.ts`'te gerçekleşti). **Sabit placeholder metinler (ör. `AUTHOR_DELETED_CONTENT`) BİRDEN FAZLA dosyada üretilebiliyor** — aynı odada iki farklı fullstack test dosyası aynı placeholder'ı üretirse `getByText` iki eşleşmeye çarpar; farklı bir odaya (`#meta`) geçmek çözer, ama `page.reload()` SONRASI `RoomView.tsx` varsayılan odaya (`#general`) döner, o odaya YENİDEN geçmek gerekir (M6c Slice B'de `delete-account.spec.ts` vs `message-self-delete.spec.ts`'te gerçekleşti).
- Yerel Postgres'i `DROP DATABASE`+`migrate deploy`+`db:seed` ile "CI'daki gibi taze" sanma — CI (`ci.yml`) seed'den SONRA ayrıca `db:backfill-totp-secrets`+`db:backfill-room-members` çalıştırıyor; atlanırsa `listRooms` boş döner, WS `'ready'` hiç gelmez, composer sonsuza dek disabled kalır.
