# M2 — Core Rooms + Messaging Hardening

*Tek sabit oda gerçek çekirdek odalara (#general, #meta) dönüşür; mesaj düzenleme ve düzenleme geçmişi, rate limiting, ve gerçek bir davet-üretme endpoint'i eklenir.*

**Goal:** Promote M0's single hardcoded room into the real always-on core rooms, harden messaging with edit history and rate limits, and close the invite-issuance gap found during M1's post-merge cleanup.
**Demo:** A tester posts in #general and #meta, edits a message, and a second tester (real `moderator` role, not just theoretical) can see the edit history while a third regular tester cannot. A fourth tester generates a real invite code from the app and uses it to sign up a fifth tester.
**Estimated hours:** 55–80h (revised up from an earlier 28–42h draft — see Risks; that estimate assumed rate limiting, room-creation infra, and a moderator concept already existed, none do).

## Baseline reality check (done before slicing, not assumed from other docs)
Before breaking this into slices, the actual codebase was read against what
`docs/THREAT-MODEL.md`, `docs/ARCHITECTURE.md`, and ADR-0006 describe. Several things
those docs phrase as existing controls **are not implemented at all**:
- `Room` has 4 fields only (`id`, `name`, `status`, `createdAt`) — no `lastMessageAt`/
  `lastViewedAt`, no core-vs-user-created distinction.
- No archival job, no room-creation endpoint, no room-creation rate cap exist anywhere.
- Messaging (send + WS join) is hardcoded to one room everywhere — not yet
  room-parameterized, only the REST history read takes a room name.
- `MessageEdit` doesn't exist (no model, no migration) — `docs/DATA-MODEL.md` already
  describes the intended shape, so this is an unbuilt design, not an undesigned one.
- No rate limiting exists anywhere — no library, no guard, no counter.
- No moderator/role concept exists — `User` has no `role`/`isAdmin` field, which directly
  blocks this milestone's own edit-history access-control criterion.
- No invite-issuance endpoint exists (confirmed again; already known from M1's
  post-merge security fix — the only way to create an `Invite` today is a manual
  Postgres insert, which is also currently the only way to bootstrap the first user).

`docs/THREAT-MODEL.md` rows 1, 5, 6, 9 were corrected alongside this doc to stop
describing these as active controls.

## Out of scope
- User-created rooms (M3) — and with them, room-creation rate caps, `lastMessageAt`/
  `lastViewedAt` tracking, and the archive/delete cron. Building that infrastructure now
  would have nothing to ever archive; it's M3's problem when user-created rooms exist.
- Reputation/XP (M4) — invite issuance in this milestone stays "any authenticated user,
  rate-limited," not reputation-gated; that gating is M4's job.
- Self-service moderator management — the founder's own `role` is set once via manual
  SQL (same pattern as this session's production user-bootstrap). A real role-management
  UI/endpoint is M5 (moderation tooling) scope.

## Acceptance criteria
- [x] #general and #meta exist, are seeded on deploy, and are usable — a user can send
      and receive messages in either (messaging is room-parameterized, not hardcoded to
      one room).
- [x] `User.role` exists (`user`/`moderator`, default `user`) and can be set.
- [x] A user can edit their own message; prior content is stored in `MessageEdit`.
- [x] Edit history is visible only to the message's author and to users with
      `role: moderator` (`docs/THREAT-MODEL.md` row 3) — enforced at the service layer,
      not just UI-hidden.
- [ ] `POST /invites` exists, requires auth, generates a real high-entropy single-use
      code, and is rate-limited per issuer (`docs/THREAT-MODEL.md` row 1).
- [ ] `POST /auth/signup` is rate-limited against invite-code-guessing attempts
      (`docs/THREAT-MODEL.md` row 9).
- [ ] Message sending is rate-limited per-user at the WS gateway
      (`docs/THREAT-MODEL.md` row 5).
- [ ] A basic load test at ~50 concurrent WS connections holds up without errors.
- [ ] `apps/web` has a room switcher (currently always picks the first room from
      `GET /rooms`) and UI for editing a message, viewing its edit history (when
      permitted), and generating an invite code.

## Tasks
Backend, each its own plan-mode pass + commit + full verification (same cadence M1 used
for its Slice A-E split):
- [x] **M2 Slice A — Core rooms + room-aware messaging.** Seed #general/#meta (replace
      the single hardcoded room); `MessagesService.sendMessage`/`MessagesGateway` become
      room-parameterized; `User.role` migration (small, unblocks Slice B).
- [x] **M2 Slice B — Message editing + history + access control.** `MessageEdit` model +
      migration; author-only edit endpoint; edit-history read gated to author-or-
      moderator via `role`.
- [ ] **M2 Slice C — Invite issuance + rate limiting.** `POST /invites` (server-generated
      high-entropy code); `@nestjs/throttler` added, applied to this endpoint and to
      `POST /auth/signup`; a custom WS throttle guard for message send. Bundled because
      the rate limiter's first real consumer is this endpoint.
- [ ] **M2 Slice D — Basic load test.** ~50 concurrent WS connections; depends on A-C
      being done to load-test something real.

Frontend, same per-slice cadence — needed for this milestone's own Demo line to be true
end-to-end (same reasoning M1 applied to its own frontend slices):
- [ ] **M2 Slice E — Room switcher UI.**
- [ ] **M2 Slice F — Message edit + history UI**, gated the same way the backend gates
      it.
- [ ] **M2 Slice G — Invite-issuance UI**, likely following the existing settings-panel
      pattern (`TotpSettingsView`/`BlockedUsersView`).

## Risks
- **Estimate risk, already surfaced:** the original 28–42h draft assumed rate limiting,
  room-creation infrastructure, and a moderator concept already existed in code. None
  do — this doc's estimate and task list were revised accordingly before any Slice A
  work started, so the gap is now a documented, planned-for cost rather than a surprise
  mid-milestone.
- **Moderator-bootstrap dependency:** Slice B's access control can't be tested against a
  real moderator until the founder manually sets their own `User.role = 'moderator'` via
  SQL after Slice A's migration ships — same manual-SQL pattern as this session's
  TOTP-lockout runbook and production user-bootstrap, not a new kind of risk.

---

## Plan notları — Slice A: core rooms + room-aware messaging + User.role

**Görev:** M0'ın tek hardcoded odasını ('genel') gerçek çekirdek odalara ('general',
'meta') terfi ettirdi; mesaj gönderme + WS gateway artık oda-parametreli;
`User.role` migration'ı eklendi (Slice B'yi açacak).

**Oda adları `dev-seed.constants.ts`'ten çıkarıldı:** yeni
`apps/api/src/db/core-rooms.constants.ts` (`CORE_ROOM_NAMES = ['general', 'meta']`) —
oda artık bir "dev fixture" değil, çekirdek ürün altyapısı, `DEV_` öneki zaten M1
Slice E5'te yanlış sınıflandırma olarak işaretlenmişti.

**Migration mevcut 'genel' odasını id'sini/mesaj geçmişini koruyarak 'general'e
yeniden adlandırdı** (boş yeni bir satır açıp eskisini terk etmek yerine) — production'da
gerçek mesajlar (bu oturumun bootstrap mesajları dahil) zaten bu satırın altında.
`prisma migrate dev` migration'ı hand-edit'ten ÖNCE lokale uyguladı — checksum
uyuşmazlığı oluştu, kullanıcı onayıyla `prisma migrate reset` çalıştırılıp (Prisma'nın
kendi "AI agent önce kullanıcıya sor" güvenlik kılidini tetikleyerek) lokal DB sıfırdan
düzeltilmiş migration'la yeniden kuruldu. Rename SQL'i izole bir testle ayrıca
doğrulandı: sahte bir 'genel' satırı oluşturulup UPDATE çalıştırıldı, id korunduğu
teyit edildi.

**Gateway TÜM odalara değil sadece `CORE_ROOM_NAMES`'e join oluyor** — "tüm odalara
join ol" düşünüldü ve reddedildi: paylaşılan test DB'sinde başka e2e dosyalarının
(`messages.e2e-spec.ts`) yarattığı rastgele-isimli odalar socket'leri kirletirdi, ve
M3'te kullanıcı-oluşturdu odalar geldiğinde "hepsine join ol" zaten yanlış bir model
olurdu.

**`message:send`'deki `roomName` opsiyonel, verilmezse `CORE_ROOM_NAMES[0]`'a
('general') düşüyor.** Slice A backend-only — `apps/web` (Slice E'ye kadar) `roomName`
hiç göndermiyor. Zorunlu yapılsaydı mevcut frontend Slice E'ye kadar mesaj
gönderemez hale gelirdi. Bu tasarım kararı gerçek fullstack e2e testiyle (`apps/web`,
frontend hiç dokunulmadan) doğrulandı — hâlâ geçiyor.

**Dokunulan/yeni testler:** `messages.service.spec.ts`'e ikinci çekirdek odaya
gönderim testi eklendi; `messages-gateway.e2e-spec.ts`'e `roomName` ile açıkça
hedeflenen bir mesajın doğru odaya gidip diğerinin geçmişine sızmadığını kanıtlayan
yeni bir test eklendi (sadece WS event'inin ateşlenmesini değil, REST history'nin de
doğru ayrıştığını doğruluyor). `blocks.e2e-spec.ts`/`messages-gateway.e2e-spec.ts`'in
mevcut testleri `DEV_ROOM_NAME` yerine `CORE_ROOM_NAMES[0]` kullanacak şekilde
güncellendi, davranış değişmedi.

### Doğrulama
`apps/api` lint/typecheck/unit(58)/e2e(19)/build; `apps/web`
lint/typecheck/build/`test:e2e`(21)/`test:e2e:fullstack`(1, gerçek backend'e karşı) —
hepsi yeşil. Migration lokal DB'de gerçekten uygulandı (üretilip test edilmeden
"muhtemelen doğrudur" denmedi).

### Sıradaki
Slice B (mesaj düzenleme + geçmiş + erişim kontrolü) — ayrı bir plan modu turu alacak.

---

## Plan notları — Slice B: mesaj düzenleme + geçmiş + yazar/moderatör erişim kontrolü

**Görev:** `MessageEdit` modeli + migration; kendi mesajını düzenleme; düzenleme
geçmişini sadece yazarın ya da `role: moderator` olan birinin görebilmesi
(`docs/THREAT-MODEL.md` satır 3, `docs/DATA-MODEL.md`'nin zaten tarif ettiği ama
kodda olmayan tasarım).

**Düzenleme WS üzerinden (`message:edit`), REST `PATCH` değil** — mevcut desenle
birebir aynı: `sendMessage`'ın zaten hiçbir REST karşılığı yok (mesaj oluşturma
sadece WS), `MessagesController` sadece okuma. Düzenleme de odaya canlı yayılması
gereken aynı tür bir mutasyon, ikinci bir mutasyon yolu açmak yerine aynı ayrımı
izliyor. Geçmişi okumak REST'te kaldı (`GET rooms/:name/messages/:id/edits`) —
mevcut geçmiş okumayla tutarlı.

**Yayın için yeni `message:updated` event'i** (`message:new` değil) — frontend'in
(Slice F) "yeni mesaj ekle" ile "id X'i bul, içeriğini değiştir"i ayırt edebilmesi
için. Aynı block-filtreli tek-tek-emit deseni (`handleMessageSend` zaten kullanıyordu)
`message:edit` için de tekrar kullanıldı — kod tekrarını önlemek için gateway'e
paylaşılan bir `broadcastToRoom` private metodu eklendi.

**Moderatör rolü her seferinde DB'den taze okunuyor, JWT'ye eklenmedi** — access
token payload'u `{sub, email}` olarak kalıyor. Rolü JWT'ye eklemek her login/signup
akışını etkiler, halbuki nadiren değişen (elle SQL ile) bir değer için sadece bu tek
okumada ihtiyaç var. `getMessageEditHistory` içinde tek bir ekstra
`prisma.user.findUnique` yeterli — Slice B'yi mesajlaşma alanının dışına çıkarmıyor.

**Düzenleme sadece yazara özel, moderatör override'ı yok** — THREAT-MODEL satır 3
geçmişin *görünürlüğü* hakkında ("sadece yazar ve moderatörlere görünür"), başkasının
içeriğini değiştirme yetkisi değil. `DATA-MODEL.md`'nin ifadesiyle birebir uyumlu.

**Public bir "düzenlendi" işareti eklenmedi** — `MessageDto`'ya `editedAt` eklemek
düşünüldü (diğer oda üyeleri neyin değiştiğini değil ama değiştirildiğini görsün diye)
ama Slice B'nin kabul kriterlerinde yok, yeni bir kolon/join gerektirir, ve bir
frontend-görünüm kararı — sessizce unutulmasın diye burada not edildi, şimdi
yapılmadı.

**Testler bir gerçek regresyon buldu:** `messages-gateway.e2e-spec.ts`'in `afterAll`
temizliği artık `MessageEdit`'in `Message`'a `ON DELETE RESTRICT` FK'si yüzünden
başarısız oluyordu (düzenlenen bir mesaj artık geçmiş satırı olmadan silinemiyor) —
temizlik sırası düzeltildi (`messageEdit.deleteMany` önce, `message.deleteMany` sonra).

**Dokunulan/yeni testler:** `messages.service.spec.ts`'e `editMessage` (yazar
günceller + geçmişe eski içeriği yazar; yazar-olmayanı reddeder; bilinmeyen mesajı
reddeder) ve `getMessageEditHistory` (yazar görebilir; moderatör görebilir; ne yazar
ne moderatör olan reddedilir; bilinmeyen mesaj 404) testleri eklendi.
`messages-gateway.e2e-spec.ts`'e gerçek WS üzerinden düzenleme + canlı yayın testi ve
başkasının mesajını düzenleme denemesinin sessizce yoksayıldığını kanıtlayan test
eklendi. Yeni `message-edit-history.e2e-spec.ts`: REST erişim kontrolünü gerçek HTTP
istekleriyle doğruluyor (yazar/moderatör/sıradan kullanıcı/bilinmeyen mesaj).

### Doğrulama
`apps/api` lint/typecheck/unit(65)/e2e(25)/build; `apps/web`
lint/typecheck/build/`test:e2e`(21)/`test:e2e:fullstack`(1, gerçek backend'e karşı) —
hepsi yeşil. Migration lokal DB'de gerçekten üretilip uygulandı (bu sefer veri
düzeltmesi gerekmediği için `--create-only` gerekmedi).

### Sıradaki
Slice C (davet üretme + rate limiting) — ayrı bir plan modu turu alacak.
