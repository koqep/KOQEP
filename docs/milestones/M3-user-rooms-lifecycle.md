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
- [x] A user can create a room with a slug-style name (username'in `^[a-zA-Z0-9_-]+$` deseniyle aynı, homoglyph/kılık değiştirme riskine karşı) ve opsiyonel serbest-metin bir açıklama (okunabilir "konu" burada yaşıyor); oluşturma günde 1 ile sınırlı (`docs/THREAT-MODEL.md` row 6).
- [x] A room with no new messages for 14 days becomes read-only and disappears from the active browse list, but stays linkable (`includeArchived` parametresiyle — Slice B).
- [ ] An archived room with zero views for a further 60 days is hard-deleted (messages included — see Plan notları, this required an explicit, recorded exception to the message-immutability rule). Slice C, not yet built.
- [x] The browse list excludes archived and deleted rooms by default.
- [x] A newly created room's messages actually reach other connected users in real time (not in the original spec's task list — found by reading the code, see Plan notları).
- [x] Her oda butonu bir canlılık sinyali gösteriyor (açıklama + son aktivite zamanı, tooltip seviyesinde — ucuz, ikinci tur gözden geçirmesinde eklendi).
- [x] Tests cover the creation rate limit, both real-time join-set paths, and the archive lifecycle (Slice A+B). Delete transitions (Slice C) not yet built.

## Tasks
Her biri kendi plan-modu turu + commit + tam doğrulama (M1-M2.5'in kullandığı aynı ritim). 2026-07-31 kapsam gözden geçirmesinde A/B/C dilimlerine bölündü, aynı gün ikinci bir tur (kullanıcının 8 maddelik gözden geçirmesi) tasarımı revize etti (aşağıdaki Plan notları):
- [x] **M3 Slice A — Oda oluşturma + rate limit + WS join-set düzeltmesi.** `POST /rooms`, per-user 24h rate limit (`invites`'ın kurduğu `UserThrottlerGuard` deseni), `Room.lastActivityAt`/`creatorId`/`description` şema eki, oda adı için slug doğrulaması + case-insensitive ön-kontrol (username deseniyle aynı disiplin), `lastActivityAt`'in `sendMessage`'da güncellenmesi (ikinci turda bulunan bir açık — güncellenmezse her oda tam 14 günde arşivlenir), oda butonlarında tooltip seviyesinde canlılık sinyali, ve kod okuyarak bulunan kritik bir açığın düzeltmesi: `messages.gateway.ts`'in `handleConnection`'ı sadece `CORE_ROOM_NAMES`'i katılıyor — kullanıcı odaları hiç katılmıyor, gerçek zamanlı mesaj hiç ulaşmıyor.
- [x] **M3 Slice B — Arşiv yaşam döngüsü.** Tamamlandı (2026-08-02) — detay için aşağıdaki "Plan notları — Slice B uygulaması" bölümüne bakın. Özet: `POST /internal/rooms/lifecycle-sweep` (`CronSecretGuard`, GitHub Actions scheduled workflow tetikliyor), 14-gün-sessizlik → arşivleme, salt-okunur uygulaması (hem `sendMessage` HEM `editMessage` — ikincisi ilk taslakta atlanmıştı), çekirdek oda istisnası, `GET /rooms?includeArchived=true`, `Room.archivedAt` şema eki (Slice C'nin 60-gün hesaplaması için gereken, bilerek Slice C'ye değil buraya eklendi).
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

## Plan notları — Slice A uygulaması (2026-08-01)

Tasarım aynen uygulandı, hiçbir sapma olmadı. Doğrulama: `apps/api`'de
lint/typecheck/build temiz, birim testler 98/98, e2e testler 46/46
(yeni `test/rooms.e2e-spec.ts` dahil); `apps/web`'de lint/typecheck/build
temiz, mocked e2e 42/42 (yeni `e2e/create-room.spec.ts` dahil).

**Backend:** `apps/api/src/db/schema.prisma` (`Room.description`/
`lastActivityAt`/`creatorId`, iki ayrı `--create-only` migration),
`apps/api/src/api/dto/create-room.dto.ts` (yeni), `apps/api/src/api/
room-creation-throttler.guard.ts` (yeni, `UserThrottlerGuard`'ın yapısal
kopyası), `RoomsController`'a `POST /rooms`, `RoomsService.createRoom`
(case-insensitive ön-kontrol + P2002 backstop + `socketRegistry.
getSockets(userId)` ile oluşturanın açık soketini yeni odaya katma),
`MessagesService.sendMessage`'ın `$transaction` içinde `Room.
lastActivityAt`'i güncellemesi, `messages.gateway.ts`
`handleConnection`'ının `CORE_ROOM_NAMES` yerine `status:'active'`
sorgulaması (join-set düzeltmesi).

**Frontend:** `lib/api.ts`'e `Room`/`createRoom`, yeni `CreateRoomView.tsx`
(InviteView/BlockedUsersView'ın kurduğu panel deseni), `RoomView.tsx`'e
"+ yeni oda" nav butonu + `create-room` paneli + oda butonlarında
`title` tooltip'i (`description` + `formatRelativeActivity(lastActivityAt)`).

**Test:** `rooms.e2e-spec.ts`'teki iki gerçek-zamanlı test, join-set
açığının iki farklı yüzünü ayrı ayrı doğruluyor — oluşturanın ZATEN bağlı
soketinin yeni odaya hemen katılması (`RoomsService`'in soket-katma kodu)
ve odanın oluşmasından SONRA bağlanan başka bir kullanıcının da
`handleConnection`'ın `status:'active'` sorgusuyla otomatik katılması.
İkisi ayrı test — biri diğerini kapsamıyor, ikisi de ayrı ayrı bugüne
kadar YAZILMAMIŞ bir açığın kapandığını kanıtlıyor.

**Bilinen, bilerek ertelenmiş bir açık:** oda oluşturulduğunda, oluşturan
DIŞINDA halihazırda bağlı kullanıcılar o odaya otomatik katılmıyor —
`GET /rooms` de WS ile canlı güncellenmediği için (kapsam dışı, bkz. Out
of scope) zaten bu kullanıcılar odanın var olduğunu sayfayı yenilemeden
bilmiyor; tutarlı bir sınır, ayrı bir bug değil.

**`RoomView.tsx` bölünmesi — ayrı bir refactor dilimi olarak planlandı:**
`apps/web/app/components/RoomView.tsx` bu slice'tan önce zaten 477 satırdı
(M2.5 Slice D/E/F birikimi), Slice A'nın eklerinden sonra 516'ya çıktı —
CLAUDE.md'nin "400 satırı geçtiyse bölünmesi konuşulur" eşiği zaten
aşılmıştı, bu slice onu daha da aştı. Kullanıcının kararı (2026-08-01):
bölme işi Slice B'ye GÖMÜLMEYECEK — Slice B zaten arşiv mantığı +
salt-okunur + arşiv-göster toggle'ıyla dolu, ikisi karıştırılmayacak.
Bölme, kendi başına küçük bir "refactor" dilimi (M3'ün Slice B/C'sinden
bağımsız, sırası kullanıcının tercihine kalmış — Slice B'den önce ya da
sonra olabilir).

### Sıradaki
Slice A tamamlandı, push edildi. Sırada iki bağımsız iş: `RoomView.tsx`
bölme refactor'ü (küçük, ayrı dilim) ve Slice B (arşiv yaşam döngüsü) —
ikisi de ayrı dal, ayrı plan-modu turu, sırası kullanıcının tercihine
kalmış.

## Plan notları — Slice B tasarımı (2026-08-01, onaylandı — uygulama henüz başlamadı)

Plan modunda tasarlandı, bir Plan agent'ın ikinci geçişiyle çapraz
kontrol edildi (gerçek kod okunarak — `now: Date` enjeksiyonunun bu kod
tabanında hiç kullanılmayan YENİ bir desen olduğu, `editMessage`'ın oda
durumunu hiç kontrol etmediği, `handleMessageSend`'in bugün hiç
`ForbiddenException` dalı olmadığı gibi noktalar agent doğrulamasıyla
netleşti). Kullanıcının kararı: dış tetikleyici GitHub Actions scheduled
workflow (ücretsiz, repo zaten CI için kullanıyor).

**Şema:** `Room.archivedAt DateTime?` (nullable, tek migration) — ilk
taslakta Slice C'ye planlanmıştı, bilerek Slice B'ye taşındı: Slice C'nin
60-gün-sıfır-görüntülenme hesaplaması bir başlangıç noktasına ihtiyaç
duyuyor, Slice B arşivlerken damgalamazsa Slice C'de geriye dönük
doldurma imkânı olmaz.

**Backend:**
- `RoomsService.archiveSilentRooms(now: Date = new Date())` — `status:
  'active'`, `lastActivityAt < now - 14 gün` (adlandırılmış sabit), `name
  notIn CORE_ROOM_NAMES` olan odaları `archived`'a çevirir, `archivedAt`
  damgalar. `now` parametresi bu kod tabanında ilk kez kullanılan bir
  desen (grep ile doğrulandı, "kurulu convention" değil) — sadece birim
  testte kesim matematiğini kontrol etmek için.
- Salt-okunur uygulaması İKİ yazma yolunda: `MessagesService.sendMessage`
  VE `MessagesService.editMessage` (ikincisi ilk taslakta atlanmıştı —
  bugün `editMessage` `Room`'a hiç join etmiyor, sadece `sendMessage`'ı
  engellemek "yeni mesaj yasak ama düzenleme serbest" bırakırdı). İkisi
  de `GoneException` (410, Nest built-in) fırlatır — özel bir
  `ForbiddenException` alt sınıfı YOK (bu kod tabanında hiç özel exception
  alt sınıfı yok, gereksiz bir ilk-örnek olurdu).
- `messages.gateway.ts`: `handleMessageSend`'in bugün `ForbiddenException`
  dalı hiç yok (sadece `NotFoundException`) — `GoneException` kontrolü
  tamamen yeni bir dal. `handleMessageEdit`'in bugünkü
  `NotFoundException || ForbiddenException` sessiz-yutma dalından
  BAĞIMSIZ, ayrı bir `GoneException` dalı (alt sınıf değil, sıralama
  sorunu yok) `WsException({status:'error', code:'ROOM_ARCHIVED'})`
  fırlatır.
- `GET /rooms?includeArchived=true` — `messages.controller.ts`'nin
  cursor/limit desenini izler (DTO yok, elle parse, kesin string eşitliği
  `=== 'true'`). `RoomSummary`'ye `status: RoomStatus` eklenir
  (`@prisma/client`'tan doğrudan import, `users.service.ts`'in `UserRole`
  deseni).
- `POST /internal/rooms/lifecycle-sweep` — yeni `RoomsLifecycleController`
  (`HealthController` gibi `JwtAuthGuard` yok), yeni `CronSecretGuard`
  (`x-cron-secret` header, `ConfigService.get('CRON_SECRET')`'e karşı
  kesin eşitlik — `EmailService`'in `ConfigService` deseni). `app.module.ts`'e
  sadece controller eklenmesi yeterli (guard'lar bu kod tabanında
  `providers`'a ayrıca kaydedilmiyor). `{archived: number}` döner (Slice
  C'de `{archived, deleted}`'a genişleyecek, şimdiden stub eklenmiyor).

**Dış tetikleyici:** yeni `.github/workflows/lifecycle-sweep.yml`
(`on: schedule`, saatlik), iki yeni GitHub repo secret/variable —
**kod dışı, kullanıcının kendisi ekleyecek**: `CRON_SECRET` (Render'daki
değerle birebir aynı) ve `API_BASE_URL` (repoda hiçbir yerde prod domain'i
yok, tahmin edilmeyecek). `render.yaml`'a `CRON_SECRET` `sync: false`
eklenir (dokümantasyon amaçlı — STATE.md'nin bilinen tuzağı gereği gerçek
değer yine de Render dashboard'undan elle girilmek zorunda).

**Frontend:** `RoomView.tsx` (516 satır) bu slice'ta BÖLÜNMÜYOR (ayrı
refactor dilimi kararı yukarıda). `lib/api.ts`'e `Room.status` (string
union, Prisma tipi import edilmiyor) + yeni `listRooms(accessToken,
includeArchived?)` (`authedGetJson` ile — bu, `bootstrap()`'ın bugün
`lib/api.ts`'i atlayıp doğrudan `fetch()` yaptığı bir borcu da temizliyor).
"Arşivlenmiş odaları göster" toggle'ı + composer'ın `activeRoom.status
!== 'active'` iken hem görsel hem gerçekten devre dışı kalması (`canSend`
boolean'ına da eklenir, sadece UI görünümü değil) + mevcut `exception`
dinleyicisine `ROOM_ARCHIVED` yedek dalı.

**Test:** birim (`archiveSilentRooms` kesim matematiği + çekirdek oda
istisnası, `sendMessage`/`editMessage`'ın `GoneException` fırlatması);
entegrasyon (`GET /rooms` filtresi, `CronSecretGuard` doğru/yanlış/eksik
header); e2e (gerçek geriye-tarihlenmiş oda + sweep çağrısı + WS üzerinden
`ROOM_ARCHIVED` — STATE.md'nin bilinen tuzağı: test oda adı `general`'den
alfabetik önce sıralanmasın, `afterAll` temizliği çocuktan-ebeveyne);
frontend mocked e2e (toggle + salt-okunur composer).

### Sıradaki (uygulama öncesi — uygulama sonucu aşağıda)
Slice B tasarımı onaylandı ama **uygulama henüz başlamadı** — oturum
limiti nedeniyle sadece plan dokümante edildi. Bir sonraki oturumda
`m3/slice-b-archive-lifecycle` dalı açılıp bu bölümdeki tasarım aynen
uygulanacak (M1-M2.5'in kullandığı aynı ritim: kod + testler + tam
doğrulama + Plan notları güncellemesi + commit, push kullanıcının onayına
kalır).

## Plan notları — Slice B uygulaması (2026-08-02)

Tasarım aynen uygulandı, sapma yok. Kullanıcının açık talebiyle sekiz
küçük, izole commit'e bölündü (`m3/slice-b-archive-lifecycle` dalında) —
her biri kendi testleriyle + lint/typecheck ile geldi, haftalık limitin
dolma riskine karşı her adımdan sonra durup ilerleme bildirildi. Migration
adımı bilerek en başta, tek başına, kod içermeyen izole bir commit oldu.

**Bir kendi kendine düzeltilen hata:** migration commit'inde, Prisma'nın
ürettiği `migration.sql`'e (zaten uygulanmışken) bir rollback yorumu
eklenmeye çalışıldı — bu STATE.md'nin bilinen "uygulanmış migration'ı
editlemek checksum uyuşmazlığı yaratır" tuzağına düşüldüğü anlamına
geliyordu. `prisma migrate dev` "reset gerekiyor, tüm veri silinir" dedi;
reset'e HİÇ dokunulmadan dosya orijinal haline geri döndürüldü, checksum
tekrar eşleşti, veri kaybı olmadı (`migrate status`/`migrate dev` ile
doğrulandı). Ders: rollback yorumu gerekiyorsa `--create-only` ile önce
dosyayı oluşturup editleyip SONRA uygulamak gerekiyormuş — bu turda
atlandı, ileride hatırlanmalı.

**Backend:** tasarımdaki her madde birebir uygulandı —
`Room.archivedAt` migration'ı, `RoomsService.archiveSilentRooms(now)`,
`sendMessage`/`editMessage`'ın `GoneException` fırlatması,
`messages.gateway.ts`'in iki handler'da FARKLI diff şekliyle
`ROOM_ARCHIVED`'ı işlemesi (`handleMessageSend`'de tamamen yeni bir dal,
`handleMessageEdit`'te mevcut sessiz-yutma dalından bağımsız ayrı bir
dal — plan agent'ın önceden tam olarak işaret ettiği fark), `GET
/rooms?includeArchived`, `RoomsLifecycleController` + `CronSecretGuard`.

**Frontend:** `lib/api.ts`'e `Room.status` + `listRooms` (bu arada
`bootstrap()`'ın `lib/api.ts`'i atlayıp doğrudan `fetch()` yaptığı eski
bir borç da temizlendi), "arşivi göster" toggle'ı, composer'ın
`activeRoom.status`'a göre gerçekten (sadece görsel değil, `canSend`'e
de işlenerek) devre dışı kalması.

**Beklenmeyen bir test regresyonu, hemen bulunup düzeltildi:**
`RoomSummary`'ye `status` eklenince, bu alanı içermeyen ESKİ mocked
frontend e2e testleri (`blocked-users.spec.ts`, `totp-settings.spec.ts`)
gerçekten kırıldı — `status` `undefined` olunca composer sessizce
"salt-okunur" render yoluna düşüyordu (`undefined !== 'active'`). Tam
`apps/web` e2e koşusuyla yakalandı, mock'lara `status: 'active'` eklenerek
düzeltildi (`create-room.spec.ts`/`room-switcher.spec.ts`'e de tutarlılık
için eklendi, onlar aslında kırılmamıştı).

**Doğrulama (final):** `apps/api` lint/typecheck/build temiz, birim
103/103, e2e 52/52; `apps/web` lint/typecheck/build temiz, mocked e2e
43/43 (yeni `e2e/room-archive.spec.ts` dahil).

### Sıradaki
Slice B tamamlandı, commit'e hazır (henüz push/merge edilmedi — kullanıcı
onayına kalmış). Sırada iki bağımsız iş, sırası kullanıcının tercihine
kalmış: `RoomView.tsx` bölme refactor'ü (küçük, ayrı dilim) ve Slice C
(silme yaşam döngüsü — kendi plan-modu turu gerekiyor).
