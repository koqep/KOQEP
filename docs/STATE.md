# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-08-15
**Aktif milestone:** **M7a** (`docs/milestones/M7a-scale-gate.md`) — Slice A + Slice B TAMAMLANDI ve main'e MERGE EDİLDİ (kullanıcı production'da doğruladı). Dal `m7a/slice-b-room-member` henüz yerelde, push kullanıcının onayına kalıyor. M0-M6 TAMAMLANDI.

## Şu an ne çalışıyor
- **M0-M6 TAMAMEN BİTTİ.** Detaylar kendi milestone dosyalarının Plan notları bölümlerinde.
- **2026-08-12 — 500-kullanıcı kapsam turu:** hedef 20-30'dan 500'e çıktı, M7 **M7a** (kapı açma eşiği) / **M7b** (cila) 'ya bölündü + Faz 0→1(50)→2(150)→3(500) aşamalı davet planı. Detay: `docs/BACKLOG.md` "F. 500-KULLANICI KAPSAM TURU".
- **2026-08-14 — M7a Slice A (oturum kalıcılığı) TAMAMLANDI, main'e merge edildi.** SADECE refresh token httpOnly cookie'ye taşındı (`koqep_rt`, `path:/auth`), access token bearer'da kaldı. Double-submit CSRF + çoklu-sekme rotasyon grace-period. Tam tasarım: ADR-0002 Addendum.
- **2026-08-15 — M7a Slice B (`RoomMember` üyelik modeli) TAMAMLANDI.** WS broadcast fan-out artık üyelik-scoped (500 kullanıcı kapasite hedefi). Üç-kaynaklı backfill (çekirdek+kurucu+katılımcı), `scope=mine/discoverable/all` + join/leave endpoint'leri, lifecycle bildirimleri global broadcast'e geçti. Tam tasarım: ADR-0009. 209 birim+111 e2e (apps/api, iki koşu) + 70 Playwright (apps/web) testi geçti.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend + Sentry.

## Şu an üzerinde çalışılan
- **Görev:** M7a Slice B implementasyonu bitti, doğrulandı, dokümante edildi. Push kullanıcının onayında.
- **Sonraki adım:** Slice B main'e merge edilip production'da doğrulanınca, M7a'nın bir sonraki dilimi (Slice C — self-servis moderatör atama) plan-modu turuyla başlar.

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.
- `User.role` alanı var, erişim kontrolü kodda çalışıyor ama production'da henüz kimse `moderator` değil — founder'ın kendi satırını elle SQL ile ayarlaması hâlâ öneriliyor (M7a Slice C self-servis atama getirecek).
- `GET /rooms?scope=all` (moderasyon) sayfalanmıyor — somut tetikleyici `docs/BACKLOG.md` A16'da.

## Yakın zamanda alınan kararlar
- Access token bellek-içi (React state), refresh token httpOnly cookie'de — bkz. ADR-0002 + Addendum.
- 2026-08-12 — ADR-0008: `totpSecret` şifreleme anahtar-kaybı KALICI, rotasyon yolu YOK (bilinçli, sessiz varsayım değil).
- 2026-08-15 — ADR-0009: `RoomMember` üyelik bir yayın/liste-scoping mekanizması, erişim kontrolü DEĞİL — üye olmayan bir kullanıcı hâlâ herhangi bir aktif odaya isimle yazabilir/okuyabilir, bilerek.

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula.
- CI'da job-seviyesi env değişkenleri JOB'LAR ARASI miras YOK — her job'ın kendi `env:` bloğu var.
- Render servisi Blueprint'e bağlı DEĞİL — `render.yaml`/env var DEĞİŞİKLİĞİ canlıya otomatik yansımaz, sadece env var'ı tamamen SİLMEK güvenilir çalıştı.
- `.env`/`.env.*` dosyaları `Read`/`cat` için engelli; `@prisma/client` import edilince `.env`'i ayrıca sessizce (yeniden) yükler.
- **Sadece HTTP status koduna göre otomatik davranış tetikleme** — AYNI status kod hem "token geçersiz" hem domain hataları için kullanılıyor; sadece `code:'INVALID_TOKEN'` taşıyan 401'lerde retry.
- `apps/web/e2e/support/auth-mocks.ts` paylaşılan fixture — yeni auth-akışı testi yazarken kopyalamak yerine BUNU kullan/genişlet.
- Bash tool `git push`'u kullanıcının izin ayarları sessizce "denied" döndürebilir — kullanıcıdan onaylamasını iste.
- `prisma migrate dev` migration dosyasını hemen uyguluyor — elle SQL eklemek için önce `--create-only` kullan.
- NestJS WS gateway'lerinde: `WsException` DIŞINDAKİ her şey jenerik hataya çevrilir; `.emit` disconnect'te ack'i kaybeder, `.timeout()` şart.
- Plan modundayken `ExitPlanMode` SADECE "implementasyona başla" onayı DEĞİL — plan dosyası dışındaki HER dosyayı düzenlemenin tek kilidi.
- Test harness üretim davranışını EKSİK yansıtıyor: (1) `apps/web` Playwright `next start` kullanıyor — kod değişikliğinden SONRA `npm run build` şart, aksi halde eski build sessizce servis edilir. (2) `apps/api`'nin e2e `TestingModule`'ü `ValidationPipe`'ı ÇALIŞTIRMAZ.
- Playwright: `page.route("**/rooms", ...)` sondaki `**` OLMADIĞI için query-string'li çağrıları eşleştirmez (ayrı bir route/predicate gerekir); `getByText`/`getByRole` `exact:true` OLMADAN substring eşleşir — yeni bir buton/başlık metni eklerken mevcut metinlerle substring çakışmasını kontrol et (`room-moderation.spec.ts`'in `getByText("odalar")`'ı "odaları keşfet" butonuyla ÇAKIŞTI, M7a Slice B).
- Birden fazla bağımsız sorguyu (`Promise.all`) tek bir `createMany`'e yazan bir backfill script'i, PARALEL e2e worker'ların AYNI DB'ye eşzamanlı yazdığı testlerde okuma-yazma arasında FK ihlaline çarpabilir (M7a Slice B'de gerçekleşti) — hatayı yakalayıp geçerli id'lere göre filtreleyip retry et, YUTMA. Aynı sebeple böyle bir script'in idempotentlik testinde "ikinci koşu global sayım sıfır" assert ETME (yarış-güvenli değil) — belirli bir satırın `createdAt`'inin değişmediğini kontrol et (`backfillTotpSecrets`'ın kendi deseni).
