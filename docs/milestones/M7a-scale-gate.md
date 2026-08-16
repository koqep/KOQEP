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
- [x] Oturum bir sekme kapatma/tarayıcı yeniden başlatma sonrası hâlâ açık (httpOnly cookie, CSRF korumalı). *(2026-08-14, Slice A tamamlandı — bkz. Plan notları)*
- [ ] `RoomMember` üyelik modeli var; bir mesaj SADECE o odanın üyelerine broadcast ediliyor (bugünkü gibi TÜM bağlı kullanıcılara değil).
- [x] İkinci bir moderatör self-servis (elle SQL olmadan) atanabiliyor. *(2026-08-16, Slice C tamamlandı — bkz. Plan notları)*
- [ ] Şifre gücü kontrolü (min uzunluk zaten var + HaveIBeenPwned k-anonymity) VE hesap-bazlı brute-force kilitlenmesi var.
- [ ] `/` bir landing/onboarding sayfası — davet kodu olan biri bağlamsız bir login formuyla karşılaşmıyor.
- [ ] ToS/Gizlilik'in EN ve TR ayrı sürümleri var, hangisi görüneceği seçilebiliyor (hukuki metnin kendisi founder'ın işi, sadece versiyon-seçme sayfası kod).
- [ ] Founder kendi DB'sinden DAU/kişi-başı-mesaj/gün-1-gün-7-dönüş/oda-aktivitesi sorgularını çalıştırabiliyor (dokümante edilmiş SQL, `docs/RUNBOOK.md`'ye eklenir).
- [ ] Gerçekçi bir yük testi (en az 300-500 eşzamanlı bağlantı, gerçek gecikme/bellek ölçümüyle) hatasız geçiyor, sonuçlar dokümante edildi.
- [ ] Postgres plan kapasitesi (RAM/bağlantı/depolama) 500 kullanıcı için Render dashboard'undan doğrulandı (founder'ın işi, kod değil).

## Tasks — kod dilimleri (Claude uygular, her biri kendi plan-modu turu)

- [x] **Slice A — Oturum kalıcılığı (httpOnly cookie + CSRF).** ~16-24 saat tahmin edilmişti, gerçek ~29-38h (bkz. Plan notları). `ADR-0002`'nin kendi "Decision" bölümünün ASLA tamamlanmamış mekanizması: `apps/web/app/page.tsx`'in bellek-içi token state'i httpOnly cookie'ye taşınır. **CSRF koruması şart** — bearer-token-in-header'ın doğal olarak sahip olmadığı bir risk, cookie'ye geçince kazanılıyor (SameSite politikası + state-changing isteklerde CSRF token). Refresh-token rotasyonu zaten var (ADR-0002), cookie'ye taşınması bunu bozmamalı. Mobil-uyumluluk hâlâ korunmalı — ADR-0002'nin kendi çözümü zaten bunu öngörmüş ("web istemcisi için httpOnly cookie, API'nin kendisi cookie-agnostic") — API bearer-token kabul etmeye devam eder, sadece WEB istemcisi artık cookie kullanır. **Tam gerçekleşen tasarım ADR-0002 Addendum'da** — SADECE refresh token cookie'ye taşındı, access token bearer'da kaldı (WS gateway + jwt-auth.guard.ts'e hiç dokunulmadı).
- [x] **Slice B — `RoomMember` üyelik modeli + üyelik-farkında broadcast.** ~35-45 saat tahmin edilmişti, gerçek ~59-80h (bkz. Plan notları — kullanıcının review'ında bulunan üç gerçek boşluk: backfill içeriği, leave endpoint'i, sayfalama). Yeni migration (`RoomMember` tablosu), mevcut kullanıcılar için üç-kaynaklı backfill (çekirdek odalar × tüm kullanıcılar + oda kurucuları + gerçek mesaj-katılımcıları — ADR-0009), `messages.gateway.ts`'in `handleConnection`'ı SADECE üye olunan odalara katılıyor, oda oluşturma otomatik üyelik ekliyor, `RoomsService.listRooms` "benim odalarım"/"keşfedilebilir odalar"/"tümü" (moderasyon) ayrımı + join/leave endpoint'leri kazandı. **Tasarım yüzeyi** M10 Faz 1'in hafif kararıyla aynı plan-modu turunda çözüldü (switcher görsel olarak değişmedi, keşif ayrı yeni bir panel).
- [x] **Slice C — Self-servis moderatör atama + yetkisini kaldırma.** ~7-9 saat tahmin edilmişti, gerçek ~13-16h (bkz. Plan notları — kullanıcının review'ında bulunan asimetri riski: atama var, kaldırma yoksa yetki-yükseltme yüzeyi genişler). `POST /moderation/users/assign-moderator` (şifre+opsiyonel TOTP reauth) + `/revoke-moderator` (reauth yok) — `ModeratorGuard` zaten vardı, iki yeni endpoint + `AuthService`'ten çıkarılan reauth mantığı. *(Rate limit gözden geçirmesi bu dilimden ÇIKARILDI — `M7b-scale-polish.md`'ye taşındı, gerçek Faz 1 trafik verisi gerektirdiği için Faz 0'da anlamlı yapılamaz.)*
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
- ~~Slice B (`RoomMember`) en büyük ve en riskli dilim — mevcut "herkes her odada" davranışını KORUYARAK backfill etmek yanlış yapılırsa mevcut kullanıcılar odalarından "düşmüş" hissedebilir.~~ Slice B tamamlandı, üç-kaynaklı backfill union'ı (çekirdek + kurucu + gerçek katılımcı) + eşzamanlılığa dayanıklı insert (P2003 retry) ADR-0009'da belgeli.
- ~~Slice A (oturum) CSRF'i doğru kurmazsa YENİ bir güvenlik açığı açar — "sadece cookie'ye taşı" kadar basit değil, ayrı bir dikkat gerektiriyor.~~ Slice A tamamlandı, double-submit CSRF + grace-period tasarımı ADR-0002 Addendum'da belgeli.

## Plan notları

### Slice A — Oturum kalıcılığı (2026-08-14, tamamlandı)
Plan modunda üç Explore agent'ı (API auth mimarisi, web istemcisi token/WS/CORS/test yüzeyi, ADR-0002+THREAT-MODEL+ADR-supersession emsali — üçüncüsü oturum limitine takılıp yarım kaldı, kalan kısmı elle tamamlandı) ile araştırıldı. `ExitPlanMode`'da kullanıcının review'ı üç gerçek sorun buldu (plan onaylanmadan önce düzeltildi): (1) CSRF cookie'sinin `path:'/auth'` olması JS'in onu HİÇBİR sayfadan okuyamaması demekti (path `/` olmalıydı), (2) çoklu-sekme rotasyon-yarışı sebepsiz çıkışa yol açabilirdi (backend grace-period + `revokedByRotation` ayrımıyla çözüldü), (3) 14 Playwright dosyasına tekrar eden mock eklemek kök nedene inmiyordu (paylaşılan `e2e/support/auth-mocks.ts` ile çözüldü, bu repodaki İLK paylaşılan Playwright yardımcı modülü).

**Implementasyon sırasında bulunan ve düzeltilen 2. gerçek bug (kullanıcı review'ında değil, kendi Playwright süitimde):** ilk tasarım `authedPostJson`/`authedGetJson`'da HERHANGİ bir 401'de sessiz refresh-ve-tekrar-dene deniyordu — ama `/auth/delete-account` (yanlış şifre/TOTP) ve `/auth/totp/enable` (yanlış TOTP kodu) gibi authed endpoint'lerin KENDİ domain 401'leri de var, kod'suz düz string mesajlarla. Blanket retry bu gerçek hataları sessizce "oturum yenilenemedi" hatasına çeviriyordu — `delete-account.spec.ts`/`totp-settings.spec.ts`'in mevcut testleri bunu YAKALADI. Düzeltme: SADECE "token'ın kendisi geçersiz" anlamına gelen 401'ler (`jwt-auth.guard.ts`, `verifyAccessToken`, `deleteAccount`'ın P2025 dalı, `UsersService.getProfile`) artık `code:'INVALID_TOKEN'` taşıyor, frontend SADECE bu code'da retry deniyor — çıplak `status===401` değil.

**Gerçek saat:** ~29-38h tahmin edilmişti (kullanıcının review'ından sonra revize), gerçek harcama bu aralığa yakın (backend cookie/grace/CSRF ~14h, frontend refresh/bootstrap ~7h, 17 Playwright dosyasının paylaşılan fixture'a geçişi + yeni session-persistence.spec.ts ~9h, INVALID_TOKEN_CODE düzeltmesi ~2h, dokümantasyon ~2h).

**Doğrulama:** `apps/api` lint/typecheck/build + 202 birim + 104 e2e testi (hepsi geçti). `apps/web` lint/typecheck/build + 67 Playwright testi (desktop 65 + mobile-375 2, hepsi geçti).

### Slice B — `RoomMember` üyelik modeli (2026-08-15, tamamlandı)
Plan üç turda onaylandı — kullanıcının review'ı her turda somut, gerekçeli bir boşluk buldu: (1) backfill'in NE yazacağı belirtilmemişti (üç-kaynaklı birleşime karar verildi, ADR-0009), (2) leave endpoint'i yoktu (eklendi, çekirdek odalar hariç), (3) keşfedilebilir liste sayfalanmamıştı (mesaj geçmişiyle AYNI cursor+limit deseni eklendi). İkinci turda iki ek not: `scope=all` da sayfalanmalı ya da somut tetikleyiciyle ertelenmeliydi (BACKLOG'a yazıldı) ve alfabetik sıralamanın M7b Slice E'ye açık bir bağımlılığı olmalıydı (o dosyaya yazıldı).

Bir Plan agent'ı kritik, önceden fark edilmemiş bir bug buldu: `handleConnection`'ın "sıfır oda" disconnect kontrolü üyelik-scoped sorguyla kişi-başı bir kill-switch'e dönüşüyordu (`register()`'dan ÖNCE çalıştığı için) — kaldırıldı, `'ready'` artık üyelikten bağımsız. Bu düzeltme test-altyapısı maliyetini ilk tahmin edilen 7-9 dosyadan ÇOK daha dara indirdi (sadece oda-SCOPED broadcast iddia eden testler açık üyelik satırı gerektirdi).

**Implementasyon sırasında bulunan ve düzeltilen 2 gerçek bug (kullanıcı review'ında değil, kendi test/build sürecimde):** (1) backfill'in okuma-yazma arasındaki pencerede paralel e2e worker'ların bir kullanıcıyı silmesi FK ihlaline yol açabiliyordu — `insertPairs` P2003'ü yakalayıp geçerli id'lere filtrelenmiş bir kez retry ediyor artık. (2) iki e2e testim ("idempotentlik sıfır YENİ satır" ve "ilk sayfa test odalarını içerir") paralel worker'lar/birikmiş yerel DB geçmişiyle yarış-güvenli değildi — `totp-backfill.e2e-spec.ts`'in satır-bazlı idempotentlik deseniyle ve cursor'ı tükenene kadar sayfalayan bir toplama deseniyle düzeltildi.

**Gerçek saat:** ~59-80h tahmin edilmişti, gerçek harcama bu aralığa yakın (şema+backfill ~8h, backend gateway/service/controller ~19h, backend testler ~11h, frontend ~11h, frontend testler ~5h, dokümantasyon ~2h, lint/flakiness düzeltmeleri ~3h).

**Doğrulama:** `apps/api` lint/typecheck/build + 209 birim + 111 e2e testi (iki üst üste koşu, flakiness yok). `apps/web` lint/typecheck/build + 70 Playwright testi (desktop 68 + mobile-375 2, hepsi geçti).

### Slice C — Self-servis moderatör atama + yetkisini kaldırma (2026-08-16, tamamlandı)
Plan bir turda onaylandı ama kullanıcının review'ı ilk taslağın gerçek bir tasarım hatasını buldu: "atama var, kaldırma yok, ama bu 'daha kötü' değil" gerekçesi YANLIŞTI — yetki-yükseltme yüzeyi genişliyordu (önce sadece founder'ın SQL erişimi atayabiliyordu, sonra HERHANGİ bir moderatör HERHANGİ birini tek çağrıyla atayabilecekti, geri alma yolu hâlâ sadece SQL). Kullanıcı iki seçenek sundu (demote eklemek ya da atamaya reauth eklemek), "hangisi bu ölçekte daha doğru, gerekçelendir" diye sordu — ikisinin FARKLI tehditlere karşı olduğu görülüp İKİSİ de eklendi: `revoke-moderator` (reversibilite, founder tek-kişilik darboğazını azaltır) VE assign'a `deleteAccount`'un reauth deseni (ele geçirilmiş bir oturumun kalıcı bir arka kapı — puppet moderatör hesabı — açamaması için, revoke SONRADAN temizler ama reauth ÖNCEDEN engeller). Bir Plan agent'ı ayrıca gerçek bir düzeltme buldu: idempotent no-op'ta (zaten-moderatör/zaten-user) audit satırı ATLAMAK yanlıştı — `liftMute`'un kendi emsali her zaman yazıyor, düzeltildi.

**Implementasyon sırasında bulunan ve düzeltilen 1 gerçek bug (kullanıcı review'ında değil, kendi e2e sürecimde):** "son moderatör kendini düşüremez" testi paylaşılan e2e DB'sindeki GERÇEK moderatör sayısına (`role='moderator'` toplam satır) bağımlıydı — Slice B'nin backfill-idempotentlik dersiyle AYNI yarış-güvensizliği. Düzeltme: bu tam sınır zaten `moderator-role.service.spec.ts`'te kontrollü bir mock'la deterministik kanıtlanıyor, e2e testi SADECE deterministik olan tarafı (başka bir moderatör varken kendini düşürmek her zaman çalışır) doğrulayacak şekilde yeniden yazıldı.

**Gerçek saat:** ~13-16h (backend AuthService refactor+servis+controller+WS ~5h, backend testler ~4h, frontend ~2h, frontend testler ~1.5h, dokümantasyon ~1h, DB-pollution test düzeltmesi ~1h) — milestone dosyasının orijinal 7-9h tahminini kullanıcının review'ında bulunan asimetri riski nedeniyle aştı.

**Doğrulama:** `apps/api` lint/typecheck/build + 233 birim + 122 e2e testi (iki üst üste koşu, flakiness yok). `apps/web` lint/typecheck/build + 75 Playwright testi (desktop 73 + mobile-375 2, hepsi geçti).

**CI'da bulunan ve düzeltilen 3. gerçek bug — aynı zamanda planın en riskli bilinmeyeninin GERÇEK KANITI.** `apps/web/e2e-fullstack/` (mock'suz, gerçek `apps/api`+Postgres'e karşı çalışan süit) CI'da iki test kırdı: `invite-issuance.spec.ts` ve `message-round-trip.spec.ts` — ikisi de `page.reload()` sonrası TEKRAR login yapmaya çalışıyordu, artık bulunamayan `getByLabel("e-posta")`'da timeout aldı. Kök neden bug DEĞİL: bu testlerin "reload = çıkış" varsayımı Slice A'yla birlikte geçersiz oldu — reload sonrası oturum artık GERÇEKTEN açık kalıyor. Diğer dört fullstack testi (delete-account, message-editing, room-switching, ws-reconnect-backfill) hiç reload etmediği için etkilenmedi; süitin tamamı (`e2e/` + `e2e-fullstack/`) `.reload()`/yeni-context için TEKRAR tarandı, başka hiçbir yerde bu varsayım yok (diğer `newContext()` kullanımları hep GERÇEKTEN farklı kullanıcılar/oturumlar, aynı oturumun yeniden-girişi değil). Her iki dosya da tekrar-login yerine "oturum hâlâ açık" doğrulamasına güncellendi (`e2e/session-persistence.spec.ts`'le aynı desen).

Bu, sadece bir test düzeltmesi değil — **planın kendi "Bulgu" bölümünün en riskli, doğrulanmamış varsayımının (localhost'ta `SameSite=None;Secure` cookie'nin cross-origin round-trip yapması) gerçek bir backend + gerçek bir Postgres + gerçek iki farklı port (3000→3001) ile KANITLANMASI.** Düzeltme sonrası her iki test de local'de `apps/api`'nin production build'i (`start:prod`) + `apps/web`'in `next start`'ına karşı ÇALIŞTIRILDI (mock yok) — ikisi de GEÇTİ, cookie tarayıcıda gerçekten set edildi ve reload sonrası gerçekten geri gönderildi. Manuel tarayıcı doğrulaması maddesi (aşağıdaki founder-işi listesinde) bu yüzden artık sadece bir DevTools gözle-kontrolüne indirgeniyor, mekanizmanın ÇALIŞIP ÇALIŞMADIĞI sorusu değil.

**Çıktı:** Dal `m7a/slice-a-session-persistence`, `docs/500-user-scope-review` dalının ÜSTÜNE kurulu (o dal henüz main'e merge edilmedi) — bu PR'ın merge sırası o dala bağımlı.
- 98-131 saatlik çekirdek tahmin GERÇEKÇİ ama ESNEK DEĞİL — bu projenin kendi geçmişi (CI env-var per-job tuzağı, CRLF/.gitignore sorunu, lint-masking bug'ı gibi) gösteriyor ki gerçek süre planlanandan sapabilir. +%20-25 tampon önerilir (gerçekçi aralık: 120-165 saat, 4-5.5 hafta).
- Faz 1 açılışının M7b'nin HİÇBİR kalemini beklemediği varsayımı, moderasyon itirazı/zalgo koruması gibi kalemlerin gerçekten Faz 2'ye kadar bekleyebileceğine dayanıyor — eğer Faz 1'in ilk haftalarında beklenenden daha sert bir moderasyon vakası çıkarsa, bu kalemler erken çekilebilir (plan katı değil, gerçek veriye göre esner).

## Plan notları
*(implementasyon sırasında doldurulur)*
