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
- [x] `POST /invites` exists, requires auth, generates a real high-entropy single-use
      code, and is rate-limited per issuer (`docs/THREAT-MODEL.md` row 1).
- [x] `POST /auth/signup` is rate-limited against invite-code-guessing attempts
      (`docs/THREAT-MODEL.md` row 9).
- [x] Message sending is rate-limited per-user at the WS gateway
      (`docs/THREAT-MODEL.md` row 5).
- [x] A basic load test at ~50 concurrent WS connections holds up without errors.
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
- [x] **M2 Slice C — Invite issuance + rate limiting.** `POST /invites` (server-generated
      high-entropy code); `@nestjs/throttler` added, applied to this endpoint and to
      `POST /auth/signup`; a custom WS throttle guard for message send. Bundled because
      the rate limiter's first real consumer is this endpoint.
- [x] **M2 Slice D — Basic load test.** ~50 concurrent WS connections; depends on A-C
      being done to load-test something real.

Frontend, same per-slice cadence — needed for this milestone's own Demo line to be true
end-to-end (same reasoning M1 applied to its own frontend slices):
- [x] **M2 Slice E — Room switcher UI.**
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
- **Rate limit numbers (Slice C) are proposed defaults, not final** — 100/60s global,
  5/hour invites, 20/60s signup, 10/10s WS messages. Concrete revisit trigger (not just
  "adjustable," which tends to get forgotten): whichever comes first — **(a)** M6 ships,
  or **(b)** a real incident — a legitimate user gets blocked, or an abuse pattern gets
  through despite them. Same two-sided trigger style as the `totpSecret` encryption
  deferral in `docs/THREAT-MODEL.md`.

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

---

## Plan notları — Slice C: davet üretme + rate limiting

**Görev:** `POST /invites` (gerçek, yüksek-entropili, tek-kullanımlık kod üreten bir
endpoint — M1'in post-merge güvenlik düzeltmesinden beri açık olan boşluk); ilk kez
`@nestjs/throttler` eklendi ve `POST /invites` (kullanıcı başına), `POST /auth/signup`
(IP başına, davet kodu tahmin etmeye karşı), ve WS `message:send`/`message:edit`
(kullanıcı başına) üzerine uygulandı.

**`@nestjs/throttler`'ın gerçek API'si (eğitim verisinden değil) GitHub README'sinden
doğrulandı** — `ttl`'in milisaniye olduğu, `@Throttle()` dekoratörünün tam şekli, ve
WS için belgelenmiş `ThrottlerGuard` alt sınıflama deseni (`handleRequest`'i override
etmek, `APP_GUARD`/`useGlobalGuards()` WS için çalışmıyor) — kod yazmadan önce.

**Gerçek testler iki ayrı, ince kütüphane hatası/yanlış-kullanımı yakaladı — ikisi de
sadece "muhtemelen doğru" denip geçilseydi fark edilmezdi:**

1. **Global (APP_GUARD, IP-bazlı) guard ile route-özel `UserThrottlerGuard`'ın aynı
   `@Throttle()` metadata'sını okuyup İKİ AYRI sayaç tutması** — `/invites`'a 3.
   istekte beklenmedik 429 olarak yakalandı (test client'ı hem global IP hem kendi
   kullanıcı sayacını aynı anda tüketiyordu). Çözüm: `UserThrottlerGuard`,
   `ThrottlerGuard`'ı extend etmekten vazgeçip `ThrottlerStorage`'ı doğrudan kullanan
   bağımsız bir `CanActivate`'e dönüştürüldü — global guard'ın paylaşılan
   `this.throttlers` listesine hiç girmiyor, `@Throttle()` metadata'sı artık bu route
   için anlamsız (kaldırıldı).
2. **`storageService.increment()`'e `blockDuration=0` vermek bloğu AYNI çağrı içinde
   sıfırlıyor** — kütüphanenin kendi `ThrottlerStorageService` implementasyonu
   okunarak bulundu: `blockExpiresAt = now+0` hemen "süresi dolmuş" sayılıp
   `resetBlockdRequest()` anında tetikleniyor. 6. istek 429 yerine 201 dönerek
   yakalandı. Base `ThrottlerGuard.canActivate()`'in kendisi de belirtilmediğinde
   `blockDuration`'ı `ttl`'e düşürüyor — `UserThrottlerGuard` aynı varsayılanı elle
   uyguladı.

**WS tarafında global HTTP guard'ın karışıp karışmadığı gerçek testle doğrulandı** —
`messages-gateway.e2e-spec.ts`'in TÜM testleri (throttle testi dahil) sorunsuz geçti,
global `ThrottlerGuard`'ın WS context'inde sessizce bozmadığı/karışmadığı kanıtlandı,
varsayılmadı.

**Davet kodu: `randomBytes(12).toString('base64url')`** — refresh token'larla aynı
üretim deseni (`REFRESH_TOKEN_BYTES`), daha kısa (12 byte = 96 bit, hâlâ astronomik
ölçüde yeterli) çünkü bir davet kodu insan tarafından elle paylaşılıyor, refresh token
uzunluğunda bir string pratik olmazdı.

**Dokunulan/yeni testler:** `invites.service.spec.ts` (kod üretimi + issuedById);
yeni `invites.e2e-spec.ts` (gerçek kod üretimi + gerçek signup ile kullanılabilirliği
+ saatte 5'ten fazlasının 429 alması); `messages-gateway.e2e-spec.ts`'e WS limitini
aşan hızlı gönderimin `exception` event'iyle engellendiğini kanıtlayan test eklendi
(taze bir kullanıcıyla — paylaşılan `accessToken`'ın önceki testlerden gelen sayacını
devralmaması için, limit kullanıcı başına dosya genelinde birikiyor).

### Doğrulama
`apps/api` lint/typecheck/unit(67)/e2e(29)/build; `apps/web`
lint/typecheck/build/`test:e2e`(21)/`test:e2e:fullstack`(1, gerçek backend'e karşı) —
hepsi yeşil. Bu slice'ta yanlış bir rate limit sayısı BAŞKA testleri kırabilirdi, bu
yüzden tüm e2e suite'i (sadece yeni dosyalar değil) asıl doğrulama oldu.

### Sıradaki
Slice D (temel yük testi) — ayrı bir plan modu turu alacak, ya da kullanıcı frontend
slice'larına (E-G) geçmek isterse o.

---

## Plan notları — Slice D: temel yük testi (~50 eşzamanlı WS bağlantısı)

**Görev:** M2'nin son backend kabul kriteri — ~50 eşzamanlı WS bağlantısının
hatasız ayakta kalması. Slice A-C'nin gerçek olmasına bağımlıydı (oda-farkında
mesajlaşma, düzenleme/yayın, ve en önemlisi Slice C'nin rate limitleri) — yoksa
yük-test edecek gerçek bir şey olmazdı.

**Bağımsız bir script, Jest testi değil, CI'a bağlı değil.** "Yük testi" ile
"doğruluk testi" farklı şeyler — bu script iş mantığını doğrulamıyor (Slice A-C'nin
e2e testleri zaten bunu yapıyor), sistemin eşzamanlılık altında ayakta kaldığını
gösteriyor. Her CI push'unda 50 gerçek WS bağlantısı açmak yavaş olurdu ve kod
doğruluğuyla ilgisiz flaky hatalara kapı açardı. Yeni `apps/api/test/load/ws-load-test.ts`
+ yeni `npm run test:load:ws` — talep üzerine çalıştırılıyor (kapasiteyi etkileyecek
gerçek bir değişiklikten önce ya da ara sıra sağlık kontrolü olarak), otomatik değil.

**Kendi `NestFactory.create(AppModule)` instance'ını açıyor** (main.ts'in yaptığı gibi),
`Test.createTestingModule` değil — gerçek production bootstrap yolunu kullanmak için.
Efemeral porta (`app.listen(0)`) dinliyor, mevcut e2e testlerinin kendi
`INestApplication`'ları için zaten yaptığı gibi.

**50 kullanıcı gerçek `/auth/signup` yerine doğrudan Prisma + `JwtService.signAsync`
ile üretildi.** Kısayol değil, bilinçli: Slice C'nin `/auth/signup`'ı artık IP başına
20/60s'e sınırlı — 50 hesabı tek script/IP'den gerçek signup'tan geçirmek bu slice'ın
yük-test etmeye çalıştığı şeyin ETRAFINDAN değil TAM ORTASINDAN geçip kendi limitine
takılırdı. `messages-gateway.e2e-spec.ts`/`blocks.e2e-spec.ts`'in zaten kullandığı
"token'ı doğrudan üret" deseniyle aynı.

**Senaryo bilerek her kullanıcının kendi WS rate limitinin İÇİNDE kalıyor, onu
zorlamıyor.** Kullanıcı başına 4 mesaj (limit 10/10s) — amaç limiti tetiklemek değil,
normal eşzamanlı kullanım altında sistemin ayakta kalması. Her socket Slice A'nın
gateway tasarımı gereği iki çekirdek odaya da otomatik join olduğundan, ölçülü bir
gönderim sayısı bile gerçek bir fan-out yükü üretiyor.

### Gerçek sonuçlar (2026-07-30, lokal dev DB'ye karşı)
```
Bağlantı: 50/50 başarılı (310ms)
Gönderilen mesaj: 200 (kullanıcı başına 4)
Alınan mesaj (tüm soketler toplamı): 10000  (200 mesaj × 50 alıcı — her socket
  kendi mesajı dahil her iki çekirdek odadaki her mesajı alıyor, beklenen davranış)
Hata sayısı: 0
Toplam süre: 7333ms
```
Sistem hatasız ayakta kaldı; uygulama kodunda değişiklik gerekmedi.

### Doğrulama
`apps/api` lint/typecheck/unit(67)/e2e(29)/build; `apps/web`
lint/typecheck/build/`test:e2e`(21)/`test:e2e:fullstack`(1, gerçek backend'e karşı) —
hepsi yeşil. Bu slice'ın asıl doğrulaması scripti gerçekten çalıştırıp gerçek
sonuçları görmekti (yukarıda), ayrı bir test suite'i değil.

### Sıradaki
M2'nin backend'i tamamen bitti (Slice A-D). Kalan Slice E-G (oda değiştirici UI,
düzenleme/geçmiş UI, davet üretme UI) — her biri ayrı bir plan modu turu alacak.

---

## Plan notları — Slice E: oda değiştirici UI

**Görev:** `apps/web`'in her zaman `GET /rooms`'un ilk odasını seçtiği,
`'meta'`'ya hiç ulaşılamadığı davranışı bitti — artık her iki çekirdek oda da
görünür ve tıklanarak değiştirilebiliyor.

**Yan not, bu slice'ın parçası değil:** `apps/web/AGENTS.md` ve onu import eden
`apps/web/CLAUDE.md`, M0'ın `create-next-app` scaffold commit'inde (a12dda0c)
gelmiş, kullanıcının hiç yazmadığı, `node_modules/next/dist/docs/` (var olmayan
bir yol) okumayı isteyen sahte bir "agent kuralları" dosyasıydı — muhtemelen
scaffold'ı yapan önceki bir Claude Code oturumunun uydurduğu, gerçek
create-next-app çıktısının parçası olmayan içerik. Bu slice'tan hemen önce ayrı
küçük bir commit'te (`chore/remove-fabricated-agents-md` branch) kaldırıldı —
M2 Slice E'nin bir parçası değil, temizlik.

**Backend'e tek satırlık bir düzeltme gerekti: `RoomsService.listRooms()`'a
`orderBy: { name: 'asc' }`.** Önceden sıra garanti değildi — bir oda
değiştiricinin reload'lar arası sırası karışan bir listesi bozuk görünürdü.
Dokunulmamış bir fonksiyona davranış değişikliği olduğu için yeni bir birim
testi geldi (`rooms.service.spec.ts`, önceden hiç yoktu).

**Oda değiştirici header'da, mevcut ayarlar-paneli toggle'ının (`ActivePanel`
/ Totp / Blocked) ARKASINDA DEĞİL.** O iki panel bilerek tüm içerik alanını
kaplıyor çünkü ikincil ayar eylemleri. Oda değiştirmek birincil gezinme —
IRC/Slack kanal sekmeleri gibi sohbetle birlikte hep görünür kalmalı, bir
paneli açıp kapatmayı gerektirmemeli. Eski statik `<h1>{room?.name}</h1>`,
`GET /rooms`'daki her odayı tıklanabilir `#isim` butonu olarak listeleyen bir
`<nav>`'a dönüştü (aktif oda `text-neutral-200`, pasif
`text-neutral-600 hover:text-neutral-400` — panel başlıklarında zaten kullanılan
aynı sınıflar, yeni bir token yok).

**Tek kalıcı socket bağlantısı, oda değişince YENİDEN BAĞLANMIYOR.**
Gateway zaten her socket'i TÜM çekirdek odalara join ediyor (Slice A) — oda
değiştirmek saf bir client-side kaygı. `activeRoomIdRef` (bir `useEffect` ile
`activeRoom`'la senkron tutulan ref), mount'ta bir kere kurulan `message:new`
dinleyicisinin, yeniden abone olmadan/soket'i koparmadan her zaman GÜNCEL aktif
odayı okuyabilmesini sağlıyor — stale closure riski yok.

**Oda değiştirince geçmiş yeniden fetch edilip mesaj listesi DEĞİŞTİRİLİYOR,
client-side cache yok.** Basit ve doğru: mevcut "bir kere fetch et, sonra
dinle" şeklini sadece oda-parametreli hale getiriyor. `fetchGenerationRef`
sayacı, hızlı art arda iki oda değişiminde eski bir fetch'in yeni birini
ezmesini engelliyor (mevcut bootstrap effect'teki `cancelled` bayrağıyla aynı
desen, mount/unmount yerine her switch'e uygulanmış hali).
`message:updated` bilerek eklenmedi — M2 dokümanı onu Slice F'ye kapsıyor,
bugün hiç dinleyicisi yok, henüz tüketilmeyen bir event için oda-farkında
filtreleme ölü kod olurdu.

**`message:send` artık `roomName: activeRoom.name` gönderiyor.** Slice A'nın
plan notlarının bilerek bu slice'a bıraktığı asıl bağlantı noktası buydu —
önceden frontend sadece `{ content }` gönderip backend'in
`CORE_ROOM_NAMES[0]` varsayılanına sessizce güveniyordu. Oda değişince taslak
metin de temizleniyor (tek satır) — yoksa `#general` için yarım yazılmış bir
mesaj switch sonrası sessizce `#meta`'ya gidebilirdi.

**Dokunulan/yeni testler:** `rooms.service.spec.ts` (yeni, alfabetik sıra);
`e2e/single-room.spec.ts` → `e2e/room-switcher.spec.ts` (iki odayı ve
oda-bazlı ayrı `GET /rooms/:name/messages` mock'larını simüle edip buton
listesinin, aktif-oda stilinin, ve tıklayınca mesaj listesinin değişmesinin
kanıtlanması); yeni `e2e-fullstack/room-switching.spec.ts` — gerçek backend'e
karşı, `#general`'da mesaj gönderip `#meta`'ya geçince görünmediğini, geri
dönünce hâlâ orada olduğunu kanıtlıyor (sadece gerçek bir backend'in
kanıtlayabileceği şey: `roomName`'in send→gateway→doğru oda'ya gerçekten
gittiği ve alım tarafındaki `roomId` filtrelemesinin doğru çalıştığı).

### Doğrulama
`apps/api` lint/typecheck/unit(68)/e2e(29)/build; `apps/web`
lint/typecheck/build/`test:e2e`(21, yeni room-switcher.spec.ts dahil)/
`test:e2e:fullstack`(2, yeni room-switching.spec.ts dahil) — hepsi yeşil.

**Merge-sonrası bulunan bug (manuel test, 2026-07-30):** panel açıkken
(Totp/Blocked) oda butonuna basmak hiçbir şey yapmıyordu — özellikle zaten
aktif olan odaya tekrar basmak `handleRoomSwitch`'in en baştaki
`if (next.id === activeRoom?.id) return;` erken-çıkışına takılıp paneli hiç
kapatmıyordu (kullanıcı "geri dönmek" için sezgisel olarak zaten aktif odaya
basıyordu). Düzeltme: `handleRoomSwitch` artık ilk satırda koşulsuz
`setActivePanel("none")` çağırıyor — herhangi bir oda butonuna basmak her
zaman sohbete döner, oda gerçekten değişse de değişmese de. Regresyon testi:
`e2e/blocked-users.spec.ts`'e `oda_butonuna_basinca_acik_panel_kapanip_sohbete_doner`
eklendi (aynen bug'ın tekrarı: panel açıkken zaten aktif olan tek odaya
basmak). Ayrı `fix/room-switcher-panel-close` branch'inde, Slice F'den önce.

### Sıradaki
Slice F (mesaj düzenleme + geçmiş UI) — ayrı bir plan modu turu alacak.
