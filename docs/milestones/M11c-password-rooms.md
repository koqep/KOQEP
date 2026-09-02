# M11c — Şifre-korumalı odalar

*Odaya katılım için şifre — mesaj içeriği şifrelemesi DEĞİL (kullanıcı
kararı, bkz. Plan notları). Kapsam turu: `docs/BACKLOG.md`'nin "G.
2026-08-29 KAPSAM TURU" bölümü.*

**Goal:** `Room`'a opsiyonel bir katılım-şifresi ekle — mesaj içeriği,
moderasyon, raporlama akışlarının HİÇBİRİNE dokunmadan.
**Demo:** Oda kurucusu oda oluştururken opsiyonel bir şifre belirliyor;
şifreli bir odaya katılmaya çalışan biri önce şifre giriyor, yanlışsa
giremiyor; moderatör şifreli bir odanın içeriğini her zamanki gibi
görebiliyor/moderasyon yapabiliyor (şifre onu etkilemiyor).
**Estimated hours:** ~15-20h.

## Out of scope
- **Gerçek mesaj-içeriği şifrelemesi** — kullanıcı kararıyla ELENDİ (bkz.
  Plan notları): anahtar yönetimi + moderasyon/raporlama sisteminin
  "okunabilir içerik" varsayımıyla çelişkisi, ~40-60h+ ek risk. Bu dilimde
  YOK, ileride ayrı bir tartışma/milestone gerektirir.
- Şifre-korumalı odanın `scope=discoverable` listesinden gizlenmesi —
  KARARLAŞTIRILDI (Slice B): normal keşif listesinde görünür, sadece düz
  metin bir "password protected" göstergesiyle işaretlenir.

## Acceptance criteria
- [x] `Room` modeli opsiyonel bir şifre-hash alanına sahip (migration).
- [x] Oda oluşturma akışında opsiyonel bir şifre alanı var — backend
      Slice A'da, frontend formu (`CreateRoomView.tsx`) Slice B'de.
- [x] `joinRoom` (bugün açık bir upsert, `Room.RoomMember`'ın erişim-kontrolü
      OLMADIĞI şemanın kendi doc yorumunda belirtiliyor) artık şifreli bir
      oda için doğru şifre gerektiriyor, yanlış şifrede reddediyor.
- [x] Moderatör aksiyonları (mute, remove-content, room-level moderasyon)
      şifreli odalarda AYNEN çalışıyor — hiçbir yeni kısıt yok (kod
      DEĞİŞMEDİ, `ModeratorGuard` zaten role-based, oda şifresinden
      bağımsız — Slice A'da doğrulandı).
- [x] Şifre hash'lenerek saklanıyor (düz metin DEĞİL, mevcut login-şifresi
      hash'leme deseniyle tutarlı).

## Tasks
- [x] **Slice A — Şema + backend.** Tamamlandı (2026-09-02),
      `feat/room-password-backend` dalında. Detay Plan notları'nda.
- [x] **Slice B — Frontend.** Tamamlandı (2026-09-02),
      `feat/room-password-frontend` dalında. Detay Plan notları'nda.

## Risks
- Bugün HİÇBİR odada erişim-kontrolü yok (`RoomMember` bilerek "access
  control DEĞİL" diye tasarlandı) — bu, kod tabanına eklenen İLK gerçek
  erişim-gating mekanizması. Diğer akışların (WS auto-join, `listRooms`,
  mevcut "herkes her odaya girebilir" varsayımı) şifreli bir oda için
  gerçekten doğru davrandığını doğrulamak, tahmin edilenden daha fazla yer
  dokunmayı gerektirebilir — implementasyon planında dikkatle taranmalı.

## Plan notları

### Kapsam kararı (2026-08-29)
Kullanıcı "şifreli oda" isteğini `AskUserQuestion` ile netleştirdi: iki
seçenek sunuldu — (a) şifre-korumalı katılım, moderasyon/raporlama
etkilenmez, ~15-20h; (b) gerçek mesaj-içeriği şifrelemesi, anahtar yönetimi
+ THREAT-MODEL etkisi (şifreli içerik mevcut moderasyon sisteminin
"okunabilir içerik" varsayımıyla çelişir), ~40-60h+. **Kullanıcı (a)'yı
seçti.** Bu dosya sadece (a)'yı kapsıyor.

### Slice A kapsam turu + implementasyonu (2026-09-02) — tamamlandı

Plan modunda 2 paralel Explore agent'ıyla (backend: `RoomMember`/ADR-0009/
`joinRoom`/hash deseni; frontend: `CreateRoomView`/`DiscoverRoomsView`/
panel deseni) kod TAM okunarak doğrulandı. **En kritik bulgu:** ADR-0009
`messages.service.ts`'in `sendMessage`/`getRecentMessages`'ının HİÇBİR
üyelik kontrolü yapmadığını, herhangi bir authed kullanıcının ismini
bildiği herhangi bir aktif odaya doğrudan yazabildiğini/okuyabildiğini
GERÇEKTEN doğruladı (bilinçli bir mimari karar, "erişim kontrolü DEĞİL").
Bu, `AskUserQuestion` ile netleştirilen kritik bir kapsam kararı doğurdu:

**Kapsam kararı — sendMessage/getRecentMessages de korunmalı mı?**
1. Sadece `joinRoom`'u koru (milestone'un literal AC'si) — şifre sadece
   UI akışının bir adımı, REST/WS'i doğrudan çağıran biri şifreyi hiç
   görmeden mesaj gönderip okuyabilirdi, "şifre-korumalı" ismi yanıltıcı
   olurdu.
2. **`sendMessage`/`getRecentMessages`/WS `handleMessageSend`'i de koru**
   (KULLANICI SEÇTİ, önerilen) — normal UI akışı (her zaman join'den
   geçiyor) HİÇ etkilenmiyor, sadece API'yi doğrudan çağıran biri
   durduruluyor. ~3-5h ek süre.

Uygulama, `feat/room-password-backend` dalında (main'den, BAĞIMSIZ) 3
commit:
- `60f37e1` — `Room.passwordHash` migration (nullable, additive) +
  `CreateRoomDto`/`JoinRoomDto` + `RoomsService.createRoom`/`joinRoom`
  (argon2, `auth.service.ts`'in AYNI deseni) + `MessagesService`'e YENİ
  `assertRoomAccessOrThrow` (sendMessage/getRecentMessages'ın ikisine de
  eklendi, şifresiz odalarda SIFIR davranış değişikliği) + WS
  `handleMessageSend`'e `ForbiddenException` → `ROOM_ACCESS_DENIED`
  çevirisi + `RoomSummary`'ye `hasPassword` (hash asla dışarı sızmıyor) +
  yeni `RoomJoinThrottlerGuard` (`ReportThrottlerGuard`'ın birebir
  kopyası, 10/saat — milestone AC'sinde yok ama şifre kontrolünün
  kendisiyle motive).
- `264796b` — testler (aşağıda).
- `ef4b6a7` — `docs/DATA-MODEL.md` güncellemesi.

**Plan sırasında YAKALANMAMIŞ, implementasyonda bulunan bir tip hatası:**
`room-moderation.service.ts` `RoomSummary` dönen 3 metodu (`renameRoom`/
`archiveRoom`/`setRoomAnnouncement`) KENDİ ayrı, `rooms.service.ts`'in
`ROOM_SUMMARY_SELECT`'inden BAĞIMSIZ bir `roomSummarySelect` kopyasını
taşıyordu — `hasPassword` eklenince derleyici bu 3 yeri de eksik alanla
yakaladı. Düzeltme: `rooms.service.ts`'in `ROOM_SUMMARY_SELECT`/
`toRoomSummary`'si EXPORT edilip `room-moderation.service.ts`'in kendi
kopyası KALDIRILDI — bir taşla iki kuş (tip hatası + önceden var olan bir
gerçek kod tekrarı).

**Test-izolasyonu dersi (ValidationPipe):** `rooms.e2e-spec.ts`'in ana
describe'u `ValidationPipe` KURMUYOR (`apps/api`'nin e2e TestingModule'ü
genelde kurmuyor, STATE.md Tuzaklar) — kısa-şifre DTO reddi testi
`auth-signup-login.e2e-spec.ts`'in "ana describe'a ValidationPipe eklemek
riskli, KENDİ küçük TestingModule'ü" emsaliyle AYNI desende ayrı, küçük
bir describe'a alındı, ana describe'un mevcut testlerine hiç dokunulmadı.

**Doğrulama:** `npm run lint`+`typecheck` temiz, `npm run build` başarılı,
`apps/api` birim 329/329 (+9 yeni), `apps/api` e2e 160/160 (26 suite, +4
yeni: `rooms.e2e-spec.ts`'te join şifre akışı + WS `ROOM_ACCESS_DENIED` +
ayrı ValidationPipe describe'unda kısa-şifre reddi, `messages.e2e-spec.ts`'te
REST 403). Frontend'e (Slice B) HENÜZ dokunulmadı.

### Slice B implementasyonu (2026-09-02) — tamamlandı

Kapsam net, Slice A'nın plan modunda ZATEN tam okunmuş frontend kodu
(`CreateRoomView.tsx`/`DiscoverRoomsView.tsx`/`lib/api.ts`/
`PasswordInput.tsx`) üzerinden doğrudan uygulamaya geçildi - yeni bir
Explore agent'ı gerekmedi (`git log` ile Slice A'dan bu yana `apps/web`'e
hiç dokunulmadığı doğrulandı).

Uygulama, `feat/room-password-frontend` dalında (main'den, Slice A ZATEN
main'de) 2 commit:
- `4b37593` — `lib/api.ts`'e `Room.hasPassword` + `createRoom`/`joinRoom`'un
  opsiyonel `password` parametresi. `CreateRoomView.tsx`'e login'in ZATEN
  kullandığı `PasswordInput` bileşeniyle (yeni bir `<input type=
  "password">` icat edilmeden) "password (optional)" alanı - kısa şifre
  client tarafında (API'ye hiç gitmeden) reddediliyor.
  `DiscoverRoomsView.tsx`: şifreli bir oda düz metin "· password
  protected" göstergesiyle işaretleniyor (KOQEP'in metin-only/terminal
  estetiği - ikon/emoji İCAT EDİLMEDİ). "join" tıklaması şifreli bir
  odada DOĞRUDAN katılmıyor, `RoomModerationSection.tsx`'in rename/
  announce formlarıyla AYNI koşullu-değiştirme deseninde inline bir
  şifre formu açılıyor; yanlış şifrede form AÇIK KALIYOR (kullanıcı
  tekrar deneyebilsin).
- `f2ebf0d` — testler (aşağıda).

**Doğrulama:** `npm run lint`+`typecheck` temiz, `npm run build` başarılı,
mock'lu Playwright süiti 146/146 (İKİ tam koşum - 6 yeni test), `e2e-
fullstack` 10/10 (bu slice'a dokunan bir fullstack testi yok, grep ile
doğrulandı), `apps/api` birim 329/329 + e2e 160/160 (etkilenmedi, saf
frontend). Görsel doğrulama: create-room panelinde şifre alanı + discover-
rooms listesinde göstergenin (şifresiz odada YOK) + join tıklanınca açılan
inline formun + yanlış şifre hatasının (form açık kalıyor, şifre alanı
dolu) gerçek Playwright ekran görüntüsüyle onaylandı.

**M11c'nin TÜM dilimleri (Slice A + Slice B) artık tamamlandı.**
