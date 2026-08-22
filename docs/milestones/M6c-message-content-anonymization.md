# M6c — Mesaj İçeriği Anonimleştirme Denetimi

*M6b'nin kardeşi — aynı avukat/KVKK sürecinden çıktı ama farklı teknik yüzey: M6b YENİ bir tablo (`TrafficLog`, 5651) etrafında, bu dosya MEVCUT `Message`/`MessageEdit`/`Report`/`deleteAccount()` akışının bir boşluğu etrafında. Sıfır kod-yüzeyi çakışması, farklı aciliyet profili (bu iş geçmişte silinmiş hesapların BUGÜN açıkta duran içeriğiyle ilgili) — bu yüzden M6b'ye eklenmedi, ayrı dosya açıldı.*

**Goal:** ADR-0005'in anonimleştirme yaklaşımının avukatın ikinci cevabında netleşen gerçek standardını ("kim görebiliyor değil, kişi yeniden belirlenebiliyor mu", satır bazında değerlendirilir) karşılayacak bir mekanizma kurmak — bugün `deleteAccount()` sadece `authorId`'yi null'lıyor, mesajın kendi METNİNE hiç dokunmuyor.

**Demo:** Bir kullanıcı hesabını silerken "mesaj içeriğim de kaldırılsın mı?" seçeneğini (varsayılan açık) görüyor, işaretli bırakırsa mesajları/düzenleme geçmişi/rapor snapshot'ları redakte ediliyor; işaretini kaldırsa bile e-posta/telefon/URL gibi yapısal kimlik bilgileri otomatik yakalanıp redakte ediliyor; founder'a "eski bir mesajımda kimliğim geçiyor" talebi gelirse `docs/RUNBOOK.md`'nin belgelediği manuel prosedürle kaldırabiliyor; ve geçmişte silinmiş hesapların içeriği de bir backfill ile aynı taramadan geçmiş oluyor.

**Estimated hours:** ~21-32 saat (üç dilim birlikte, +%20-25 tampon dahil). Detaylı kapsam gözden geçirmesi: aşağıdaki "Plan notları" bölümü.

## Out of scope
- Genel içerik moderasyonu / mesaj GÖNDERİRKEN PII taraması — bu dilim SADECE hesap silme anına ve geçmişe dönük backfill'e odaklı, canlı mesajlaşmayı proaktif taramak/engellemek ayrı, çok daha büyük bir kapsam (içerik moderasyonu felsefesiyle de gerilir — kullanıcıların ne yazdığını platform gerçek zamanlı denetlemiyor, bilinçli bir tasarım kararı).
- %100 otomatik PII tespiti — serbest metinde bağlamsal kimlik ifşasını (isim geçmeden birini tanımlayan bir ayrıntı gibi) güvenilir yakalayan bir sistem yok, bu dilim bunu iddia etmiyor. Üç bileşen BİRLİKTE "makul çaba" savunması oluşturuyor, garanti değil.
- `Message.content`'in TAMAMEN otomatik/varsayılan olarak temizlenmesi — bu, ADR-0005'in orijinal "thread coherence" gerekçesini (başkalarının yanıtladığı bir mesajı sessizce bozma) geçersiz kılar; bunun yerine KULLANICININ kendi seçimi (Slice B) + dar otomatik güvenlik ağı (Slice C) tercih edildi.

## Acceptance criteria
- [ ] Hesap silme akışında kullanıcı "mesaj içeriğimi de kaldır" seçeneğini görüyor, varsayılan İŞARETLİ.
- [ ] Seçenek işaretliyken `Message.content`/`MessageEdit.previousContent`/`Report.reportedContent` (bu kullanıcıya ait olanlar) `user.delete()`'TEN ÖNCE, aynı transaction içinde redakte ediliyor — `authorId` null'a düşmeden önce hangi satırların bu kullanıcıya ait olduğu doğru tespit ediliyor.
- [ ] Seçenek İŞARETSİZ bırakılsa bile, yapısal PII (e-posta/telefon/URL deseni) otomatik taranıp redakte ediliyor — kullanıcının geniş tercihinden bağımsız, her zaman açık bir dar güvenlik ağı.
- [ ] `docs/RUNBOOK.md`'de belgelenmiş bir manuel talep/takedown prosedürü var — mevcut `FEEDBACK_EMAIL` kanalı bu taleplerin de adresi olarak açıkça belirtilmiş.
- [ ] **Backfill:** `deleteAccount()`'ın canlıya çıktığı günden bu yana zaten silinmiş hesaplara ait (`authorId`/`reportedUserId` bugün zaten null olan) mesajlar/edit'ler/rapor snapshot'ları da aynı yapısal-PII taramasından geçirilmiş.
- [ ] `docs/decisions/ADR-0005-data-retention-anonymize.md`, `docs/THREAT-MODEL.md` row 8 gerçek kod davranışını yansıtacak şekilde güncel (bu dosyanın kapsam-gözden-geçirme turu bu güncellemelerin bir kısmını ZATEN yaptı — bkz. Plan notları).

## Tasks — kod dilimleri (Claude uygular, her biri kendi plan-modu turu)
- [ ] **Slice A — Manuel talep kanalı.** ~1-2 saat, neredeyse tamamen doküman. `docs/RUNBOOK.md`'ye yeni §3.8: bir kullanıcı hesap-silme-sonrası kalan kimliklendirici içerik için talepte bulunduğunda `Message.content`/`MessageEdit.previousContent`/`Report.reportedContent`'i hedef mesaj(lar) için manuel `UPDATE` ile redakte eden SQL (§3.5'in — moderatör içerik geri alma — birebir emsali, ters yönde). Mevcut `FEEDBACK_EMAIL` (`RoomHeader.tsx`, `docs/BACKLOG.md` A19) bu talepler için de AÇIKÇA belirtilir, yeni kanal icat edilmiyor.
- [ ] **Slice B — Hesap silme anında kullanıcı seçimi.** ~7.5-10.5 saat. **Kritik sıralama kısıtı:** `Message.authorId` `onDelete: SetNull` olduğu için redaksiyon (`authorId`/`reportedUserId` hâlâ doluyken) `user.delete()`'TEN ÖNCE, aynı transaction içinde yapılmalı. `DeleteAccountDto`'ya `redactMessageContent?: boolean`, `AuthService.deleteAccount`'a (`auth.service.ts:378-409`) redaksiyon adımı, `DeleteAccountView.tsx`'e checkbox (varsayılan `checked=true`). Placeholder için mevcut `AUTHOR_DELETED_CONTENT` (`messages.service.ts:34`) yeniden kullanılması önerilir — kesin karar implementasyon turunda.
- [ ] **Slice C — Otomatik yapısal-PII taraması + backfill.** ~9-13 saat. Yeni `content-redaction.util.ts` (`content-validation.util.ts`'in yanına, e-posta/telefon/URL regex, yeni bağımlılık yok) — Slice B'nin akışına HER HALÜKARDA (kullanıcı "hayır" dese bile) entegre edilir. Ayrı bir **backfill script** (`backfill-totp-secrets.ts`'in deseni, idempotent) TÜM mevcut `authorId IS NULL` mesajları + ilgili satırları tarar — geçmişte silinmiş hesapların bugün açıkta duran riskini kapatan tek parça.

## Tasks — founder'ın kendi eliyle yapacağı işler
- [ ] Gizlilik politikasının gerçek hukuki metnine (M6 AC #1, hâlâ bekliyor) manuel takedown kanalının (Slice A) açıkça belirtilmesi.
- [ ] Bu dosyanın "makul çaba, garanti değil" çerçevesinin (ADR-0005 Addendum #2) avukata ayrıca onaylatılıp onaylatılmayacağına karar verilmesi — bu turda avukata SORULMADI, sadece dahili bir savunma çerçevesi olarak önerildi.

## Plan notları — 2026-08-21 kapsam gözden geçirmesi

Kullanıcının önceki turda sorduğu 4 maddelik denetim (deleteAccount'ta içerik dokunulmuyor mu, MessageEdit ne oluyor, diğer tablolarda ne var, gerçek mi teorik mi) + avukatın iki ardışık cevabı (birincisi: erişim kapsamı standardı değiştirmez; ikincisi: satır bazlı değerlendirme, tüm serbest metnin varlığı otomatik ret değil) `Read`/`Grep` ile kod tabanı doğrudan denetlenerek işlendi.

**Bulgu — `deleteAccount()` gerçekten hiçbir içerik dokunuşu yapmıyor.** `auth.service.ts:378-409` sadece `prisma.user.delete()` çağırıyor. `Message.content` şemada `authorId` `onDelete: SetNull` olduğu için FK temizleniyor ama METİN aynen kalıyor — frontend (`MessageItem.tsx:100`) sadece `authorUsername` null olunca "deleted user" gösteriyor, `content` değişmeden render ediliyor.

**Bulgu — `MessageEdit`'in hiç `User` ilişkisi yok, "anonimleşecek" bir alanı bile yok.** `previousContent` baştan sona işlenmeden kalıyor. Erişim kontrolü (`messages.service.ts:331-367`) incelendi: moderatör dalının `hasReport` kontrolü DURUM FİLTRESİ TAŞIMIYOR — bir mesaj bir kez raporlandıysa (rapor 6 ay önce çözülmüş olsa bile) moderatör o mesajın geçmişini SÜRESİZ çekebiliyor. `THREAT-MODEL.md`'nin satır 3'teki "scoped to an active report" ifadesi bu yüzden hafif yanlıştı, düzeltildi.

**Bulgu — `Report.reportedContent`'in uygulama-seviyesi erişimi daha dar (`listOpenReports`, `reports.service.ts:94-99`, SADECE `status:'open'`) ama DB satırı süresiz duruyor.** Render Postgres konsoluna (zaten normal bir admin aracı) elle erişimle hâlâ okunabilir.

**Tam envanter (diğer tablolar):** `ReputationEvent` (`actionType`+`amount`, serbest metin yok), `Invite` (sadece rastgele üretilmiş `code`), `ModerationAuditLog` (`reason` moderatörün kendi metni, kaynak kullanıcının değil; `targetRoomName/Description/Announcement` oda meta-verisi, hesap-spesifik değil) — hepsi düşük/teorik risk. **Düzeltme (önceki M6b turunda yanlış bulunmuştu):** `Invite.usedById`'in migration SQL'i (`20260729065835_.../migration.sql:61`) kontrol edildi, `ON DELETE SET NULL` — önceki "Restrict varsayar" bulgusu yanlıştı.

**Avukatın ikinci cevabı, ilk turun (b) seçeneğini (sadece arşiv tablolarını temizle) geçersiz kıldı** — "kim görebiliyor" kriteri değil, "kişi yeniden belirlenebiliyor mu" kriteri, hangi tabloda olduğu fark etmiyor. Ama "her serbest metin = anonim değil" de değil — değerlendirme SATIR bazında. Bu, orijinal (a)/(b)/(c) seçeneklerinin hiçbirini tam karşılamadı — gerçek çözüm satır-seviyesinde bir tarama/kullanıcı-seçimi kombinasyonu.

**Kullanıcının kesinleştirdiği kapsam ve öncelik sırası:** (1) manuel talep kanalı ÖNCE (en ucuz, ADR-0005'in zaten sözünü verip tutmadığı şey), (2) hesap silme anında kullanıcı seçimi (varsayılan AÇIK önerisi kabul edildi), (3) otomatik regex taraması (en geniş mühendislik, en dar/güvenilir kapsam). Üçü de Message/MessageEdit/Report'ta AYNI standartla uygulanacak — yarım bir çözüm istenmedi.

**Milestone kararı — M6b'ye eklenmedi, ayrı dosya:** gerekçe M6b'nin kendisinin M6'dan ayrılma mantığıyla birebir aynı — sıfır kod-yüzeyi çakışması (M6b: yeni tablo + middleware + cron; bu iş: mevcut tablolar + deleteAccount akışı + yeni bir tarama yardımcı fonksiyonu), M6b'nin kendi tahmininin bu işi hiç hesaba katmadan yapılmış olması, farklı aciliyet profili (backfill parçası GEÇMİŞ riski kapatıyor, TrafficLog İLERİYE dönük altyapı).

Doğrulama: bu tur SADECE kapsam gözden geçirmesi ve dokümantasyon — kod/test yazılmadı (kullanıcının açık talebi, "kod yazma, sadece kapsamı dilimlere böl"). Her kod diliminin (A/B/C) implementasyonu, bu dosya onaylandıktan SONRA, ayrı bir plan-modu turuyla başlayacak.

## Risks
- Slice C'nin regex taraması yanlış-negatif üretebilir (bağlamsal/yaratıcı kimlik ifşası yakalanamaz) — bu dosya "garanti" değil "makul çaba" iddia ediyor, ADR-0005 Addendum #2'de açıkça yazılı; avukatla bu çerçevenin kendisi ayrıca doğrulanmadı (founder işi).
- Backfill'in kapsamı (TÜM geçmiş `authorId IS NULL` satırları) mevcut veri hacmine göre uzun sürebilir — Slice C'nin implementasyon turunda gerçek satır sayısı ölçülmeli, `backfill-totp-secrets.ts`'in idempotent deseni bunun için zaten uygun.
- Slice B'nin varsayılan-AÇIK checkbox'ı, kullanıcıların "thread coherence" bozulmasını (kendi mesajlarının context'ten kaybolması) fark etmeden kabul etmesine yol açabilir — UI metninin bunu net anlatması gerekiyor, implementasyon turunda dikkat edilmeli.
