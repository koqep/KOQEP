# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-07-29
**Aktif milestone:** M1 — Real Auth: Invite Signup + Login (`docs/milestones/M1-auth-invites.md`)

## Şu an ne çalışıyor
- **M0 — Walking Skeleton TAMAMLANDI.** Tüm kabul kriterleri karşılandı, ayrıca bu oturumda bu makinede bağımsız olarak yeniden doğrulandı (lint/typecheck/build/unit/e2e/fullstack-e2e hepsi yeşil).
- **M1 Slice A — invite-gated signup + login + token TAMAMLANDI** (`m1/slice-a-auth` branch'i, henüz merge edilmedi). `POST /auth/signup|login|refresh|logout` çalışıyor, testli. Dev-login hâlâ duruyor (`DevAuthController`, `ENABLE_DEV_LOGIN` ile), `apps/web` hâlâ onu kullanıyor — Slice E'de değişecek.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres, Basic-256mb/5GB) + Prisma.

## Şu an üzerinde çalışılan
- **Görev:** M1 devam ediyor.
- **Yarım kalan:** Slice A bitti (bkz. `docs/milestones/M1-auth-invites.md` Plan notları), henüz push/PR edilmedi.
- **Sonraki adım:** Slice B (TOTP + kurtarma kodları). En büyük risk TOTP kurtarma UX'i (bkz. Tuzaklar).

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.

## Yakın zamanda alınan kararlar
- 2026-07-29 — DB hosting: Render Postgres (Basic-256mb), Internal Database URL ile — Neon/Supabase değil (aynı platformda, ek hesap yok).
- 2026-07-28 — WS transport: Socket.IO, native ws değil — bkz. `docs/decisions/ADR-0007`.
- 2026-07-28 — Access token bellek-içi (React state) saklanıyor, localStorage/sessionStorage YOK.
- 2026-07-28 — M0'ın seed dev-login'i `ENABLE_DEV_LOGIN` env'i ile kapatılabilir hale getirildi (staging'de `true`) — M1'de tamamen kaldırılacak.
- 2026-07-29 — M1 Slice A: access token 24h → 15m (refresh token artık var); refresh token JWT değil, `crypto.randomBytes` + DB'de SHA-256 hash — ADR-0002'nin gerçek revocation gereksinimi bunu istiyordu.

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- TOTP kurtarma akışı gerçek bir davetten önce şahsen test edilmeli — M1'in en büyük solo-destek riski.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula.
- CI'da job-seviyesi env değişkenleri TÜM adım/alt süreçlere sızar — birden fazla uygulama aynı job'daysa env'i komut bazında scope'la.
- Prisma client üretimi TEK kaynaktan: `apps/api/package.json`'daki `postinstall` script'i — her `npm install`/`npm ci`'da otomatik çalışır, buildCommand/CI adımına gömmeye çalışma.
- Render servisi (`koqep-api`) Blueprint'e bağlı DEĞİL, elle kuruldu — `render.yaml` değişiklikleri canlıya OTOMATİK yansımaz, dashboard'dan elle güncellenmeli.
- `.env`/`.env.*` dosyaları `Read` için engelli — içerik değiştirmek için `Write` ile tam dosyayı körlemesine yeniden yaz.
- Render'da bir env var'ın DEĞERİNİ değiştirmek (ör. `ENABLE_DEV_LOGIN=false`) canlıya yansımayabilir — sadece değişkeni tamamen SİLMEK işe yaradı, gözlemlendi (2026-07-29). Kod tarafı `=== 'true'` ile strict, truthiness bug DEĞİL — doğrulandı, testli. Sebep muhtemelen Render'ın deploy tetikleme davranışı, kesin mekanizma bilinmiyor.
- `@prisma/client` import edilince `schema.prisma`'nın yanındaki `.env`'i sessizce (yeniden) yükler; dotenv zaten TANIMLI bir key'i override etmez ama `delete`'lenmiş/tanımsız bir key'i geri dolduruyor. Testte "env var yok" simüle etmek için `delete process.env.X` DEĞİL, boş string (`''`) kullan — yoksa test makineden makineye (yerel `.env` var/yok) farklı sonuç verir.
