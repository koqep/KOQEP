# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-07-29
**Aktif milestone:** M1 — Real Auth: Invite Signup + Login (`docs/milestones/M1-auth-invites.md`)

## Şu an ne çalışıyor
- **M0 — Walking Skeleton TAMAMLANDI.** Tüm kabul kriterleri karşılandı: CI yeşil, seeded dev-login, WS round-trip (gönder → gerçek-zamanlı-al → persist), 1 e2e test, `apps/api` Render'da + `apps/web` Vercel'de canlı, production'da iki-sekme gerçek zamanlı demo doğrulandı (`/health` OK, DB bağlı).
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres, Basic-256mb/5GB) + Prisma.

## Şu an üzerinde çalışılan
- **Görev:** Yok — oturum kapatılıyor, M0 bitti.
- **Yarım kalan:** Yok.
- **Sonraki adım:** M1'e başla — `docs/milestones/M1-auth-invites.md`. Seed dev-login gerçek davetiye tabanlı kayıt ile değiştirilecek; TOTP (opsiyonel), access/refresh token, şifre sıfırlama, block-user. En büyük risk TOTP kurtarma UX'i (bkz. Tuzaklar).

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.

## Yakın zamanda alınan kararlar
- 2026-07-29 — DB hosting: Render Postgres (Basic-256mb), Internal Database URL ile — Neon/Supabase değil (aynı platformda, ek hesap yok).
- 2026-07-28 — WS transport: Socket.IO, native ws değil — bkz. `docs/decisions/ADR-0007`.
- 2026-07-28 — Access token bellek-içi (React state) saklanıyor, localStorage/sessionStorage YOK.
- 2026-07-28 — M0'ın seed dev-login'i `ENABLE_DEV_LOGIN` env'i ile kapatılabilir hale getirildi (staging'de `true`) — M1'de tamamen kaldırılacak.

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- TOTP kurtarma akışı gerçek bir davetten önce şahsen test edilmeli — M1'in en büyük solo-destek riski.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula.
- CI'da job-seviyesi env değişkenleri TÜM adım/alt süreçlere sızar — birden fazla uygulama aynı job'daysa env'i komut bazında scope'la.
- Prisma client üretimi TEK kaynaktan: `apps/api/package.json`'daki `postinstall` script'i — her `npm install`/`npm ci`'da otomatik çalışır, buildCommand/CI adımına gömmeye çalışma.
- Render servisi (`koqep-api`) Blueprint'e bağlı DEĞİL, elle kuruldu — `render.yaml` değişiklikleri canlıya OTOMATİK yansımaz, dashboard'dan elle güncellenmeli.
- `.env`/`.env.*` dosyaları `Read` için engelli — içerik değiştirmek için `Write` ile tam dosyayı körlemesine yeniden yaz.
