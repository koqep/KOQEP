# M1 — Real Auth: Invite Signup + Login

*Seed dev-login gerçek davetiye tabanlı kayıt ile değişir; opsiyonel TOTP, token akışı, şifre sıfırlama ve minimum bir güvenlik ağı (block) eklenir.*

**Goal:** Replace M0's seeded dev-login with real invite-gated signup, optional TOTP, and a working token lifecycle — plus the smallest possible abuse safety net.
**Demo:** A tester redeems a real invite code, creates an account, optionally turns on TOTP, logs in and out, resets their password, and blocks a test account.
**Estimated hours:** 55–85h (TOTP + recovery codes and a correctly-tested token/reset flow are the biggest single cost in the whole plan — see capacity check).

## Out of scope
- Invite-per-level-up (reputation doesn't exist until M4) — use a small founder-issued invite pool for now.
- User-created rooms (M3).
- Moderation tooling beyond block (M5).

## Acceptance criteria
- [x] A real external tester can redeem an invite code and create an account.
- [x] TOTP is available and optional; enabling it issues recovery codes.
- [x] Login issues an access + refresh token; refresh rotates correctly.
- [x] Password reset follows `docs/THREAT-MODEL.md` row 11: single-use/short-TTL reset link, email notification on reset, all sessions revoked on password change; if TOTP is enabled, reset alone does not grant login.
- [x] A user can block another user, and blocked users can't message them.
- [x] Tests cover signup, login, TOTP setup+recovery, password reset, and block.

## Tasks
- [x] Invite code model + redemption endpoint (founder-issued pool for now).
- [x] Signup + login endpoints, access/refresh token issuance (ADR-0002).
- [x] TOTP setup + recovery codes (optional).
- [x] Password reset flow with the THREAT-MODEL row-11 controls.
- [x] Block-user feature.
- [x] Tests for each flow.
- [ ] Remove M0's seeded dev-login endpoint (`AuthController`, `POST /auth/dev-login`) and the `ENABLE_DEV_LOGIN` env-gate around it entirely — it issues a token with zero credentials and was only ever env-gated (`ENABLE_DEV_LOGIN=true` in staging) as an M0 stopgap, not a real access control.

## Risks
- TOTP recovery UX is the top solo-support-burden risk identified in Phase 1 — mitigation: the founder personally runs the recovery-code flow start to finish before any real invite goes out.

## Earliest real-user point
**This is it — end of M1, not M2 or later.** A real invited stranger can sign up, optionally enable TOTP, and talk in the one room that exists so far, with a block button as a safety net. Shipping this at M0 (seeded login, zero abuse controls) would not be defensible. Waiting until M5 (full report flow + moderator audit log) to add *any* safety net would be over-cautious for a small, personally-vouched-for invite tree — a single individual's ability to stop unwanted contact is enough at this stage. That's why block-user is pulled into M1 instead of deferred with the rest of moderation tooling.

---

## Plan notları — Slice A: invite-gated signup + login + token issuance (backend)

**Görev:** M0'ın dev-login'i yanında (henüz kaldırılmadan), gerçek davet-tabanlı kayıt, giriş, refresh, çıkış uç noktaları.

**Kapsam dışı (bilinçli):** TOTP, şifre sıfırlama, block-user — ayrı slice'lar. Frontend signup/login ekranı — dev-login hâlâ `apps/web`'i besliyor, kopmasın diye bu slice'ta dokunulmadı. `AuthController.devLogin` bu yüzden silinmedi, `DevAuthController` adıyla ayrı bir dosyaya taşındı (aynı `ENABLE_DEV_LOGIN` kapısıyla) — iki controller `/auth` prefix'ini paylaşıyor, route çakışması yok.

**Yeni bağımlılıklar (onaylı):** `argon2` (şifre hash'leme), `class-validator` + `class-transformer` (DTO doğrulama, `.claude/rules/api.md` kuralı).

**Şema:** `User.passwordHash` (required), `User.inviterId` (self-relation, `onDelete: SetNull` — mevcut `Message.author` paterniyle tutarlı); yeni `Invite`, `RefreshToken` modelleri. Migration'da gerçek bir veri sorunu çıktı: `passwordHash`'i NOT NULL eklemek, M0'dan kalan tek seed satırını kırıyordu (`prisma migrate dev` bunu kendisi reddetti). `--create-only` ile migration dosyası üretilip elle expand/contract'a çevrildi: kolon önce nullable eklenir, geçersiz bir placeholder ile backfill edilir, sonra NOT NULL yapılır — `db:seed` tekrar çalışınca placeholder gerçek hash ile değişir.

**Bulunan ve düzeltilen bir hata:** İlk yazımda `signup()` daveti User'dan ÖNCE claim ediyordu — `Invite.usedById`'yi henüz var olmayan bir kullanıcı id'sine set etmeye çalışınca FK constraint ihlali (`P2003`), 500 olarak patlıyordu (e2e testte yakalandı). Sıra düzeltildi: User önce oluşturulur, davet sonra claim edilir, ikisi aynı transaction'da — claim yarışı kaybedilirse (`count===0`) User da geri alınır, yetim hesap kalmaz.

**Token tasarımı:** Access token JWT, `24h`'den `15m`'ye düşürüldü (artık refresh var, uzun ömürlü access token'a gerek yok). Refresh token JWT DEĞİL — `crypto.randomBytes(32)`, ham hâli sadece istemciye dönüyor, DB'de SHA-256 hash'i saklanıyor (`RefreshToken.tokenHash`). Rotasyon: her `refresh()` çağrısı eskisini `revokedAt` ile iptal eder, yeni bir çift döner.

**Seed:** `dev-seed.constants.ts`'e `DEV_USER_PASSWORD` ve 5 sabit `DEV_INVITE_CODES` (`DEV-INVITE-1..5`) eklendi — rastgele değil, bilerek deterministik (idempotent upsert, local test için tahmin edilebilir).

### Doğrulama
`npm run lint && npm run typecheck && npm test && npm run test:e2e --workspace=apps/api && npm run build` (hem `apps/api` hem `apps/web`) + `npm run test:e2e:fullstack --workspace=apps/web` — hepsi yeşil.

### Sıradaki
Slice B (TOTP), Slice C (şifre sıfırlama), Slice D (block-user), Slice E (frontend signup/login UI + dev-login'in tamamen kaldırılması).

---

## Plan notları — Slice A takip: dev-login exposure kapatıldı

Gerçek auth (Slice A) yayına girdikten sonra staging'de `ENABLE_DEV_LOGIN=true` açık kalmıştı — bu artık gerçek auth'un yanında duran, sıfır kimlik doğrulamalı tam bir bypass'tı. `render.yaml`'da `false` yapıldı, ama Render servisi Blueprint'e bağlı olmadığı için bunun canlıya yansıması için dashboard'dan elle kapatılması gerekti (yapıldı, `POST /auth/dev-login` artık 404). `docs/THREAT-MODEL.md` satır 13 olarak eklendi.

Bu sırada bir "değeri 'false' yapmak yetmedi, değişkeni silmek gerekti" gözlemi geldi. İncelendi: `app.module.ts`'teki karşılaştırma zaten `=== 'true'` (strict), truthiness bug DEĞİL — mevcut test (`dev-login-gate.e2e-spec.ts`) zaten literal `'false'` string'ini test ediyor ve geçiyordu. Ayrı, gerçek bir bulgu: `@prisma/client` import edilince `.env`'i sessizce yeniden yüklüyor, `delete`'lenmiş bir key'i geri dolduruyor (dotenv zaten TANIMLI bir key'e dokunmuyor ama silinmişe dokunuyor) — bu yüzden testte "tanımsız" simülasyonu `delete` yerine boş string ile yapıldı (ortam-bağımsız, güvenilir). Production'daki asıl sebep (Render'ın deploy tetikleme davranışı) doğrulanamadı, `STATE.md`'de "gözlemlendi, mekanizma bilinmiyor" olarak dürüstçe kaydedildi.

---

## Plan notları — Slice B: TOTP + kurtarma kodları

**Görev:** Opsiyonel TOTP kurulumu/etkinleştirme/kapatma + login akışına ikinci faktör.

**Kapsam dışı (bilinçli):** Şifre sıfırlama, block-user — ayrı slice'lar. Frontend UI — backend-only, Slice A'nın aynı gerekçesiyle. TOTP disable UI/akışı frontend'de yok henüz ama backend endpoint'i var (M1'in "optional" ifadesi hem açma hem kapamayı gerektiriyor).

**Yeni bağımlılık (onaylı):** `otpauth` — RFC 6238 TOTP, TypeScript-native, sıfır alt-bağımlılık.

**Şema:** `User.totpSecret`/`totpEnabledAt` (ikisi de nullable — Slice A'daki gibi expand/contract gerekmedi), yeni `TotpRecoveryCode` (`RefreshToken` ile aynı desen: hash'lenmiş, tek kullanımlık, `usedAt`).

**Küçük refactor:** `auth.service.ts`'e özel `hashRefreshToken` fonksiyonu, paylaşılan `crypto.util.ts`'deki `sha256Hex`'e taşındı — recovery code hash'leme de aynı fonksiyonu kullanıyor, kod tekrarı yok.

**Login akışı:** `LoginDto.totpCode` opsiyonel alan oldu. `AuthService.login()`: şifre doğrulandıktan sonra, kullanıcının TOTP'si açıksa `totpCode` zorunlu — önce canlı TOTP kodu olarak denenir, olmazsa kurtarma kodu olarak (tüketilerek). Yanıt şekli (ayrı bir "TOTP gerekli" sinyali vs. tek bir 401) bilerek basit tutuldu — Slice E'ye kadar hiçbir frontend bunu tüketmiyor, henüz var olmayan bir sözleşmeyi tasarlamak yerine.

**Bilerek ertelenen:** `totpSecret` DB'de düz metin duruyor, şifrelenmiyor — `JWT_SECRET`/`DATABASE_URL` ile aynı güven sınırında (ikisi de zaten Render'da düz env var), yani ek şifreleme asıl olarak "sadece DB sızıntısı, app sunucusu değil" senaryosuna karşı koruma sağlardı. `docs/THREAT-MODEL.md`'nin Open items bölümüne kalıcı bir not olarak eklendi, sessizce atlanmadı.

### Doğrulama
`npm run lint && npm run typecheck && npm test && npm run test:e2e --workspace=apps/api && npm run build` (apps/api) + `apps/web`'in `test:e2e:fullstack`'i (dev-login yolu etkilenmediği doğrulandı) — hepsi yeşil.

### Sıradaki
Slice C (şifre sıfırlama), Slice D (block-user), Slice E (frontend + dev-login kaldırma).

---

## Plan notları — Slice C: şifre sıfırlama (THREAT-MODEL satır 11)

**Görev:** `POST /auth/password-reset/{request,confirm}` — tek kullanımlık/kısa ömürlü link, e-posta bildirimi, şifre değişince tüm oturumların iptali.

**Kapsam kararı (kullanıcıyla netleştirildi):** Gerçek Resend entegrasyonu bu slice'ın kapsamında — mock'lanıp ertelenmedi, çünkü THREAT-MODEL satır 11'in "e-posta bildirimi" kontrolü kozmetik değil, kontrolün kendisi. Domain doğrulama/SPF/DKIM/DMARC kapsam DIŞI — DNS seviyesinde, sadece kullanıcı yapabilir; `docs/milestones/M6-launch-readiness.md`'ye görev olarak eklendi (daha önce hiçbir yerde yoktu, `docs/BACKLOG.md` A11 sadece işaretlemişti). Yalnızca bir Resend hesabı + API key yeterli — Resend'in paylaşımlı `onboarding@resend.dev` adresinden domain'siz gönderim yapılabiliyor.

**Yeni bağımlılık (onaylı):** `resend` — SDK, konstrüktörde API key zorunlu (`new Resend(undefined)` fırlatıyor, herhangi bir string fırlatmıyor — bu yüzden `ConfigService.get('RESEND_API_KEY') ?? 'unset-in-local-dev'` fallback'i şart, yoksa RESEND_API_KEY ayarlanmamış her makinede TÜM e2e testler kırılırdı, sadece şifre sıfırlama değil).

**Bulunan bir API detayı:** Resend SDK hata durumunda fırlatmıyor, `{data, error}` döndürüyor — `EmailService` bunu kontrol edip elle `throw` ediyor, yoksa `AuthService`'teki catch-ve-logla tasarımı hiç tetiklenmezdi.

**Şema:** Yeni `PasswordResetToken` (nullable alan yok, yeni tablo — Slice A'daki gibi expand/contract gerekmedi). `signup.dto.ts`'teki `MIN_PASSWORD_LENGTH`/`MAX_PASSWORD_LENGTH` export edildi, `ConfirmPasswordResetDto` aynı sabitleri kullanıyor (iki ayrı sabit yerine).

**Enumeration'a karşı tasarım:** `requestPasswordReset` her zaman `{ok:true}` döner — kullanıcı bulunamasa da, e-posta gönderimi başarısız olsa da. Sadece e-posta gönderim hataları yutulup loglanıyor (Nest'in yerleşik `Logger`'ı, yeni bağımlılık yok); DB gibi gerçek altyapı hataları hâlâ fırlatılıyor (onlar enumeration riski taşımıyor, tüm istekleri eşit etkiliyor).

**"Sıfırlama tek başına giriş sağlamaz" (TOTP açık olsun olmasın):** Özel bir dallanma yerine yapısal bir sonuç — `confirmPasswordReset` hiçbir zaman token döndürmüyor, kullanıcı ayrıca `/auth/login`'e gidiyor (TOTP kontrolü zaten orada, Slice B'den beri).

### Doğrulama
`npm run lint && npm run typecheck && npm test && npm run test:e2e --workspace=apps/api && npm run build` (apps/api) + `apps/web`'in `test:e2e:fullstack`'i — hepsi yeşil. E2e test gerçek bir network çağrısı yapmıyor — `EmailService` Nest'in `overrideProvider`'ıyla değiştirilip reset linkini/token'ı network'e çıkmadan yakalıyor.

### Sıradaki
Slice D (block-user), Slice E (frontend + dev-login kaldırma).

---

## Plan notları — Slice D: block-user

**Görev:** Bir kullanıcı diğerini engelleyebilir, engellenenin mesajları engelleyene ulaşmaz.

**Kapsam kararı (bilerek netleştirildi):** Uygulamada tek bir paylaşımlı oda var (`genel`), DM/özel mesajlaşma yok — THREAT-MODEL satır 10'un bahsettiği DM bağlamı henüz mevcut değil. Bu yüzden "engellenen mesaj gönderemez" şu şekilde uygulandı: engellenen kullanıcının mesajları SADECE engelleyene ulaşmıyor (hem geçmişte hem gerçek zamanlı) — odadaki herkes başkası normal şekilde görmeye devam ediyor. Engel tek yönlü ve sessiz (engellenen bilgilendirilmiyor, odaya yazmaktan alıkonulmuyor — bu bir moderatör aksiyonu olurdu, M5'e kadar kapsam dışı). Mevcut mimariye göre doğru minimum yorum bu — var olmayan bir DM-engelleme özelliğinin sulandırılmışı değil.

**Şema:** Yeni `Block` (`@@unique([blockerId, blockedId])` — idempotent engelleme/kaldırma, tekrar satırı yok). Nullable alan yok, yeni tablo — Slice A'daki gibi expand/contract gerekmedi.

**Kullanıcılar email ile referanslanıyor, id ile değil:** `MessageDto` şu an sadece `authorEmail` döndürüyor, `authorId` hiçbir yerde client'a açık değil — bu yüzden `POST /users/block`/`unblock` da `{email}` alıyor, gelecekteki frontend'in gerçekten kullanabileceği tek tanımlayıcı bu.

**Geçmiş filtreleme (`MessagesService.getRecentMessages`):** Bare `notIn` yerine bilerek `OR: [{authorId: null}, {authorId: {notIn: blockedIds}}]` kullanıldı — SQL'in `NOT IN` + NULL semantiği sürpriz yapabilir (`NULL NOT IN (...)` SQL'de `NULL` değerlendirilip satırı sessizce dışarıda bırakabilir), `authorId` nullable (ADR-0005, anonimleştirilmiş yazar) — açık OR, anonimleşmiş mesajların kimse için yanlışlıkla kaybolmayacağını garanti ediyor.

**Gerçek zamanlı filtreleme (`MessagesGateway.handleMessageSend`):** Eskiden `this.server.to(roomId).emit(...)` ile blanket broadcast yapılıyordu. Artık `this.server.in(roomId).fetchSockets()` ile odadaki socket'ler tek tek geziliyor, mesajın yazarını engelleyenlerin socket'i atlanıyor, gerisine ayrı ayrı `emit` ediliyor.

### Doğrulama
`npm run lint && npm run typecheck && npm test && npm run test:e2e --workspace=apps/api && npm run build` (apps/api) + `apps/web`'in `test:e2e:fullstack`'i — hepsi yeşil. E2e test gerçek 3 kullanıcı + gerçek WS bağlantısıyla tam akışı doğruluyor: engellemeden önceki mesaj geçmişte kalır, engelden sonraki mesaj ne geçmişte ne gerçek zamanlı engelleyene ulaşır (üçüncü kullanıcıya ulaşmaya devam eder), engel kaldırılınca tekrar ulaşır.

### Sıradaki
Slice E — son slice: frontend signup/login/TOTP/reset/block UI, `apps/web`'in dev-login'den koparılması, `DevAuthController`'ın ve `ENABLE_DEV_LOGIN` kapısının tamamen kaldırılması. E1-E5 olarak alt-slice'lara bölündü (bkz. aşağıdaki plan notları) — bu kadar geniş bir kapsamı tek adımda yapmak yerine.

---

## Plan notları — Slice E1: auth kabuğu (signup + login UI, dev-login-on-mount'un yerini alır)

**Görev:** `apps/web` artık mount'ta otomatik `/auth/dev-login` çağırmıyor — gerçek bir giriş/kayıt ekranı var. Slice E'nin ilk alt-parçası; E2 (şifre sıfırlama UI), E3 (TOTP UI), E4 (block/unblock UI), E5 (dev-login'in tamamen kaldırılması) ayrı plan notları alacak.

**Kullanıcıyla netleştirilen sıralama:** Backend'deki dev-login (`DevAuthController`) bu slice'ta DOKUNULMADAN kalıyor — sadece frontend onu artık çağırmıyor. Silme işi en son, E5'te, frontend gerçekten ihtiyaç duymadığından emin olunca.

**Slice B'den kalan bilinçli ertelenmiş bir kararı çözdü:** Login'in "yanlış şifre" ile "TOTP gerekli" 401'lerini ayırt etme sözleşmesi Slice B'de bilerek tasarlanmamıştı ("henüz var olmayan bir sözleşmeyi tasarlamak yerine"). Artık gerçek bir tüketici (bu UI) var. Mesaj metnine string-match yapmak yerine (kırılgan — kullanıcı Slice A'da `.env` yan-etkisine güvenmeyi tam bu gerekçeyle reddetmişti) NestJS'i doğrudan kontrol edildi: `new UnauthorizedException({code, message})` body'yi olduğu gibi serialize ediyor (`ex.getResponse()` ile doğrulandı). `AuthService.login()`'in iki fırlatma noktası artık `code: 'INVALID_CREDENTIALS'` / `code: 'TOTP_REQUIRED'` taşıyor; testler bu kontratı `toMatchObject({response:{code:...}})` ile açıkça doğruluyor, sadece "bir şey fırlattı" değil.

**Bilinçli kapsam dışı:** Sessiz token-yenileme/retry mantığı YOK. Access token 15 dakika (Slice A); M1'in Demo satırı "giriş/çıkış yapar" diyor, "saatlerce kesintisiz oturum" değil. Süresi dolan bir token'la ortasında başarısız olan bir istek zaten var olan gevşek hata toleransına (`if (!response.ok) return;`) düşüyor — regresyon değil, bilinçli bir kesinti.

**Frontend yapısı:** `lib/api.ts` (yeni, `ApiError` sınıfı `code` alanını taşıyor), `app/components/AuthView.tsx` (tek component, `mode: 'login'|'signup'` iç state — iki ayrı route değil), `app/components/RoomView.tsx` (eskiden `page.tsx`'in tamamı olan oda ekranı, artık `accessToken` prop olarak alıyor, kendi dev-login'ini çekmiyor, bir "çıkış" aksiyonu eklendi), `app/page.tsx` (artık sadece orkestratör — token state'i tutar, `AuthView`/`RoomView` arasında seçer).

**Dokunulan/yeniden yazılan testler:** `e2e/single-room.spec.ts` artık önce login formunu dolduruyor (dev-login mock'u yerine `/auth/login` mock'u). Yeni `e2e/auth.spec.ts`: kayıt başarılı akışı, yanlış bilgi hatası (TOTP alanı görünmüyor), TOTP gerekince alanın belirmesi + doğru kodla ikinci denemenin başarılı olması (route mock'u bir sayaçla ilk çağrıda 401, ikincide başarı döndürüyor). `e2e-fullstack/message-round-trip.spec.ts` artık seed'lenmiş dev kullanıcının gerçek email/şifresiyle her iki context'te de UI üzerinden gerçekten giriş yapıyor; reload sonrası oturum bellek-içi olduğundan düşüyor (ADR-0002, bilinçli), bu yüzden reload'dan sonra tekrar giriş yapılıyor — testin "reload sonrası kalıcı" iddiası artık gerçekten DB kalıcılığını kanıtlıyor, geçici local state'i değil.

### Doğrulama
Her iki workspace: `apps/api` lint/typecheck/unit(59)/e2e(22)/build; `apps/web` lint/typecheck/build/`test:e2e`(4, mock'lu)/`test:e2e:fullstack`(1, gerçek) — hepsi ilk denemede yeşil.

### Sıradaki
E2 (şifre sıfırlama UI) — ayrı bir plan modu turu alacak.

---

## Plan notları — Slice E2: şifre sıfırlama UI

**Görev:** Slice C'de hazır olan iki endpoint'in (`POST /auth/password-reset/request`,
`POST /auth/password-reset/confirm`) frontend'i. İki farklı akış olduğundan iki farklı
yerde yaşıyorlar: "request" adımı (sadece e-posta) `AuthView`'da üçüncü bir `mode`
(`forgot-password`) olarak eklendi — signup'a paralel bir toggle. "confirm" adımı ise
kullanıcı bu cihazda oturum açmamış durumdayken e-postadaki linkten geliyor, o yüzden
gerçek bir route gerekiyordu: yeni `apps/web/app/reset-password/page.tsx` +
`app/components/ResetPasswordView.tsx`.

**Anti-enumeration UI'da da korundu:** Backend `request` endpoint'i e-posta kayıtlı
olsun olmasın her zaman `{ok:true}` döner (THREAT-MODEL satır 11). UI da aynı nötr
mesajı gösteriyor — "Bu e-posta kayıtlıysa bir sıfırlama bağlantısı gönderildi." —
"bulundu/bulunamadı" ima eden hiçbir dallanma yok.

**Next.js detayı:** `/reset-password` route'u `useSearchParams()` kullanıyor, bu App
Router'da `<Suspense>` sınırı gerektiriyor (build sırasında doğrulandı — static prerender
başarılı). Route dosyası sadece Suspense sarmalayıcısı, gerçek form/mantık
`ResetPasswordView.tsx`'te.

**Bilinçli kapsam dışı:** Şifre tekrar alanı yok (backend istemiyor, hiçbir tüketici
talep etmedi). Gerçek e-posta ile uçtan uca fullstack test yok — token'ı gerçek bir
e-postadan yakalayacak bir test altyapısı yok ve gerekçesi de yok; Slice C'nin kendi
`password-reset.e2e-spec.ts`'i (`overrideProvider` ile) zaten gerçek backend akışını
kanıtlıyor. Frontend'in işi sadece iki endpoint'i doğru çağırıp yanıtı doğru işlemek,
bunu mock'lu testler tam kapsıyor.

**Dokunulan/yeni testler:** `e2e/auth.spec.ts`'e eklendi:
`sifremi_unuttum_gonderince_notr_mesaj_gosterir` ("şifreni mi unuttun?" linki forma
geçiyor, gönderince nötr mesaj görünüyor, "girişe dön" login'e geri dönüyor). Yeni
`e2e/reset-password.spec.ts` (3 test): token'sız URL "geçersiz bağlantı" gösteriyor,
geçerli token + başarılı mock "şifren güncellendi" + login'e link gösteriyor, başarısız
mock (400) backend'in kendi hata mesajını gösteriyor.

### Doğrulama
Her iki workspace: `apps/api` lint/typecheck/unit(59)/e2e(22)/build; `apps/web`
lint/typecheck/build/`test:e2e`(8, mock'lu)/`test:e2e:fullstack`(1, gerçek) — hepsi ilk
denemede yeşil.

### Sıradaki
E3 (TOTP UI) — ayrı bir plan modu turu alacak.

---

## Plan notları — Slice E3: TOTP kurulum/kapatma UI

**Görev:** Slice B'de hazır olan üç endpoint'in (`POST /auth/totp/{setup,enable,disable}`,
hepsi `JwtAuthGuard` ile korumalı) frontend'i. `setup` secret'ı hemen kalıcı hale getirir
ama "etkin" değildir; `enable` doğru kodla onaylanınca `totpEnabledAt`'i set eder ve
8 kurtarma kodunu bir kerelik açık metin döner; `disable` canlı bir TOTP kodu ya da
kullanılmamış bir kurtarma kodu ister, şifre istemez.

**Backend'de kullanıcı profili/durumu endpoint'i yok** (`GET /auth/me` vb.) — frontend'in
"bu kullanıcıda TOTP açık mı" diye sorabileceği bir yer yok. Backend değişikliği
gerekmeden çözüldü: bir login'in TOTP istemesi zaten "TOTP açık" demektir, signup ise
tanım gereği kapalı demektir. `AuthView`, `onAuthenticated(tokens, totpEnabled)` imzasıyla
bunu (`mode === "signup" ? false : totpRequired`) yukarı taşıyor; `page.tsx` `totpEnabled`
state'i tutup `RoomView`'a `initialTotpEnabled` olarak geçiyor. `RoomView` kendi
`totpEnabled` state'ini bu prop'tan besliyor, sonraki değişiklikleri (enable/disable
başarılı olunca) yeniden sorgulamadan optimistic günceliyor.

**Yeni bağımlılık — onaylandı:** `qrcode-terminal` (+ dev: `@types/qrcode-terminal`).
Görsel `<img>` QR ya da sade metin-secret alternatiflerine karşı seçildi — paketin
gerçek kaynağı (`lib/main.js`) okunarak doğrulandı: `{small: true}` seçeneğiyle çıktı
saf Unicode blok karakteri (█▀▄), ANSI kaçış kodu yok, Node'a özgü API (`fs`/`process`)
kullanmıyor — tarayıcıda güvenle çalışıyor. Sıfır alt-bağımlılık. "Terminal estetikli,
metin-only" ürün kimliğine `<img>` QR'dan daha uygun.

**UI yapısı — yeni route yok:** Şifre sıfırlamanın aksine (oturumsuz, e-posta linkiyle
erişilir), TOTP kurulumu aktif oturum gerektirir — `RoomView` içinde header'daki yeni
"iki adımlı doğrulama" butonuyla açılan, `page.tsx`'in `AuthView`/`RoomView` arasında
kullandığı aynı tam-değiştirme desenini bir seviye aşağıda tekrarlayan yeni bir
`TotpSettingsView.tsx` komponenti. Modal/dialog kurulmadı — kodda hiç precedent yok,
gereksiz karmaşıklık (overlay, focus trap, z-index) eklerdi.

**`lib/api.ts`:** `postJson`'ın hata ayrıştırma mantığı ortak bir `sendJson` yardımcısına
çıkarıldı; `authedPostJson` bunu `Authorization: Bearer` header'ıyla kullanıyor (kod
tekrarını önlemek için — önceden bu header sadece `RoomView.tsx`'te satır içi
oluşturuluyordu). Yeni export'lar: `TotpSetup`, `setupTotp`, `enableTotp`, `disableTotp`.

**Kilitlenme kurtarma boşluğu (kullanıcı sorusu üzerine, uygulamadan önce çözüldü):**
Hem authenticator hem 8 kurtarma kodu kaybedilirse kod tarafında kurtarma yolu yok —
ne bir admin/rol kavramı ne bir admin endpoint'i var. `docs/PRD.md`'nin "Zero users lost
to account lockout from TOTP" hedefiyle gerginlik burada. Kod yazılmadı; bunun yerine
`docs/THREAT-MODEL.md`'ye yeni bir "open item" eklendi: doğrulanmış bir destek talebinde
founder Render Postgres konsolundan elle `totpSecret`/`totpEnabledAt`'i `NULL`lar,
somut bir tetikleyiciyle ("ikinci kez talep edilirse" ya da "M3 kapsamı") gerçek bir
admin endpoint'ine geçiş planlanır — plaintext-`totpSecret` maddesiyle aynı desen.

**Dokunulan/yeni testler:** Yeni `e2e/totp-settings.spec.ts` (6 test, mock'lu): TOTP
kapalıyken panel "kurulumu başlat" gösteriyor; kurulum başlatılınca secret + ASCII QR +
kod alanı görünüyor; doğru kodla etkinleştirince 8 kurtarma kodu "bir daha
gösterilmeyecek" uyarısıyla gösteriliyor, "kaydettim" sonrası panel kapatma formuna
geçiyor; yanlış kod hata gösteriyor ama kurulumu yeniden başlatmıyor; TOTP zaten
açıkken panel doğrudan kapatma formuna giriyor, başarılı kapatma "kurulumu başlat"a
dönüyor; "kapat" sohbet ekranına dönüyor. `auth.spec.ts`'e dokunulmadı —
`onAuthenticated` imza değişikliği iç detay, görünür login davranışı değişmedi.

### Doğrulama
Her iki workspace: `apps/api` lint/typecheck/unit(59)/e2e(22)/build (bu slice'tan
etkilenmiyor, yine de yeniden çalıştırıldı); `apps/web`
lint/typecheck/build/`test:e2e`(14, mock'lu)/`test:e2e:fullstack`(1, gerçek) — hepsi ilk
denemede yeşil.

### Sıradaki
E4 (block/unblock UI) — ayrı bir plan modu turu alacak.

---

## Plan notları — Slice E4: block/unblock UI

**Görev:** Slice D'de hazır olan üç endpoint'in (`POST /users/block`, `POST
/users/unblock`, `GET /users/blocked`, hepsi `JwtAuthGuard` ile korumalı) frontend'i.
Hedef kullanıcı **email ile** belirtiliyor — backend'de user-list/search endpoint'i yok,
`MessageDto` da hiçbir zaman `authorId` döndürmüyor, sadece `authorEmail`; yani email
zaten frontend'in erişebildiği tek kimlik alanı.

**Mesaj filtreleme frontend'de hiç iş gerektirmedi.** `messages.service.ts`'teki
`OR`-tabanlı null-safe Prisma filtresi ve `messages.gateway.ts`'teki oda-geneli değil
soket-bazlı `emit` doğrulandı: engellenen kullanıcının mesajları hem geçmişte hem
gerçek zamanlı akışta zaten sunucu tarafında tamamen yok — frontend'in "engellenen
kullanıcıdan mesaj" diye gri gösterecek/gizleyecek hiçbir şeyi yok.

**UX kapsamı, kullanıcıyla netleştirildi:** mesaj render'ı dokunulmadan kaldı (gönderen
email'i mesajların yanında gösterilmiyor, mesaj üzerinden "engelle" aksiyonu yok).
Engelleme sadece elle email girerek — `TotpSettingsView` ile aynı desende yeni bir
ayarlar paneli: email gir, engelle; aynı panelde mevcut engellenenler listesi ve
"engeli kaldır".

**`RoomView.tsx` panel state'i refactor edildi:** tek `showTotpSettings: boolean`
yerine `activePanel: "none" | "totp" | "blocked"` union'ı — ikinci bir bağımsız boolean
eklemek iki panelin aynı anda render edilmesine izin verirdi (hiçbir şey karşılıklı
dışlamayı garanti etmiyordu). Bu, zaten test edilmiş E3 koduna davranış değiştirmeyen
küçük bir refactor — `totp-settings.spec.ts` hiç dokunulmadan yeniden çalıştırılıp
hâlâ geçtiği doğrulandı, ayrıca yeni bir regresyon testiyle ("iki adımlı doğrulama"
paneli açıkken "engellenenler"e tıklayınca birinin kaybolup diğerinin görünmesi)
karşılıklı dışlamanın gerçekten çalıştığı kanıtlandı.

**`lib/api.ts`:** ilk kez bir `authedGetJson` yardımcısı eklendi (önceden `GET
/rooms`/`GET /rooms/:name/messages` `RoomView.tsx` içinde ham `fetch` ile çağrılıyordu
— TOTP çağrılarının izlediği tipli-wrapper deseniyle tutarlı olsun diye). Yeni
export'lar: `blockUser`, `unblockUser`, `listBlockedUsers`.

**Yeni komponent:** `apps/web/app/components/BlockedUsersView.tsx` —
`TotpSettingsView`'daki tüm konvansiyonları tekrarlıyor (aynı `accessToken`/`onClose`
prop şekli, aynı hata gösterimi, aynı panel başlığı/`kapat` düzeni). Mount'ta
`listBlockedUsers` ile listeyi çekiyor; engelleme/kaldırma optimistic güncelleniyor
(yeniden fetch yok).

**Dokunulan/yeni testler:** Yeni `e2e/blocked-users.spec.ts` (7 test, mock'lu): liste
boşken boş durum mesajı; mevcut engellenenler listede görünüyor; email girip
engelleyince listeye ekleniyor (input temizleniyor); bilinmeyen email hata gösteriyor
(liste değişmiyor); "engeli kaldır" listeden çıkarıyor; "kapat" sohbet ekranına
dönüyor; iki panelin karşılıklı dışlandığı (yukarıdaki regresyon testi).

### Doğrulama
Her iki workspace: `apps/api` lint/typecheck/unit(59)/e2e(22)/build (bu slice'tan
etkilenmiyor, yine de yeniden çalıştırıldı); `apps/web`
lint/typecheck/build/`test:e2e`(21, mock'lu)/`test:e2e:fullstack`(1, gerçek) — hepsi
ilk denemede yeşil (bir testte `getByRole` substring eşleşmesi yüzünden "engelle" ile
"engellenenler" çakıştı, `exact: true` ile düzeltildi).

### Sıradaki
E5 (dev-login'in tamamen kaldırılması) — ayrı bir plan modu turu alacak, Slice E'nin
son alt-parçası.
