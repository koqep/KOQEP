# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-08-20
**M7a TAMAMEN KAPANDI (2026-08-19), M0-M6 TAMAMLANDI.** M7b (cila) sürüyor — Slice E TAMAMLANDI (2026-08-20, kod tamam, push kullanıcı onayında). Kalan dilimler: D1 (rate limit), D2 (moderasyon itirazı+kendi mesajını silme+"düzenlendi"), H2 (geri bildirim/duyuru), I2 (TR→EN UI). Detaylar `docs/milestones/M7b-scale-polish.md`'nin Plan notları.

## Şu an ne çalışıyor
- **M0-M6 + M7a (Slice A-J) TAMAMEN BİTTİ.** Detaylar kendi milestone dosyalarının Plan notları bölümlerinde. M7a'nın tek kalıntısı: Postgres RAM/CPU/depolama ölçülemedi (Render metrik paneli paket yükseltmesi istiyor) — `docs/BACKLOG.md` A18'e somut tetikleyiciyle ertelendi.
- **2026-08-20 — M7b Slice E (oda keşfi + taslak kalıcılığı + zalgo koruması + tıklanabilir linkler) TAMAMLANDI.** `Room.lastActivityAt` indeksi + keşif/moderasyon listeleri artık aktiviteye göre sıralı (switcher bilerek sabit alfabetik). `content-validation.util.ts` (`Intl.Segmenter`, native) grapheme başına 5 birleşik-işaret sınırı — hem `sendMessage` hem `editMessage`'da. `RoomView.tsx`'in taslağı `Record<roomId,string>` + localStorage debounce (çıkışta temizleniyor). `MessageContent.tsx` çıplak URL'leri linke çeviriyor (kod bloğu hariç, önizleme yok, `dangerouslySetInnerHTML` YOK). `THREAT-MODEL.md` satır 42 kapatıldı.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend + Sentry.

## Şu an üzerinde çalışılan
- **Görev:** M7b Slice E'nin push'u kullanıcının onayında (`m7b/slice-e-discovery-drafts-content`).
- **Sonraki adım:** Merge sonrası M7b'nin sıradaki dilimi — Faz 1 henüz açılmadıysa veri-bağımsız olanlardan (H2 geri bildirim/duyuru ya da I2 TR→EN UI) devam edilebilir; D1/D2 gerçek Faz 1 trafiği/moderasyon hacmi bekliyor.

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.
- `GET /rooms?scope=all` (moderasyon) sayfalanmıyor — somut tetikleyici `docs/BACKLOG.md` A16'da.
- `AuthService.verifyCurrentPassword` (deleteAccount + assignModerator reauth) hesap kilidi KORUMASI ALMIYOR — somut tetikleyici `THREAT-MODEL.md`'nin açık maddesinde.
- Render Postgres'in RAM/CPU/depolamasının 500 kullanıcıya yeteceği ÖLÇÜLEMEDİ (bağlantı-limiti AYRI, o doğrulandı) — somut tetikleyici `docs/BACKLOG.md` A18'de.

## Yakın zamanda alınan kararlar
- Access token bellek-içi (React state), refresh token httpOnly cookie'de — bkz. ADR-0002 + Addendum.
- 2026-08-19 — production `DATABASE_URL`'ine `connection_limit=30` EKLENDİ (founder, doğrulanmış: `max_connections=100`, Basic-256mb, Render dokümantasyonu).
- 2026-08-20 — RoomHeader (switcher) sıralaması BİLEREK sabit alfabetik kaldı; SADECE keşif+moderasyon listeleri aktiviteye göre sıralandı (kas hafızası/buton konumu tutarlılığı, kullanıcı kararı).

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula.
- `.env`/`.env.*` dosyaları `Read`/`cat` için engelli; `@prisma/client` import edilince `.env`'i ayrıca sessizce (yeniden) yükler.
- `apps/web/e2e/support/auth-mocks.ts` paylaşılan fixture — yeni auth-akışı testi yazarken kopyalamak yerine BUNU kullan/genişlet.
- `prisma migrate dev` migration dosyasını hemen uyguluyor — elle SQL eklemek için önce `--create-only` kullan.
- NestJS WS gateway'lerinde: `WsException` DIŞINDAKİ her şey jenerik hataya çevrilir (ayrı bir `'exception'` event'i, `'error'` DEĞİL — bir yük testi/script SADECE `'error'` dinlerse sunucu hatalarını kaçırır); `.emit` disconnect'te ack'i kaybeder, `.timeout()` şart.
- Plan modundayken `ExitPlanMode` SADECE "implementasyona başla" onayı DEĞİL — plan dosyası dışındaki HER dosyayı düzenlemenin tek kilidi.
- Test harness üretim davranışını EKSİK yansıtıyor: (1) `apps/web` Playwright `next start` kullanıyor — kod değişikliğinden SONRA `npm run build` şart. (2) `apps/api`'nin e2e `TestingModule`'ü `ValidationPipe`'ı ÇALIŞTIRMAZ.
- Playwright: `page.route("**/rooms", ...)` sondaki `**` OLMADIĞI için query-string'li çağrıları eşleştirmez; `getByText`/`getByRole` `exact:true` OLMADAN substring eşleşir.
- Paylaşılan e2e DB'sinde "sistemde toplam X satır var" gibi GLOBAL bir sayıya dayanan assertion YAZMA — o sınırı unit testte mock'la kanıtla, e2e'de SADECE senin yarattığın satırlarla deterministik olanı test et.
- Güvenlik-kritik bir yanıt yolunda (login, reauth) dış bir API çağrısını (email, HIBP) `await` ETME — zamanlama-oracle riski; `void`+kendi try/catch'iyle ateşle-unut yap.
- Postgres'te `ROUND(double precision, integer)` YOK — `::numeric` cast şart. Docs-only bir SQL dilimi bile gerçek DB'ye karşı test edilmeden yazılmaz.
- "Unable to start a transaction" İKİ FARKLI kök nedenden gelebilir (hot-row kilidi VEYA connection pool tükenmesi) — `connection_limit`'i büyütmenin etkisi BUNA göre TERS yönde olabilir; hot-row'u ÖNCE kaldır, SONRA pool'u test et.
- Ardışık, soğumadan çalıştırılan yük testleri AYNI local Postgres'te gürültü biriktirir — kesin karşılaştırma için her koşumdan önce `docker compose restart postgres`.
- Yerel Postgres'i `DROP DATABASE`+`migrate deploy`+`db:seed` ile "CI'daki gibi taze" sanma — CI (`ci.yml`) seed'den SONRA ayrıca `db:backfill-totp-secrets`+`db:backfill-room-members` çalıştırıyor (dev kullanıcı `seed.ts`'te `prisma.user.upsert` ile DOĞRUDAN yaratılıyor, signup'ın çekirdek-odalara-otomatik-üyelik akışının DIŞINDA) — atlanırsa `listRooms` boş döner, WS `'ready'` hiç gelmez, composer sonsuza dek disabled kalır (M7b Slice E'de gerçekleşti, kod bug'ı değildi).
