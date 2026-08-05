# M5 — Moderation & Abuse Tooling

*Rapor akışı (oda mesajları — DM henüz yok) sadece raporlanan içeriği moderatöre gösterir; şeffaf geçici susturma (shadow ban değil); her moderatör erişimi ve aksiyonu değiştirilemez bir denetim günlüğüne yazılır; davetçi hesap verebilirliği (B15) platformun en özgün moderasyon avantajı.*

**Goal:** Give the founder (sole moderator) real tools: a report flow, transparent temp-mute, an audit log over their own access, and inviter accountability.
**Demo:** A tester reports an abusive message; the founder sees only that reported content, applies a temp-mute that the muted user is visibly notified of (in-app, real-time), the audit log shows exactly what was accessed and when, and the muted user's inviter sees a visible accountability signal.
**Estimated hours:** 30–44h.

## Out of scope
- Multi-moderator role management — there is exactly one moderator (the founder) at this scale.
- **DM raporlama — DM'in kendisi henüz yok** (2026-08-05 kapsam gözden geçirmesinde doğrulandı, `docs/THREAT-MODEL.md` satır 10 zaten "Row written as if DM exists — it doesn't ... Until DM ships, this entire row's risk is moot" diyor). Rapor akışı bu yüzden SADECE oda mesajlarını kapsıyor — DM şipince aynı rapor mekanizması ona da genişletilecek, ayrı bir görev değil.
- Invite-issuance audit tablosu (`User` FK'sinden bağımsız, silinen davetçileri geriye dönük izlemek için) — `docs/BACKLOG.md`'nin zaten kaydettiği gibi SADECE Slice D'nin tasarımı bunu gerçekten gerektirirse inşa edilir, önceden varsayılmıyor.

## Acceptance criteria
- [ ] A user can report a message; the report exposes only the reported content to the moderator (`docs/THREAT-MODEL.md` row 10) — not ambient access to all of a user's messages. (DM raporlama, DM şipince — bkz. Out of scope.)
- [ ] A moderator can apply a temp-mute; the muted user is visibly notified in real time (WS) — no shadow ban.
- [ ] Every moderator access to edit history or reported content, and every moderation action, is written to an append-only audit log (`docs/THREAT-MODEL.md` row 12): who, what, on whom, when.
- [ ] Same-actor multi-report pattern (row 10's weak backstop) triggers a flag for moderator attention.
- [ ] When a user is banned/temp-muted for real abuse, their inviter's invite
      quota/trust is visibly affected (`docs/BACKLOG.md` `B15` — "davetçi
      hesap verebilirliği," the platform's most distinctive moderation
      lever; depends on M4's invite-per-level mechanism already existing).

## Tasks
Her biri kendi plan-modu turu + commit + tam doğrulama (M1-M4'ün kullandığı aynı ritim). 2026-08-05 kapsam gözden geçirmesinde A/B/C/D dilimlerine bölündü (aşağıdaki Plan notları):
- [ ] **M5 Slice A — Rapor akışı + moderatöre kapsamlı görünürlük + denetim günlüğü temeli.** `Report` tablosu (oda mesajları, DM DEĞİL — bkz. Out of scope). Moderatöre SADECE raporlanan içeriği gösteren bir review queue — `messages.service.ts`'in zaten kurduğu `role === 'moderator'` deseniyle aynı (`getMessageEditHistory`). Her moderatör erişimi (rapor görüntüleme dahil) append-only bir denetim günlüğüne yazılır (ADR-0004'ün `ReputationEvent` deseni).
- [ ] **M5 Slice B — Geçici susturma + gerçek zamanlı bildirim + denetim günlüğü aksiyonları.** `User.mutedUntil` (canlı durum) + Slice A'nın denetim günlüğüne MUTE/UNMUTE aksiyon satırları — `User.totalXp`/`level` (canlı önbellek) + `ReputationEvent` (günlük) ikilisiyle aynı mimari desen. `sendMessage`/WS gateway susturulmuş kullanıcıyı reddeder (M3 Slice B'nin arşivlenmiş-oda `GoneException` deseniyle aynı ruhta). Bildirim `SocketRegistryService.getSockets(userId)` ile gerçek zamanlı WS push (zaten var olan, bağımlılıksız bir servis — yeni bir mekanizma gerekmiyor).
- [ ] **M5 Slice C — Aynı-aktör çoklu-rapor deseni tespiti.** Aynı kullanıcı kısa bir pencerede birden fazla farklı kullanıcı tarafından raporlanınca moderatöre otomatik flag. Pencere/eşik sayıları bu slice'ın kendi plan-modu turunda kesinleşecek (Slice A'nın XP formülü sayılarıyla aynı "tahmini, sonradan ayarlanabilir" ilkesi).
- [ ] **M5 Slice D — Davetçi hesap verebilirliği (B15).** Ban/temp-mute alan bir kullanıcının davetçisinin durumu görünür şekilde etkilenir — tam mekanik (kota düşümü vs. görünür bir güven bayrağı) bu slice'ın kendi turunda kararlaştırılacak, önceden belirlenmiyor (milestone'un kendi notu zaten böyle diyor). Slice B'ye bağımlı (mute/ban olayları önce var olmalı).
- [ ] Tests for report scoping, mute visibility, audit log completeness, multi-report flagging, and inviter-accountability triggering — her slice kendi testleriyle gelir.

## Risks
- This is the last real safeguard between "small trusted group" and "invite-only but abuse-prone" — mitigation: treat it as non-negotiable even under time pressure; it's cheap relative to the damage one bad actor does to a small community.
- **2026-08-05 kapsam gözden geçirmesinde bulunan yeni risk:** rapor mekanizmasının kendisi bir suistimal yüzeyi — art niyetli bir kullanıcı, masum birine karşı sahte raporlar yığıp Slice C'nin çoklu-rapor flag'ini tetikleyebilir. Rapor gönderimi kendi rate limitine ihtiyaç duyuyor (Slice A'nın kapsamı, ayrı bir slice değil) — `room-creation-throttler.guard.ts`'in kurduğu bağımsız `CanActivate` deseni (global `APP_GUARD`'la çift-sayım riski olmadan) doğrudan uygulanabilir emsal.

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
scope review'un işi değil, Slice D'nin kendi turunda kararlaştırılacak.
Ayrıca `docs/BACKLOG.md`'nin "Ertelenen" bölümü bir "invite-issuance
audit tablosu"nu (silinen davetçileri `User` FK'sinden bağımsız geriye
dönük izlemek için) SADECE Slice D'nin tasarımı gerçekten gerektirirse
inşa edilsin diye not etmiş — önceden varsayılmıyor, Out of scope'a
açıkça yazıldı.

**Dilimlere bölme mantığı:** A→B→C→D sırası bilinçli — Slice A (rapor +
moderatör görünürlüğü + denetim günlüğü temeli) her şeyin üstüne
kurulduğu birincil ilkel. Slice B (susturma) Slice A'nın denetim
günlüğünü ilk gerçek AKSİYON satırlarıyla dolduruyor. Slice C (çoklu-
rapor tespiti) Slice A'nın rapor verisi üzerine ince bir katman, göreli
olarak küçük. Slice D (davetçi hesap verebilirliği) SON — çünkü "ban/
mute alan bir kullanıcı" olayına tepki veriyor, Slice B'nin mute/ban
mekanizması önce var olmalı.

### Sıradaki
Kapsam gözden geçirmesi onaylandı, uygulama henüz başlamadı. Bir
sonraki oturumda Slice A (rapor akışı + moderatöre kapsamlı görünürlük
+ denetim günlüğü temeli) kendi plan-modu turuyla başlayacak.
