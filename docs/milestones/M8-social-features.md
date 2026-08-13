# M8 — Social & Expression Features

*M7 ürünü 500 ölçeğinde çalışır/adil hale getiriyor ama YENİ bir şey eklemiyor. M8, kullanıcının 2026-08-12 kapsam turunda istediği ve "olmadan ürün çalışır ama eksik hissettirir" testine giren özellikleri kapsıyor — `docs/BACKLOG.md`'nin kendi "Karar kuralı"nın 1. maddesini (bozuk/güvensiz hissettirir mi) GEÇMİYORLAR, bu yüzden M7'nin 1.0-zorunlu listesinde değiller.*

**Goal:** 500 kişilik bir toplulukta gerçek etkileşim ve keşfedilebilirlik — birbirini bulma (dizin, mention), birebir konuşma (DM), düşük-çaba etkileşim (reaksiyon), ve "nerede kaldım" (okundu durumu).
**Demo:** İki kullanıcı DM'de konuşabiliyor ve birbirini raporlayabiliyor; bir mesajda `@kullanıcı` yazmak bildirim üretiyor; bir mesaja reaksiyon eklenebiliyor; oda listesi okunmamış sayısı gösteriyor.
**Estimated hours:** ~230-280 saat — M7'den BÜYÜK. 30 saat/hafta bütçeyle **~8-9.5 hafta**, M7'den SONRA, kesintisiz.

## Out of scope
- Tam çift-dilli destek (`M9-i18n.md`).
- Görsel yeniden tasarım (`M10-ui-redesign.md`) — ama bu milestone'un DM/mention/reaksiyon/okundu-durumu dilimleri YENİ UI yüzeyleri yaratıyor, hepsi işaretlendi (aşağıya bakın).
- E-posta erişim kaybı kurtarma — gerçek bir teknik çözümü yok (`docs/THREAT-MODEL.md`'nin açık maddesi), bu milestone'da ÇÖZÜLMÜYOR, sadece tekrar değerlendiriliyor.

## Acceptance criteria
- [ ] Kullanıcı adı değiştirilebiliyor, eski ad 14 gün rezerve, mesajlarda yazar adı SNAPSHOT olarak saklanıyor (canlı join değil) — birinin bıraktığı adı alan biri eski mesajlara sahip GÖRÜNMÜYOR.
- [ ] Kullanıcı profili (bio + katılma tarihi + seviye) var; bio moderasyon kapsamına dahil (rapor edilebilir).
- [ ] Deterministik ASCII avatar (ID'den türetilen) — SEÇMELİ değil, sıfır moderasyon maliyeti.
- [ ] E-posta değiştirilebiliyor (yeniden doğrulama akışıyla).
- [ ] Geçici hesap dondurma (30 gün geri dönüş penceresi) var.
- [ ] `@kullanıcı` mention'ı bir bildirim üretiyor; kullanıcı dizini/arama mention'ın ön koşulunu karşılıyor.
- [ ] Presence (online/offline) + yazıyor göstergesi çalışıyor.
- [ ] Mesajlara reaksiyon eklenebiliyor, itibar sistemi (XP) reaksiyonla da besleniyor (sadece mesaj sayısıyla değil).
- [ ] `ReadCursor` şemada gerçekten var, okundu durumu çalışıyor, `docs/DATA-MODEL.md`'nin iddiasıyla kod artık TUTARLI.
- [ ] Okunmamış göstergesi, yukarı-kaydırma "yeni mesaj" bildirimi, sekme başlığı bildirimi hepsi `ReadCursor`'a dayanıyor.
- [ ] Mesaja yanıtlama/alıntı (thread kurmadan) çalışıyor.
- [ ] Mesaj araması (Postgres tam-metin) çalışıyor.
- [ ] Mesaja permalink var.
- [ ] DM (birebir mesaj) çalışıyor, engelleme entegre, VE aynı slice'ta DM raporlama akışı var (`docs/THREAT-MODEL.md` row 10'un kendi şartı — DM'siz raporlama, raporlamasız DM YOK).
- [ ] Terminal komutları (`/help`, `/join`, `/whoami`, `/clear`) çalışıyor.
- [ ] MX kaydı + tek-kullanımlık e-posta engelleme signup'ta var.

## Tasks — kod dilimleri (Claude uygular, her biri kendi plan-modu turu)

- [ ] **Slice A — Kullanıcı adı sistemi (değiştirme + rezervasyon + snapshot).** ~18-24 saat. Mesajlarda yazar adı bugün CANLI JOIN ile gösteriliyor (`authorUsername`) — bu, ad değişince TÜM geçmiş mesajların yeni adla görünmesi anlamına gelir. Çözüm: `Message`'a yazım-anındaki kullanıcı adının SNAPSHOT'ı eklenir (mevcut `authorId` FK'si KALIR, ayrıca bir `authorUsernameSnapshot` gibi bir alan). Eski ad 14 gün kimseye verilmez (`Username` için ayrı bir "rezervasyon" tablosu ya da `deletedAt`/`releasedAt` alanlı bir geçmiş tablosu). **Login username-veya-email OLARAK EKLENMEZ** — M7 kapsam turunda bilinçli olarak reddedildi (rezervasyon sorunuyla çakışıyor), login KALICI olarak e-posta-only kalır.
- [ ] **Slice B — Profil (bio + katılma tarihi + seviye) + deterministik ASCII avatar.** ~16-22 saat. Bio serbest metin → mevcut rapor akışına dahil edilir (yeni bir moderasyon kategorisi değil, mevcut `Report` modeli mesaj DIŞINDA bir hedef türünü de kapsayacak şekilde genişler). Avatar SEÇMELİ değil — ID'den deterministik türetilen ASCII sanat, sıfır yükleme/moderasyon yüzeyi.
- [ ] **Slice C — E-posta değiştirme + geçici hesap dondurma.** ~14-18 saat. E-posta değişimi mevcut doğrulama akışını (link+token) yeniden kullanır. Hesap dondurma: `ADR-0005`'in anonimleştirme deseninden AYRI bir durum (`User.frozenAt` gibi bir alan + 30 gün içinde giriş yaparsa otomatik çözülme).
- [ ] **Slice D — Kullanıcı dizini/arama + mention + bildirim.** ~24-30 saat. Yeni bir liste/arama endpoint'i (Slice A'nın username sistemine bağımlı), `@kullanıcı` parse'ı mesaj gönderiminde, bildirim mekanizması (yeni bir WS event + muhtemelen bir "bildirimlerim" görünümü — **YENİ UI yüzeyi, M10 Faz 1 kararı gerekir**).
- [ ] **Slice E — Presence + yazıyor göstergesi.** ~14-18 saat. `docs/ARCHITECTURE.md`'nin zaten "in-process, kalıcı değil" diye tarif ettiği ama hiç kodlanmamış tasarımın gerçek implementasyonu — yeni WS event'leri, Redis GEREKMİYOR (tek instance'da in-process yeterli, ADR-0003 ile tutarlı).
- [ ] **Slice F — Reaksiyonlar + itibar sistemi entegrasyonu.** ~22-28 saat. Yeni `Reaction` modeli, mesaj başına reaksiyon UI'ı (**YENİ UI yüzeyi**), `ReputationEvent`'e yeni bir `actionType` (reaksiyon alma/verme) — mevcut `computeLevelFromXp` mantığı bozulmadan genişler.
- [ ] **Slice G — `ReadCursor` + okundu durumu + okunmamış göstergesi + sekme başlığı.** ~30-38 saat, EN BÜYÜK dilim. `docs/DATA-MODEL.md`'nin uzun zamandır yazılı ama hiç kodlanmamış `ReadCursor` modelini gerçekten inşa eder — `(user,room)→last_read_message_id`, çoklu-cihaz senkron. Oda listesi okunmamış rozetleri + yukarı-kaydırma "yeni mesaj" bildirimi + sekme başlığı bildirimi HEPSİ bu dilimin üstüne kurulur. **YENİ UI yüzeyleri (rozetler, bildirimler) — M10 Faz 1 kararı gerekir.**
- [ ] **Slice H — Yanıtlama/alıntı + permalink.** ~14-18 saat. `Message`'a `replyToId` (nullable, self-referential), `>` alıntı render'ı, permalink route'u (`/room/:name/message/:id` gibi — Next.js routing genişler).
- [ ] **Slice I — Mesaj araması.** ~12-16 saat. Postgres `tsvector`/`GIN` index, `/search` endpoint'i, arama UI'ı (**YENİ UI yüzeyi**).
- [ ] **Slice J — DM (birebir mesaj) + DM raporlama.** ~45-60 saat, DM'siz BAŞLAMAZ (THREAT-MODEL row 10'un kendi şartı — raporlama olmadan DM inşa edilmez). Yeni `Conversation`/`DirectMessage` modeli, WS yönlendirme değişikliği (oda-broadcast'ten bire-bir yönlendirmeye), mevcut `Block` entegrasyonu, mevcut `Report` akışının DM mesajlarını da hedef alabilmesi. **BÜYÜK, YENİ UI yüzeyi (tam bir DM arayüzü) — M10 Faz 1 kararı ŞART, bu kadar büyük bir yüzeyi tasarım kararı olmadan inşa etmek ikinci kez bozulmaya davetiye çıkarır.**
- [ ] **Slice K — Terminal komutları.** ~16-22 saat. `/help`, `/join`, `/whoami`, `/clear` — composer'da prefix-parse, `/join` oda değiştirmeyi tetikler (Slice B'nin `RoomMember`'ıyla uyumlu çalışmalı, M7'den sonra geldiği için hazır olacak).
- [ ] **Slice L — MX kaydı + tek-kullanımlık e-posta engelleme.** ~4-6 saat, ucuz, herhangi bir sırada eklenebilir.

## Tasks — founder'ın kendi eliyle yapacağı işler
- [ ] E-posta erişim kaybı kurtarma tasarımı için zaman ayır — gerçek bir çözüm yok, aceleye getirilmemeli, bu milestone'un kapsamı dışında bilerek bırakıldı.
- [ ] Slice J (DM) başlamadan önce moderasyon kapasitesinin (M7'nin self-servis moderatör ataması) gerçekten kullanılıp kullanılmadığını doğrula — DM, tek moderatörle daha da zor denetlenir.

## Risks
- Bu milestone M7'den BÜYÜK — tek bir bloklama yerine kendi içinde AYRI plan-modu turlarıyla, muhtemelen 2-3 alt gruba (kimlik/profil, keşif/etkileşim, DM) bölünerek yürütülmeli.
- Slice A (kullanıcı adı) veri modeline dokunuyor — Slice D/G/H/J hepsi ona bağımlı, YANLIŞ sırayla başlanırsa (ör. DM önce) yeniden iş çıkar.
- 230-280 saatlik tahmin, M7'nin kendi +%20-25 tampon dersini dikkate alarak yazıldı — yine de bu, tek bir milestone için oldukça büyük, founder'ın kendi 30 saat/hafta bütçesiyle 2+ ay demek.
