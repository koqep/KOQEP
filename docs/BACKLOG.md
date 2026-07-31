# KOQEP — Backlog

<!-- Bu dosya TODO.md DEĞİLDİR. Aktif işler docs/milestones/ içindedir.
     Burası "bir gün belki" havuzu + bilinçli olarak reddedilmiş fikirlerin mezarlığı.
     Claude bu dosyayı her session okumaz; sadece kapsam tartışırken okunur. -->

**Puanlama:** Etki 1–5 (5 = ürün bunsuz çalışmaz) · Maliyet S/M/L · Kova: `V1` `V1.1` `V2` `ASLA`

---

## 2026-07-30 — LANSMAN KARARI: "beta" değil, kapalı 1.0

M2 tamamen bitti (backend A-D + frontend E-G). M3'e geçmeden önce founder'ın
yeni bir lansman kararı var, aşağıdaki bu karara göre yapılan tam bir kapsam
denetiminin sonucu.

**Karar:** KOQEP "beta" olarak çıkmayacak — fonksiyonel olarak eksiksiz bir
1.0 olarak çıkacak, ama kapı dar: ilk sürüm 20-30 kişilik kapalı davetli bir
gruba açılacak. "Beta" etiketi yok, "kapalı topluluk" çerçevesi var.

**Yeni "V1'e girer mi" testi** (eskisinin yerine geçiyor, aşağıda gerekçesiyle
birlikte): *bu özellik olmadan, 20-30 kişilik kapalı bir toplulukta ürün
BOZUK ya da GÜVENSİZ hissettirir mi?* Eski `Karar kuralı`'ndaki "ilk 100
kullanıcıyı getirir mi" sorusu bir BÜYÜME kriteriydi — artık geçerli değil,
çünkü bu lansman büyüme hedeflemiyor. Bu, aşağıdaki birkaç maddenin eski
kovasını (V1 → V1.1) DEĞİŞTİRİYOR, sebebi büyüme gerekçesinin ortadan
kalkması, önem kaybetmeleri değil.

### Kova revizyonları (eski karar, yeni kritere göre değişti)
| # | Öğe | Eski kova | Yeni kova | Neden |
|---|---|---|---|---|
| B1 | Herkese açık ASCII profil sayfası | V1 | V1.1 | Tüm gerekçesi "davetiyeli platformun tek büyüme motoru" idi (bkz. tablo B1). Büyüme hedefi artık yok — 20-30 kişilik kapalı bir grup için dışa açık bir profil sayfası gereksiz, hatta username kararı netleşmeden inşa edilemez zaten. |
| B5 | `/now` — platform nabzı | V1 | M3-sonrası | "Boş oda problemi" M3'ün getirdiği kullanıcı-odaları riski — M3 gelmeden çözülecek bir problem yok (şu an sadece 2 çekirdek oda var, hepsi zaten "canlı"). M3 şipsin, o zaman tekrar değerlendir. |
| B10 | `Ctrl+K` komut paleti | V1 | V1.1 | Terminal komutlarına bağımlı (aşağıda V1.1'e kaydı) — komutlar olmadan palet neyi gösterecek? |
| A2 | Mesaj arama | V1 | V1.1 | Eski gerekçe büyük ölçek (100+ kullanıcı, aylarca mesaj) varsayıyordu. 20-30 kişi birkaç ayda scroll ile bulunabilecek hacimde mesaj biriktirir — aramanın yokluğu bu ölçekte "bozuk" hissettirmez. |
| A3 | Okundu durumu (multi-device) | V1 | V1.1 | Aynı gerekçe — DM/mention-ağırlıklı platformlarda kritik, herkese-açık oda-tabanlı sohbette daha az. `ReadCursor` şemada bile yok henüz (aşağıya bakın) — sonradan eklemek zannedildiği kadar ucuz değil ama DM gelene kadar acil de değil. |

### Kodda gerçek durum tespiti (2026-07-30, doğrudan okunarak doğrulandı)
Aşağıdaki liste, kullanıcının verdiği tam denetim listesine karşılık geliyor.
Her satır: **durum** (var/kısmi/yok, kodda doğrulandı) → **1.0 kararı** →
**milestone**.

**Yapısal boşluk**
- **Kullanıcı adı (username):** YOK — `User` modelinde sadece `email`
  (`apps/api/src/db/schema.prisma`, doğrulandı). Mesajlarda `authorEmail`
  gösteriliyor (Slice F'ten beri gerçekten UI'da render ediliyor — "sen" ya
  da email metni). **1.0 ZORUNLU.** 20-30 kişilik kapalı bir grupta bile
  herkesin herkesin e-postasını varsayılan olarak görmesi gerçek bir
  gizlilik sorunu — bu "cila eksik" değil, "bozuk hissettirir" testini
  geçiyor. Ayrıca veri modeline dokunuyor: şimdi (gerçek mesaj/kullanıcı
  hacmi yokken) ucuz, M3-M6 üstüne inşa edildikçe pahalanır. → **Yeni
  `M2.5` milestone'ının ilk slice'ı**, M3'ten önce.

**Spec'te olan ama hiç yapılmamış**
- **Markdown + kod blokları:** YOK — hiçbir markdown/sanitizer paketi kurulu
  değil (`apps/web/package.json` kontrol edildi), mesajlar düz metin olarak
  render ediliyor (React otomatik escape, `dangerouslySetInnerHTML` hiçbir
  yerde yok — yani şu an GÜVENSİZ değil, sadece çıplak). `REVIEW-BRIEF.md`
  markdown'ı bir açık soru olarak flag'lemiş ("XSS surface, hangi renderer,
  hangi sanitizer") ama `PRD.md`'nin nihai v1 scope'unda YOK — yani "taahhüt
  edilmiş kapsam" değil, "tartışılmış ama karara bağlanmamış" bir madde.
  Tam markdown (linkler, sanitization altyapısı) 1.0 blocker'ı değil, cila.
  **AMA** teknik bir kitleye günden güne kod parçası paylaştıracak bir
  platformda düz-metin-yapıştırılmış-kod gerçekten "eksik" hissettirir —
  ucuz bir orta yol var: sadece \`\`\` bloklarını monospace+arkaplan ile
  ayırmak (syntax highlighting yok, link/bold yok). **KISMİ 1.0** (sadece bu
  ucuz kısım), tam markdown → V1.1. → `M2.5` ya da `M4`.
- **Terminal komutları (`/help`, `/join`, `/whoami`, `/clear`):** YOK. Oda
  değiştirme zaten buton ile çalışıyor (Slice E) — komutlar bir UX cilası,
  fonksiyonel eksiklik değil. → **V1.1.**
- **Kullanıcı profili (bio, ASCII avatar, katılma tarihi, seviye, rozet):**
  YOK. Seviye/rozet zaten M4'ün (reputation) kapsamında ama M4'ün mevcut
  görev listesinde hiçbir UI/profil sayfası yok — sadece backend hesaplama.
  Minimal ihtiyaç (kullanıcı adının mesajlarda görünmesi) username kararının
  parçası, **1.0'a o yoldan zaten giriyor**. Tam profil sayfası (bio + ASCII
  avatar + rozet) cila → **V1.1**, muhtemelen yeni bir M7 ya da M4'e ek.
- **Durum (online/away/DND/invisible):** YOK, presence altyapısı hiç yok
  (`apps/api/src` içinde presence/online/typing için hiçbir kod bulunamadı —
  `ARCHITECTURE.md` presence'ı "in-process, kalıcı değil" diye tarif ediyor
  ama henüz hiç yazılmamış). İnce ayrımlar (away/DND/invisible) kesinlikle
  cila. → **V1.1.**
- **Presence + "kim yazıyor" göstergesi:** YOK, aynı gerekçe. → **V1.1.**
- **DM (birebir mesaj):** YOK — hiçbir `Conversation`/`DirectMessage` modeli
  yok. **Önemli bir tutarsızlık bulundu:** `docs/THREAT-MODEL.md` satır 10
  DM'in VAR OLDUĞUNU varsayarak yazılmış ("Harass another user via DM") ama
  DM hiç inşa edilmedi — doküman kodun önüne geçmiş. PRD'nin v1 scope'unda
  DM hiç geçmiyor (sadece "rooms" + "text messaging"). 20-30 kişilik, zaten
  aynı 2 çekirdek odada görünür şekilde konuşan bir grupta DM'in yokluğu
  "bozuk" hissettirmez — mahremiyet ihtiyacı bu ölçekte düşük. → **Sonraya
  ERTELE** (V1.1/yeni bir milestone). `THREAT-MODEL.md` satır 10'a "DM henüz
  yok" notu düşüldü (aşağıda, ayrı commit).
- **Bildirimler (mention, DM):** YOK, ikisi de yukarıdaki bağımlılıklara
  (username/DM) bağlı, doğal olarak sonraya kayıyor. → **V1.1.**
- **Mesaj arama:** yukarıdaki revizyon tablosuna bakın — **V1.1.**
- **Okundu durumu:** yukarıdaki revizyon tablosuna bakın. `ReadCursor` şemada
  bile yok (sadece `docs/DATA-MODEL.md`'de tarif edilmiş, hiç migration
  yok) — "tasarlandı ama kullanılmıyor" iddiası bile iyimser, henüz hiç
  tablo olarak var olmadı. → **V1.1.**
- **Geçmiş sayfalama (yukarı kaydırma):** **KISMİ** — backend zaten
  cursor-based sayfalama destekliyor (`GET /rooms/:name/messages?cursor=`,
  `nextCursor` dönüyor, `messages.controller.ts`/`messages.service.ts`
  doğrulandı) ama frontend hiç kullanmıyor, sadece ilk sayfayı çekip
  gösteriyor. Birkaç hafta sonra eski mesajlara hiç erişilememesi gerçekten
  "hafızasız" hissettirir, ve maliyet DÜŞÜK çünkü backend zaten hazır.
  **1.0 ZORUNLU** (düşük maliyet/gerçek orta-vadeli sorun oranı yüksek). →
  `M2.5`.
- **Sabitlenmiş mesaj, oda konusu, oda kuralları:** oda konusu zaten
  `PRD.md`'nin v1 scope'unda VE `M3` doc'unun kendi acceptance kriterinde
  var ("free-form topic") — değişiklik gerekmiyor, zaten kapsamda. Sabitlenmiş
  mesaj + oda kuralları cila → **V1.1.**
- **Geçici odalar (TTL):** zaten `B9`'da V1.1 olarak işaretli, değişmiyor.

**Hukuki / güvenlik (kullanıcının kendi çerçevesi: pazarlık payı yok)**
- **E-posta doğrulama:** YOK (`auth.service.ts`'de doğrulama/token mantığı
  yok, doğrulandı). Gerçek risk: davet kodu kimin elindeyse herhangi bir
  email ile kayıt olunabiliyor, sahiplik kontrol edilmiyor. **1.0 ZORUNLU.**
  → `M2.5` Slice B'de yapıldı (2026-07-31): `User.emailVerifiedAt` +
  `EmailVerificationToken`, signup artık doğrulanana kadar giriş
  yapılamıyor. **Resend-verification-email endpoint'i bilerek bu slice'a
  dahil edilmedi** — e-posta hiç ulaşmazsa founder Postgres konsolundan elle
  düzeltiyor (TOTP tam-kilitlenme kurtarmasıyla aynı desen). Somut
  tetikleyici (TOTP-kilitlenme kararındaki gibi belirsiz bırakılmadı): bu
  elle-düzeltme **(a)** ikinci kez gerekirse, ya da **(b)** M3 şipse —
  hangisi önce gelirse.
- **Hesap silme akışı:** YOK — `ADR-0005` anonimleştirme kararını zaten
  tanımlamış ama kullanıcının kendi tetikleyebileceği bir endpoint yok.
  KVKK/GDPR zorunluluğu. **1.0 ZORUNLU.** → `M2.5`.
- **Oturum/cihaz yönetimi:** YOK (liste UI'ı/endpoint'i), ama KISMİ koruma
  zaten var — `RefreshToken.revokedAt` alanı var ve şifre değişince tüm
  oturumlar iptal ediliyor (`docs/THREAT-MODEL.md` satır 11). Tam "hangi
  cihazlarda açığım" listesi KVKK zorunluluğu DEĞİL (unutulma hakkı/veri
  taşınabilirliği ister, oturum listesi UI'ı istemez), ve 20-30 kişilik
  GÜVENİLEN davetiyeli bir grupta hesap ele geçirme riski düşük. →
  **V1.1.**
- **Yaş sınırı politikası:** hiç konuşulmamış, doğru — ama bu bir POLİTİKA
  kararı, kod değil. KVKK'nın çocuk verisi hükümleri gerçek bir risk.
  **1.0 ZORUNLU ama neredeyse bedava** — ToS'a yaş şartı yazmak + signup'a
  bir onay kutusu eklemek (~1-2 saat), tam yaş doğrulama (kimlik kontrolü)
  bu ölçekte aşırı. → `M6`'nın ToS işine ek.
- **ToS + Gizlilik Politikası, 5651 log saklama:** zaten `M6`'da (ve rapor/
  moderasyon akışı `M5`'te) kapsanıyor, değişiklik gerekmiyor.

**Güvenilirlik**
- **Bağlantı kopması / mesaj boşluğu:** YOK — hiçbir reconnect-backfill
  mantığı yok (`apps/web` içinde `reconnect` için hiçbir kod bulunamadı,
  socket.io'nun varsayılan otomatik-yeniden-bağlanması transport'u
  onarıyor ama kaçırılan mesajları DOLDURMUYOR). **1.0 ZORUNLU** — mesaj
  kaybı sessizce olursa bu tam olarak "bozuk hissettirir" testinin
  tanımı. → `M2.5`.
- **Gönderim hatası + rate-limit geri bildirimi:** **KISMİ** — backend
  zaten `exception` WS event'i fırlatıyor rate limit aşılınca
  (`ws-throttler.guard.ts`, `messages-gateway.e2e-spec.ts`'te test edilmiş)
  ama frontend hiç dinlemiyor (doğrulandı, `apps/web`'de `exception`
  dinleyicisi yok). Tel zaten var, sadece UI dinlemiyor — ucuz bir
  düzeltme. **1.0 ZORUNLU**, düşük maliyet. → `M2.5` (WS güvenilirlik
  paketinin parçası).
- **Çift gönderim koruması:** YOK ama DOĞAL olarak kısmen korunuyor
  (`draft` state'i emit sonrası hemen temizleniyor, `canSend` butonu
  devre dışı bırakıyor) — sağlam değil ama 20-30 kişilik iyi niyetli bir
  grupta kaza sonucu çift mesaj "bozuk" hissettirmez, can sıkıcı olur.
  Ucuzsa (gönder butonunu "gönderiliyor" state'iyle disable etmek) aynı
  pakette bedavaya yakın eklenebilir. → **1.0, düşük öncelik**, `M2.5`.
- **Mesaj uzunluk sınırı geri bildirimi:** sınırın kendisi zaten var
  (`MAX_MESSAGE_LENGTH = 2000`, hem client hem server) ama aşılınca
  SESSİZCE hiçbir şey olmuyor (`if (content.length > MAX...) return;`).
  Ucuz düzeltme, aynı pakete eklenir. → `M2.5`.

**Moderasyon derinliği**
- **Rapor akışı, geçici susturma, moderatör denetim kaydı, çoklu-rapor
  tespiti:** TAMAMEN `M5`'in kendi acceptance kriterlerinde zaten var,
  zorunlu zaten. Değişiklik yok.
- **Davetçi hesap verebilirliği:** `BACKLOG.md`'de zaten `B15` olarak 5-etki/
  V1 işaretli ("bu senin en özgün moderasyon avantajın") AMA **gerçek bir
  boşluk bulundu: `M5`'in kendi görev listesinde hiç yok.** Bucket doğru,
  uygulama planı eksikti. `M5`'e task olarak eklendi (aşağıda, ayrı dosya
  değişikliği).

**Erişilebilirlik / Mobil**
- **Ekran okuyucu + kontrast:** `M6`'da "accessibility pass" zaten var ama
  gerçek kapsam muhtemelen hafife alınmış — şu an `apps/web` genelinde
  toplam 2 `aria-*` kullanımı var (ikisi de bu oturumda test hedefleme için
  eklendi, gerçek bir erişilebilirlik çalışması değil). `M6`'nın saat
  tahmini bunu yansıtacak şekilde yukarı revize edildi (aşağıda).
- **Klavye kısayolu keşfedilebilirliği:** terminal komutlarıyla aynı
  kategori, cila → **V1.1.**
- **Mobil tarayıcı uyumu:** hiç test edilmemiş, hiçbir responsive breakpoint
  class'ı yok (`sm:`/`md:`/`lg:` için 0 eşleşme, `apps/web/app` genelinde
  doğrulandı) — sabit `max-w-2xl` layout. Kullanıcı ilk grubun telefondan
  açacağını zaten belirtmiş — layout kırılırsa (örn. header'daki 5 buton +
  oda sekmeleri dar ekranda taşarsa) ürün gerçekten kullanılamaz hissettirir.
  **1.0 ZORUNLU.** → `M6`'ya eklendi.

**Operasyon**
- **Hata takibi, uptime izleme, yedek/geri yükleme:** zaten `M6`'da,
  değişiklik yok.
- **Durum sayfası:** `M6`'nın mevcut listesinde zaten YOK — bu doğru bir
  karar, teyit ediyorum: 20-30 kişilik bilinen bir grup için herkese açık
  bir durum sayfası gereksiz, bir sorun olunca kişisel bildirim yeterli. →
  **V1.1/asla**, eklenmedi.
- **Runbook ("gece 3'te ne yaparım"):** ucuz, `M6`'nın mevcut "backup/restore
  runbook" işinin doğal bir uzantısı, aynı görevin kapsamına genişletildi.

**Kimliğe uyan yeni fikirler:** hiçbiri by-definition zorunlu değil (yeni
fikirler, spec'te yoklar). Hepsi ya zaten `B`/`C` bölümünde bir kovaya sahip
(değişmedi, B1/B5/B10 hariç yukarıda), ya da yeni önerilerse aşağıdaki
karar kuralına göre V1.1/V2'ye gidiyor — hiçbiri bu denetimde V1'e terfi
etmedi. `/tutorial` özellikle: `A5` (onboarding akışı) zaten V1'de ve
zorunlu, ama "terminal-native `/tutorial` komutu" spesifik biçimi değil —
1.0 için basit bir "hoşgeldin + ilk mesajını yaz" onboarding'i yeterli, tam
interaktif tutorial `V1.1`.

### Yeni milestone: `M2.5 — Identity & Reliability Hardening`
Yukarıdaki 1.0-zorunlu maddelerin çoğu ne M3'ün ("kullanıcı odaları") ne
M4-M6'nın konusuna temiz oturuyor — hepsi "zaten inşa ettiğimizi gerçekten
sağlam yapmak" kategorisinde, yeni bir özellik yüzeyi değil. M3'ten önce,
`docs/milestones/M2.5-identity-reliability.md` olarak ayrı bir dosyada
detaylandırıldı: kullanıcı adı, e-posta doğrulama, hesap silme, WS
güvenilirlik paketi, geçmiş sayfalama, kısmi kod bloğu gösterimi.

### Saat tahmini revizyonu
Detay ve gerçekçilik kontrolü sohbet yanıtında — özet: mevcut M3-M6 tahmini
(93–144 saat) + yeni `M2.5` (52–78 saat) + `M5`/`M6` eklerinin saatleri
(kendi dosyalarında) ≈ **toplam 155–240 saat kalan iş**, 30 saat/hafta
bütçeyle **~5–8 hafta**.

### Karar kuralı (güncellendi)
Eski üç sorunun yerine, bu lansman için:

1. Bu olmadan, **20-30 kişilik kapalı bir toplulukta** ürün BOZUK ya da
   GÜVENSİZ hissettirir mi? Hayırsa 1.0 değildir — ne kadar iyi bir fikir
   olursa olsun.
2. Veri modeline dokunuyor mu? Dokunuyorsa VE 1.0-zorunlu değilse bile,
   "sonradan ekleme maliyeti şimdi mi düşük" sorusunu ayrıca sor (username
   gibi) — bazen "zorunlu değil ama şimdi yapmak çok daha ucuz" durumu olur.
3. Büyüme motoru mu, yoksa küçük-kapalı-grup deneyimini mi iyileştiriyor?
   Büyüme motoruysa (B1 gibi) bu lansımda önceliksiz — büyüme hedeflenmiyor.

Eski kuralın 2 ve 3. maddeleri ("başka platform kopyalar mı", "ürün çalışır
mı") hâlâ geçerli, aynen kalıyor.

---

## A. EKSİK ZORUNLULUKLAR — bunlar "özellik" değil, açık
Spec'inde yoklar ama olmadan ürün production'a çıkamaz. **Yeni fikir aramadan önce bunlar.**

| # | Öğe | Etki | Maliyet | Kova | Not |
|---|---|---|---|---|---|
| A1 | **TOTP kurtarma kodları** | 5 | S | V1 | Zorunlu TOTP + kurtarma yolu yok = kullanıcı kaybı garantili. En büyük destek yükü. |
| A2 | **Mesaj arama** | 5 | M | V1 | Aranamayan sohbet arşivi ölü arşivdir. Postgres FTS ile başla, Meilisearch'e sonra geç. |
| A3 | **Okundu durumu (multi-device)** | 5 | M | V1 | Mobil geliyor. Sonradan eklemek şema değişikliği demek — şimdi tasarla. |
| A4 | **Push notification altyapısı** | 5 | M | V1.1 | Mobil arka planda WebSocket ölür. APNs/FCM olmadan mobil uygulama işlevsiz. |
| A5 | **Onboarding akışı** | 5 | S | V1 | Davetiyeyle giren kullanıcı boş bir terminale düşerse çıkar. İlk 60 saniye ürünün kaderi. |
| A6 | **Moderatör paneli + rapor kuyruğu** | 4 | M | V1 | Moderasyon "ban" butonu değil, bir iş akışı. |
| A7 | **Düzenleme geçmişi (moderatöre görünür)** | 4 | S | V1 | Masum mesaj at → itibar kazan → düzenleyip saldır. Klasik istismar. |
| A8 | **Veri dışa aktarma (`/export`)** | 4 | S | V1 | KVKK/GDPR zorunluluğu. Ayrıca ürün kimliğine çok uygun: her şey zaten metin. |
| A9 | **Gözlemlenebilirlik** (log, metrik, hata takibi) | 4 | S | V1 | Sentry + yapılandırılmış log. İlk gün kur, sonradan kurmak pahalı. |
| A10 | **Yedekleme + geri yükleme testi** | 4 | S | V1 | Test edilmemiş yedek = yedek yok. |
| A11 | **E-posta teslimat kurulumu** (SPF/DKIM/DMARC) | 4 | S | V1 | Doğrulama maili spam'e düşerse kayıt akışı komple kırılır. |
| A12 | **Erişilebilirlik denetimi** | 3 | S | V1.1 | Siyah-beyaz + monospace + CRT efekti = kontrast ve ekran okuyucu sorunları. |
| A13 | **i18n / dil planı** | 3 | M | V1.1 | Ürün tasarımı gereği çok ülkeli ama dil planı yok. En azından oda başına dil etiketi. |
| A14 | **ToS + Gizlilik politikası** | 4 | S | V1 | Türkiye bağlantılı sosyal platform: KVKK + 5651. Avukat parası ayır. |

---

## B. ÜRÜN KİMLİĞİNE UYAN GÜÇLÜ FİKİRLER
Terminal + metin-only kimliğinden doğal olarak çıkan, rakiplerin yapamayacağı şeyler.
**En değerli kısım burası — çünkü buradakiler taklit edilemez.**

| # | Öğe | Etki | Maliyet | Kova | Neden |
|---|---|---|---|---|---|
| B1 | **Herkese açık ASCII profil sayfası** `koqep.com/u/ad` | 5 | S | V1 | **Davetiyeli platformun tek büyüme motoru.** Giriş yapmadan görülebilen, paylaşılabilir ASCII kartvizit. Dışarıdan görünen tek yüzey. |
| B2 | **`.koqeprc` kullanıcı yapılandırma dosyası** | 4 | M | V1.1 | Kullanıcı gerçekten bir dotfile düzenliyor: tema, kısayol, alias. Kimliğe kusursuz uyuyor, teknik kitleyi bağlar, ucuz. |
| B3 | **Komut takma adları** (`/g` → `/join #general`) | 3 | S | V1.1 | B2'nin parçası. Güç kullanıcısı yaratır. |
| B4 | **Statusline** (tmux/vim tarzı alt bar) | 3 | S | V1 | Oda, online sayısı, okunmamış — tek satırda. Ekranı bölmeden bilgi verir. |
| B5 | **`/now` — platform nabzı** | 5 | S | V1 | **Boş oda probleminin çözümü.** Tüm platformdaki canlı aktiviteyi tek ekranda gösterir. 50 kullanıcı 40 odaya dağılınca her yer ölü görünür; burası her zaman canlıdır. |
| B6 | **ASCII davet ağacı** | 4 | S | V1 | Paylaşılabilir görsel artefakt. Ekran görüntüsü alınıp paylaşılır = organik tanıtım. |
| B7 | **Deterministik ASCII avatar** (ID'den türetilir) | 3 | S | V1 | Yükleme yok, moderasyon maliyeti yok, kimliğe uygun. |
| B8 | **Yavaş mod / "düşünme modu"** (oda başına min. aralık) | 4 | S | V1.1 | "Dikkat dağıtmayan" felsefesinin somut hali. Kalite artırır, spam'i mekanik olarak keser. |
| B9 | **Geri sayımlı geçici odalar** | 3 | S | V1.1 | Zaten planında var — sayacı görünür yap. Aciliyet ve canlılık hissi yaratır. |
| B10 | **`Ctrl+K` komut paleti / bulanık arama** | 4 | M | V1 | Klavye-öncelikli iddiasının kanıtı. Oda, kullanıcı, komut — hepsi tek yerden. |
| B11 | **`?` kısayol yardım katmanı** | 3 | S | V1 | Klavye ürününde keşfedilebilirlik şart. |
| B12 | **`/mentions` — bahsedilmeler kutusu** | 4 | S | V1 | Bildirim yığınından bağımsız, sakin bir gelen kutusu. |
| B13 | **Yer imleri / kaydedilmiş mesajlar** | 3 | S | V1.1 | Ucuz, geri dönüş sebebi yaratır. |
| B14 | **Haftalık özet e-postası** | 4 | M | V1.1 | Elde tutmanın en ucuz aracı. "Yokken şunlar oldu." |
| B15 | **Davetçi hesap verebilirliği** | 5 | M | V1 | Davet ettiğin kişi banlanırsa senin davet kotan düşer. **Davet ağacını moderasyon silahına çevirir** — Discord'un yapamadığı şey. Bu senin en özgün avantajın. |

---

## C. ERTELE — iyi fikir, yanlış zaman
V1'de yapılırsa lansmanı geciktirir, kullanıcı yokken hiçbir değer üretmez.

| # | Öğe | Kova | Neden ertelendi |
|---|---|---|---|
| C1 | Coğrafi sunucu hiyerarşisi (Ülke→Bölge→Şehir) | V2 | 50 kullanıcıyla 40 boş oda = ürün ölü görünür. **Tek odayla başla, trafik zorlayınca böl.** |
| C2 | Achievement sistemi (gizli olanlar dahil) | V1.1 | Kullanıcı yokken kimse başarım kazanmaz. |
| C3 | Rozet sistemi | V1.1 | Founder/Early User rozeti V1'de yeter, gerisi sonra. |
| C4 | Reputation reaksiyonları (Helpful/Insightful/Funny) | V1.1 | Anlamlı sinyal için hacim gerekir. 100 kullanıcıda gürültüdür. |
| C5 | Shadow ban | V2 | Herkesin birbirini tanıdığı 200 kişilik toplulukta işe yaramaz, fark edilir. |
| C6 | Gizli komutlar (`/matrix`, `/fortune`) | V1.1 | Eğlenceli, sıfır maliyetli — ama `/sudo`'yu **yapma** (D bölümüne bak). |
| C7 | Admin analytics dashboard | V1.1 | Başta SQL sorgusu yeter. Dashboard 2 haftalık iştir, 0 kullanıcı verisi gösterir. |
| C8 | Arkadaşlık sistemi | V1.1 | Eğer yapılacaksa **takip** olsun, arkadaşlık isteği değil — onay yükü yok, asimetrik. |
| C9 | Telefon doğrulama | V2 | Davetiyeli sistemin zaten çözdüğü bir sorunu SMS maliyeti + PII sorumluluğuyla çözüyor. |
| C10 | Mobil uygulama | V2 | Web'de PMF bulmadan mobil = iki kat bakım maliyeti. Ama API'yi bugünden mobil varmış gibi tasarla. |

---

## D. YAPMA — bilinçli ret
| # | Öğe | Neden |
|---|---|---|
| D1 | **`/sudo` gizli komutu** | Sosyal mühendislik hedefi. Birisi yeni kullanıcıya "şunu yaz" diyecek. Şaka bile olsa yapma. |
| D2 | **Boost = daha hızlı XP** | Liyakat sisteminde statü satmak reputation sinyalini bozar. Kozmetik sat, ilerleme satma. |
| D3 | **Seviye 4000 tavanı (mevcut eğriyle)** | 3 günde 1 seviye = 33 yıl. Ya eğriyi üstel yap ya tavanı 100'e indir. |
| D4 | **Level 10 davet şartı** | Yeni kullanıcı 30 gün kimseyi davet edemez → ağ büyüyemez. **Level 3 veya "ilk 7 aktif gün" yap.** |
| D5 | **Zorunlu TOTP (kayıtta)** | Dönüşüm katili. TOTP'yi sadece yetkili işlemler için zorunlu kıl: davet üretme, moderasyon, admin. |
| D6 | **Kod bloğu çalıştırma** | Birisi mutlaka isteyecek. Sandbox güvenlik cehennemi. Asla. |
| D7 | **"Kim okuyor" göstergesi** | Yazıyor göstergesi tamam, okuyor göstergesi rahatsız edici. |

---

## E. YAPAY ZEKÂ ÖZELLİKLERİ — dikkatli ol
"İnsan, dikkat dağıtmayan, metin-only" felsefesine AI eklemek kimliği bulandırabilir.
Kullanıcıya *görünmeyen* AI güvenli, *sohbete katılan* AI riskli.

| # | Öğe | Etki | Kova | Not |
|---|---|---|---|---|
| E1 | **AI moderasyon ön-triyajı** | 5 | V1.1 | Şüpheli mesajı işaretler, **karar vermez** — insan kuyruğuna atar. Küçük ekip için tek ölçeklenebilir moderasyon yolu. Kullanıcı hiç görmez. |
| E2 | **Uzun oda için özet** (`/catchup`) | 4 | V2 | "Son 6 saatte ne konuşuldu." Metin-only ürün için doğal. Opsiyonel tut. |
| E3 | **Spam/sybil örüntü tespiti (davet ağacında)** | 4 | V2 | Davet ağacındaki anormal desenleri yakalar. |
| E4 | **Sohbete katılan AI bot** | — | ASLA | Ürünün tüm vaadini yok eder. "Gerçek insanlar" satıyorsun. |

---

## Karar kuralı

Yeni bir fikir bu listeye eklenecekse üç soruya cevap ver:

1. Bu, **ilk 100 kullanıcıyı** getirir mi ya da tutar mı? Hayırsa V1 değildir.
2. Bunu **başka bir platform kolayca kopyalayabilir mi**? Evetse öncelik düşük.
3. Bu olmadan ürün **çalışır mı**? Çalışıyorsa özelliktir, zorunluluk değildir.

**Şu anki en büyük risk özellik eksikliği değil, özellik fazlalığıdır.**
Listede 60+ madde var. V1'e giren 15'i geçerse lansman gelmez.
