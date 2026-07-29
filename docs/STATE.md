# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-07-29
**Aktif milestone:** M1 — Real Auth: Invite Signup + Login (`docs/milestones/M1-auth-invites.md`)

## Şu an ne çalışıyor
- **M0 — Walking Skeleton TAMAMLANDI.** Tüm kabul kriterleri karşılandı, ayrıca bu oturumda bu makinede bağımsız olarak yeniden doğrulandı (lint/typecheck/build/unit/e2e/fullstack-e2e hepsi yeşil).
- **M1 Slice A+B+C+D — backend TAMAMLANDI**; **Slice E1 — frontend auth kabuğu (signup+login UI) TAMAMLANDI** (`m1/slice-a-auth` branch'i, henüz merge edilmedi). `apps/web` artık gerçek `/auth/signup`+`/auth/login` kullanıyor, dev-login'i mount'ta çağırmıyor. Dev-login backend'i (`DevAuthController`) hâlâ duruyor, bilerek — E5'e kadar silinmeyecek. Şifre sıfırlama/TOTP/block UI'ları henüz yok (E2-E4).
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres, Basic-256mb/5GB) + Prisma + Resend (e-posta, `koqep.com` doğrulanmış).

## Şu an üzerinde çalışılan
- **Görev:** M1 Slice E devam ediyor (E1 bitti, E2-E5 kaldı).
- **Yarım kalan:** Slice A-D + E1 bitti (bkz. `docs/milestones/M1-auth-invites.md` Plan notları), henüz push/PR edilmedi.
- **Sonraki adım:** E2 — şifre sıfırlama UI (yeni `/reset-password` route'u gerekecek, E1'de yoktu). TOTP kurtarma akışını gerçek bir davetten önce şahsen dene (bkz. Tuzaklar) — kod hazır ama UX riski hâlâ geçerli.

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.

## Yakın zamanda alınan kararlar
- 2026-07-29 — DB hosting: Render Postgres (Basic-256mb), Internal Database URL ile — Neon/Supabase değil (aynı platformda, ek hesap yok).
- 2026-07-28 — WS transport: Socket.IO, native ws değil — bkz. `docs/decisions/ADR-0007`.
- 2026-07-28 — Access token bellek-içi (React state) saklanıyor, localStorage/sessionStorage YOK.
- 2026-07-28 — M0'ın seed dev-login'i `ENABLE_DEV_LOGIN` env'i ile kapatılabilir hale getirildi (staging'de `true`) — M1'de tamamen kaldırılacak.
- 2026-07-29 — M1 Slice A: access token 24h → 15m (refresh token artık var); refresh token JWT değil, `crypto.randomBytes` + DB'de SHA-256 hash — ADR-0002'nin gerçek revocation gereksinimi bunu istiyordu.
- 2026-07-29 — M1 Slice B: `totpSecret` düz metin (şifrelenmemiş) — bilinçli, bkz. `docs/THREAT-MODEL.md` Open items. Kurtarma kodları da `RefreshToken` ile aynı desende hash'lenip tek kullanımlık.
- 2026-07-29 — M1 Slice C: e-posta sağlayıcı Resend, gerçek entegrasyon (mock değil) — kullanıcının kararı, gerekçe: THREAT-MODEL satır 11'in bildirimi kontrolün kendisi.
- 2026-07-29 — `koqep.com` Cloudflare üzerinden Resend'e bağlandı, SPF/DKIM/DMARC auto-configure ile eklendi, "Verified". M6'daki ilgili madde erken tamamlandı olarak işaretlendi (bkz. `docs/milestones/M6-launch-readiness.md`). `EMAIL_FROM_ADDRESS=noreply@koqep.com` kullanıcı tarafından `.env`'e eklenecek.
- 2026-07-29 — M1 Slice D: block tek yönlü ve sessiz, tek paylaşımlı oda mimarisine göre — engellenen kullanıcı odaya yazmaya devam eder, sadece engelleyene ulaşmaz (ne geçmişte ne WS'te). DM yok, moderatör mute/ban M5'e kadar kapsam dışı.
- 2026-07-29 — M1 Slice E kullanıcıyla E1-E5'e bölündü (tek dev-adımlık iş çok büyüktü). E1: `AuthService.login()`'in 401'leri artık `{code: 'INVALID_CREDENTIALS'|'TOTP_REQUIRED'}` taşıyor (Slice B'nin bilerek ertelediği karar) — frontend mesaj metnine değil `code`'a bakıyor.

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
- `resend` SDK hata durumunda fırlatmaz, `{data, error}` döner — `EmailService` `error`'ı elle kontrol edip `throw` ediyor. Ayrıca `new Resend(undefined)` fırlatır ama boş olmayan herhangi bir string fırlatmaz — `RESEND_API_KEY` yoksa `ConfigService.get(...) ?? 'unset-in-local-dev'` fallback'i şart, yoksa AppModule'u ayağa kaldıran HER e2e test kırılır.
- `apps/web`'de token bellek-içi (ADR-0002) — reload/yeni sekme oturumu düşürür, bu kasıtlı. `e2e-fullstack` testleri reload sonrası tekrar login yapmalı, eski davranışa (otomatik dev-login) güvenilemez.
