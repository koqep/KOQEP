# M4 — Reputation + Invite-Per-Level

*XP olay-günlüğü olarak tutulur, seviye bu günlükten hesaplanır. Her seviye atlayışta 1 davet kazanılır (Level 1'den itibaren). Manuel "davet oluştur" akışı KALDIRILIYOR — davetler artık sadece seviye atlayınca otomatik kazanılır (2026-08-04 kapsam gözden geçirmesi, kullanıcı kararı).*

**Goal:** Replace M1's founder-issued invite pool with the real mechanism: an append-only reputation event log driving level, and 1 invite granted per level-up.
**Demo:** A tester sends enough messages to level up and sees a new invite appear (invites panelinde, artık kalıcı bir `GET /invites` listesiyle); replaying the event log after a simulated rule change produces a corrected level without touching stored totals directly.
**Estimated hours:** 20–30h.

## Out of scope
- Monetization (Boost-for-XP is killed per `docs/review/CRITIQUE.md`; alternatives are a later prototype, per `docs/PRD.md` open questions).
- Tam bir profil sayfası (bio, ASCII avatar, rozet) — `docs/BACKLOG.md`'nin zaten kaydettiği gibi bu M4'ün kapsamında değil, V1.1/olası bir M7. Sadece `GET /users/me`'ye ucuz bir `level`/`totalXp` alanı ekleniyor (Slice C) — sayfa değil, tek bir sayı.
- Mesaj göndermek dışındaki XP-kazandıran eylemler ("diğer tanımlı eylemler", acceptance criteria'nın orijinal ifadesi) — hiçbir dokümanda somut bir liste yok (PRD/GLOSSARY/CRITIQUE grep edildi, boş). `ReputationEvent.actionType` alanı string olduğu için sonradan yeni bir eylem eklemek ucuz — v1 sadece `MESSAGE_SENT`.
- Seviye atlayınca WS ile canlı bildirim — M3'ün "sonraki reload'da görünür kabul edilebilir" ilkesiyle aynı, invites paneli açıldığında zaten güncel liste geliyor.
- Sybil/XP-farming'e karşı ek teknik kontrol (ör. mesaj başına azalan getiri, günlük XP tavanı) — `docs/THREAT-MODEL.md` satır 1 bunu zaten "küçük topluluk fark eder" diye kabul edilmiş bir risk olarak işaretliyor, mevcut WS mesaj rate limiti (10/10s) zaten bir üst sınır koyuyor. Milestone'un kendi Risk notu da "basit bir formülle başla" diyor — gold-plating yok.

## Acceptance criteria
- [x] Sending a message appends a `ReputationEvent` row (`MESSAGE_SENT`, diğer eylemler kapsam dışı — yukarıya bakın).
- [x] Current level is computed/materialized from the event log, never stored as an authoritative mutable counter (ADR-0004).
- [ ] Leveling up grants exactly 1 new invite PER SEVİYE (bir olayda birden fazla seviye atlanırsa o kadar davet — aşağıdaki Plan notları'na bakın), starting at Level 1. Slice B.
- [ ] Kazanılan davetler `GET /invites` ile listelenebiliyor — bu, mevcut kodun (ve `InviteView.tsx`'in) hiç sahip olmadığı yeni bir uç nokta, "davet kazandım ama göremiyorum" durumunu önlemek için zorunlu (Yol B: bu olmadan özellik kullanılamaz, kozmetik değil). Slice B.
- [x] ~~Invite issuance is rate-limited per inviter~~ — **ZATEN YAPILMIŞ** (M2 Slice C, `UserThrottlerGuard`, 5/saat). Manuel oluşturma kaldırılınca bu guard'ın `invites.controller.ts`'teki kullanımı da kaldırılıyor (Slice B) — otomatik kazanım zaten mesaj gönderiminin kendi WS rate limitine tabi, ayrı bir limite ihtiyaç yok.
- [x] A test demonstrates replaying the event log after a simulated XP-rule change, proving the event-log choice pays off.

## Tasks
Her biri kendi plan-modu turu + commit + tam doğrulama (M1-M3'ün kullandığı aynı ritim). 2026-08-04 kapsam gözden geçirmesinde A/B/C dilimlerine bölündü (aşağıdaki Plan notları):
- [x] **M4 Slice A — ReputationEvent günlüğü + seviye hesaplama + mesaj başı XP.** Tamamlandı (2026-08-04) — detay için aşağıdaki "Plan notları — Slice A uygulaması" bölümüne bakın. `ReputationEvent` tablosu + `User.totalXp`/`User.level` (cache, AYNI migration'da). `ReputationService.awardXp` — `MessagesService.sendMessage`'ın zaten var olan transaction'ına eklendi. Saf fonksiyon `computeLevelFromXp(totalXp, xpPerLevel)` — replay testinin kalbi.
- [ ] **M4 Slice B — Davet kazanımı + manuel oluşturmanın kaldırılması + GET /invites.** Seviye atlayınca (birden fazla seviye tek olayda atlanabilir — çoklu davet) `Invite` satırları AYNI transaction içinde oluşturulur. `POST /invites` VE `UserThrottlerGuard`'ın oradaki kullanımı kaldırılır (kullanıcı kararı — davetler artık sadece kazanılır). Yeni `GET /invites` (kendi davetlerini listele). Frontend: `InviteView.tsx`'in "davet oluştur" butonu kaldırılır, yerine kalıcı bir liste gelir.
- [ ] **M4 Slice C — Founder/mevcut kullanıcı geçişi + minimal seviye görünürlüğü.** Founder ve erken kullanıcılar M4 şipince 0 XP'yle başlıyor — ilk daveti manuel SQL ile bootstrap (kod DEĞİL, zaten kurulu "sıfır-kullanıcılı DB" desenine uygun, bkz. STATE.md tuzağı). `GET /users/me`'ye `level`/`totalXp` eklenir (sayfa değil, tek alan) — Yol B: seviye tamamen görünmez olsaydı mekanik "sessiz" hissettirirdi.

## Risks
- The exact level/XP formula is a product guess, not a validated curve — mitigation: ship a simple linear formula first and treat tuning as a post-launch iteration, not a blocker for this milestone. **Slice A'da kesinleşti (2026-08-04):** 1 XP/mesaj, `level = floor(totalXp / 35)` — her 35 mesaj bir seviye. İlk taslak 20'ydi; günde 10-15 mesaj atan "makul aktif" bir kullanıcı için 20 → 1.3-2 gün/seviye çıkıyordu, PRD'nin dolaylı "~3 gün" hedefinden hızlıydı. 35 ile 3.5 gün (10 mesaj/gün) - 2.3 gün (15 mesaj/gün) arası, hedefe daha yakın. Tamamen tahmini, adlandırılmış sabitler olarak yazıldı (`XP_PER_LEVEL`, `MESSAGE_SENT_XP`), tuning sonraki bir iş.
- **Yeni bulunan risk:** M4 şiptiği anda founder dahil TÜM mevcut kullanıcılar 0 XP/0 seviyede başlar — birileri davet edilmeden önce mesaj göndermesi/seviye atlaması gerekir. Kabul edilen risk (Slice C'ye bakın) — tek seferlik, zaten kurulu manuel-SQL-bootstrap deseniyle çözülüyor, kalıcı bir kod yolu gerektirmiyor.

---

## Plan notları — 2026-08-04 kapsam gözden geçirmesi

M3 tamamen bitince "taze bir gözle" bir kapsam turu istendi — bu dosyaya
oturum boyunca hiç dokunulmamıştı. M3'te öğrenilen dersler bilerek
uygulandı: rate limiting tuzakları, WS güvenilirlik desenleri
(`SocketRegistryService`), migration disiplini (aynı slice'ta ilgili
tüm alanları ekle), TOCTOU gibi yarış durumu kontrolleri. Her madde
gerçek kod okunarak (`schema.prisma`, `invites.service.ts`,
`invites.controller.ts`, `user-throttler.guard.ts`, `InviteView.tsx`,
`users.service.ts`, `messages.service.ts`) ve gerçek dokümanlar
(`ADR-0004`, `docs/PRD.md`, `docs/THREAT-MODEL.md`, `docs/BACKLOG.md`,
`docs/review/CRITIQUE.md`, `docs/GLOSSARY.md`) okunarak doğrulandı —
varsayılmadı. **Yol B ölçütü** her maddeye uygulandı: *bu olmadan 20-30
kişilik kapalı bir toplulukta ürün bozuk/güvensiz hissettirir mi?*

**Milestone'un kendi görev listesinin atladığı, kod okuyarak bulunan
kritik açık:** `ReputationEvent` tablosu şemada YOK (grep ile
doğrulandı, sıfırdan kuruluyor) — bu beklenen bir durumdu. Ama daha
önemlisi: **`POST /invites` bugün TAMAMEN AÇIK ve sınırsız** — herhangi
bir kimliklenmiş kullanıcı, sadece 5/saat rate limitine tabi olarak
istediği kadar davet kodu üretebiliyor (`invites.service.ts`'in
`createInvite`'ı hiçbir bakiye/hak kontrolü yapmıyor). M4'ün "seviye
başına 1 davet kazanılır" mekaniği bu MEVCUT serbest akışla doğrudan
ÇELİŞİYOR — milestone dokümanı bu çelişkiyi hiç fark etmemiş, sanki
"davet oluşturma" hiç var olmayan bir özellikmiş gibi yazılmış.
Kullanıcıya soruldu (`AskUserQuestion`): manuel oluşturma KALDIRILACAK,
davetler artık sadece otomatik kazanılacak.

**İkinci kritik açık (Yol B ile bulundu):** `InviteView.tsx`'in
`codes` state'i SADECE o an açık olan tarayıcı sekmesinde, o oturumda
oluşturulan kodları tutuyor — sayfa yenilenince ya da başka bir cihazdan
girilince kaybolur, ve `GET /invites` (kendi davetlerini listele) diye
bir uç nokta HİÇ YOK. Eğer M4 sadece "arka planda otomatik davet
oluştur" yapıp bu görünürlük açığını kapatmazsa, kullanıcı seviye
atlayıp davet kazandığını bilse bile kodu asla GÖREMEZ — bu, Yol B'nin
tam da yakalamak için var olduğu türden bir açık: kozmetik değil,
özelliği kullanılamaz kılıyor. `docs/BACKLOG.md`'nin "M4'ün mevcut görev
listesinde hiçbir UI/profil sayfası yok" notuyla KARIŞTIRILMAMALI — o
not tam bir PROFİL SAYFASI (bio/avatar/rozet) için, invites panelinin
kendisi zaten var olan bir özellik ve yeni modele uyacak şekilde
değişmek ZORUNDA.

**Üçüncü bulgu — zaten yapılmış bir görev:** Acceptance criteria'nın
"invite issuance is rate-limited per inviter" maddesi ve Tasks'ın
"per-inviter invite issuance rate limit" maddesi **M2 Slice C'de zaten
tamamlanmış** (`UserThrottlerGuard`, 5/saat, `docs/THREAT-MODEL.md`
satır 1'in kendisi de bunu "M2 Slice C'de planlı" diye işaretliyor ama
STALE — zaten şipmiş). M3'te de aynı örüntü vardı (milestone dokümanının
gerçekte tamamlanmış işi hâlâ "yapılacak" göstermesi) — checkbox'lar
düzeltildi, gerçek kalan iş (bakiye/hak bazlı kısıtlama, rate limit
DEĞİL) Slice B'ye yazıldı.

**Migration disiplini (bu oturumun dersi, doğrudan uygulandı):**
`ReputationEvent` tablosu + `User.totalXp` + `User.level` üçü de Slice
A'nın TEK migration'ında eklenecek — M3 Slice A'da `description`'ın
ayrı bir migration'a kalıp sonradan eklenmesi (maliyetsiz ama gereksiz
bir ekstra adım) tekrarlanmayacak, bu üçü baştan birbiriyle ilişkili
olduğu bilindiği için birlikte gidiyor.

**WS güvenilirlik deseni (uygulanan ders):** Yeni bir `ReputationService`
kendi başına bir WS event'i ya da yeni bir cross-cutting concern
GEREKTİRMİYOR — XP kazanımı `MessagesService.sendMessage`'ın zaten var
olan `$transaction`'ına eklenir (aynı transaction'da `Room.
lastActivityAt` güncellemesinin yanına), `SocketRegistryService`'in
"paylaşılan, aşağı-yönlü bağımlılık" deseniyle aynı ruhta: `ReputationService`
de `MessagesService`'in aşağı-yönlü bir bağımlılığı olacak, tersi değil
(döngüsel DI riski yok).

**TOCTOU/yarış durumu değerlendirmesi:** Slice B'de "seviye atlayınca
davet oluştur" mantığı XP güncellemesiyle AYNI transaction içinde
olacağı için (Slice C'nin `purgeArchivedRooms`'unda çözülen TOCTOU
sınıfından FARKLI olarak) burada ayrı bir aday-seçme/silme penceresi
yok — tek bir atomik yazma. Asıl dikkat edilmesi gereken nokta: bir tek
mesajın XP'si BİRDEN FAZLA seviye atlatabilir mi (büyük bir XP_PER_LEVEL
küçültmesi ya da toplu bir "geçmiş mesajları geriye dönük XP'le"
senaryosunda) — cevap evet, bu yüzden Slice B'nin tasarımı "tam olarak 1
davet" değil "(yeni seviye - eski seviye) kadar davet" olacak şekilde
düzeltildi (acceptance criteria'da işlendi).

**Sorulan soru:** manuel "davet oluştur" butonunun kaderi
(`AskUserQuestion` ile) — kullanıcı KALDIRILMASINI onayladı (önerilen
seçenek). Sorulmayan ama kendi kararıyla çözülen iki nokta (Yol B
uygulanarak, milestone'un kendi "basit formülle başla" risk notuyla
tutarlı): XP formülü sayıları (1 XP/mesaj, 20 mesaj/seviye — tamamen
tahmini, Slice A'nın plan-modu turunda kesinleşecek) ve founder/mevcut
kullanıcı geçişi (kalıcı kod değil, tek seferlik manuel SQL — zaten
kurulu bir desen).

### Sıradaki
Kapsam gözden geçirmesi onaylandı, uygulama henüz başlamadı. Bir sonraki
oturumda Slice A (`ReputationEvent` günlüğü + seviye hesaplama) kendi
plan-modu turuyla başlayacak — bu dosyadaki tasarım bir taslak, Slice
A'nın kendi turu XP formülü sabitlerini kesinleştirecek.

## Plan notları — Slice A uygulaması (2026-08-04)

Plan-modu turunda kod okunarak (varsayılmadan) tasarlandı, bir Plan
agent'ıyla çapraz kontrol edildi. Agent **iki gerçek regresyon riski**
doğruladı — ikisi de yanlış yapılırsa zaten şipmiş özellikleri kırardı:

**1. Hesap silme regresyonu.** `AuthService.deleteAccount()` doğrudan
`prisma.user.delete()` çağırıyor, hiçbir uygulama-seviyesi temizlik
yok — tamamen şemanın `onDelete` davranışına güveniyor.
`ReputationEvent.userId` `String?` + `onDelete: SetNull` OLMASAYDI,
mesaj göndermiş herhangi bir kullanıcı hesabını silmeye çalışınca FK
ihlaliyle patlardı. `Invite.issuedById`/`Message.authorId`'nin zaten
kurduğu "içerik/denetim satırı → SetNull" kategorisine uyacak şekilde
yazıldı (ADR-0005).

**2. Slice C purge regresyonu.** `RoomsService.purgeArchivedRooms`
(M3 Slice C, zaten şipmiş) `messageEdit`→`message`→`room` sırasıyla
hard-delete ediyor. `ReputationEvent.sourceMessageId` `String?` +
`onDelete: SetNull` OLMASAYDI, Slice A şiptikten sonra arşivlenip
XP'li mesajlara sahip bir oda purge edilirken FK'ye takılıp Slice C'yi
kırardı. SetNull ile Slice C'nin koduna hiç dokunulmadı — Postgres
SetNull FK'li satırları parent silmeyi asla engellemiyor. Üçüncü bir
nokta (`apps/api/test/load/ws-load-test.ts`, bağımsız bir yük-testi
temizlik betiği) aynı sırayla siliyor — SetNull tasarımıyla değişmeden
çalışıyor, sadece kayıt için not edildi.

**Gerçekte yapılan:**
- Tek migration: `ReputationEvent` tablosu + `User.totalXp`/`User.level`
  (cache alanları), üçü birlikte — migration disiplini korundu.
- `ReputationService.awardXp(tx, userId, actionType, amount,
  sourceMessageId?)` — kendi transaction'ını açmıyor, çağıranın açık
  `tx`'ini alıyor (bu kod tabanında ilk kez, agent doğruladı: cross-
  service transaction kompozisyonu daha önce yoktu). `MessagesService.
  sendMessage`'ın zaten var olan `$transaction`'ına eklendi.
- Saf fonksiyon `computeLevelFromXp(totalXp, xpPerLevel = XP_PER_LEVEL)`
  — `rooms.service.ts`'in `isUniqueConstraintError` deseniyle aynı
  ruhta, state'siz mantık class dışında. `xpPerLevel` parametresi
  replay testinin kalbi.
- `XP_PER_LEVEL=20` taslağı `35`'e düzeltildi — bkz. yukarıdaki Risks
  notu.
- e2e test (`messages-gateway.e2e-spec.ts`): gerçek bir WS mesajının
  gerçek bir `ReputationEvent` satırı + `User.totalXp`/`level`
  güncellemesi ürettiği doğrulandı.
- `docs/DATA-MODEL.md` güncellendi: `ReputationEvent` blurb'üne SetNull
  gerekçesi eklendi, `Message 0/1—N ReputationEvent` ilişki satırı
  eklendi (agent'ın bulduğu dokümantasyon açığı).

Doğrulama: `apps/api` lint/typecheck/build temiz, 117/117 birim test,
56/56 e2e test. Dal `m4/slice-a-reputation-log`, push kullanıcının
onayına kalıyor.

### Sıradaki
Slice A tamam. Slice B (davet kazanımı + manuel oluşturmanın
kaldırılması + `GET /invites` + frontend rework) kendi plan-modu
turuyla başlayacak.
