# M7 — Scale to 500 + Critical Fixes

*20-30 kişilik kapalı topluluk hedefi 500'e çıktı (2026-08-12, founder kararı). Bu milestone, o değişiklikle ATEŞLENEN her şeyi kapsıyor: gerçek altyapı sınırları, tek-moderatör varsayımının çökmesi, ve 20-30 arkadaş arasında tolere edilebilir ama 500 yarı-tanıdık yabancı arasında olmayan küçük ama gerçek boşluklar. Yeni özellik EKLEMİYOR (DM, mention, reaksiyon vb. — bkz. `M8-social-features.md`) — sadece MEVCUT ürünün 500 ölçeğinde çalışır/adil/güvenli olmasını sağlıyor.*

**Goal:** Ürün 500 kullanıcıya gerçekten davet edilebilir hale gelsin — hem teknik olarak (broadcast kapasitesi, oturum kalıcılığı) hem operasyonel olarak (tek moderatör yetişebilir) hem de temel adalet/güven açısından (itiraz yolu, oturum kaybolmuyor).
**Demo:** 500 eşzamanlı bağlantılık gerçekçi bir yük testi hatasız geçiyor; bir kullanıcı sekmesini kapatıp geri açtığında oturumu hâlâ açık; ikinci bir moderatör self-servis atanabiliyor; susturulan/içeriği kaldırılan bir kullanıcı SEBEBİNİ görüyor; founder kendi DB'sinden gerçek DAU/geri-dönüş sorguları çalıştırabiliyor.
**Estimated hours:** ~155-175 saat (detay aşağıda, dilim bazında). 30 saat/hafta bütçeyle **~6-7 hafta**, tek başına bu milestone için — kesintisiz, başka işe bölünmeden.

## Out of scope
- Herhangi bir YENİ sosyal özellik (DM, mention, reaksiyon, presence, okundu durumu, yanıtlama, arama, kullanıcı dizini, terminal komutları) — hepsi `M8-social-features.md`'de, ayrı ve SONRA.
- Tam çift-dilli (runtime EN/TR seçimi, `User.locale`, backend hata kodlarının tam çevirisi) — `M9-i18n.md`'de, ayrı bir çapraz-kesen altyapı değişikliği, özellik değil.
- Görsel/UX yeniden tasarımı (hiyerarşi, panel deseni, mesaj ritmi, motion) — `M10-ui-redesign.md`'de, KENDİ iki-aşamalı süreciyle (önce tasarım kararı, sonra kod). Bu milestone'un landing/onboarding/keşif gibi yeni yüzey yaratan dilimleri M10'un Faz 1 tasarım kararlarına muhtaç — aşağıdaki her dilimde işaretlendi.
- Kullanıcı profili/bio/avatar/kullanıcı adı değiştirme — `M8`'e, yeni moderasyon yüzeyi + rezervasyon karmaşıklığı nedeniyle.

## Acceptance criteria
- [ ] Oturum bir sekme kapatma/tarayıcı yeniden başlatma sonrası hâlâ açık (httpOnly cookie, CSRF korumalı).
- [ ] `RoomMember` üyelik modeli var; bir mesaj SADECE o odanın üyelerine broadcast ediliyor (bugünkü gibi TÜM bağlı kullanıcılara değil).
- [ ] İkinci bir moderatör self-servis (elle SQL olmadan) atanabiliyor.
- [ ] Global rate limit 500 kullanıcı ölçeğinde gözden geçirildi, gerekirse artırıldı, karar kayıtlı.
- [ ] Susturma bildirimi SEBEP içeriyor; içerik kaldırma AYRI, hedefe özel bir bildirim üretiyor (genel `message:updated`'a gömülü değil).
- [ ] Kullanıcı kendi mesajını silebiliyor.
- [ ] Düzenlenmiş bir mesaj sıradan bir görüntüleyene "(düzenlendi)" gösteriyor.
- [ ] Oda listesi aktiviteye göre sıralanıyor/filtrelenebiliyor (sadece alfabetik değil).
- [ ] `/` bir landing/onboarding sayfası — davet kodu olan biri bağlamsız bir login formuyla karşılaşmıyor.
- [ ] Şifre gücü kontrolü (min uzunluk zaten var + HaveIBeenPwned k-anonymity) VE hesap-bazlı brute-force kilitlenmesi var.
- [ ] Founder kendi DB'sinden DAU/kişi-başı-mesaj/gün-1-gün-7-dönüş/oda-aktivitesi sorgularını çalıştırabiliyor (dokümante edilmiş SQL, `docs/RUNBOOK.md`'ye eklenir).
- [ ] Bir geri bildirim yolu var (mailto tabanlı minimum) VE moderatör pinlenmiş bir duyuru mesajı atabiliyor.
- [ ] Mesajlarda çıplak URL'ler tıklanabilir (`target=_blank rel=noopener`), önizleme YOK.
- [ ] Birleşik-işaret/zalgo suistimaline karşı bir grapheme-sınırı var.
- [ ] Oda değiştirince yazılmakta olan taslak KAYBOLMUYOR.
- [ ] ToS/Gizlilik'in EN ve TR ayrı sürümleri var, hangisi görüneceği seçilebiliyor (hukuki metnin kendisi founder'ın işi, sadece versiyon-seçme sayfası kod).
- [ ] Zaten yıllardır bekleyen Türkçe→İngilizce UI geçişi (BACKLOG A15) BİTTİ — runtime dil SEÇİMİ olmadan, varsayılan tamamen İngilizce.
- [ ] Gerçekçi bir yük testi (en az 300-500 eşzamanlı bağlantı, gerçek gecikme/bellek ölçümüyle) hatasız geçiyor, sonuçlar dokümante edildi.
- [ ] Postgres plan kapasitesi (RAM/bağlantı/depolama) 500 kullanıcı için Render dashboard'undan doğrulandı (founder'ın işi, kod değil).

## Tasks — kod dilimleri (Claude uygular, her biri kendi plan-modu turu)

- [ ] **Slice A — Oturum kalıcılığı (httpOnly cookie + CSRF).** ~16-24 saat. `ADR-0002`'nin kendi "Decision" bölümünün ASLA tamamlanmamış mekanizması: `apps/web/app/page.tsx`'in bellek-içi token state'i httpOnly cookie'ye taşınır. **CSRF korumwithin şart** — bearer-token-in-header'ın doğal olarak sahip olmadığı bir risk, cookie'ye geçince kazanılıyor (SameSite politikası + state-changing isteklerde CSRF token). Refresh-token rotasyonu zaten var (ADR-0002), cookie'ye taşınması bunu bozmamalı. Mobil-uyumluluk hâlâ korunmalı — ADR-0002'nin kendi çözümü zaten bunu öngörmüş ("web istemcisi için httpOnly cookie, API'nin kendisi cookie-agnostic") — API bearer-token kabul etmeye devam eder, sadece WEB istemcisi artık cookie kullanır.
- [ ] **Slice B — `RoomMember` üyelik modeli + üyelik-farkında broadcast.** ~35-45 saat, EN BÜYÜK dilim. Yeni migration (`RoomMember` tablosu), mevcut kullanıcılar için backfill (bugünkü "herkes otomatik her odada" davranışını KORUYACAK şekilde — cutover'da kimse mevcut odalarından "çıkmış" hissetmemeli), `messages.gateway.ts`'in `handleConnection`'ı SADECE üye olunan odalara katılsın diye değişir, oda oluşturma otomatik üyelik ekler, `RoomsService.listRooms` "benim odalarım" vs "keşfedilebilir odalar" ayrımı kazanır. **Tasarım yüzeyi yaratıyor** (oda listesi UI'ı değişir) — M10 Faz 1'in bu SPESİFİK yüzey için hafif bir tasarım kararı (tam redesign değil) bu dilimden ÖNCE gerekiyor.
- [ ] **Slice C — Self-servis moderatör atama + rate limit gözden geçirmesi.** ~10-14 saat. Yeni endpoint (`ModeratorGuard` zaten var, sadece bir atama endpoint'i eksik), + global 100/60s limitin 500 ölçeğinde gözden geçirilmesi (muhtemelen artış, aynı NAT/ofis IP'sinden çok sayıda meşru kullanıcı senaryosu).
- [ ] **Slice D — Moderasyon itirazı + kendi mesajını silme + "düzenlendi" göstergesi.** ~20-26 saat. Susturma/içerik-kaldırmaya SEBEP alanı eklenir, içerik kaldırma için hedefe özel bir bildirim (mevcut WS kanalları yeniden kullanılır, yeni altyapı değil). Kendi mesajını silme: `ADR-0005`'in anonimleştirme desenine tutarlı bir soft-delete (içerik `[Bu mesaj yazarı tarafından silindi.]` gibi bir sabitle değiştirilir, `MODERATOR_REMOVED_CONTENT`'in kendi deseni). "Düzenlendi" göstergesi: veri zaten var (`MessageEdit` ilişkisi), sadece bir görünüm kararı.
- [ ] **Slice E — Oda keşfedilebilirliği + taslak kalıcılığı + zalgo koruması + tıklanabilir linkler.** ~14-20 saat. `RoomsService.listRooms`'a aktivite sıralaması, `RoomView.tsx`'in `draft` state'i `Record<roomId,string>`'e döner, mesaj içerik doğrulamasına grapheme-sınırı eklenir, `MessageContent.tsx`'e linkify (önizleme YOK). **Oda listesi kısmı Slice B'yle aynı yüzeyi paylaşıyor** — birlikte tasarlanmalı.
- [ ] **Slice F — Hesap sertleştirme (şifre gücü + brute-force kilidi).** ~10-14 saat. HaveIBeenPwned k-anonymity check (yeni bağımlılık YOK, düz `fetch`), hesap-bazlı başarısız-giriş sayacı + backoff (yeni bir `User` alanı veya ayrı bir tablo — implementasyon sırasında karar).
- [ ] **Slice G — Landing/onboarding sayfası + hukuki EN/TR versiyon seçimi.** ~14-18 saat. `/` artık `AuthView`'a değil bir landing/onboarding'e gider (`/app` ya da benzeri bir rotaya taşınır — implementasyon sırasında netleşir), `/privacy`/`/terms`'e bağlanır. **M10 Faz 1'in hafif bir tasarım kararı bu dilimden ÖNCE gerekiyor** (yeni bir sayfa, boş yere iki kez tasarlanmasın). ToS/Gizlilik EN/TR versiyon seçme sayfası (hukuki metnin KENDİSİ founder'ın işi).
- [ ] **Slice H — Ürün analitiği (SQL sorguları) + geri bildirim/duyuru.** ~10-14 saat. Analitik: dashboard DEĞİL, `docs/RUNBOOK.md`'ye eklenen dokümante edilmiş SQL sorguları (DAU, kişi-başı mesaj, gün-1/gün-7 dönüş, oda-aktivitesi) — üçüncü parti analitik YOK (gizlilik duruşuyla tutarlı, founder'ın kendi tercihi). Geri bildirim: `mailto:` linki (yeni backend gerekmiyor). Duyuru: moderatörün pinleyebileceği tek bir mesaj alanı (`Room` ya da ayrı küçük bir model — implementasyon sırasında karar).
- [ ] **Slice I — Türkçe→İngilizce UI geçişinin bitirilmesi (A15) + yük testi/kapasite doğrulaması.** ~18-24 saat. A15'in kendi tetikleyicisi (İngilizce dosya oranı ≥%50) muhtemelen bu dilimin KENDİSİYLE ateşleniyor — kalan Türkçe component'ler İngilizceye çevrilir, **runtime dil SEÇİMİ/`User.locale` EKLENMEZ** (o M9'un tam kapsamı). Playwright seçicileri bu geçişle birlikte `data-testid`'e taşınmalı (388 Türkçe-bağımlı seçici, M9'un kendi maliyet analizinde) — **BU dilimde SADECE değişen dosyaların seçicileri güncellenir, TAM testid geçişi M9'a kalır** (aksi halde bu dilim M9'un maliyetini üstleniyor demektir). Yük testi: `apps/api/test/load/ws-load-test.ts` gerçek bellek/gecikme ölçümüyle genişletilir, 300-500 bağlantıya çıkarılır, sonuçlar dokümante edilir.

## Tasks — founder'ın kendi eliyle yapacağı işler
- [ ] Render Postgres planının gerçek RAM/CPU/bağlantı-limiti/depolama rakamlarını dashboard'dan doğrula, 500 kullanıcı için yeterli mi karar ver (gerekirse yükselt).
- [ ] Slice I'nin yük testi sonuçlarını gözden geçir, ADR-0003'ün "ne zaman Redis+ikinci instance" eşiğinin gerçekten geldiğine karar ver.
- [ ] Yeni aylık maliyet tahminini gerçek Render/Postgres faturasıyla doğrula ($50/mo bütçe ADR-0002'de zaten 600-kullanıcı için varsayılmıştı — muhtemelen hâlâ yeterli, ama doğrulanmadı).
- [ ] ToS/Gizlilik'in EN ve TR hukuki metnini yazdır (Slice A'dan zaten bekleyen iş, şimdi iki dilde).
- [ ] Avukata ek soru: iki dil sürümü çelişirse hangisi bağlayıcı?

## Risks
- Slice B (`RoomMember`) en büyük ve en riskli dilim — mevcut "herkes her odada" davranışını KORUYARAK backfill etmek yanlış yapılırsa mevcut kullanıcılar odalarından "düşmüş" hissedebilir. `new-migration` skill'inin expand/backfill/verify disiplinini gerektirir, tek bir plan-modu turunda değil muhtemelen kendi alt-turlarıyla ele alınmalı.
- Slice A (oturum) CSRF'i doğru kurmazsa YENİ bir güvenlik açığı açar — "sadece cookie'ye taşı" kadar basit değil, ayrı bir dikkat gerektiriyor.
- 155-175 saatlik tahmin GERÇEKÇİ ama ESNEK DEĞİL — bu projenin kendi geçmişi (CI env-var per-job tuzağı, CRLF/.gitignore sorunu, lint-masking bug'ı gibi) gösteriyor ki gerçek süre planlanandan sapabilir. +%20-25 tampon önerilir (gerçekçi aralık: 190-220 saat, 6-7.5 hafta).
