# M7a — Kapı Açma Eşiği (500'e Ölçeklenme, Faz 0)

**✅ TAMAMLANDI (2026-08-19).** Tüm kod dilimleri (A-J) + tüm AC'ler kapandı. Tek kalıntı: `docs/BACKLOG.md` A18 (Postgres RAM/CPU/depolama, Render metrik paneli paket yükseltmesi gerektirdiği için ölçülemedi) — somut tetikleyiciyle (50+ gerçek kullanıcı YA DA gözlemlenen yavaşlama/timeout) bilerek ertelendi, Faz 1'in açılışını ENGELLEMİYOR. Sıradaki milestone kararı: M7b (cila) ya da M8.

**2026-08-26 — KRİTİK production regresyonu bulundu ve düzeltildi (Slice A, kod tarafı TAMAMLANDI).** Production'da F5 sonrası oturum düşüyordu (CSRF çerezi cross-hostname `document.cookie` ile okunamıyordu — kod M7a Slice A'dan beri hep böyleydi, sadece localhost'ta port-farkı yüzünden maskeleniyordu). Kalıcı düzeltme API'nin `api.koqep.com`'a taşınmasına bağlı — founder-task listesine eklendi, henüz tamamlanmadı. Detay: "Slice A düzeltmesi" Plan notları.

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
- [x] `RoomMember` üyelik modeli var; bir mesaj SADECE o odanın üyelerine broadcast ediliyor (bugünkü gibi TÜM bağlı kullanıcılara değil). *(2026-08-15, Slice B tamamlandı — bkz. Plan notları. Bu satır o zaman işaretlenmemiş kalmıştı, Slice J'nin milestone-kapatma turunda düzeltildi.)*
- [x] İkinci bir moderatör self-servis (elle SQL olmadan) atanabiliyor. *(2026-08-16, Slice C tamamlandı — bkz. Plan notları)*
- [x] Şifre gücü kontrolü (min uzunluk zaten var + HaveIBeenPwned k-anonymity) VE hesap-bazlı brute-force kilitlenmesi var. *(2026-08-18, Slice F tamamlandı — bkz. Plan notları)*
- [x] `/` bir landing/onboarding sayfası — davet kodu olan biri bağlamsız bir login formuyla karşılaşmıyor. *(2026-08-19, Slice G tamamlandı — bkz. Plan notları)*
- [x] ToS/Gizlilik'in EN ve TR ayrı sürümleri var, hangisi görüneceği seçilebiliyor (hukuki metnin kendisi founder'ın işi, sadece versiyon-seçme sayfası kod). *(2026-08-19, Slice G tamamlandı — bkz. Plan notları)*
- [x] Founder kendi DB'sinden DAU/kişi-başı-mesaj/gün-1-gün-7-dönüş/oda-aktivitesi sorgularını çalıştırabiliyor (dokümante edilmiş SQL, `docs/RUNBOOK.md`'ye eklenir). *(2026-08-19, Slice H tamamlandı — bkz. Plan notları)*
- [x] Gerçekçi bir yük testi (en az 300-500 eşzamanlı bağlantı, gerçek gecikme/bellek ölçümüyle) hatasız geçiyor, sonuçlar dokümante edildi. *(2026-08-19, Slice I+J tamamlandı — `Room.lastActivityAt` row-contention düzeltmesi + `connection_limit=30` (Faz 1/2'nin gerçekçi ölçeğinde 100-150 bağlantıda neredeyse sıfır hata). Founder `connection_limit=30`'u production `DATABASE_URL`'ine ekledi, deploy etti, doğruladı — bu satırın kod+config tarafı TAMAMLANDI. 500-bağlantılık senkron aşırı-burst senaryosu local'de tam temiz değildi ama bu, Render'ın gerçek Postgres kapasitesiyle local Docker'ın kaynak tavanı arasındaki farktan kaynaklanıyor, kabul edilen bir kalıntı risk — bkz. Plan notları.)*
- [x] Postgres plan kapasitesi (RAM/bağlantı/depolama) 500 kullanıcı için Render dashboard'undan doğrulandı (founder'ın işi, kod değil). *(`max_connections=100` (Basic-256mb, <8GB RAM kategorisi) Render'ın resmi dokümantasyonundan DOĞRULANDI, `connection_limit=30` rahat bir marjla altında — bkz. A17. RAM/CPU/depolama kısmı Render'ın detaylı metrik panelinin paket yükseltmesi gerektirmesi nedeniyle ÖLÇÜLEMEDİ — sessizce "yeterli" denmedi, somut bir tetikleyiciyle `docs/BACKLOG.md` A18'e ertelendi (gerçek kullanıcı 50'yi geçince YA DA yavaşlama/timeout gözlemlenirse paket yükseltilip kontrol edilir). Bu maddenin kapsamı bu şekilde tamamlandı kabul ediliyor.)*

## Tasks — kod dilimleri (Claude uygular, her biri kendi plan-modu turu)

- [x] **Slice A — Oturum kalıcılığı (httpOnly cookie + CSRF).** ~16-24 saat tahmin edilmişti, gerçek ~29-38h + ~2h düzeltme turu (bkz. Plan notları). `ADR-0002`'nin kendi "Decision" bölümünün ASLA tamamlanmamış mekanizması: `apps/web/app/page.tsx`'in bellek-içi token state'i httpOnly cookie'ye taşınır. **CSRF koruması şart** — bearer-token-in-header'ın doğal olarak sahip olmadığı bir risk, cookie'ye geçince kazanılıyor (SameSite politikası + state-changing isteklerde CSRF token). Refresh-token rotasyonu zaten var (ADR-0002), cookie'ye taşınması bunu bozmamalı. Mobil-uyumluluk hâlâ korunmalı — ADR-0002'nin kendi çözümü zaten bunu öngörmüş ("web istemcisi için httpOnly cookie, API'nin kendisi cookie-agnostic") — API bearer-token kabul etmeye devam eder, sadece WEB istemcisi artık cookie kullanır. **Tam gerçekleşen tasarım ADR-0002 Addendum'da** — SADECE refresh token cookie'ye taşındı, access token bearer'da kaldı (WS gateway + jwt-auth.guard.ts'e hiç dokunulmadı). **2026-08-26: KRİTİK bir production regresyonu bulundu ve düzeltildi — bkz. "Slice A düzeltmesi" Plan notları.** Orijinal doğrulama (satır 145'te belgeli) sadece FARKLI PORT (localhost:3000/3001) ile yapılmıştı, gerçek farklı HOSTNAME (production'da koqep.com/koqep.onrender.com) hiç test edilmemişti — CSRF çerezi host-only olduğu için production'da her `/auth/refresh` 403 dönüyordu.
- [x] **Slice B — `RoomMember` üyelik modeli + üyelik-farkında broadcast.** ~35-45 saat tahmin edilmişti, gerçek ~59-80h (bkz. Plan notları — kullanıcının review'ında bulunan üç gerçek boşluk: backfill içeriği, leave endpoint'i, sayfalama). Yeni migration (`RoomMember` tablosu), mevcut kullanıcılar için üç-kaynaklı backfill (çekirdek odalar × tüm kullanıcılar + oda kurucuları + gerçek mesaj-katılımcıları — ADR-0009), `messages.gateway.ts`'in `handleConnection`'ı SADECE üye olunan odalara katılıyor, oda oluşturma otomatik üyelik ekliyor, `RoomsService.listRooms` "benim odalarım"/"keşfedilebilir odalar"/"tümü" (moderasyon) ayrımı + join/leave endpoint'leri kazandı. **Tasarım yüzeyi** M10 Faz 1'in hafif kararıyla aynı plan-modu turunda çözüldü (switcher görsel olarak değişmedi, keşif ayrı yeni bir panel).
- [x] **Slice C — Self-servis moderatör atama + yetkisini kaldırma.** ~7-9 saat tahmin edilmişti, gerçek ~13-16h (bkz. Plan notları — kullanıcının review'ında bulunan asimetri riski: atama var, kaldırma yoksa yetki-yükseltme yüzeyi genişler). `POST /moderation/users/assign-moderator` (şifre+opsiyonel TOTP reauth) + `/revoke-moderator` (reauth yok) — `ModeratorGuard` zaten vardı, iki yeni endpoint + `AuthService`'ten çıkarılan reauth mantığı. *(Rate limit gözden geçirmesi bu dilimden ÇIKARILDI — `M7b-scale-polish.md`'ye taşındı, gerçek Faz 1 trafik verisi gerektirdiği için Faz 0'da anlamlı yapılamaz.)*
- [x] **Slice F — Hesap sertleştirme (şifre gücü + brute-force kilidi).** ~10-14 saat tahmin edilmişti, gerçek ~18-22h (bkz. Plan notları — kullanıcının review'ında bulunan dört gerçek boşluk: şifre-sıfırlama kilidi temizlemiyordu, meşru kullanıcı hiç sinyal almıyordu, bildirim e-postası pencereler-arası spam'e açıktı, await edilen e-posta gönderimi zamanlama-tabanlı bir enumeration oracle'ı açıyordu). `PasswordPolicyService` (HaveIBeenPwned k-anonymity, düz `fetch`, fail-open) + `User.failedLoginCount`/`lockedUntil`/`lockoutNotifiedAt` (hesap-bazlı kilit, `mutedUntil`'in aynı şekli).
- [x] **Slice G — Landing/onboarding sayfası + hukuki EN/TR versiyon seçimi.** ~14-18 saat tahmin edilmişti, gerçek ~5-6h (bkz. Plan notları — BACKLOG'un "küçük kapsam" talimatı sayesinde en ucuz tasarım seçildi: ayrı route/state yok, mevcut `AuthView`'ın üstüne bir tanıtım bloğu). ToS/Gizlilik EN/TR versiyon seçme sayfaları (hukuki metnin KENDİSİ founder'ın işi).
- [x] **Slice H — Ürün analitiği (SQL sorguları).** ~6-8 saat tahmin edilmişti, gerçek ~4-5h (bkz. Plan notları — kullanıcının review'ında AC'nin kelimesi kelimesine listelemediği ama dilimin kendi motivasyonundan doğan iki gerçek boşluk bulundu: davet ağacı + moderasyon yükü ölçülmüyordu). Dashboard DEĞİL, `docs/RUNBOOK.md`'ye eklenen dokümante edilmiş SQL sorguları (DAU, kişi-başı mesaj, gün-1/gün-7 dönüş, oda-aktivitesi, davet ağacı, moderasyon yükü) — üçüncü parti analitik YOK (gizlilik duruşuyla tutarlı). *(Geri bildirim/duyuru bu dilimden ÇIKARILDI — `M7b-scale-polish.md`'ye taşındı, kapı-açma engelleyicisi değil.)*
- [x] **Slice I — Yük testi/kapasite doğrulaması.** ~10-13 saat tahmin edilmişti, gerçek ~7-8h (bkz. Plan notları). `apps/api/test/load/ws-load-test.ts` genişletildi (300-500 bağlantı, sunucu+client AYRI process, `pidusage` ile gerçek RSS, marker-tabanlı gerçek gecikme) VE GERÇEKTEN çalıştırıldı — **sonuç: AC'nin "hatasız geçiyor" şartı karşılanmadı**, 500 bağlantıda `MessagesService.sendMessage`'ın `Room.lastActivityAt` satır kilidinde çakışma bulundu (%12 hata, p50 ~5.5sn gecikme). Kullanıcının kararıyla bu dilim bilgiyi ÖLÇMEK+DOKÜMANTE ETMEK ile sınırlı tutuldu — kök nedenin düzeltilmesi (transaction yeniden tasarımı) BACKLOG A17'ye somut tetikleyiciyle açıldı, ayrı bir plan-modu turu gerektiriyor. *(Türkçe→İngilizce UI bitirme (A15) bu dilimden ÇIKARILDI — `M7b-scale-polish.md`'ye taşındı, kapı-açma engelleyicisi değil, kimlik-tutarlılığı Faz 3'e kadar bekleyebilir.)*
- [x] **Slice J — `MessagesService.sendMessage`'ın row-contention'ını düzelt (A17).** Saat tahmin edilmedi (henüz planlanmamıştı, gerçek ~5-6h). `Room.lastActivityAt` güncellemesi transaction'dan çıkarıldı + ateşle-unut + 30sn debounce (bkz. Plan notları) — GERÇEK yük testiyle doğrulandı. Kod düzeltmesi kendi başına yeterli değildi, `connection_limit=30` da gerekti — founder production `DATABASE_URL`'ine ekleyip deploy etti, çalıştığını doğruladı (2026-08-19). Render Postgres'in Basic-256mb planının `max_connections`'ının (100, resmi dokümantasyondan doğrulandı) bunun rahatça altında olduğu teyit edildi. **Slice J TAM ANLAMIYLA TAMAMLANDI.**

## Tasks — founder'ın kendi eliyle yapacağı işler
- [x] **Slice J'nin tamamlayıcısı — production `DATABASE_URL`'ine `?connection_limit=30` ekle.** *(2026-08-19 — founder ekledi, deploy etti, siteyi test etti, çalışıyor. `max_connections=100` (Basic-256mb) doğrulaması ile birlikte güvenli olduğu teyit edildi.)*
- [x] Render Postgres planının gerçek RAM/CPU/depolama rakamlarını dashboard'dan doğrula, 500 kullanıcı için yeterli mi karar ver (gerekirse yükselt) — Faz 0'da, Faz 1 açılmadan. *(Bağlantı-limiti kısmı doğrulandı — `max_connections=100`, resmi Render dokümantasyonundan. RAM/CPU/depolama kısmı Render'ın detaylı metrik paneli paket yükseltmesi gerektirdiği için ÖLÇÜLEMEDİ — `docs/BACKLOG.md` A18'e somut tetikleyiciyle (gerçek kullanıcı 50'yi geçince YA DA yavaşlama/timeout gözlemlenirse) ertelendi, sessizce bırakılmadı.)*
- [ ] Slice I/J'nin yük testi sonuçlarını gözden geçir, ADR-0003'ün "ne zaman Redis+ikinci instance" eşiğinin gerçekten geldiğine karar ver.
- [ ] Yeni aylık maliyet tahminini gerçek Render/Postgres faturasıyla doğrula ($50/mo bütçe ADR-0002'de zaten 600-kullanıcı için varsayılmıştı — muhtemelen hâlâ yeterli, ama doğrulanmadı).
- [ ] ToS/Gizlilik'in EN ve TR hukuki metnini yazdır (Slice A'dan zaten bekleyen iş, şimdi iki dilde).
- [ ] Avukata ek soru: iki dil sürümü çelişirse hangisi bağlayıcı? *(hâlâ AÇIK — gizlilik politikası/kullanım şartları TR+EN metinleri 2026-08-25'te yazıldı, ama bu madde bilerek "henüz kesinleşmedi" notuyla sayfada bırakıldı.)*
- [ ] **KRİTİK, Slice A düzeltmesinin ön koşulu — Render'da `koqep-api` servisine custom domain `api.koqep.com` ekle, Cloudflare DNS'te işaretle, SSL doğrulamasını bekle.** *(2026-08-26 — CSRF production regresyonunun kalıcı düzeltmesi için gerekli, bkz. "Slice A düzeltmesi" Plan notları. Kod tarafı zaten hazır/deploy edilebilir, sadece bu adım eksik.)*
- [ ] Vercel'de `NEXT_PUBLIC_API_URL`'i `https://api.koqep.com`'a güncelle, web'i yeniden deploy et (yukarıdaki maddeden SONRA).
- [ ] Render'da `WEB_ORIGIN`'in hâlâ `https://koqep.com` (kanonik, www'suz) olduğunu doğrula — değişmesi gerekmiyor, kod zaten bu değerden `.koqep.com`'u türetiyor.
- [ ] Tüm adımlar bitince production'da gerçek login → F5 döngüsüyle doğrula (oturum artık düşmemeli).
- [ ] **Host-header allowlist middleware'i ekle** — bugün `koqep.onrender.com`'a
      doğrudan (tarayıcı dışı, curl/başka bir sunucu) geçerli bir Bearer
      token'la gitmek `api.koqep.com` ile birebir aynı çalışıyor, CORS bunu
      engellemiyor (sadece tarayıcı-kaynaklı istekleri kapsıyor), CSRF
      double-submit kontrolü de sadece `/auth/refresh`+`/auth/logout`'un
      çerez akışını kapsıyor. **KOD ŞİMDİ yazılabilir ama YUKARIDAKİ domain
      taşıması TAMAMLANMADAN aktif edilemez** — production BUGÜN gerçekten
      `koqep.onrender.com` üzerinden çalışıyor, allowlist'i şimdi açmak
      kendi frontend'ini de reddeder. *(2026-08-29 kapsam turunda bulundu,
      `docs/BACKLOG.md`'nin "G." bölümü — detay orada.)*

## Risks
- ~~Slice B (`RoomMember`) en büyük ve en riskli dilim — mevcut "herkes her odada" davranışını KORUYARAK backfill etmek yanlış yapılırsa mevcut kullanıcılar odalarından "düşmüş" hissedebilir.~~ Slice B tamamlandı, üç-kaynaklı backfill union'ı (çekirdek + kurucu + gerçek katılımcı) + eşzamanlılığa dayanıklı insert (P2003 retry) ADR-0009'da belgeli.
- ~~Slice A (oturum) CSRF'i doğru kurmazsa YENİ bir güvenlik açığı açar — "sadece cookie'ye taşı" kadar basit değil, ayrı bir dikkat gerektiriyor.~~ Slice A tamamlandı, double-submit CSRF + grace-period tasarımı ADR-0002 Addendum'da belgeli.

## Plan notları

### Slice A — Oturum kalıcılığı (2026-08-14, tamamlandı)
Plan modunda üç Explore agent'ı (API auth mimarisi, web istemcisi token/WS/CORS/test yüzeyi, ADR-0002+THREAT-MODEL+ADR-supersession emsali — üçüncüsü oturum limitine takılıp yarım kaldı, kalan kısmı elle tamamlandı) ile araştırıldı. `ExitPlanMode`'da kullanıcının review'ı üç gerçek sorun buldu (plan onaylanmadan önce düzeltildi): (1) CSRF cookie'sinin `path:'/auth'` olması JS'in onu HİÇBİR sayfadan okuyamaması demekti (path `/` olmalıydı), (2) çoklu-sekme rotasyon-yarışı sebepsiz çıkışa yol açabilirdi (backend grace-period + `revokedByRotation` ayrımıyla çözüldü), (3) 14 Playwright dosyasına tekrar eden mock eklemek kök nedene inmiyordu (paylaşılan `e2e/support/auth-mocks.ts` ile çözüldü, bu repodaki İLK paylaşılan Playwright yardımcı modülü).

**Implementasyon sırasında bulunan ve düzeltilen 2. gerçek bug (kullanıcı review'ında değil, kendi Playwright süitimde):** ilk tasarım `authedPostJson`/`authedGetJson`'da HERHANGİ bir 401'de sessiz refresh-ve-tekrar-dene deniyordu — ama `/auth/delete-account` (yanlış şifre/TOTP) ve `/auth/totp/enable` (yanlış TOTP kodu) gibi authed endpoint'lerin KENDİ domain 401'leri de var, kod'suz düz string mesajlarla. Blanket retry bu gerçek hataları sessizce "oturum yenilenemedi" hatasına çeviriyordu — `delete-account.spec.ts`/`totp-settings.spec.ts`'in mevcut testleri bunu YAKALADI. Düzeltme: SADECE "token'ın kendisi geçersiz" anlamına gelen 401'ler (`jwt-auth.guard.ts`, `verifyAccessToken`, `deleteAccount`'ın P2025 dalı, `UsersService.getProfile`) artık `code:'INVALID_TOKEN'` taşıyor, frontend SADECE bu code'da retry deniyor — çıplak `status===401` değil.

**Gerçek saat:** ~29-38h tahmin edilmişti (kullanıcının review'ından sonra revize), gerçek harcama bu aralığa yakın (backend cookie/grace/CSRF ~14h, frontend refresh/bootstrap ~7h, 17 Playwright dosyasının paylaşılan fixture'a geçişi + yeni session-persistence.spec.ts ~9h, INVALID_TOKEN_CODE düzeltmesi ~2h, dokümantasyon ~2h).

**Doğrulama:** `apps/api` lint/typecheck/build + 202 birim + 104 e2e testi (hepsi geçti). `apps/web` lint/typecheck/build + 67 Playwright testi (desktop 65 + mobile-375 2, hepsi geçti).

### Slice A düzeltmesi — cross-hostname CSRF çerez okuma açığı (2026-08-26, tamamlandı, KRİTİK production regresyonu)

**Bulgu:** production'da F5/sayfa yenilemesi sonrası oturum düşüyordu — `/auth/refresh` her seferinde 403 "CSRF doğrulaması başarısız" dönüyordu. Kullanıcı "iki sekmeyle test edilmiş ve doğrulanmıştı" dediği için önce sonradan giren bir commit'in kırdığı düşünülüp M7a Slice A'dan main'e kadar `auth-cookie.util.ts`/`auth.controller.ts`/`main.ts`/`page.tsx`/`lib/api.ts`/migration'lar git log ile tek tek tarandı — **hiçbiri hiç değişmemiş** (tek istisna M6b'nin main.ts'e eklediği, sonra temizlenen `/health`'e özel geçici debug middleware'i, CORS'a hiç dokunmuyor). `session-persistence.spec.ts` (frontend, tamamen mock) ve `auth-signup-login.e2e-spec.ts`'in Set-Cookie testleri (backend, in-process Supertest) ikisi de yeşildi ama YAPISAL OLARAK bu sınıf bug'ı yakalayamazlardı — ikisi de gerçek tarayıcı + gerçek farklı hostname yolundan hiç geçmiyor.

**Gerçek kök neden:** `buildCsrfCookieOptions()`'ın ürettiği `koqep_csrf` çerezi `domain` attribute'u OLMADAN (host-only) üretiliyordu. Production'da web `koqep.com`'da, API `koqep.onrender.com`'da — kullanıcının kendisi DevTools'tan doğruladı (403'ün kendisi + API domaini). RFC 6265 çerez eşleştirmesi PORT'u değil sadece HOSTNAME'i baz alır — `apps/web/lib/api.ts`'in `document.cookie` okuması (`readCookie`) bu yüzden `koqep.onrender.com`'a scope'lu bir çerezi ASLA göremiyordu, `X-Csrf-Token` header'ı hiç gönderilmiyordu. Yerel geliştirmede bug hiç görünmedi çünkü `localhost:3000`/`localhost:3001` FARKLI PORT ama AYNI HOSTNAME — M7a Slice A'nın kendi doğrulaması (yukarıdaki Slice A notunun "gerçek iki farklı port (3000→3001)" cümlesi) tam olarak bunu kanıtlıyor: doğrulama gerçek farklı HOSTNAME ile hiç yapılmamıştı, sadece farklı PORT ile. **Bug M7a Slice A'nın kendi ilk implementasyonundan beri vardı — sonradan giren bir commit'in kırdığı bir şey değil.**

**Kullanıcının onayladığı çözüm:** API, `koqep.com`'un alt-domain'ine taşınacak (`api.koqep.com`, Render custom domain + mevcut Cloudflare DNS). CSRF çerezine `Domain=.koqep.com` eklenince `document.cookie` bunu `koqep.com` sayfasından okuyabilecek.

**Uygulama:** `auth-cookie.util.ts`'e yeni saf fonksiyon `getCsrfCookieDomain(webOrigin)` — `allowed-origins.ts`'in www-strip deseniyle AYNI mantık, `WEB_ORIGIN`'den ortak domain'i (`.koqep.com`) türetiyor. `localhost`/IP/tek-etiketli hostname'lerde `undefined` (host-only, mevcut yerel/CI davranışı KORUNUYOR — CI'nin `WEB_ORIGIN=http://localhost:3000` set ettiği doğrulandı, `.github/workflows/ci.yml:29,98`). `buildCsrfCookieOptions()` artık `webOrigin` parametresi alıyor, `auth.controller.ts`'in `setAuthCookies`/`clearAuthCookies`'i `process.env.WEB_ORIGIN`'i geçiyor. `buildRefreshCookieOptions()` BİLEREK değişmedi — `httpOnly:true` olduğu için `document.cookie` sorunu zaten yok, `.koqep.com`'a genişletmek ileride BAŞKA bir subdomain XSS'e maruz kalırsa en hassas kimlik materyalini (refresh token) de sızdırma riski açardı; en dar scope bilinçli olarak korundu.

**İmplementasyon sırasında bulunan ve düzeltilen 1 gerçek hata (kendi sürecimde, kullanıcı review'ında değil):** `auth-cookie.util.spec.ts` zaten VARDI (parseCookieHeader/buildRefreshCookieOptions/buildClearCookieOptions/generateCsrfToken'ı kapsayan gerçek testlerle) — ilk `Write` çağrım dosyanın var olduğunu kontrol etmeden İÇERİĞİNİ TAMAMEN SİLİP kendi yeni testlerimle değiştirdi. `git diff --stat` ile fark edildi (beklenen "yeni dosya" değil "modified, 79 satır silinmiş" çıktı verdi), orijinal testler geri yüklenip yeni `getCsrfCookieDomain` describe bloğu YANINA eklendi, hiçbir mevcut test kaybolmadı.

**Deploy güvenliği:** kod tek başına zararsız — API hâlâ `koqep.onrender.com`'daysa üretilen `Domain=.koqep.com` çerezi o isteğe hiç eşleşmez (`.onrender.com`, `.koqep.com`'un parçası değil), bug bugünkü haliyle devam eder, KÖTÜLEŞMEZ. Asıl düzeltme API `api.koqep.com`'a taşınınca devreye girer (founder'ın kendi işi — Render custom domain + Cloudflare DNS + Vercel `NEXT_PUBLIC_API_URL` güncellemesi, henüz yapılmadı).

**Gerçek saat:** ~3-4h (kök neden araştırması — commit-commit git log taraması + RFC 6265 analizi ~1.5h, Plan agent + implementasyon ~1h, spec-dosyası-silme hatasının fark edilip düzeltilmesi ~0.5h, gerçek local Postgres'e karşı doğrulama + dokümantasyon ~1h).

**Doğrulama:** `apps/api` lint/typecheck/build temiz. Yeni `getCsrfCookieDomain` testleri dahil 317 birim testi (iki üst üste koşu) + genişletilen `auth-signup-login.e2e-spec.ts` dahil 151 e2e testi (gerçek local Postgres'e karşı, iki üst üste koşu) — hepsi geçti, flakiness yok. `apps/web`'e kod değişikliği yok; `session-persistence.spec.ts` + `legal-pages.spec.ts` regresyon kontrolü için yine de çalıştırıldı (9/9 geçti).

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

### Slice F — Hesap sertleştirme (2026-08-18, tamamlandı)
Plan bir Plan agent'ı turuyla onaylandı (TOTP'yi kilit sayacı dışında tutmak + kilitli-durum kodunu sızdırmamak — ikisi de gerçek, kritik güvenlik düzeltmeleriydi), sonra kullanıcının review'ı ÜÇ AYRI turda dört gerçek boşluk buldu: (1) `confirmPasswordReset` HIBP kontrolü ekliyordu ama kilit alanlarını temizlemiyordu — kilitli bir kullanıcı şifresini sıfırladıktan SONRA bile giremiyordu, e-posta erişimi kilit mekanizmasından daha güçlü bir doğrulama olduğu için temizlenmesi gerekiyordu; (2) meşru kullanıcı hiçbir sinyal almıyordu (ACCOUNT_LOCKED kodu sızdırılmıyordu, doğru ama sonuç: kullanıcı "neden giremiyorum" hiç öğrenemiyordu) — çözüm hesap sahibinin KENDİ e-postasına bildirim (saldırgan görmüyor, enumeration riski yok); (3) bu bildirim pencereler-arası (kilit süresi dolup yeniden tetiklenen döngüler) sınırsız spam'e açıktı — `lockoutNotifiedAt` + 12 saatlik soğuma penceresi eklendi; (4) EN KRİTİK — bildirim e-postası `await` ediliyordu, bu da Düzeltme 2'nin kapattığı enumeration oracle'ını FARKLI bir kanaldan (zamanlama) yeniden açıyordu: kilidi TETİKLEYEN istek bir Resend ağ turu bekleyeceği için diğer yanlış-şifre isteklerinden ölçülebilir şekilde yavaş dönerdi. Düzeltme: e-posta gönderimi `void` ile ateşle-unut yapıldı, deterministik bir promise-sıralaması testiyle kanıtlandı (wall-clock ölçümü DEĞİL).

**Implementasyon sırasında bulunan ve düzeltilen 1 gerçek gap (kullanıcı review'ında değil, kendi implementasyon sürecimde):** `PasswordPolicyService`'in yeni e2e-mock kuralını (testing.md) sadece `auth-signup-login.e2e-spec.ts`'e eklemeyi planlamıştım — gerçek `/auth/signup`/`/auth/password-reset/confirm` çağıran TÜM dosyaları `grep -rl` ile tararken 4 dosya DAHA (`mute`, `invites`, `delete-account`, `password-reset`) bulundu, hepsi düzeltildi. `.claude/rules/testing.md`'ye bu deneyim genel bir kural olarak eklendi (yeni bir mock kuralı eklerken TEK bir çağrı noktasına değil, servisin TÜM gerçek çağrı noktalarına grep atmak).

**Gerçek saat:** ~18-22h (backend PasswordPolicyService+AuthService+EmailService ~7h, backend testler ~7h, ripple-fix 5 dosya ~2h, frontend ~0.5h, dokümantasyon ~1.5h) — milestone dosyasının orijinal 10-14h tahminini kullanıcının review'ında bulunan dört gerçek boşluk nedeniyle aştı.

**Doğrulama:** `apps/api` lint/typecheck/build + 238 birim + 130 e2e testi (iki üst üste koşu, flakiness yok). `apps/web` lint/typecheck/build + 75 Playwright testi (mevcutlar değişmeden geçti, minLength eklemesi hiçbir mevcut testi bozmadı).

**CI'da bulunan ve düzeltilen 3. gerçek bug — aynı zamanda planın en riskli bilinmeyeninin GERÇEK KANITI.** `apps/web/e2e-fullstack/` (mock'suz, gerçek `apps/api`+Postgres'e karşı çalışan süit) CI'da iki test kırdı: `invite-issuance.spec.ts` ve `message-round-trip.spec.ts` — ikisi de `page.reload()` sonrası TEKRAR login yapmaya çalışıyordu, artık bulunamayan `getByLabel("e-posta")`'da timeout aldı. Kök neden bug DEĞİL: bu testlerin "reload = çıkış" varsayımı Slice A'yla birlikte geçersiz oldu — reload sonrası oturum artık GERÇEKTEN açık kalıyor. Diğer dört fullstack testi (delete-account, message-editing, room-switching, ws-reconnect-backfill) hiç reload etmediği için etkilenmedi; süitin tamamı (`e2e/` + `e2e-fullstack/`) `.reload()`/yeni-context için TEKRAR tarandı, başka hiçbir yerde bu varsayım yok (diğer `newContext()` kullanımları hep GERÇEKTEN farklı kullanıcılar/oturumlar, aynı oturumun yeniden-girişi değil). Her iki dosya da tekrar-login yerine "oturum hâlâ açık" doğrulamasına güncellendi (`e2e/session-persistence.spec.ts`'le aynı desen).

Bu, sadece bir test düzeltmesi değil — **planın kendi "Bulgu" bölümünün en riskli, doğrulanmamış varsayımının (localhost'ta `SameSite=None;Secure` cookie'nin cross-origin round-trip yapması) gerçek bir backend + gerçek bir Postgres + gerçek iki farklı port (3000→3001) ile KANITLANMASI.** Düzeltme sonrası her iki test de local'de `apps/api`'nin production build'i (`start:prod`) + `apps/web`'in `next start`'ına karşı ÇALIŞTIRILDI (mock yok) — ikisi de GEÇTİ, cookie tarayıcıda gerçekten set edildi ve reload sonrası gerçekten geri gönderildi. Manuel tarayıcı doğrulaması maddesi (aşağıdaki founder-işi listesinde) bu yüzden artık sadece bir DevTools gözle-kontrolüne indirgeniyor, mekanizmanın ÇALIŞIP ÇALIŞMADIĞI sorusu değil.

**Çıktı:** Dal `m7a/slice-a-session-persistence`, `docs/500-user-scope-review` dalının ÜSTÜNE kurulu (o dal henüz main'e merge edilmedi) — bu PR'ın merge sırası o dala bağımlı.
- 98-131 saatlik çekirdek tahmin GERÇEKÇİ ama ESNEK DEĞİL — bu projenin kendi geçmişi (CI env-var per-job tuzağı, CRLF/.gitignore sorunu, lint-masking bug'ı gibi) gösteriyor ki gerçek süre planlanandan sapabilir. +%20-25 tampon önerilir (gerçekçi aralık: 120-165 saat, 4-5.5 hafta).
- Faz 1 açılışının M7b'nin HİÇBİR kalemini beklemediği varsayımı, moderasyon itirazı/zalgo koruması gibi kalemlerin gerçekten Faz 2'ye kadar bekleyebileceğine dayanıyor — eğer Faz 1'in ilk haftalarında beklenenden daha sert bir moderasyon vakası çıkarsa, bu kalemler erken çekilebilir (plan katı değil, gerçek veriye göre esner).

### Slice G — Landing/onboarding + hukuki EN/TR versiyon seçimi (2026-08-19, tamamlandı)
Plan mode'da iki gerçek tasarım kararı kullanıcıya `AskUserQuestion` ile soruldu (araştırma tamamlandıktan sonra, iki makul yaklaşım arasında gerçek bir maliyet/kapsam farkı olduğu için): (1) landing yapısı — BACKLOG'un "küçük kapsam" talimatı (satır 555) ile milestone dosyasının orijinal `/app`'e taşıma fikri (satır 84) arasında çelişki vardı, kullanıcı ucuz seçeneği (tek ekran, `AuthView`'ın üstüne kısa tanıtım, ayrı route/state yok) seçti; (2) tanıtım metninin dili — M2 Slice G kararı (yeni bileşenler İngilizce) ile aynı ekrandaki Türkçe `AuthView` arasındaki gerilim, kullanıcı M2 kuralına sadık kalınmasını (İngilizce) seçti, bilinçli geçici iki-dillilik kabul edildi (BACKLOG B16 tetiklenince ikisi birlikte çevrilecek).

Uygulama: yeni `LandingIntro.tsx` (İngilizce, `lang="en"` — M6 Slice C'nin `DeleteAccountView.tsx` deseni), `page.tsx`'in `!accessToken` dalı artık `LandingIntro`+`AuthView`'ı ortak bir `<main>` içinde tutuyor, `AuthView.tsx`'in kök elemanı height/centering'i artık bu paylaşılan `<main>`'den alıyor (kendi `h-dvh`'ı kaldırıldı). `/privacy/en`+`/terms/en` — yeni i18n framework yok, App Router'ın nested-route deseniyle iki statik sayfa (mevcut TR sayfaların birebir ikizi), 4 sayfaya da dil-değiştirme linki + "hangi dil bağlayıcı" sorusunun henüz hukuki incelemeden geçmediğini belirten tek cümlelik bir not eklendi (`M7a-scale-gate.md:93`'ün açık sorusu sessizce atlanmadı). BACKLOG satır 585'in "landing/onboarding maddesiyle birlikte, ucuz" bundling'i — `ChatPanel.tsx`'in boş-oda metni oda adını içerecek şekilde küçük bir iyileştirme aldı (dil değişmedi, component zaten Türkçe).

**Gerçek saat:** ~5-6h (LandingIntro+page/AuthView restructuring+testler ~2.5h, EN legal sayfalar+dil-linkleri+testler ~2h, ChatPanel ~0.5h, dokümantasyon ~0.5h) — milestone dosyasının orijinal 14-18h tahminini kullanıcının seçtiği ucuz tasarımla belirgin şekilde altında kaldı (iki-adımlı landing+route değişikliği reddedilip en minimal seçenek onaylandığı için).

**Doğrulama:** `apps/web` lint/typecheck/build + 81 Playwright testi (desktop 79 + mobile-375 2, hepsi geçti — yeni `landing.spec.ts` (2 test) + genişletilmiş `legal-pages.spec.ts` (4 yeni test) dahil, mevcut hiçbir test kırılmadı). `apps/api`'ye bu dilimde hiç dokunulmadı.

### Slice H — Ürün analitiği (2026-08-19, tamamlandı)
Bir Explore agent'ı (tam şema + `RUNBOOK.md`'nin üslubu) + bir Plan agent'ı (taslak SQL tasarımının eleştirisi) ile araştırıldı. Plan agent'ı 4 gerçek düzeltme buldu: (1) kişi-başı-mesaj'da pay-payda tutarsız filtrelemesi (silinmiş hesapların orphan mesajları oranı şişiriyordu) — hem pay hem payda `authorId IS NOT NULL` ile filtrelendi; (2) DAU'nun etiketi "günlük aktif MESAJLAŞAN kullanıcı" olarak netleştirildi ve BACKLOG:577'nin varsaydığı "sessiz-okuyucu" sinyali oda-aktivitesi sorgusuna (`RoomMember` sayısı eksi distinct-yazar) eklendi — DAU tanım gereği mesaj-atanların alt kümesi olduğu için tek başına bu karşılaştırmayı sağlayamıyordu; (3) retention'ın "son cohort'lar yanıltıcı düşük görünür" kör noktası prose yerine SQL'in kendisinde bir `pencere_tamamlandi` boolean sütunuyla somutlaştırıldı; (4) timezone tuzağı — DB session UTC varsayılan, ürün TR kullanıcı kitlesine göre, gün-bazlı TÜM truncation'lar `Europe/Istanbul`'a çevrildi. Kendi son-taslak yazımımda ayrı bir gerçek hata buldum: oda-aktivitesi sorgusunda `RoomMember`+`Message`'ın aynı anda LEFT JOIN edilmesi bir fan-out yaratıyordu (bir odanın 10 üyesi+5 mesajı 50 satır üretirdi) — mesaj sayan her sütun `COUNT(DISTINCT ...)`'e çevrildi.

Kullanıcının review'ı, AC'nin kelimesi kelimesine listelediği 4 metrik yeterli olmadığını, dilimin kendi motivasyon cümlesine ("Faz 1'de veri gelmeye başlar başlamaz ölçülebilsin", projenin en riskli varsayımı "Discord'dan kaçanlar gerçekten daha az özellikli bir şey ister mi?") geri gidince iki gerçek boşluk bulundu: **davet ağacı** (§6.5 — davetçi başına kullanım oranı + `WITH RECURSIVE` ile davet zincirinin derinlik dağılımı, organik dallanma mı tek-seviye ölüm mü) ve **moderasyon yükü** (§6.6 — haftalık rapor hacmi, çözülme süresi, tekrar-raporlanan kullanıcı oranı). İkisi de zaten var olan alanlara (`Invite.issuedById`/`usedAt`/`revokedAt`, `User.inviterId`, `Report`/`ModerationAuditLog`) sorgu eklemekten fazlası değil, şema/kod değişikliği gerektirmedi.

**Implementasyon sırasında bulunan ve düzeltilen 1 gerçek bug (ne Plan agent'ının ne kullanıcının review'ında — sorguları gerçek local dev DB'ye karşı çalıştırırken):** çözülme-süresi sorgusunda `ROUND(double precision, integer)` Postgres'te yok (`PERCENTILE_CONT` `double precision` döndürüyor, `ROUND`'un 2-argümanlı hali sadece `numeric` kabul ediyor) — `::numeric` cast eklenerek düzeltildi. 6 sorgunun HEPSİ `docker-compose.yml`'in local Postgres'ine karşı gerçek veriyle (4008 kullanıcı/581 mesaj/1011 davet, önceki bir yük testinden kalma + moderasyon sorguları için elle eklenip test sonrası temizlenen 3 sentetik `Report` satırı) çalıştırılıp doğrulandı — fan-out düzeltmesi `general` odasında (3963 üye × 569 mesaj) somut olarak kanıtlandı (düzeltmeden önce yüzbinlerce, düzeltmeden sonra doğru 569 dönerdi).

**Gerçek saat:** ~4-5h (araştırma+Plan agent ~1h, SQL yazımı+RUNBOOK ~1.5h, kullanıcının review'ında bulunan 2 ek sorgu ~1h, gerçek DB'ye karşı doğrulama+bug düzeltmesi ~1h, dokümantasyon ~0.5h) — milestone dosyasının orijinal 6-8h tahmininin altında kaldı.

**Doğrulama:** kod değişikliği yok (`apps/api`/`apps/web` test koşumu gerekmedi). 6 sorgunun TAMAMI local dev DB'ye (docker-compose Postgres, migrate+mevcut veri) karşı gerçekten çalıştırıldı, 1 gerçek sözdizimi hatası bulunup düzeltildi.

### Slice I — Yük testi/kapasite doğrulaması (2026-08-19, tamamlandı — AC KISMEN karşılandı)
Bir Explore agent'ı `ws-load-test.ts`'in mevcut halini araştırdı: hâlâ M2 Slice D döneminden kalma (50 bağlantı), `RoomMember` seed'lemiyordu (M7a Slice B'den beri `handleConnection` SADECE üye olunan odalara join ediyor — sentetik kullanıcılar hiçbir odaya girmiyor, script broadcast'i hiç ölçmüyordu), gerçek bellek/gecikme ölçümü yoktu. Dosyayı kendim okuyunca KRİTİK bir ek bulgu: script kendi sunucusunu KENDİ İÇİNDE, aynı process'te açıyordu — `process.memoryUsage()` eklesem bile "sunucu belleği" değil "sunucu+500 client'ın karışık belleği" ölçerdim, production'da sunucu asla kendi içinde 500 client bağlantısı taşımıyor.

Kullanıcıya iki gerçek tasarım seçeneği sunuldu (`pidusage` dev-dependency vs. yeni bir internal HTTP endpoint) — **`pidusage`** seçildi (sadece devDependencies, sadece bu script kullanıyor, production'a gitmiyor). Script iki role ayrıldı: sunucu `dist/main.js` olarak AYRI bir child process'te (`PORT=4100`), driver kendi PrismaClient'ıyla seed/temizlik yapıyor, `pidusage(serverProcess.pid)` ile GERÇEK sunucu RSS'i örnekleniyor, her mesajın `content`'ine gömülen zaman damgasıyla GERÇEK gecikme ölçülüyor. `npm run test:load:ws` artık önce `npm run build` çalıştırıyor (ts-node'un soğuk derleme süresi yerine `start:prod`'un GERÇEKTEN çalıştırdığı komut kullanılıyor, hem hızlı hem production'a temsili).

**Implementasyon sırasında bulunan ve düzeltilen 1 gerçek bug (kullanıcı review'ında değil, gerçek 500-bağlantılık koşumda):** ilk taslak sadece socket'in `error`/`connect_error` event'lerini dinliyordu — NestJS'in varsayılan `WsExceptionsHandler`'ı, `WsException` OLMAYAN her hatayı (STATE.md'nin kurulu tuzağı) çağıran soketin kendisine AYRI bir `'exception'` event'i olarak emit ediyor. Bu dinleyici olmadan script sunucu-tarafı hataları HİÇ görmüyordu — ilk 500-bağlantılık koşum yanlışlıkla "hatasız" raporlandı, `'exception'` dinleyicisi eklenince gerçek tablo ortaya çıktı.

**GERÇEK 500-bağlantılık koşumun bulgusu (local Postgres, docker-compose):** 2000 mesajın 239'u (%12) `Internal server error` ile başarısız, gecikme p50 ~5.5sn/p99 ~6.9sn, ama 500/500 bağlantı başarılı ve peak sunucu RSS sadece ~327MB — **ARCHITECTURE.md'nin "ilk kırılacak yer WS bağlantı sayısı/bellek ayak izi" tahmininin AKSİNE**, bellek/bağlantı kapasitesi sorun değildi. Kök neden `messages.service.ts:75-101`'i okuyarak bulundu: `sendMessage`'ın `$transaction`'ı `Message.create`+`Room.update({lastActivityAt})`+`ReputationService.awardXp`'i TEK transaction'da yapıyor — sentetik kullanıcıların çoğu aynı küçük `CORE_ROOM_NAMES` setine yazdığı için yüzlerce eşzamanlı transaction AYNI `Room` satırının kilidinde çakışıyor. Prisma `connection_limit`'ini 50'ye çıkararak (geçici, commit edilmeyen bir doğrulama) hipotez test edildi — **İYİLEŞMEDİ, KÖTÜLEŞTİ** (p50 ~5.9sn) — bu, sorunun bağlantı-havuzu boyutu DEĞİL gerçek bir satır-kilidi çakışması olduğunu kanıtlıyor.

**Kullanıcının kararı:** bu dilim ÖLÇME+DOKÜMANTASYON ile sınırlı tutuldu, `sendMessage`'ın transaction'ını yeniden tasarlamak (ör. `lastActivityAt` güncellemesini debounce/transaction-dışı bir yola almak) AYRI, kendi plan-modu turu gerektiren bir backend değişikliği — ADR-0003'ün "measured bottleneck, not provisioned speculatively" ilkesine tam uygun. Bulgu `docs/BACKLOG.md` A17'ye somut tetikleyiciyle (Sentry'de gerçek hata artışı YA DA bir sonraki yük testinin %5+ hata göstermesi) açıldı, AC'nin ilgili maddesi (satır 75) BİLEREK açık bırakıldı — sessizce "geçti" denmedi.

**Gerçek saat:** ~7-8h (araştırma+tasarım ~1.5h, script yeniden yazımı ~2h, EADDRINUSE/ts-node-soğuk-başlangıç debug'ı ~1h, exception-listener bug'ının bulunup düzeltilmesi + connection_limit hipotezinin test edilmesi ~2h, dokümantasyon ~1.5h).

**Doğrulama:** `apps/api` lint/typecheck temiz. Script GERÇEKTEN 3 kez çalıştırıldı (10-bağlantılık smoke test + 500-bağlantılık varsayılan koşum + 500-bağlantılık `connection_limit=50` koşumu) — hepsi gerçek local Postgres'e (docker-compose) karşı, her koşum sonunda sentetik veri temizliği doğrulandı (`0 leftover synthetic users`).

### Slice I takibi — eşik doğrulama (2026-08-19)
Kullanıcının sorusu: A17'nin (row-contention) M7b'nin ilk dilimi mi olması gerektiği, yoksa M7a'nın kendi bitmemiş işi mi. İki karşı-argüman ortaya çıktı (ikisi de kabul edildi): (1) M7a Slice I'nin AC'si tam olarak bu yüzden açık bırakılmıştı — A17 zaten M7a'nın bitmemiş işi, M7b'nin "hiçbiri kapı açma koşulu değil" çerçevesine uymuyor; (2) test edilen 500 bağlantı, 50 gerçek kullanıcının organik üretebileceğinden çok daha agresif bir senkron patlamaydı — gerçek eşik bilinmeden karar verilemez. Karar: Slice I'nin doğal bir devamı olarak (yeni plan-modu turu gerekmedi), 50/100/150 bağlantıda yük testi tekrar çalıştırıldı.

**Gerçek ölçüm sonuçları** (local Postgres, docker-compose, aynı script):

| Bağlantı | Hata | Hata % | p50 gecikme | p95 gecikme | Peak RSS |
|---|---|---|---|---|---|
| 50 | 0/200 | %0 | 1508ms | 2504ms | 169MB |
| 100 | 5/400 | %1.25 | 3843ms | 5198ms | 210MB |
| 150 | 246/600 | %41 | 5404ms | 6172ms | 248MB |
| 500 (Slice I'nin kendi koşumu) | 239/2000 | %12 | 5533ms | 6879ms | 327MB |

**Dürüst bir gözlem:** hata ORANI monoton değil — 150, 500'den daha kötü çıktı. Bu muhtemelen art arda, aralıksız çalıştırılan testlerin AYNI local Postgres container'ında biriken kaynak baskısından ve script'in kendi rastgele jitter'ının (her koşuda gerçek eşzamanlılık farklı) getirdiği varyanstan kaynaklanıyor — "150 bağlantı 500'den kötü" diye genellenebilir bir sonuç DEĞİL, tek-seferlik bir gözlem olarak kaydediliyor. Buna karşın GECİKME sinyali monoton ve güvenilir (50→100→150→500 boyunca sürekli kötüleşiyor) — bu, tekrar-koşum gürültüsünden ETKİLENMEYEN, güvenilir bulgu.

**Sonuç, kullanıcının kendi karar kuralına göre:** "50-100 civarında zaten bozulma varsa M7a'nın kendi Slice J'si" — 50 bağlantıda p50 gecikme ZATEN 1.5 saniye (sıfır hata olsa bile bu, kabul edilebilir bir UX değil), 100 bağlantıda GERÇEK hatalar başlıyor (%1.25). Faz 1'in kendi ölçeğinde (50 kullanıcı) bir burst senaryosu (herkesin aynı anda bir duyuruya tepki vermesi gibi) sorunsuz olacağı GARANTİ EDİLEMEZ. Bu yüzden A17, M7b'ye ERTELENMEDİ — M7a'nın kendi Tasks listesine yeni bir **Slice J** olarak eklendi (yukarıya bakın), Faz 1 açılmadan bitmesi gereken bir kalem olarak işaretlendi. `docs/BACKLOG.md` A17 bu eşik verisiyle güncellendi.

### Slice J — `sendMessage` transaction yeniden tasarımı (2026-08-19, tamamlandı — AC TAM karşılandı)
Bir Explore agent'ı (tam transaction içeriği + `ReputationService`/`InvitesService`'in `tx` katılımı + `archiveSilentRooms`'un `lastActivityAt` kullanımı) + bir Plan agent'ı (taslak tasarımın eleştirisi) ile araştırıldı. Plan agent'ı 2 gerçek düzeltme buldu: (1) debounce'un optimistic set'i başarısız bir yazımda geri alınmıyordu — `catch` içinde `Map`'ten silinecek şekilde düzeltildi; (2) test flush'ı `Promise.resolve()` yerine `auth.service.spec.ts`'in kendi `setImmediate` emsaliyle yapılmalıydı (flaky risk). Ayrıca doğruladı: `editMessage` AYNI contention'a sahip DEĞİL (messageId-bazlı, cross-user hot-row yok) — sadece `sendMessage` düzeltildi. `archiveSilentRooms`'un `CORE_ROOM_NAMES`'i zaten sweep dışında tuttuğu bulundu — debounce'un çekirdek odalarda SIFIR doğruluk riski taşıdığı doğrulandı.

**Uygulama:** `Room.update({lastActivityAt})` transaction'dan tamamen çıkarıldı (Message.create+awardXp+grantInvites atomik kalmaya devam ediyor, ADR-0004). Transaction'dan SONRA `void this.touchRoomActivity(room.id)` — `AuthService.sendLockoutNotification`'ın (M7a Slice F) AYNI ateşle-unut deseni, in-memory 30sn debounce (`Map<roomId,timestamp>`, MessagesService'in tek-process ömrü boyunca — ADR-0003'ün "monolith-first" varsayımına bağlı, founder ikinci bir instance'a karar verirse debounce ZAYIFLAR ama kırılmaz).

**Kullanıcının onayladığı beklenmedik-sonuç kuralı devreye girdi:** implementasyon sonrası gerçek yük testinde (100 bağlantı) hâlâ hata bulundu (%8) — düzeltme YETERSIZDI, ikinci bir kök neden araştırması yapıldı (yeni bir Slice K açmak yerine, aynı turda). Bulunan: Prisma'nın VARSAYILAN connection pool'u (num_cpus×2+1) bu burst deseninde zaten dar boğazdı — `connection_limit`'i 30'a çıkarınca 100 bağlantıda hata SIFIRA indi (temiz, kontrollü bir A/B). Bu, Slice I'nin ERKEN bulgusunu ("connection_limit=50 kötüleştirdi, satır kilidi değil pool boyutu sorunu") kısmen YENİDEN DEĞERLENDİRDİ — o test Room.update HÂLÂ transaction'dayken yapılmıştı, pool'u büyütmek o zaman daha fazla transaction'ın AYNI satır kilidinde çakışmasına yol açıyordu (kötüleşme gerçekti ama nedeni farklıydı). Satır kilidi kalkınca pool boyutu GERÇEK, ayrı bir darboğaz olarak ortaya çıktı.

**500 bağlantıda `connection_limit` taraması (her koşum önce Postgres yeniden başlatılarak, temiz taban çizgisiyle):**

| `connection_limit` | Hata | Hata % | p50 gecikme |
|---|---|---|---|
| varsayılan (~9-17) | 450/2000 | %22.5 | 5833ms |
| 20 | 520/2000 | %26 | 5459ms |
| **50** | **198/2000** | **%9.9** | 5731ms |
| 100 | 290/2000 | %14.5 (+anormal davranış) | 6850ms |

100'e çıkarmak İYİLEŞTİRMEDİ — muhtemelen local Docker Postgres'in kendi `max_connections=100` tavanına çarpıldı, farklı bir hata modu. **30'da ayrıca test edilen daha gerçekçi ölçekler:** 100 bağlantı → 0/400 (%0), 150 bağlantı → 4/600 (%0.67) — neredeyse tamamen temiz. **500 bağlantı senaryosu** (500 kullanıcının 2 saniyede senkron 2000 mesaj göndermesi) hem local Docker kaynak tavanına hem Postgres'in `max_connections`'ına çarpıyor — bu ölçekte local ortamda tam "hatasız"a ulaşılamadı, gerçek Render Postgres planının kapasitesine bağlı (founder'ın zaten açık olan görevi).

**Tavsiye: `connection_limit=30`.** Faz 1/2'nin gerçekçi ölçeğinde (100-150) neredeyse sıfır hata, 500'de varsayılana göre belirgin iyileşme, Postgres'in tipik `max_connections=100` tavanının altında güvenli marj. Founder işleri listesine somut bir madde olarak eklendi — **kod tarafı TAMAMLANDI, config tarafı (production `DATABASE_URL`) founder'ın işi.**

**Dürüst metodoloji notu:** ardışık, soğumadan çalıştırılan test koşumları AYNI local Postgres container'ında biriken baskıdan gürültülü sonuçlar üretebiliyor (Slice I'nin eşik-takibinde de görülmüştü) — bu yüzden KESIN karşılaştırmalar için her koşumdan önce `docker compose restart postgres` ile temiz bir taban çizgisi sağlandı.

**Gerçek saat:** ~5-6h (araştırma+Plan agent ~1h, kod+testler ~2h, ilk yük testi doğrulaması+beklenmedik sonuç araştırması ~1.5h, connection_limit taraması+dokümantasyon ~1.5h).

**Doğrulama:** `apps/api` lint/typecheck temiz. 240 birim (2 yeni test: debounce + hata-izolasyonu) + 131 e2e (1 yeni test: `lastActivityAt` polling ile doğrulandı, kendi izole odasında — paylaşılan `CORE_ROOM_NAMES` debounce'undan etkilenmesin diye) — hepsi gerçek local Postgres'e karşı iki kez çalıştırıldı (bir kez `room-member-backfill`'in bilinen paralel-worker yarış koşulu flake'i görüldü, izole çalıştırılınca geçti, Slice J ile ilgisiz). Yük testi 100/150/500 bağlantıda + 4 farklı `connection_limit` değerinde GERÇEKTEN çalıştırıldı (yukarıdaki tablo).

**Kapanış (2026-08-19, aynı gün):** Founder `connection_limit=30`'u production `DATABASE_URL`'ine ekledi, deploy etti, siteyi test etti — çalışıyor. Render Postgres'in Basic-256mb planının `max_connections`'ı Render'ın resmi dokümantasyonundan doğrulandı — RAM'e göre kademeli (< 8GB → 100, 8-16GB → 200, 16-32GB → 400, ≥32GB → 500 bağlantı), Basic-256mb bu tabloda en alt kademede: **`max_connections=100`**. `connection_limit=30` bunun rahatça altında (~70 bağlantılık marj — driver/health-check/psql gibi diğer bağlantılara yer bırakıyor). Kaynak: [Create and Connect to Render Postgres](https://render.com/docs/postgresql-creating-connecting), [Flexible Plans for Render Postgres](https://render.com/docs/postgresql-refresh). **M7a'nın TÜM kod dilimleri (A-J) ve ilgili AC'leri artık tamamlandı** — kalan tek açık madde (satır 76'nın RAM/CPU/depolama kısmı) bağlantı-limitinden AYRI, daha geniş bir soru, founder'ın kendi dashboard incelemesini bekliyor.

## Plan notları
*(implementasyon sırasında doldurulur)*
