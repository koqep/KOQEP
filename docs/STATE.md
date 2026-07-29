# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-07-29
**Aktif milestone:** M1 TAMAMLANDI. M2 (`docs/milestones/M2-core-rooms-messaging.md`) henüz başlamadı — kapsamı bu oturumda seçilmedi, kullanıcı karar verecek.

## Şu an ne çalışıyor
- **M0 — Walking Skeleton TAMAMLANDI.** Tüm kabul kriterleri karşılandı, ayrıca bu oturumda bu makinede bağımsız olarak yeniden doğrulandı (lint/typecheck/build/unit/e2e/fullstack-e2e hepsi yeşil).
- **M1 — Real Auth: Invite Signup + Login TAMAMEN BİTTİ ve `main`'e MERGE EDİLDİ** (PR #9, `m1/slice-a-auth` → `main`, commit `4403a31`; kullanıcı kendisi push+merge etti, `git fetch`+`git log origin/main` ile bağımsız doğrulandı, 2026-07-29). CI'da `password-reset.e2e-spec.ts`'i kıran bir "Invalid URL" hatası bulunup düzeltildi (`test` job'ında `WEB_ORIGIN` eksikti, bkz. Tuzaklar) — merge o fix'i de içeriyor. `apps/web` artık gerçek `/auth/signup`+`/auth/login`+`/auth/password-reset/{request,confirm}`+`/auth/totp/{setup,enable,disable}`+`/users/{block,unblock,blocked}` kullanıyor. TOTP kurulumu ve engellenenler yönetimi `RoomView` içinde birbirini dışlayan paneller (yeni route değil, `/reset-password` istisna). **Dev-login (`DevAuthController`, `ENABLE_DEV_LOGIN`) koddan tamamen silindi (E5)** — Render dashboard'dan da zaten daha önce silinmişti (kullanıcı teyidi).
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres, Basic-256mb/5GB) + Prisma + Resend (e-posta, `koqep.com` doğrulanmış).

## Şu an üzerinde çalışılan
- **Görev:** M1 merge sonrası bulunan güvenlik açığı (bkz. karar günlüğü) kapatıldı VE kullanıcı production temizliğini bizzat tamamladı: eski test hesabı + `dev@koqep.local` silindi, kendi gerçek email/şifresiyle elle bootstrap edilmiş bir `User` satırıyla giriş yaptı (bkz. Tuzaklar — bootstrap chicken-and-egg), kendi id'siyle gerçek bir davet kodu üretti. Fix `fix/prod-dev-seed-leak` branch'inde commit edildi, henüz push edilmedi.
- **Yarım kalan:** `fix/prod-dev-seed-leak`'in push/PR/merge edilmesi. M2 kapsamı konuşulacak (kullanıcı bunu istedi, henüz başlamadı).
- **Sonraki adım:** M2 kapsam görüşmesi. TOTP kurtarma akışını gerçek bir davetten önce şahsen dene (bkz. Tuzaklar) — kod hazır ama UX riski hâlâ geçerli.

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
- 2026-07-29 — M1 Slice E2: şifre sıfırlama request adımı `AuthView`'da üçüncü bir `mode` (signup'a paralel), confirm adımı yeni `/reset-password` route'u (ilk gerçek Next.js routing ihtiyacı, `useSearchParams()` + `<Suspense>`). Gerçek e-posta ile fullstack test eklenmedi — Slice C'nin kendi `overrideProvider` tabanlı e2e testi backend akışını zaten kanıtlıyor.
- 2026-07-29 — M1 Slice E3: TOTP UI `RoomView` içinde bir panel (yeni route değil, oturum gerektiriyor); QR için yeni bağımlılık `qrcode-terminal` (ASCII/terminal render, onaylandı). TOTP-açık-mı durumu backend'den sorulmuyor — login'in TOTP istemiş olması zaten cevap. Tam kilitlenme (authenticator + 8 kod birden kaybolursa) için kod yazılmadı, `docs/THREAT-MODEL.md`'ye elle-DB-fix runbook notu eklendi (somut tetikleyiciyle gerçek admin endpoint'ine geçiş planı).
- 2026-07-29 — M1 Slice E4: engelleme sadece elle email girerek (kullanıcının kararı) — mesaj render'ına gönderen email'i eklenmedi, mesaj üzerinden "engelle" aksiyonu yok. `RoomView`'ın panel state'i `showTotpSettings: boolean`'dan `activePanel: "none"|"totp"|"blocked"` union'ına refactor edildi (iki bağımsız boolean karşılıklı dışlamayı garanti etmezdi).
- 2026-07-29 — M1 Slice E5: dev-login koddan tamamen silindi (`DevAuthController`, `issueDevLoginToken`, `ENABLE_DEV_LOGIN`, ilgili testler). `dev-seed.constants.ts`/`seed.ts` KALDI — `DEV_ROOM_NAME` tek odanın adı olarak üretim kodunda kullanılıyor, backdoor'un parçası değildi. İki e2e fixture (`messages.e2e-spec.ts`, `messages-gateway.e2e-spec.ts`) token almak için artık doğrudan `JwtService` kullanıyor. M1 bununla tamamen bitti.
- 2026-07-29 — Merge sonrası bulundu: `seed.ts`'in dev kullanıcı + `DEV_INVITE_CODES` kısmı production'a da yazılıyordu (aynı `preDeployCommand`, dev-login'le birebir aynı risk sınıfı). `SEED_DEV_FIXTURES` opt-in env'i eklendi (varsayılan KAPALI/güvenli, oda her zaman seed edilir) — `NODE_ENV`'e güvenilmedi, çünkü kod tabanında hiç kullanılmıyordu ve Render'ın onu nasıl set ettiği doğrulanamadı (bkz. Tuzaklar, ENABLE_DEV_LOGIN'in Render davranışı zaten bir kez sürpriz yapmıştı). `test-fullstack-e2e` CI job'ı `SEED_DEV_FIXTURES=true` ile açık tutuluyor (gerçek login testi buna ihtiyaç duyuyor); `test` job'ı kapalı bırakıldı ve testler değişmeden geçti (hiçbiri seed'in dev-kullanıcı kısmına bağımlı değilmiş, kendi fixture'larını upsert ediyorlar).
- 2026-07-29 — dev@koqep.local production'dan silinince ortaya çıktı: `signup()` hep bir davet ister, `Invite.issuedById` hep var olan bir `User`'a FK'lidir — sıfır kullanıcıyla uygulama kendi kendini bootstrap edemiyor. Çözüm koda değil belgeye gitti: `docs/THREAT-MODEL.md` Open items'a elle-SQL prosedürü (lokal `argon2.hash` + doğrudan `User` INSERT, `Invite` gerekmez) somut tetikleyiciyle (M2'nin davet-üretme endpoint'i bunu da kapsayacak şekilde tasarlanmalı) eklendi. Kullanıcı bunu gerçek production hesabıyla denedi, çalıştı.

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- TOTP kurtarma akışı gerçek bir davetten önce şahsen test edilmeli — M1'in en büyük solo-destek riski.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula.
- CI'da job-seviyesi env değişkenleri TÜM adım/alt süreçlere sızar — birden fazla uygulama aynı job'daysa env'i komut bazında scope'la.
- `.github/workflows/ci.yml`'deki her job'ın kendi `env:` bloğu var, JOB'LAR ARASI miras YOK — bir env var'ı sadece bir job'a eklemek diğerlerinde sessizce eksik kalır (gözlemlendi 2026-07-29: `WEB_ORIGIN` sadece `test-fullstack-e2e`'de vardı, `test` job'ında yoktu; `AuthService`'in reset linki `${WEB_ORIGIN}/...` `undefined/...` oluyordu, `password-reset.e2e-spec.ts`'teki `new URL()` "Invalid URL" ile patlıyordu — lokalde `.env` olduğu için gizli kalmıştı). Yeni bir env var eklerken HER job'ı tek tek kontrol et, birine eklemek yetmez.
- Prisma client üretimi TEK kaynaktan: `apps/api/package.json`'daki `postinstall` script'i — her `npm install`/`npm ci`'da otomatik çalışır, buildCommand/CI adımına gömmeye çalışma.
- Render servisi (`koqep-api`) Blueprint'e bağlı DEĞİL, elle kuruldu — `render.yaml` değişiklikleri canlıya OTOMATİK yansımaz, dashboard'dan elle güncellenmeli.
- `.env`/`.env.*` dosyaları `Read` için engelli — içerik değiştirmek için `Write` ile tam dosyayı körlemesine yeniden yaz.
- Render'da bir env var'ın DEĞERİNİ değiştirmek canlıya yansımayabilir — sadece değişkeni tamamen SİLMEK işe yaradı, gözlemlendi (2026-07-29, `ENABLE_DEV_LOGIN` ile). Sebep muhtemelen Render'ın deploy tetikleme davranışı, kesin mekanizma bilinmiyor — gelecekte başka bir env var'ı kapatırken de aynı şeyi bekle.
- `@prisma/client` import edilince `schema.prisma`'nın yanındaki `.env`'i sessizce (yeniden) yükler; dotenv zaten TANIMLI bir key'i override etmez ama `delete`'lenmiş/tanımsız bir key'i geri dolduruyor. Testte "env var yok" simüle etmek için `delete process.env.X` DEĞİL, boş string (`''`) kullan — yoksa test makineden makineye (yerel `.env` var/yok) farklı sonuç verir.
- `resend` SDK hata durumunda fırlatmaz, `{data, error}` döner — `EmailService` `error`'ı elle kontrol edip `throw` ediyor. Ayrıca `new Resend(undefined)` fırlatır ama boş olmayan herhangi bir string fırlatmaz — `RESEND_API_KEY` yoksa `ConfigService.get(...) ?? 'unset-in-local-dev'` fallback'i şart, yoksa AppModule'u ayağa kaldıran HER e2e test kırılır.
- `apps/web`'de token bellek-içi (ADR-0002) — reload/yeni sekme oturumu düşürür, bu kasıtlı. `e2e-fullstack` testleri reload sonrası tekrar login yapmalı, eski davranışa (otomatik dev-login) güvenilemez.
- Sıfır kullanıcılı bir DB'de (ör. dev seed kapalıyken/silindiğinde) `/auth/signup` kendi kendini başlatamaz — davet ister, davetin `issuedById`'i var olan bir `User`'a FK'lidir. İlk kullanıcı her zaman elle `INSERT INTO "User"` + lokal `argon2.hash` gerektirir (bkz. THREAT-MODEL Open items) — bunu "eksik davet kodu" hatası sanıp Invite tablosuna uğraşma, önce User'ı elle yarat.
