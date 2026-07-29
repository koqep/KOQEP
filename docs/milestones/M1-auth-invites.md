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
- [ ] Password reset follows `docs/THREAT-MODEL.md` row 11: single-use/short-TTL reset link, email notification on reset, all sessions revoked on password change; if TOTP is enabled, reset alone does not grant login.
- [ ] A user can block another user, and blocked users can't message them.
- [ ] Tests cover signup, login, TOTP setup+recovery, password reset, and block.

## Tasks
- [x] Invite code model + redemption endpoint (founder-issued pool for now).
- [x] Signup + login endpoints, access/refresh token issuance (ADR-0002).
- [x] TOTP setup + recovery codes (optional).
- [ ] Password reset flow with the THREAT-MODEL row-11 controls.
- [ ] Block-user feature.
- [ ] Tests for each flow.
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
