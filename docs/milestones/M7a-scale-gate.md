# M7a — Kapı Açma Eşiği (500'e Ölçeklenme, Faz 0)

*`M7-scale-and-critical-fixes.md`'nin BÖLÜNMÜŞ hali (2026-08-12, founder kararı). Gerekçe:
tek parça M7'nin TAMAMI (~155-175 saat, 6-7 hafta) bitene kadar ürünü KİMSEYE
gösterememek, kapalı bir 1.0 lansmanın kendi amacıyla (en riskli varsayımı GERÇEK
kullanıcıyla test etmek) çelişiyor. M7a = kapıyı açmayı GERÇEKTEN engelleyen
kalemler — bunlar bitmeden bir davet dalgası (50 kişi bile) açılmaz. Polis/cila
kalemleri `M7b-scale-polish.md`'de, AYRI ve daha az acil.*

## Faz 0 nedir
"Faz 0", herhangi bir davet dalgası açılmadan ÖNCEki dönem — bugünden Faz 1'in
(ilk 50 davet) açılışına kadar. M7a'nın TÜM kalemleri Faz 0'da biter, hiçbiri
sonraya ertelenmez. Bunun nedeni kalem kalem farklı: bazıları mimari (sonradan
retrofit etmek üstel derecede pahalı — `RoomMember`), bazıları ilk-izlenim
(landing, hesap güvenliği), bazıları ölçüm-kapasitesi (yük testi, analitik —
Faz 1 açılmadan ÖLÇEBİLİR olmak gerekiyor, yoksa Faz 1'in kendisi kör bir
deney olur).

## Aşamalı davet planı (bağlam — detaylı sıralama `M7b-scale-polish.md`'de)
| Faz | Kullanıcı sayısı | Ne zaman açılır |
|---|---|---|
| **Faz 0** | 0 | M7a bitene kadar — bu dosyanın TAMAMI |
| **Faz 1** | ~50 | M7a bittiğinde |
| **Faz 2** | ~150 | Faz 1'in gerçek verisiyle `M7b`'nin faz-2-öncesi kalemleri bitince |
| **Faz 3** | ~500 | Faz 2'nin gerçek verisiyle `M7b`'nin faz-3-öncesi kalemleri bitince |

Neden aşamalı: altyapı/moderasyon yükü TOPLAM hedef sayıyla değil EŞZAMANLI/
aktif yükle ölçeklenir — 50 kişiyle açılıp gerçek sorunları ucuza yüzeye
çıkarmak, M7b'nin en ağır kalemlerini (rate limit ayarı, moderasyon itirazı
hacmi) TAHMİNLE değil GERÇEK veriyle zamanlamak demek. `RoomMember` TEK
istisna — mimari bir değişiklik olduğu için kullanıcı sayısından bağımsız,
Faz 0'da (kullanıcı gelmeden) bitmiş olmalı, hiçbir faza ertelenemez.

## Goal
Ürün Faz 1'in ilk 50 kişisine GERÇEKTEN, sorumlu şekilde açılabilsin — teknik
olarak (broadcast kapasitesi, oturum kalıcılığı, doğrulanmış yük kapasitesi),
operasyonel olarak (moderatör atanabiliyor, ölçüm mümkün) ve ilk izlenim
olarak (landing sayfası, hesap güvenliği, hukuki metin sürümleri).

## Demo
Bir kullanıcı sekmesini kapatıp geri açtığında oturumu hâlâ açık; `RoomMember`
üyelik modeli var ve broadcast sadece üyelere gidiyor; ikinci bir moderatör
self-servis atanabiliyor; şifre gücü + hesap-bazlı brute-force kilidi
çalışıyor; `/` bir landing sayfası; ToS/Gizlilik EN/TR seçilebiliyor; founder
kendi DB'sinden DAU sorgusu çalıştırabiliyor; 300-500 eşzamanlı bağlantılık
yük testi hatasız geçmiş ve sonuçları dokümante edilmiş.

## Estimated hours
**~98-131 saat çekirdek, +%20-25 tampon (M7'nin kendi geçmiş-proje dersi) ile
~120-165 saat.** 30 saat/hafta bütçeyle **~4-5.5 hafta**.

**"İlk 50 kişiyi ne zaman davet edebilirim?" — ~4 ila 5.5 hafta sonra**,
kesintisiz 30 saat/hafta ile. Bu, M7'nin tek-parça 6-7.5 haftalık tahmininden
gerçek bir kısalma (RoomMember + oturum kalıcılığı + hesap güvenliği +
landing/hukuki + analitik + yük testi hâlâ tam maliyetiyle burada — kısalma,
M7b'nin ~55-70 saatlik kalemlerinin Faz 1 açıldıktan SONRAya, hatta paralel
yürütülebilecek şekilde ertelenmesinden geliyor).

## Out of scope
- `M7b-scale-polish.md`'nin tüm kalemleri (moderasyon itirazı, kendi mesajını
  silme, "düzenlendi" göstergesi, oda keşfedilebilirliği, taslak kalıcılığı,
  zalgo koruması, tıklanabilir linkler, rate limit gözden geçirmesi, geri
  bildirim/duyuru, Türkçe→İngilizce UI bitirme) — hiçbiri Faz 1'in AÇILIŞINI
  engellemiyor, hepsi kendi fazına göre sıralı.
- `M8-social-features.md`, `M9-i18n.md`, `M10-ui-redesign.md` — değişmedi.

## Acceptance criteria
- [ ] Oturum bir sekme kapatma/tarayıcı yeniden başlatma sonrası hâlâ açık (httpOnly cookie, CSRF korumalı).
- [ ] `RoomMember` üyelik modeli var; bir mesaj SADECE o odanın üyelerine broadcast ediliyor (bugünkü gibi TÜM bağlı kullanıcılara değil).
- [ ] İkinci bir moderatör self-servis (elle SQL olmadan) atanabiliyor.
- [ ] Şifre gücü kontrolü (min uzunluk zaten var + HaveIBeenPwned k-anonymity) VE hesap-bazlı brute-force kilitlenmesi var.
- [ ] `/` bir landing/onboarding sayfası — davet kodu olan biri bağlamsız bir login formuyla karşılaşmıyor.
- [ ] ToS/Gizlilik'in EN ve TR ayrı sürümleri var, hangisi görüneceği seçilebiliyor (hukuki metnin kendisi founder'ın işi, sadece versiyon-seçme sayfası kod).
- [ ] Founder kendi DB'sinden DAU/kişi-başı-mesaj/gün-1-gün-7-dönüş/oda-aktivitesi sorgularını çalıştırabiliyor (dokümante edilmiş SQL, `docs/RUNBOOK.md`'ye eklenir).
- [ ] Gerçekçi bir yük testi (en az 300-500 eşzamanlı bağlantı, gerçek gecikme/bellek ölçümüyle) hatasız geçiyor, sonuçlar dokümante edildi.
- [ ] Postgres plan kapasitesi (RAM/bağlantı/depolama) 500 kullanıcı için Render dashboard'undan doğrulandı (founder'ın işi, kod değil).

## Tasks — kod dilimleri (Claude uygular, her biri kendi plan-modu turu)

- [ ] **Slice A — Oturum kalıcılığı (httpOnly cookie + CSRF).** ~16-24 saat. `ADR-0002`'nin kendi "Decision" bölümünün ASLA tamamlanmamış mekanizması: `apps/web/app/page.tsx`'in bellek-içi token state'i httpOnly cookie'ye taşınır. **CSRF koruması şart** — bearer-token-in-header'ın doğal olarak sahip olmadığı bir risk, cookie'ye geçince kazanılıyor (SameSite politikası + state-changing isteklerde CSRF token). Refresh-token rotasyonu zaten var (ADR-0002), cookie'ye taşınması bunu bozmamalı. Mobil-uyumluluk hâlâ korunmalı — ADR-0002'nin kendi çözümü zaten bunu öngörmüş ("web istemcisi için httpOnly cookie, API'nin kendisi cookie-agnostic") — API bearer-token kabul etmeye devam eder, sadece WEB istemcisi artık cookie kullanır.
- [ ] **Slice B — `RoomMember` üyelik modeli + üyelik-farkında broadcast.** ~35-45 saat, EN BÜYÜK dilim. Yeni migration (`RoomMember` tablosu), mevcut kullanıcılar için backfill (bugünkü "herkes otomatik her odada" davranışını KORUYACAK şekilde — cutover'da kimse mevcut odalarından "çıkmış" hissetmemeli), `messages.gateway.ts`'in `handleConnection`'ı SADECE üye olunan odalara katılsın diye değişir, oda oluşturma otomatik üyelik ekler, `RoomsService.listRooms` "benim odalarım" vs "keşfedilebilir odalar" ayrımı kazanır. **Tasarım yüzeyi yaratıyor** (oda listesi UI'ı değişir) — M10 Faz 1'in bu SPESİFİK yüzey için hafif bir tasarım kararı (tam redesign değil) bu dilimden ÖNCE gerekiyor. **Faz-bağımsız istisna:** kullanıcı sayısından bağımsız olarak Faz 0'da bitmeli — mimari bir değişiklik, gerçek mesajlar/ilişkiler birikince retrofit etmek çok daha pahalı olur.
- [ ] **Slice C — Self-servis moderatör atama.** ~7-9 saat. Yeni endpoint (`ModeratorGuard` zaten var, sadece bir atama endpoint'i eksik). *(Rate limit gözden geçirmesi bu dilimden ÇIKARILDI — `M7b-scale-polish.md`'ye taşındı, gerçek Faz 1 trafik verisi gerektirdiği için Faz 0'da anlamlı yapılamaz.)*
- [ ] **Slice F — Hesap sertleştirme (şifre gücü + brute-force kilidi).** ~10-14 saat. HaveIBeenPwned k-anonymity check (yeni bağımlılık YOK, düz `fetch`), hesap-bazlı başarısız-giriş sayacı + backoff (yeni bir `User` alanı veya ayrı bir tablo — implementasyon sırasında karar).
- [ ] **Slice G — Landing/onboarding sayfası + hukuki EN/TR versiyon seçimi.** ~14-18 saat. `/` artık `AuthView`'a değil bir landing/onboarding'e gider (`/app` ya da benzeri bir rotaya taşınır — implementasyon sırasında netleşir), `/privacy`/`/terms`'e bağlanır. **M10 Faz 1'in hafif bir tasarım kararı bu dilimden ÖNCE gerekiyor** (yeni bir sayfa, boş yere iki kez tasarlanmasın). ToS/Gizlilik EN/TR versiyon seçme sayfası (hukuki metnin KENDİSİ founder'ın işi).
- [ ] **Slice H — Ürün analitiği (SQL sorguları).** ~6-8 saat. Dashboard DEĞİL, `docs/RUNBOOK.md`'ye eklenen dokümante edilmiş SQL sorguları (DAU, kişi-başı mesaj, gün-1/gün-7 dönüş, oda-aktivitesi) — üçüncü parti analitik YOK (gizlilik duruşuyla tutarlı). **Faz 0'da bitmeli, Faz 1'de veri gelmeye başlar başlamaz ölçülebilsin diye** — sonradan eklemek Faz 1'in ilk haftalarını kör geçirmek demek. *(Geri bildirim/duyuru bu dilimden ÇIKARILDI — `M7b-scale-polish.md`'ye taşındı, kapı-açma engelleyicisi değil.)*
- [ ] **Slice I — Yük testi/kapasite doğrulaması.** ~10-13 saat. `apps/api/test/load/ws-load-test.ts` gerçek bellek/gecikme ölçümüyle genişletilir, 300-500 bağlantıya çıkarılır, sonuçlar dokümante edilir. **Faz 0'da bitmeli** — kapasitenin gerçekten tutup tutmadığını bilmeden Faz 1'i açmak, riski ölçmeden almak demek. *(Türkçe→İngilizce UI bitirme (A15) bu dilimden ÇIKARILDI — `M7b-scale-polish.md`'ye taşındı, kapı-açma engelleyicisi değil, kimlik-tutarlılığı Faz 3'e kadar bekleyebilir.)*

## Tasks — founder'ın kendi eliyle yapacağı işler
- [ ] Render Postgres planının gerçek RAM/CPU/bağlantı-limiti/depolama rakamlarını dashboard'dan doğrula, 500 kullanıcı için yeterli mi karar ver (gerekirse yükselt) — Faz 0'da, Faz 1 açılmadan.
- [ ] Slice I'nin yük testi sonuçlarını gözden geçir, ADR-0003'ün "ne zaman Redis+ikinci instance" eşiğinin gerçekten geldiğine karar ver.
- [ ] Yeni aylık maliyet tahminini gerçek Render/Postgres faturasıyla doğrula ($50/mo bütçe ADR-0002'de zaten 600-kullanıcı için varsayılmıştı — muhtemelen hâlâ yeterli, ama doğrulanmadı).
- [ ] ToS/Gizlilik'in EN ve TR hukuki metnini yazdır (Slice A'dan zaten bekleyen iş, şimdi iki dilde).
- [ ] Avukata ek soru: iki dil sürümü çelişirse hangisi bağlayıcı?

## Risks
- Slice B (`RoomMember`) en büyük ve en riskli dilim — mevcut "herkes her odada" davranışını KORUYARAK backfill etmek yanlış yapılırsa mevcut kullanıcılar odalarından "düşmüş" hissedebilir. `new-migration` skill'inin expand/backfill/verify disiplinini gerektirir, tek bir plan-modu turunda değil muhtemelen kendi alt-turlarıyla ele alınmalı.
- Slice A (oturum) CSRF'i doğru kurmazsa YENİ bir güvenlik açığı açar — "sadece cookie'ye taşı" kadar basit değil, ayrı bir dikkat gerektiriyor.
- 98-131 saatlik çekirdek tahmin GERÇEKÇİ ama ESNEK DEĞİL — bu projenin kendi geçmişi (CI env-var per-job tuzağı, CRLF/.gitignore sorunu, lint-masking bug'ı gibi) gösteriyor ki gerçek süre planlanandan sapabilir. +%20-25 tampon önerilir (gerçekçi aralık: 120-165 saat, 4-5.5 hafta).
- Faz 1 açılışının M7b'nin HİÇBİR kalemini beklemediği varsayımı, moderasyon itirazı/zalgo koruması gibi kalemlerin gerçekten Faz 2'ye kadar bekleyebileceğine dayanıyor — eğer Faz 1'in ilk haftalarında beklenenden daha sert bir moderasyon vakası çıkarsa, bu kalemler erken çekilebilir (plan katı değil, gerçek veriye göre esner).

## Plan notları
*(implementasyon sırasında doldurulur)*
