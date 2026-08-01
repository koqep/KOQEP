# M3 — User-Created Rooms + Lifecycle

*Kullanıcılar kendi odalarını açabilir; 14 gün sessizlikte arşivlenir, arşivde 60 gün daha izlenmezse silinir. Oda oluşturma günde 1 ile sınırlı.*

**Goal:** Let users create their own topic rooms, with the archive/delete lifecycle from `docs/ARCHITECTURE.md`/ADR-0006 enforced automatically.
**Demo:** A tester creates a room; a second, empty test room that's been silent for 14 days (simulated via a fast-forwarded clock in tests) shows as archived and read-only; an archived room with no views for 60 more days is gone from the DB.
**Estimated hours:** 25–38h (first-time scheduled/cron job on the chosen platform is the main unknown). Sequencing note (2026-07-30): `docs/milestones/M2.5-identity-reliability.md` runs before this milestone, not after — username and WS reliability are foundational, not room-lifecycle work, so they got their own milestone instead of being folded in here.

## Out of scope
- Reputation-gated room creation (any signed-up user can create one, per `docs/PRD.md`).
- Live WS updates to the room list on creation/archival — low value at 20-30 users, "next reload" is acceptable.
- Un-archive / moderator override — `CLAUDE.md`'s "Oda durumu tek yönlü ilerler" rule forbids a reverse path by design, not a time cut.
- View-count exposed in the UI — an internal signal for the delete sweep only.

## Acceptance criteria
- [ ] A user can create a room with a slug-style name (username'in `^[a-zA-Z0-9_-]+$` deseniyle aynı, homoglyph/kılık değiştirme riskine karşı) ve opsiyonel serbest-metin bir açıklama (okunabilir "konu" burada yaşıyor); oluşturma günde 1 ile sınırlı (`docs/THREAT-MODEL.md` row 6).
- [ ] A room with no new messages for 14 days becomes read-only and disappears from the active browse list, but stays linkable (bkz. Slice B Plan notları — `includeArchived` parametresiyle).
- [ ] An archived room with zero views for a further 60 days is hard-deleted (messages included — see Plan notları, this required an explicit, recorded exception to the message-immutability rule).
- [ ] The browse list excludes archived and deleted rooms by default.
- [ ] A newly created room's messages actually reach other connected users in real time (not in the original spec's task list — found by reading the code, see Plan notları).
- [ ] Her oda butonu bir canlılık sinyali gösteriyor (açıklama + son aktivite zamanı, tooltip seviyesinde — ucuz, ikinci tur gözden geçirmesinde eklendi).
- [ ] Tests cover both lifecycle transitions (archive and delete) and the creation rate limit.

## Tasks
Her biri kendi plan-modu turu + commit + tam doğrulama (M1-M2.5'in kullandığı aynı ritim). 2026-07-31 kapsam gözden geçirmesinde A/B/C dilimlerine bölündü, aynı gün ikinci bir tur (kullanıcının 8 maddelik gözden geçirmesi) tasarımı revize etti (aşağıdaki Plan notları):
- [ ] **M3 Slice A — Oda oluşturma + rate limit + WS join-set düzeltmesi.** `POST /rooms`, per-user 24h rate limit (`invites`'ın kurduğu `UserThrottlerGuard` deseni), `Room.lastActivityAt`/`creatorId`/`description` şema eki, oda adı için slug doğrulaması + case-insensitive ön-kontrol (username deseniyle aynı disiplin), `lastActivityAt`'in `sendMessage`'da güncellenmesi (ikinci turda bulunan bir açık — güncellenmezse her oda tam 14 günde arşivlenir), oda butonlarında tooltip seviyesinde canlılık sinyali, ve kod okuyarak bulunan kritik bir açığın düzeltmesi: `messages.gateway.ts`'in `handleConnection`'ı sadece `CORE_ROOM_NAMES`'i katılıyor — kullanıcı odaları hiç katılmıyor, gerçek zamanlı mesaj hiç ulaşmıyor.
- [ ] **M3 Slice B — Arşiv yaşam döngüsü.** Cron-tetiklemeli `POST /internal/rooms/lifecycle-sweep` (yeni bağımlılık yok, dış bir tetikleyici çağırıyor), 14-gün-sessizlik → arşivleme, salt-okunur uygulaması (`sendMessage`'ın hiç kontrol etmediği bir başka açık), çekirdek oda istisnası, `GET /rooms` filtresi + arşivlenmiş odaların ADR-0006'nın "hâlâ linkable" gereksinimini karşılaması için `includeArchived` parametresi (ikinci turda bulunan bir gerileme — filtre eklenince switcher'da arşivlenmiş bir odaya ulaşacak hiçbir yol kalmıyordu).
- [ ] **M3 Slice C — Silme yaşam döngüsü.** Görüntülenme takibi (`Room.lastViewedAt`), 60-gün-sıfır-görüntülenme → hard-delete, mesajların da odayla birlikte silinmesi (kayıtlı istisna, aşağıya bakın).

## Risks
- Background job reliability on a $50/mo host — mitigation: keep both jobs as simple, idempotent, cron-triggered HTTP endpoints rather than introducing a separate queue/worker system, consistent with the monolith-first decision.
- Render servisi Blueprint'e bağlı değil (STATE.md tuzağı) — `render.yaml`'a bir cron bloğu eklemek tek başına yeterli değil, dış tetikleyici (GitHub Actions scheduled workflow önerildi, ücretsiz) dashboard'dan/ayrıca elle kurulmalı.

---

## Plan notları — 2026-07-31 kapsam gözden geçirmesi (Slice A-C tasarımı)

M2.5 bitince "taze bir gözle" bir kapsam turu istendi — M2/M2.5'in
derslerinin (gerçek kod okumadan plan yapmama, rate limiting tuzakları,
WS güvenilirlik desenleri) M3'e nasıl uygulanacağı düşünülüp, sonra
A/B/C'ye bölündü. Bir Plan agent'ın ikinci geçişiyle çapraz kontrol
edildi.

**Milestone'un kendi Tasks listesinin atladığı, kod okuyarak bulunan iki
kritik açık:**
1. `messages.gateway.ts`'in `handleConnection`'ı sadece `CORE_ROOM_NAMES`
   (`general`, `meta`) adlı odaları sorgulayıp `client.join()` ediyor —
   kullanıcı odaları hiç katılmıyor. Oda oluşturma tek başına inşa
   edilirse, o odada gönderilen hiçbir mesaj hiç kimseye gerçek zamanlı
   ulaşmaz. Slice A'ya dahil edildi, ayrı bir "detay" değil.
2. `MessagesService.sendMessage` oda durumunu hiç kontrol etmiyor —
   "arşivlenince salt okunur" acceptance kriterinin arkasında bugün hiç
   kod yok. Slice B'ye dahil edildi.

**Gerçek bir kural çatışması bulundu, kullanıcıya soruldu, karar
verildi:** `CLAUDE.md`'nin "Mesaj içeriği asla hard-delete edilmez"
kuralı (ADR-0005, hesap silme bağlamında) ile ADR-0006'nın oda
hard-delete'inin "storage cost stays bounded" hedefi çelişiyordu.
**Karar (onaylandı): oda hard-delete edilince mesajları da onunla
birlikte hard-delete ediliyor** — hesap silmedeki (tek kişinin katkısını
canlı thread'lerden silme) durumdan kategorik farklı (bütün oda ve
HERKESİN mesajı birlikte ölüyor), ADR-0006'nın asıl amacını
(depolama geri kazanımı) gerçekten sağlıyor. `CLAUDE.md`'ye ve
ADR-0006'ya kayıtlı bir istisna notu eklendi (ayrı commit'ler, bkz.
aşağıdaki dosya listesi) — sessizce çiğnenmedi.

**Rate limiting:** `apps/api/src/api/user-throttler.guard.ts` (davet
üretimi için zaten var, 5/saat per-user) neredeyse birebir aynı ihtiyaç
(1/gün per-user, oda oluşturma). Slice A yeni bir `RoomCreationThrottlerGuard`
kuracak — aynı iki tuzak (global `APP_GUARD` ile çift sayım,
`blockDuration=0`) tekrar tetiklenmeyecek şekilde, `UserThrottlerGuard`'ın
birebir yapısal kopyası.

**WS altyapısı yeniden kullanılıyor:** `SocketRegistryService` (Slice D)
tam da bu kesişen-endişe problemi için var — yeni oluşturulan bir odaya,
oluşturan kullanıcının zaten bağlı soketini `MessagesGateway`'e hiç
dokunmadan katmak için kullanılacak. `WsException({status,code})` deseni
(RATE_LIMITED/MESSAGE_TOO_LONG) Slice B'de yeni bir `ROOM_ARCHIVED` kodu
için genişletilecek.

**Cron:** proje kökünde hiç scheduling bağımlılığı kurulu değil (kontrol
edildi) — yeni bir bağımlılık eklemek yerine (CLAUDE.md'nin "önce sor"
kuralı), dış bir tetikleyicinin çağıracağı korumalı bir HTTP endpoint'i
(`POST /internal/rooms/lifecycle-sweep`, yeni `CronSecretGuard`) tasarlandı
— milestone'un kendi "cron-triggered endpoint, not a queue system"
ifadesiyle zaten örtüşüyordu. Dış tetikleyici seçimi (Render Cron Job vs.
ücretsiz bir GitHub Actions scheduled workflow) kod dışı, kullanıcının
kararı — Slice B'nin Plan notlarında somutlaştırılacak.

### Sıradaki (ilk tur sonu — ikinci tur aşağıda)
Slice A — ayrı bir dal, ayrı bir commit, tam doğrulama.

## Plan notları — 2026-07-31 ikinci tur (kullanıcının 8 maddelik gözden geçirmesi)

İlk tur onaylandıktan hemen sonra, Slice A'nın kod/migration'ına
başlanmışken kullanıcı "planı erken onayladım" dedi ve durdu — 8 eksik
madde listeledi, her biri için **"Yol B" ölçütü** verdi: *bu olmadan
20-30 kişilik kapalı bir toplulukta ürün bozuk/güvensiz hissettirir mi?*
Her madde gerçek dokümanlar (`docs/PRD.md`, `docs/DATA-MODEL.md`,
`docs/THREAT-MODEL.md`, `docs/ARCHITECTURE.md`) okunarak, sonradan-ekleme
maliyeti gerçekten hesaplanarak değerlendirildi — varsayılmadı. İki madde
`AskUserQuestion` ile doğrudan soruldu (üyelik modeli + oda konusu alanı).

**M3'e alınanlar** (Slice A/B'nin Tasks maddelerine zaten işlendi):
- Oda adı slug doğrulaması (username deseniyle aynı, homoglyph riski).
- `Room.description` — ayrı, serbest-metin bir "konu" alanı (slug okunabilir
  bir konu OLAMIYOR — "elden-ring-inceleme" ≠ "Elden Ring inceleme
  tartışması").
- `lastActivityAt`'in gerçekten güncellendiği nokta (`sendMessage`) —
  ilk turda YAZILMAMIŞ sessiz bir açıktı, güncellenmezse her oda
  aktiviteden bağımsız tam 14 günde arşivlenir.
- Tooltip seviyesinde canlılık sinyali (açıklama + son aktivite) — Faz 1'in
  FATAL coğrafi-oda bulgusuyla aynı risk sınıfı (boş/ölü görünen odalar),
  daha düşük olasılıkla ama ucuz bir sigorta.
- Arşivlenmiş odanın "hâlâ linkable" kalması (Slice B) — `GET /rooms`
  filtresi eklenince switcher'da arşivlenmiş bir odaya ulaşacak hiçbir yol
  kalmıyordu; `includeArchived` parametresiyle çözüldü.

**`docs/BACKLOG.md`'ye somut tetikleyicilerle ertelenenler** (aşağıdaki
ayrı commit'te):
- Üyelik modeli (`RoomMember`) + oda şifresi — `DATA-MODEL.md`'nin 7
  varlığında hiç yok, PRD üyelikten bahsetmiyor, çekirdek odalar zaten
  "herkes otomatik içeride" çalışıyor. Tetikleyici: aktif kullanıcı >50
  VEYA aktif oda sayısı >15 VEYA gerçek bir özel-oda talebi.
- Oda moderasyonu (silme/yeniden adlandırma) — TOTP kilitlenme/resend-endpoint
  ile aynı kurulu desen (founder'ın manuel Postgres düzeltmesi). Tetikleyici:
  bu manuel düzeltme ikinci kez gerekirse VEYA M4 (moderasyon) şipse.

Detaylı karar tablosu (8 madde, gerekçe + sonradan-ekleme maliyeti) plan
dosyasında tam haliyle duruyor, buraya kopyalanmadı.

### Sıradaki
Slice A — `m3/slice-a-room-creation` dalında devam ediyor, ikinci turun
değişiklikleriyle (description, slug doğrulama, `lastActivityAt` güncelleme
noktası, tooltip) tamamlanacak. Slice B/C ayrı dallar, ayrı plan-modu
turları (tasarımları bu dokümanda zaten var, uygulaması ayrı).
