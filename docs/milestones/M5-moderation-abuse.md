# M5 — Moderation & Abuse Tooling

*Rapor akışı (oda mesajları — DM henüz yok) sadece raporlanan içeriği moderatöre gösterir, ve moderatör raporu gerçekten ÇÖZEBİLİR (içerik kaldırma + durum); şeffaf geçici susturma (shadow ban değil, mesaj gönderimi VE düzenlemesi kapsar); her moderatör erişimi ve aksiyonu değiştirilemez bir denetim günlüğüne yazılır; kötü-isimli oda moderasyonu artık manuel SQL değil; davetçi hesap verebilirliği (B15) platformun en özgün moderasyon avantajı.*

**Goal:** Give the founder (sole moderator) real tools: a report flow with a real resolution action, transparent temp-mute, room moderation, an audit log over their own access, and inviter accountability.
**Demo:** A tester reports an abusive message; the founder sees only that reported content, removes it (content replaced, original preserved in the audit trail — never hard-deleted) and applies a temp-mute that the muted user is visibly notified of (in-app, real-time), the audit log shows exactly what was accessed and when, and the muted user's inviter sees a visible accountability signal.
**Estimated hours:** 30–44h (revize edilecek — Slice A içerik-kaldırma+durum ile genişledi, yeni bir Slice D (oda moderasyonu) eklendi).

## Out of scope
- Multi-moderator role management — there is exactly one moderator (the founder) at this scale.
- **Moderatör rolünün self-servis ataması — M2'nin "M5 scope" öngörüsü 2026-08-05'te yeniden değerlendirildi, kapsam dışı bırakıldı.** Founder'ın kendi rolünü SQL ile bir kere ayarlaması (`STATE.md` tuzağı) tek seferlik bir bootstrap adımı — M5'in kendi Out-of-scope'unun zaten reddettiği "multi-moderator management" olmadıkça tekrar eden bir ihtiyaç değil. Manuel prosedür olarak kalıyor, `docs/THREAT-MODEL.md` Open items'a eklendi.
- **DM raporlama — DM'in kendisi henüz yok** (2026-08-05 kapsam gözden geçirmesinde doğrulandı, `docs/THREAT-MODEL.md` satır 10 zaten "Row written as if DM exists — it doesn't ... Until DM ships, this entire row's risk is moot" diyor). Rapor akışı bu yüzden SADECE oda mesajlarını kapsıyor — DM şipince aynı rapor mekanizması ona da genişletilecek, ayrı bir görev değil.
- Invite-issuance audit tablosu (`User` FK'sinden bağımsız, silinen davetçileri geriye dönük izlemek için) — `docs/BACKLOG.md`'nin zaten kaydettiği gibi SADECE Slice E'nin tasarımı bunu gerçekten gerektirirse inşa edilir, önceden varsayılmıyor.

## Acceptance criteria
- [x] A user can report a message; the report exposes only the reported content to the moderator (`docs/THREAT-MODEL.md` row 10) — not ambient access to all of a user's messages. (DM raporlama, DM şipince — bkz. Out of scope.)
- [x] A moderator can resolve a report by removing the message's content — NEVER a hard delete (CLAUDE.md'nin "mesaj içeriği asla hard-delete edilmez" kuralı, tek istisna oda purge, ADR-0006) — or dismissing it as not-actionable; the report's status reflects the outcome.
- [ ] A moderator can apply a temp-mute; the muted user is visibly notified in real time (WS) — no shadow ban. Mute, hem yeni mesaj göndermeyi HEM mevcut mesaj düzenlemeyi kapsar (`docs/THREAT-MODEL.md` satır 3'ün tarif ettiği "önce masum mesaj at, sonra düzenleyip saldırıya çevir" vektörü). Slice B.
- [x] Every moderator access to edit history or reported content, and every moderation action (mute, content removal, room moderation), is written to an append-only audit log (`docs/THREAT-MODEL.md` row 12): who, what, on whom, when. (Slice A: erişim + içerik kaldırma/reddetme kapsandı; Slice B/D kendi aksiyon tiplerini ekleyecek.)
- [ ] Same-actor multi-report pattern (row 10's weak backstop) triggers a flag for moderator attention — SADECE çözülmemiş (açık) raporlar sayılır, çözülmüş bir rapor yanlış alarm üretmemeli. Slice C.
- [ ] A moderator can rename or delete a badly-named/abusive room directly (`docs/BACKLOG.md`'nin ertelenmiş "oda moderasyonu" maddesi — tetikleyicisi zaten fırlamış, bkz. Plan notları). Slice D.
- [ ] When a user is banned/temp-muted for real abuse, their inviter's invite
      quota/trust is visibly affected (`docs/BACKLOG.md` `B15` — "davetçi
      hesap verebilirliği," the platform's most distinctive moderation
      lever; depends on M4's invite-per-level mechanism already existing).

## Tasks
Her biri kendi plan-modu turu + commit + tam doğrulama (M1-M4'ün kullandığı aynı ritim). 2026-08-05 kapsam gözden geçirmesinde (iki tur) A/B/C/D/E dilimlerine bölündü (aşağıdaki Plan notları):
- [x] **M5 Slice A — Rapor akışı + moderatöre kapsamlı görünürlük + çözüm eylemi + durum + denetim günlüğü temeli.** Tamamlandı (2026-08-06) — detay için aşağıdaki "Plan notları — Slice A uygulaması" bölümüne bakın. `Report` tablosu (oda mesajları, DM DEĞİL — bkz. Out of scope), `status` alanıyla (açık/çözüldü/reddedildi). Moderatöre SADECE raporlanan içeriği gösteren bir review queue — `messages.service.ts`'in zaten kurduğu `role === 'moderator'` deseniyle aynı (`getMessageEditHistory`). Moderatörün gerçek bir çözüm eylemi VAR: içeriği kaldırma — `editMessage`'ın zaten kurduğu `MessageEdit`-denetim-izi desenini yeniden kullanan, ama moderatör-yetkili farklı bir yoldan çağrılan bir "moderatör kaldırması" (hard-delete DEĞİL, içerik bir placeholder'a değişir, orijinal `MessageEdit`'te saklanır). Rapor gönderimi kendi rate limitine sahip (`room-creation-throttler.guard.ts`'in bağımsız `CanActivate` deseni). Her moderatör erişimi VE aksiyonu append-only bir denetim günlüğüne yazılır (ADR-0004'ün `ReputationEvent` deseni).
- [ ] **M5 Slice B — Geçici susturma (tam kapsam) + gerçek zamanlı bildirim + denetim günlüğü aksiyonları.** `User.mutedUntil` (canlı durum, ODA-BAĞIMSIZ/global) + Slice A'nın denetim günlüğüne MUTE/UNMUTE aksiyon satırları — `User.totalXp`/`level` (canlı önbellek) + `ReputationEvent` (günlük) ikilisiyle aynı mimari desen. `sendMessage` VE `editMessage` ikisi de susturulmuş kullanıcıyı reddeder (M3 Slice B'nin arşivlenmiş-oda `GoneException` deseninin TAM uygulanışı — ilk taslak sadece `sendMessage`'ı kapsıyordu, THREAT-MODEL satır 3'ün "post benign, edit into abuse" vektörünü kapatmak için ikisi de gerekli). Oda oluşturma/davet kazanımına AYRICA dokunulmuyor (gerekçe Plan notları'nda). Bildirim `SocketRegistryService.getSockets(userId)` ile gerçek zamanlı WS push (zaten var olan, bağımlılıksız bir servis — yeni bir mekanizma gerekmiyor).
- [ ] **M5 Slice C — Aynı-aktör çoklu-rapor deseni tespiti.** Aynı kullanıcı kısa bir pencerede birden fazla farklı kullanıcı tarafından raporlanınca moderatöre otomatik flag — SADECE `status: açık` raporlar sayılır (Slice A'nın durum alanına bağımlı). Pencere/eşik sayıları bu slice'ın kendi plan-modu turunda kesinleşecek (Slice A'nın XP formülü sayılarıyla aynı "tahmini, sonradan ayarlanabilir" ilkesi).
- [ ] **M5 Slice D — Oda moderasyonu (silme/yeniden adlandırma).** Kötü-isimli/kötüye kullanılan bir oda için moderatör doğrudan aksiyon alabilir — rapor kuyruğundan bağımsız, mevcut `role === 'moderator'` deseniyle korunan basit bir endpoint. `docs/BACKLOG.md`'nin M3'ten beri ertelenmiş maddesi, tetikleyicisi zaten fırlamış (Plan notları). Aksiyon Slice A'nın denetim günlüğüne yazılır.
- [ ] **M5 Slice E — Davetçi hesap verebilirliği (B15).** Ban/temp-mute alan bir kullanıcının davetçisinin durumu görünür şekilde etkilenir — tam mekanik (kota düşümü vs. görünür bir güven bayrağı) bu slice'ın kendi turunda kararlaştırılacak, önceden belirlenmiyor (milestone'un kendi notu zaten böyle diyor). Slice B'ye bağımlı (mute/ban olayları önce var olmalı).
- [ ] Tests for report scoping, resolution/status transitions, content-removal (never hard-delete), mute visibility (send+edit), audit log completeness, multi-report flagging (open-only), room moderation, and inviter-accountability triggering — her slice kendi testleriyle gelir.

## Risks
- This is the last real safeguard between "small trusted group" and "invite-only but abuse-prone" — mitigation: treat it as non-negotiable even under time pressure; it's cheap relative to the damage one bad actor does to a small community.
- **2026-08-05 kapsam gözden geçirmesinde bulunan risk:** rapor mekanizmasının kendisi bir suistimal yüzeyi — art niyetli bir kullanıcı, masum birine karşı sahte raporlar yığıp Slice C'nin çoklu-rapor flag'ini tetikleyebilir. Rapor gönderimi kendi rate limitine ihtiyaç duyuyor (Slice A'nın kapsamı, ayrı bir slice değil) — `room-creation-throttler.guard.ts`'in kurduğu bağımsız `CanActivate` deseni (global `APP_GUARD`'la çift-sayım riski olmadan) doğrudan uygulanabilir emsal.
- **2026-08-05'in ikinci turunda bulunan risk:** moderatör içerik-kaldırma eylemi CLAUDE.md'nin "mesaj içeriği asla hard-delete edilmez" kuralını (tek istisna: oda purge, ADR-0006) ihlal edecek şekilde tasarlanabilirdi — Slice A'nın tasarımı bunu bilerek `MessageEdit`-tarzı bir "içeriği değiştir, orijinali sakla" mekanizmasına bağladı, hard-delete YOK.

---

## Plan notları — 2026-08-05 kapsam gözden geçirmesi

M4 tamamen bitince "taze bir gözle" bir kapsam turu istendi — bu
dosyaya hiç dokunulmamıştı. M3/M4'te kullanılan aynı disiplin
uygulandı: gerçek kod okunarak (`schema.prisma` — grep ile
Report/Mute/Ban/audit'e dair HİÇBİR şey yok, tamamen yeşil alan;
`blocks.service.ts`, `messages.service.ts`/`messages.controller.ts`
— moderatör-scoped erişim deseni zaten `getMessageEditHistory`'de
kurulu; `socket-registry.service.ts`; `room-creation-throttler.guard.ts`)
ve gerçek dokümanlar (`docs/THREAT-MODEL.md` satır 10/12, `docs/PRD.md`,
`docs/BACKLOG.md` B15 ve "Ertelenen" bölümü, `docs/GLOSSARY.md` —
mute/report/ban için HİÇBİR tanım yok, `docs/review/CRITIQUE.md`)
okunarak doğrulandı — varsayılmadı. **Yol B ölçütü** her maddeye
uygulandı: *bu olmadan 20-30 kişilik kapalı bir toplulukta ürün
bozuk/güvensiz hissettirir mi?*

**Milestone'un kendi acceptance criteria'sının atladığı, dokümanları
çapraz okuyarak bulunan kritik çelişki:** Acceptance criteria #1
"a message or DM" raporlanabilsin diyor ve `docs/THREAT-MODEL.md`
satır 10'u gerekçe gösteriyor — ama satır 10'un kendisi zaten şunu
söylüyor: *"Row written as if DM exists — it doesn't ... Until DM
ships, this entire row's risk is moot."* DM modeli (`Conversation`/
`DirectMessage`) şemada hiç yok, 2026-07-30 LANSMAN KARARI'nda 1.0'ın
dışına bilerek bırakılmış. Yani M5'in kendi acceptance criteria'sı,
var olmayan bir özelliği raporlanabilir varsayıyor — DM şipmeden DM
raporlama diye bir şey inşa edilemez. **Düzeltme:** rapor akışı SADECE
oda mesajlarını kapsayacak şekilde kapsam daraltıldı (Out of scope'a
eklendi); DM şipince aynı mekanizma ona da genişleyecek, bu M5'in işi
değil.

**İkinci bulgu (Yol B ile, gerçek bir suistimal yüzeyi):** Rapor
mekanizmasının kendisi hiç düşünülmeden bırakılırsa yeni bir saldırı
yüzeyi açar — art niyetli bir kullanıcı masum birine karşı çoklu sahte
rapor yığıp Slice C'nin "aynı-aktör çoklu-rapor" flag'ini tetikleyebilir
(acceptance criteria #4'ün TAM DA önlemeye çalıştığı şeyin tersini
üretir). Milestone dokümanı bunu hiç anmıyordu. Rapor gönderimine bir
rate limit gerekiyor — Risks'e eklendi, Slice A'nın kapsamına yazıldı.

**Üçüncü bulgu — doğrudan uygulanabilir mimari emsaller (kod okuyarak
bulundu, tasarım kararlarını önemli ölçüde ucuzlatıyor):**
- Moderatöre kapsamlı görünürlük: `messages.service.ts:208`'in
  `getMessageEditHistory`'de zaten kurduğu `role !== 'moderator'` deseni
  — Report review queue için sıfırdan icat edilecek bir şey yok.
- Susturma canlı-durum + günlük ikilisi: `User.totalXp`/`level` (canlı
  önbellek) + `ReputationEvent` (append-only günlük) — M4 Slice A'nın
  kurduğu TAM aynı mimari, `User.mutedUntil` + moderatör denetim günlüğü
  için birebir uygulanabilir.
- Susturulmuş kullanıcının mesaj göndermesini engelleme: M3 Slice B'nin
  arşivlenmiş-oda `GoneException` deseni (`sendMessage`'ın oda durumu
  kontrolü) — aynı "yaz-anında kontrol et" prensibi, susturma için de
  geçerli. Soketi zorla koparmaya GEREK YOK (Yol B: geçici susturmada
  eski mesajları görebilmek güvenlik sorunu değil, sadece YENİ gönderim
  engellenmeli).
- Gerçek zamanlı susturma bildirimi: `SocketRegistryService.getSockets
  (userId)` (M2.5 Slice D'de kurulmuş, bağımlılıksız, paylaşılan bir
  servis) — kullanıcının açık soketlerine doğrudan WS push, yeni bir
  mekanizma gerektirmiyor.
- Rapor rate limiti: `room-creation-throttler.guard.ts`'in kurduğu
  bağımsız `CanActivate` deseni (global `APP_GUARD` ile çift-sayım
  riski olmadan, `user-throttler.guard.ts`'in M4 Slice B'de silinen
  ama dokümante edilen aynı deseni) — doğrudan uygulanabilir.

**Dördüncü bulgu — `docs/BACKLOG.md`'nin zaten kaydettiği, atlanmaması
gereken bir bağımlılık:** B15'in (davetçi hesap verebilirliği) tam
mekaniği (kota düşümü vs. görünür güven bayrağı) `docs/BACKLOG.md`'de
de milestone'un kendi Tasks notunda da BİLEREK açık bırakılmış — bu
scope review'un işi değil, Slice E'nin kendi turunda kararlaştırılacak.
Ayrıca `docs/BACKLOG.md`'nin "Ertelenen" bölümü bir "invite-issuance
audit tablosu"nu (silinen davetçileri `User` FK'sinden bağımsız geriye
dönük izlemek için) SADECE Slice E'nin tasarımı gerçekten gerektirirse
inşa edilsin diye not etmiş — önceden varsayılmıyor, Out of scope'a
açıkça yazıldı.

**İlk tur dilimlere bölme mantığı (ikinci turda A/B genişledi, D
eklendi — aşağıya bakın):** Slice A (rapor + moderatör görünürlüğü +
denetim günlüğü temeli) her şeyin üstüne kurulduğu birincil ilkel.
Slice B (susturma) Slice A'nın denetim günlüğünü ilk gerçek AKSİYON
satırlarıyla dolduruyor. Slice C (çoklu-rapor tespiti) Slice A'nın
rapor verisi üzerine ince bir katman. Slice E (davetçi hesap
verebilirliği) SON — çünkü "ban/mute alan bir kullanıcı" olayına tepki
veriyor, Slice B'nin mute/ban mekanizması önce var olmalı.

## Plan notları — 2026-08-05 ikinci tur (kullanıcı gözden geçirmesi)

Kullanıcı ilk turu "sağlam ama beş boşluk var" diye işaretledi ve her
biri için gerçek kod okunarak Yol B ölçütüyle değerlendirme istedi.
Beşinin de gerçek olduğu doğrulandı — dördü M5'e girdi, biri BACKLOG'ta
manuel prosedür olarak kaldı.

**1. İçerik kaldırma yoktu — EN TEMEL moderasyon eylemi.** Doğru tespit.
Rapor + görünürlük + susturma var ama moderatörün raporlanan mesajı
KALDIRABİLECEĞİ hiçbir yol yoktu — susturma göndereni durdurur, zaten
gönderilmiş saldırgan içeriği silmez. **Kritik kısıtlama (kod okuyarak
doğrulandı):** `CLAUDE.md`'nin "Değişmez kurallar"ı "mesaj içeriği asla
hard-delete edilmez" diyor, TEK istisna oda purge (ADR-0006) — yani
moderatör kaldırması bir hard-delete OLAMAZ. Çözüm: `editMessage`'ın
zaten kurduğu deseni (yeni içerik yaz, eskisini `MessageEdit`'e
taşı) yeniden kullanan ama moderatör-yetkili farklı bir yoldan çağrılan
bir "moderatör kaldırması" — içerik bir placeholder'a değişir, orijinal
`MessageEdit`'te (ve denetim günlüğünde) saklı kalır. Slice A'ya
eklendi.

**2. Rapor çözüm durumu yoktu.** Doğru tespit, 1. bulguyla doğrudan
bağlı — bir moderatör aksiyon aldığında (kaldır/reddet) raporun
`status`'u değişmeli, yoksa (a) rapor sonsuza kadar kuyrukta kalır, (b)
Slice C'nin çoklu-rapor tespiti ÇÖZÜLMÜŞ raporları saymaya devam edip
yanlış alarm üretir. Ayrıca `docs/THREAT-MODEL.md` satır 12'nin kendi
metni zaten "scoped to an ACTIVE report" diyor — durum kavramı
tasarımda zaten ÖRTÜK olarak varmış, hiç operasyonelleştirilmemişti.
`Report.status` (açık/çözüldü/reddedildi) Slice A'ya eklendi, Slice
C'nin sayımı `status: açık`'a kısıtlandı.

**3. Susturmanın kapsamı belirsizdi — gerçek bir güvenlik açığıydı.**
Doğru tespit. `docs/THREAT-MODEL.md` satır 3 TAM OLARAK bu senaryoyu
tarif ediyor: "post benign content, edit into abuse after reputation
accrues" — susturulmuş biri `editMessage`'ı hâlâ çağırabiliyorsa,
eski (susturma öncesi) bir mesajını saldırgan içeriğe çevirerek
susturmayı bypass edebilir. İlk taslak sadece `sendMessage`'ı
kapsıyordu — halbuki kendi Plan notlarımın atıfta bulunduğu M3 Slice
B'nin `GoneException` deseni zaten HEM `sendMessage` HEM `editMessage`'ı
kapsıyordu (arşivlenmiş oda için), ben sadece yarısını uygulamıştım.
Düzeltildi: Slice B artık ikisini de kapsıyor. Oda oluşturma ve davet
kazanımı/kullanımı AYRICA engellenmiyor — gerekçe: (a) davet kazanımı
zaten `sendMessage`'a bağımlı, engellenince otomatik durur; (b) yeni
bir oda açmak `sendMessage` global olarak engellendiği için evasion
sağlamıyor; (c) oda oluşturma zaten kendi rate limitine tabi (spam
değil, susturma-ilgisiz bir kontrol). Bu üçü Slice B'nin metnine
açıkça yazıldı — sessiz bir boşluk bırakılmadı.

**4. Oda moderasyonu iki milestone'dur kayıyordu.** Doğru tespit,
`docs/BACKLOG.md` satır 279-285 doğrudan okunarak doğrulandı: tetikleyici
"bu manuel düzeltme ikinci kez gerekirse VEYA **M4 (moderasyon)** şipse"
diye yazılmış — ama milestone numaralandırması kaydı: o zamanki "M4
(moderasyon)" bugünün M5'i. Yani tetikleyici ZATEN FIRLAMIŞ, sadece
BACKLOG'un kendi metni güncellenmemişti. Yeni **Slice D** olarak
eklendi — rapor kuyruğundan bağımsız, doğrudan bir moderatör aksiyonu
(mevcut `role === 'moderator'` deseniyle). `docs/BACKLOG.md`'nin ilgili
satırı da bu oturumda düzeltildi (ayrı bir commit).

**5. Moderatör atama hâlâ manuel SQL — M5'e mi girmeli?** Bu tek
madde M5'e GİRMEDİ, gerekçeli bir kararla. `docs/milestones/
M2-core-rooms-messaging.md`'nin ertelemesi "founder'ın kendi rolü BİR
KERE ayarlanıyor... gerçek bir UI/endpoint M5 kapsamı" diyordu — ama
M5'in kendi Out-of-scope'u zaten "multi-moderator role management" ı
reddediyor, ve TEK moderatör (founder) senaryosunda "kendi rolünü bir
kere ayarlama" zaten tek-seferlik bir bootstrap adımı, sıfır-kullanıcılı
DB bootstrap'ıyla (`docs/THREAT-MODEL.md` Open items) AYNI kategoride.
Yol B: 20-30 kişilik bir toplulukta, founder'ın KENDİ rolünü BİR KERE
elle ayarlaması gerçekten "bozuk/güvensiz" hissettirir mi? Hayır —
tekrar eden bir işlem değil, ve tek gerçek kullanım senaryosu
(ikinci bir moderatör eklemek) zaten bu milestone'un kapsamı dışında.
**Karar:** M5'e eklenmedi, manuel prosedür olarak kalıyor —
`docs/THREAT-MODEL.md` Open items'a yeni bir madde olarak yazıldı,
`docs/milestones/M2-core-rooms-messaging.md`'nin eski "M5 scope"
öngörüsüne bu kararı işaret eden bir not eklendi (tarihi kaydı silmeden).

### Sıradaki
Kapsam gözden geçirmesi (iki tur) onaylandı. Slice A kendi plan-modu
turuyla başladı ve tamamlandı — detay aşağıdaki "Plan notları — Slice
A uygulaması" bölümünde.

## Plan notları — Slice A uygulaması (2026-08-06)

Plan-modu turunda kod okunarak tasarlandı, bir Plan agent'ıyla çapraz
kontrol edildi, sonra kullanıcının ikinci bir gözden geçirmesiyle üç
nokta daha eklendi (aşağıda). Uygulama sırasında testler iki gerçek
bug daha buldu.

**Agent'ın ilk turda bulduğu üç şey (plana işlendi, uygulandı):**
- `Report.messageId`/`reportedUserId` ve `ModerationAuditLog.
  targetMessageId` NULLABLE + `SetNull` — `RoomsService.
  purgeArchivedRooms`'un (M3 Slice C) hard-delete sırasını ve
  `AuthService.deleteAccount()`'u `ReputationEvent`'le AYNI gerekçeyle
  bozmuyor (migration SQL'de doğrulandı).
- `ModeratorGuard`'ı `getMessageEditHistory`'ye BLANKET bir guard
  olarak takmak REDDEDİLDİ — o metot yazar-VEYA-moderatör izin veriyor,
  guard yazarın kendi geçmişini görmesini kırardı. Guard sadece 3 yeni
  moderatör-only endpoint'te kullanıldı, `getMessageEditHistory`'nin
  kendi mantığı korunup rapor-şartı EKLENDİ (ayrı bir konu, aşağıya
  bakın).
- Denetim günlüğü granülerliği: rapor-başına değil, `GET /moderation/
  reports` çağrısı başına TEK `REPORT_QUEUE_VIEWED` satırı — panel'lerin
  (`InviteView.tsx` deseni) her mount'ta yeniden çekmesiyle birleşince
  rapor-başına loglamak gürültü üretirdi.

**İkinci turdan gelen üç ekleme (uygulandı):**
- `Report.reportedUserId` (denormalize, `message.authorId`'den) +
  `@@index([reportedUserId])` — Slice C'nin sayım sorgusu bu kolonu
  KULLANACAK, önceden eklemek Slice C'de ikinci bir migration'ı
  önlüyor.
- Frontend'de anlık gönderim onayı ("raporlandı") — raporlayan artık
  hiçbir geri bildirim almıyor değil.
- `docs/THREAT-MODEL.md`'ye içerik-kaldırma-geri-alma manuel prosedürü
  eklendi (aşağıya bakın, ayrı commit).

**`getMessageEditHistory` gerçek hale getirildi (agent'ın bulduğu
doc/kod uyuşmazlığı):** `docs/THREAT-MODEL.md` satır 12 zaten "scoped
to an active report" diyordu ama Report hiç yokken bu doğrulanamaz bir
iddiaydı. Report artık var — moderatör dalı artık bu mesaja ait EN AZ
BİR Report satırı gerektiriyor (durum önemsiz). Mevcut e2e test
(`message-edit-history.e2e-spec.ts`) rapor oluşturacak şekilde
güncellendi, yeni bir test raporsuz mesaj için moderatörün de
reddedildiğini kanıtlıyor.

**`removeMessageContent`'in tasarımı düzeltildi (uygulama sırasında,
kendi kendine yakalanan bir hata):** İlk taslak kendi `$transaction`'ını
açıyordu — ama `ReportsService.removeContent`'in mesaj içeriği
değişikliğini `Report.status` güncellemesi + `ModerationAuditLog`
yazımıyla TEK atomik işleme komponse edebilmesi için `awardXp`/
`grantInvites` (M4) ile AYNI desene çekildi: kendi tx'ini açmıyor,
çağıranın açık tx'ini alıyor. Committed öncesi düzeltildi.

**Testlerin bulduğu iki gerçek bug:**
- `messages.controller.ts`: boş istek gövdesinde (`Content-Type`/body
  hiç gönderilmemişse) `@Body() dto` `undefined` dönüyordu, `dto.reason`
  500 atıyordu — `dto?.reason` ile düzeltildi. Frontend'in `reportMessage`'ı
  `reason` boşsa gövdeyi hiç göndermediği için bu, GERÇEK bir prod yolu.
- e2e temizlik: `REPORT_QUEUE_VIEWED` denetim satırları `reportId: null`
  taşıyor (rapor-başına değil, "kuyruk görüntülendi" olayı) — mevcut
  `reportId IN (...)` temizlik filtresi bunları hiç yakalamıyordu,
  `moderatorId` bazlı ayrı bir temizlik eklendi. `message-edit-history.
  e2e-spec.ts`'in kendi rapor satırı da hiç temizlenmiyordu, eklendi.
  İki e2e koşusu üst üste çalıştırılıp sıfır kalıntı doğrulandı.

**Gerçek zamanlı bildirim (agent'ın bulduğu, ilk taslağın atladığı
eksik):** Moderatör içerik kaldırma REST üzerinden çalışıyor ama oda WS
ile canlı — `MessagesGateway`'e yeni bir PUBLIC `broadcastMessageUpdate`
metodu eklendi (var olan private `broadcastToRoom`'u sarıyor,
`handleMessageEdit`'in zaten kullandığı `message:updated` event'ini
yeniden kullanıyor). Bu kod tabanında İLK KEZ REST'ten WS broadcast
tetiklenmesi, controller katmanında (servis gateway'e bağımlı olmuyor).
Frontend'de SIFIR yeni WS-dinleme kodu gerekti.

**Frontend `docs/BACKLOG.md`'de bir erteleme notu OLMADIĞI için (agent
bağımsız doğruladı) bu dilimin kapsamındaydı** — M4 Slice C'nin
backend-only kararının AKSİNE. `ModerationQueueView.tsx`
(`InviteView.tsx` deseni), `MessageItem.tsx`'e "raporla" butonu,
`RoomHeader.tsx`'e SADECE moderatörler için görünen "moderasyon"
butonu.

Doğrulama: `apps/api` lint/typecheck/build temiz, birim + e2e yeşil
(iki üst üste e2e koşusu sıfır kalıntı doğruladı). `apps/web`
lint/typecheck/build temiz, Playwright 49/49 (6 yeni test dahil). Dal
`m5/slice-a-report-flow`, push kullanıcının onayına kalıyor.

### Sıradaki
Slice A tamam. Slice B (geçici susturma, tam kapsam) kendi plan-modu
turuyla başlayacak.
