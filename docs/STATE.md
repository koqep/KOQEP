# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-08-25
**M7a TAMAMEN KAPANDI (2026-08-19), M0-M6 TAMAMLANDI.** M7b (cila) — Slice E/H2/D2/I2 TAMAMLANDI ve MERGE OLDU (PR #68-71). Kalan tek dilim: D1 (rate limit, Faz 1 trafiği bekliyor) — milestone TAMAMEN KAPANMADI. **M6c (mesaj içeriği anonimleştirme) TÜM dilimleri TAMAMLANDI VE main'e MERGE OLDU (PR #73-76) — milestone KAPANDI. M6b (5651 trafik logu): TÜM KOD DİLİMLERİ (A-H) TAMAMLANDI (2026-08-25) — A-D MERGE OLDU (PR #77-83), Slice F push onayında. TrafficLog artık REST+WS'te gerçek satır üretiyor VE 18 ay sonra otomatik siliniyor. Kalan: founder-task'lar (avukat soruları, Senaryo A/B, Postgres yükseltmesi).** Detaylar `docs/milestones/M7b-scale-polish.md`, `docs/milestones/M6b-traffic-log-5651.md`.

## Şu an ne çalışıyor
- **M0-M6 + M7a (Slice A-J) TAMAMEN BİTTİ.** M7a'nın tek kalıntısı: Postgres RAM/CPU/depolama ölçülemedi — `docs/BACKLOG.md` A18'e somut tetikleyiciyle ertelendi.
- **M7b Slice E/H2/D2/I2 TAMAMLANDI ve main'e MERGE OLDU (PR #68-71).** Oda keşfi + taslak kalıcılığı + zalgo koruması + tıklanabilir linkler (E); geri bildirim linki + moderatör oda duyurusu (H2); moderasyon sebebi/bildirimi + kendi mesajını silme + "düzenlendi" göstergesi (D2 — **ÖNEMLİ, hâlâ geçerli:** `reason` zorunlu hale geldiği için Render+Vercel deploy'ları ARKA ARKAYA yapılmalıydı, D2 merge olduğuna göre bu adım zaten tamamlanmış olmalı, aksi doğrulanmadıysa kontrol et); TR→EN UI geçişi (I2, BACKLOG A15 kapandı, A20 backend mesajları için açıldı).
- **M6b Slice A (proxy/IP) MERGE OLDU.** `client-ip.util.ts`'in `getRealClientIp()`'i POZİSYON-DOĞRULAMALI (string-arama DEĞİL) bir algoritma — sağdan sola yürüyüp Render'ın private-range hop'unu + Cloudflare'in yayınladığı aralıkları atlayan, ilk güvenilmeyen girdiyi döndüren, `*.onrender.com` açık kalsa bile sahtelenemez bir tasarım (bkz. Tuzaklar). REST (Slice A) VE WS (Slice D, `client.handshake`) ikisi de bunu kullanıyor.
- **M6b Slice B (`TrafficLog` şeması) MERGE OLDU (PR #80).** `SetNull` FK, `integrityHash` NOT NULL, `connectionId` WS START/END'i eşler. **Postgres kapasitesi (founder kararı KESİNLEŞTİ, PR #81 merge oldu):** kod bekler değil, ama Render Postgres planı gerçek yazım production'a deploy edilmeden ÖNCE founder tarafından yükseltilmiş olmalı (`docs/BACKLOG.md` A18).
- **M6b Slice C+D (yazma) MERGE OLDU (PR #82-83).** `TrafficLogMiddleware` her REST isteğinde (401/429 dahil); `MessagesGateway` her WS bağlantısında (`connectionId` ile eşlenen START/END, reddedilenler dahil) — ikisi de paylaşılan `traffic-log-writer.util.ts`'i (P2003 retry dahil) çağırıyor. Gerçek e2e koşumunda bulunanlar: bkz. Tuzaklar.
- **M6b Slice F (18 aylık silme) TAMAMLANDI, push onayında.** `TrafficLogService.purgeOldRows` 18 ay öncesini TAKVİM AYIYLA (`setMonth`, sabit-gün DEĞİL) hesaplayıp `POST /internal/traffic-logs/purge`'ü günlük tetikleyen ayrı bir GitHub Actions workflow'uyla siliyor — mevcut `CronSecretGuard` deseni, yeni secret/var yok. M6b'nin SON kod dilimi.
- **M6c (mesaj içeriği anonimleştirme) TÜM dilimleri TAMAMLANDI VE main'e MERGE OLDU, milestone KAPANDI.** `deleteAccount()` artık: (varsayılan açık checkbox işaretliyse) TÜM mesaj içeriğini/geçmişini/rapor snapshot'larını, (işaretsizse) SADECE yapısal PII (e-posta/telefon — URL bilerek hariç) içeren satırları `AUTHOR_DELETED_CONTENT`'e redakte ediyor; `docs/RUNBOOK.md` §3.8 manuel takedown prosedürü; `backfill-message-content-pii.ts` geçmiş satırları tarıyor (`render.yaml`+`ci.yml`'ye bağlı). WS yayını YOK (kapsam dışı, bilerek).
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend + Sentry.

## Şu an üzerinde çalışılan
- **Görev:** `m6b/slice-f-traffic-log-purge`'ün push'u kullanıcı onayında (Slice C+D zaten merge oldu).
- **Sonraki adım:** M6b'nin kod tarafı KAPANDI. Kalan: founder-task'lar (avukata iki soru, Senaryo A/B kararı, Postgres yükseltmesinin fiilen yapılması). D1 (rate limit) Faz 1 gerçek trafiğini bekliyor.

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
- Yerel Postgres'i `DROP DATABASE`+`migrate deploy`+`db:seed` ile "CI'daki gibi taze" sanma — CI (`ci.yml`) seed'den SONRA ayrıca `db:backfill-totp-secrets`+`db:backfill-room-members`+`db:backfill-message-content-pii` (M6c Slice C) çalıştırıyor; atlanırsa `listRooms` boş döner, WS `'ready'` hiç gelmez, composer sonsuza dek disabled kalır.
- `MiddlewareConsumer.forRoutes('*')` ile kayıtlı GLOBAL middleware'lerde `req.path` DEĞİL `req.originalUrl` kullan — tek-route'lu bir controller (`HealthController` gibi) kendi alt-router'ına mount edildiği için `req.path` o router'a GÖRE relatif döner (`/health` yerine `/`), `req.originalUrl` her zaman gerçek tam yolu yansıtır (M6b Slice C'de gerçek e2e koşumunda bulundu).
- Yeni bir e2e dosyası gerçek `AppModule`+DB ile sahte bir X-Forwarded-For/IP kullanacaksa `apps/api/test/support/random-test-ip.ts`'i (M6b Slice D) kullan, KENDİ küçük aralığını icat etme — Jest e2e dosyaları PARALEL koşuyor (`jest-e2e.json`'da `runInBand` yok), küçük bir aralık (ör. RFC 5737'nin tek bir /24'ü, 254 değer) dosyalar arası ÇARPIŞABİLİYOR (gerçekten oldu, bir testin "satır yok" iddiası başka bir dosyanın ürettiği satırla yanlış eşleşti). Ayrıca: gerçek bir WS sunucusu açan (`app.listen(0)` + `socket.io-client`) İKİNCİ bir e2e dosyası eklemek Jest'in "worker process gracefully exit edemedi" uyarısına yol açabilir (`--runInBand`'de tekrarlanmaz) — `io()`'ya `reconnection: false` eklemek çözer.
- API domaini Cloudflare'de - dashboard/DNS kaydı okuması TEK BAŞINA yeterli değil, GERÇEK istek log'uyla (production'da bilerek sahte `X-Forwarded-For` göndererek) çapraz doğrulanmalı (M6b Slice A'da dashboard "DNS-only" dedi ama gerçek trafik Cloudflare'in araya girdiğini kanıtladı). Render'ın `X-Forwarded-For`'u istemcinin gönderdiğini HİÇ temizlemiyor (sadece ekliyor) - "zincirde bir yerde güvenilir bir IP var mı" diye STRING İÇERİĞİNDE arama YAPMA (sahtelenebilir), POZİSYONA güven (sağdan sola yürü, Render'ın private-range hop'unu + Cloudflare'in yayınladığı aralıkları atla). `apps/api/src/services/client-ip.util.ts`'in `getRealClientIp()`'i TEK gerçek IP kaynağı, `app.set('trust proxy', N)` KULLANILMIYOR (M6b Slice A).
