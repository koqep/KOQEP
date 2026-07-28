# M0 — Walking Skeleton

*En ince uçtan uca akış: repo → CI → DB → API → WS → istemci → deploy. Gerçek kullanıcı yok, tek sabit oda, tek seed kullanıcı.*

**Goal:** Prove the entire stack works end-to-end and is deployed, before any real feature exists.
**Duration:** ≤1 week (aspirational — see capacity check below).
**Estimated hours:** 45–70h (heaviest item: first-ever production deploy + WS-in-prod, not the feature code itself).
**Demo:** Two browser tabs, both logged in as the seeded dev user, one hardcoded room. A message sent in one tab appears in the other in real time, and survives a page reload (persisted).

## Out of scope
- Invite-only signup, TOTP, password reset.
- Any room beyond the one hardcoded room.
- Reputation/XP, moderation, rate limiting.

## Acceptance criteria
- [ ] CI is green: lint + typecheck + test.
- [ ] A seeded dev-login endpoint issues a working access token (no real invite flow yet).
- [ ] A message sent by one client appears via WebSocket in a second connected client in real time.
- [ ] The message is persisted in Postgres and survives a reload.
- [ ] One end-to-end test covers: send → receive over WS → persisted in DB.
- [ ] The app is deployed to a public staging URL.
- [ ] `docs/STATE.md` is current.

## Tasks
- [ ] Pick the deploy target *before* writing app code (a managed platform with git-push deploy — Fly.io/Render/Railway — not self-managed containers, per ADR-0003).
- [ ] Repo skeleton: NestJS + Next.js monolith per `docs/ARCHITECTURE.md`.
- [ ] CI pipeline (lint, typecheck, test).
- [ ] DB connection + first migration: minimal `User`, `Room`, `Message` tables per `docs/DATA-MODEL.md`.
- [ ] One seeded dev-login endpoint.
- [ ] One seeded room + one screen: terminal-style single-room view.
- [ ] WebSocket send/receive round trip, persisted to DB.
- [ ] One end-to-end test.
- [ ] Deploy to staging.

## Risks
- First-time solo production deploy (flagged FATAL in `docs/review/CRITIQUE.md`) — mitigation: the deploy target is chosen and a "hello world" is deployed on it *before* any real app code is written, so deploy friction surfaces on day 1, not day 7.

## Plan notları

**Görev:** DB bağlantısı + ilk migration — minimal `User`, `Room`, `Message` (Prisma), `docs/DATA-MODEL.md`'nin M0 alt kümesi.

**Kapsam dışı (bilinçli):** `inviterId`, `region`, TOTP alanları (User) — Invite/TOTP milestone'ına kadar eklenmiyor (M0 out-of-scope listesiyle tutarlı). `lastMessageAt`/`lastViewedAt` (Room) — arşiv/silme zamanlayıcısı henüz yok, o milestone'da eklenecek. `MessageEdit`, `ReputationEvent`, `ReadCursor`, `Invite` tabloları — bu görevin parçası değil. Render'da gerçek bir Postgres kaynağı oluşturup `DATABASE_URL`'i canlıya bağlamak da bu görevin dışında — bu görev sadece kod/migration'ı hazırlar, canlı bağlantı ayrı bir adım olarak (deploy hedefi seçimi gibi) yapılacak.

**Lokal DB:** Docker ile lokal Postgres (kullanıcı onayı alındı) — `docker-compose.yml` eklenecek.

### Dosyalar ve sıra

1. **`apps/api/package.json`** — `@prisma/client` (dependency), `prisma` (devDependency) eklenir. Script'ler: `db:generate`, `db:migrate` (`prisma migrate dev`), `db:migrate:deploy` (`prisma migrate deploy`, CI/prod için non-interactive).
2. **`package.json`** (kök) — `db:migrate` script'i eklenir (`npm run db:migrate --workspace=apps/api`) — CLAUDE.md'nin Komutlar bölümünde zaten belgeli ama şu an kökte tanımlı değil.
3. **`docker-compose.yml`** (kök, yeni) — lokal Postgres 16 servisi, sabit dev kullanıcı/şifre/db adı.
4. **`apps/api/.env.example`** (yeni) — `DATABASE_URL` şablonu. `.env` zaten `.gitignore`'da.
5. **`apps/api/src/db/schema.prisma`** (yeni) — datasource + generator + modeller:
   - `enum RoomStatus { active archived deleted }` (ADR-0006 ile tutarlı, tek yönlü ilerleme)
   - `User { id, email (unique), createdAt }`
   - `Room { id, name (unique), status (default active), createdAt }`
   - `Message { id, roomId → Room, authorId → User? (nullable, onDelete: SetNull — ADR-0005), content, createdAt }` + `@@index([roomId, createdAt])` (DATA-MODEL.md'nin büyüme stratejisiyle uyumlu)
6. **Migration üretimi** — lokalde `docker compose up -d` + `npm run db:migrate --workspace=apps/api` çalıştırılır, üretilen `apps/api/src/db/migrations/<ts>_init/` commit edilir. Elle SQL yazılmaz.
7. **`apps/api/src/db/prisma.service.ts`** (yeni) — `PrismaService extends PrismaClient`, `OnModuleInit`/`OnModuleDestroy` ile connect/disconnect.
8. **`apps/api/src/db/prisma.module.ts`** (yeni) — `@Global()` modül, `PrismaService`'i export eder.
9. **`apps/api/src/app.module.ts`** — `PrismaModule` import edilir.
10. **`.github/workflows/ci.yml`** — `postgres:16-alpine` service container + `DATABASE_URL` env eklenir; `npm test`'ten önce `db:migrate:deploy` adımı eklenir (CI'da migration gerçekten uygulanıp test edilsin).

### Testler
- **`apps/api/src/db/prisma.service.spec.ts`** (yeni, entegrasyon) — gerçek Postgres'e bağlanır (Docker/CI), bir `Room` + o odaya bağlı bir `Message` oluşturur, geri okur ve içeriğin doğru persist edildiğini doğrular; ayrıca var olmayan bir `roomId` ile mesaj oluşturmanın FK ihlaliyle reddedildiğini doğrular. Test kendi verisini temizler (`afterAll`), paralel çalışabilir şekilde benzersiz isimler kullanır.

### Notlar
- Test dosyası konumu mevcut emsale göre (`apps/api/src/api/health.controller.spec.ts`) kaynakla aynı dizinde tutuluyor — CLAUDE.md dizin haritasındaki `apps/api/tests/` ile birebir örtüşmüyor ama slice 0'da kurulan gerçek konvansiyon bu; sapma fark edilsin diye burada not düşülüyor.
- `docs/STATE.md` güncellemesi bu görevin parçası değil, `/wrap` ile yapılacak.

---

## Plan notları — Seeded dev-login endpoint

**Görev:** Gerçek invite/TOTP akışı olmadan, sabit seed kullanıcı için çalışan bir access token üreten `POST /auth/dev-login` endpoint'i.

**Kullanıcı onaylı kararlar:**
- Yeni bağımlılıklar: `@nestjs/jwt` (JWT imzalama/doğrulama) ve `@nestjs/config` (env değişkeni yönetimi — Prisma'nın örtük `.env` yükleme yan etkisine güvenmek yerine resmi, açık bir çözüm; ileride eklenecek diğer env değişkenleri için de tek kaynak olacak).
- Kapsam: sadece access token. Refresh token, rotation, revocation, parola/TOTP — ADR-0002'nin tam tasarımı, gerçek auth milestone'ına bırakılıyor (M0 out-of-scope listesiyle tutarlı; `THREAT-MODEL.md` satır 2'deki argon2id/TOTP/refresh-rotation gereksinimleri de o milestone'ın konusu).

**Kapsam dışı (bilinçli):**
- Oda seed'i ("one seeded room") — ayrı bir milestone görevi, bu işin parçası değil.
- Token'ı doğrulayan bir Guard/middleware — bu görev sadece token *üretimini* kapsıyor; token'ın API/WS'de doğrulanması WS round-trip görevinde ele alınacak.
- Render'da gerçek `JWT_SECRET` girilmesi — DB görevindeki `DATABASE_URL` paterniyle aynı: kod hazırlanır, canlıya bağlama ayrı adım.

**Karar değişikliği (kullanıcı reddetti, düzeltildi):** İlk taslakta `@prisma/client`'ın `.env`'i otomatik yükleme yan etkisine güvenmek öneriliyordu — kullanıcı bunu kırılgan bulup reddetti ("açıklamak için yorum gerekiyorsa zaten kırılgandır"). Bunun yerine `@nestjs/config` eklenir: `ConfigModule.forRoot({ isGlobal: true })` ile `.env` açıkça yüklenir, `JwtModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory })` ile `JWT_SECRET` import sırasına bağımlı olmadan, DI üzerinden okunur.

### Dosyalar ve sıra

1. **`apps/api/package.json`** — `@nestjs/jwt` ve `@nestjs/config` dependency olarak eklenir. `db:seed` script'i eklenir (`ts-node src/db/seed.ts`).
2. **`apps/api/.env.example`** ve **`apps/api/.env`** — `JWT_SECRET` eklenir (dev için rastgele bir değer).
3. **`apps/api/src/db/dev-seed.constants.ts`** (yeni) — `DEV_USER_EMAIL` sabiti (seed script ve AuthService arasında paylaşılan tek kaynak, sihirli string yok).
4. **`apps/api/src/db/seed.ts`** (yeni) — `DEV_USER_EMAIL` ile tek bir `User` upsert eder (idempotent, tekrar çalıştırılabilir).
5. **`apps/api/src/services/auth.service.ts`** (yeni) — `issueDevLoginToken()`: seed kullanıcıyı `email`'e göre bulur, bulunamazsa `UnauthorizedException` (mesajda `db:seed` ipucu), bulunursa `{ sub: user.id, email: user.email }` payload'ıyla imzalı JWT döner.
6. **`apps/api/src/api/auth.controller.ts`** (yeni) — `POST /auth/dev-login`, doğrudan `AuthService.issueDevLoginToken()`'a delegate eder (handler'da iş mantığı yok).
7. **`apps/api/src/app.module.ts`** — `ConfigModule.forRoot({ isGlobal: true })` ve `JwtModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config) => ({ secret: config.get('JWT_SECRET'), signOptions: { expiresIn: '24h' } }) })` imports'a, `AuthController` controllers'a, `AuthService` providers'a eklenir.
8. **`.github/workflows/ci.yml`** — `JWT_SECRET` env değişkeni eklenir (sabit bir CI-only değer); `db:migrate:deploy` adımından sonra `db:seed` adımı eklenir (e2e/entegrasyon testlerinden önce seed kullanıcı var olsun).

### Testler
- **`apps/api/src/services/auth.service.spec.ts`** (yeni, birim) — `PrismaService` mock'lanır (dış sınır — DB), gerçek bir `JwtService` (test secret'lı) kullanılır. İki senaryo: kullanıcı bulunursa dönen token'ın payload'ında `sub` doğru; kullanıcı bulunamazsa `UnauthorizedException` fırlatılır.
- **`apps/api/test/auth.e2e-spec.ts`** (yeni, entegrasyon) — gerçek Postgres + gerçek `AppModule` ile: `beforeAll`'da dev kullanıcıyı kendi upsert eder (harici `db:seed` adımına bağımlı olmadan, testler paralel/bağımsız çalışabilsin diye), `POST /auth/dev-login` çağırır, dönen `accessToken`'ın string olduğunu ve decode edildiğinde `sub`'ın seed kullanıcının id'siyle eştiğini doğrular.

### Doğrulama
- `npm run lint && npm run typecheck && npm test && npm run build` — hepsi yeşil olmalı.
- CI değişikliği push edilip GitHub Actions'ta gerçekten yeşil geçtiği doğrulanacak (DB görevinde olduğu gibi varsayılmayacak).
