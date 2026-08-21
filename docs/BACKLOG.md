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
  ucuz kısım), tam markdown → V1.1. → `M2.5` Slice F'de yapıldı
  (2026-07-31): `MessageContent.tsx`, split-tabanlı basit bir parser.
  **Bulunan gerçek kısıt:** gönderme/düzenleme kutuları `<input
  type="text">` — tek satırlı, hiçbir tuş kombinasyonuyla newline
  tutamaz. Bugün kimse gerçek çok-satırlı bir \`\`\` bloğu YAZAMIYOR
  (sadece tek satırlık, ör. \`\`\`npm install\`\`\`). Composer'ı
  `<textarea>`'ya yükseltmek bilerek bu slice'ın kapsamı DIŞINDA
  tutuldu (kullanıcıya soruldu, onaylandı) — milestone görevi zaten
  sadece "render etmek" diyordu. **Tetikleyici ateşlendi (2026-08-09
  M6 kapsam gözden geçirmesinde bulundu): M3 çoktan şipti, gerçek bir
  çok-satırlı kod yapıştırma isteği hâlâ gelmedi.** Bilinçli karar: bu
  bir ürün özelliği, `M6`'nın kendi Out-of-scope'u ("sağlamlaştırma,
  özellik değil") dışında kalıyor — `M6`'ya alınmadı. → **V1.1**, bir
  sonraki özellik-odaklı milestone'a kaydı (tetikleyici artık sadece
  "gerçek bir çok-satırlı kod yapıştırma isteği gelirse").
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
  hangisi önce gelirse. **Tetikleyici ateşlendi (2026-08-09 M6 kapsam
  gözden geçirmesinde bulundu): M3 çoktan şipti, elle-düzeltme henüz
  ikinci kez gerekmedi.** Bilinçli karar: bu bir onboarding-kolaylığı,
  `M6`'nın "gerçek kullanıcı verisini sorumlu tutmak" testini geçmiyor
  (TOTP tam-kilitlenme kurtarmasıyla AYNI kategoride — 20-30 kişilik
  bilinen/davetli bir grupta founder'ın nadir elle müdahalesi kabul
  edilebilir) — `M6`'ya alınmadı, manuel prosedür kalıcı olarak kabul
  edildi. Tetikleyici artık sadece "(a) ikinci kez gerekirse".
  **Eksik test kapsamı:** `apps/web`'den gerçek DB'ye bağlanan bir
  fullstack `email-verification.spec.ts` yok — sadece mocklu
  `apps/web/e2e/verify-email.spec.ts` var (`VerifyEmailView`'ın üç
  durumu). Gerçek signup→verify→login döngüsü `apps/api`'nin e2e testinde
  kanıtlanıyor ama tarayıcı üzerinden uçtan uca değil. Bunu eklemek
  `apps/web`'e yeni bir bağımlılık (`pg` gibi) gerektiriyor, tek başına
  bu eksikliği kapatmak için eklenmedi (`code-style.md`/CLAUDE.md'nin
  "yeni bağımlılık eklemeden önce sor" kuralı). Somut tetikleyici:
  `apps/web` tarafında başka bir test daha gerçek DB bağlantısına ihtiyaç
  duyarsa, o zaman `pg` bağımlılığını ekleyip ikisini birden çözeriz —
  tek testlik bir bağımlılık eklemeye değmez.
- **Hesap silme akışı:** → `M2.5` Slice C'de yapıldı (2026-07-31):
  `POST /auth/delete-account`, şifre/TOTP re-auth, `User` satırı gerçekten
  hard-delete ediliyor (ADR-0005), mesaj içeriği kalıyor yazar bağlantısı
  anonimleşiyor. Detay: milestone Plan notları.
  **Ertelenen — somut tetikleyicilerle:** (a) Invite-issuance audit tablosu
  (`User` FK'sinden bağımsız, silinen davetçileri geriye dönük izlemek
  için) — sadece M5'in davetçi hesap-verebilirliği tasarımı bunu gerçekten
  gerektirirse inşa edilir. **ÇÖZÜLDÜ (2026-08-09, M5 Slice E kendi
  uygulaması + M6 kapsam gözden geçirmesi doğruladı):** M5 Slice E
  gerçekten uygulandı ve bu tabloya İHTİYAÇ DUYMADI —
  `ModerationAuditLog.targetInviteId` (SetNull FK) + `Invite.issuedById`
  (zaten SetNull) yeterli oldu, kayıt `Invite`/`User` satırının kendisinde
  yaşıyor. Tetikleyici ateşlenip cevaplandı, kapatıldı, yeniden açılmayacak.
  (b) Silme onay e-postası — sadece kullanıcı
  yanlışlıkla silme şikayeti/talebi bir kez gerçekleşirse (`EmailService`'e
  eklemek trivial, şu an istenmiyor).
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

### Karar kuralı (2026-08-12 — 500 kullanıcı dönemi, ESKİSİNİ GEÇERSİZ KILAR)
Hedef kullanıcı sayısı 20-30'dan **500**'e çıktı — M2-M6 boyunca kullanılan
yukarıdaki kural (ve ondan önceki "Yol B ölçütü") bu değişiklikle geçersiz.
500'de "herkes birbirini şahsen tanıyor" varsayımı çöküyor (davet zinciri
birkaç seviye derinleşince artık gerçek bir "kapalı, vetted" grup değil),
VE bazı sınırlar artık "kullanıcı deneyimi kötü hissettirir mi" sorusunun
ötesinde, **gerçek/ölçülebilir teknik sınırlar** haline geliyor (ör. her
mesajın kaç sokete broadcast edildiği). Bu yüzden tek soru yerine üç:

1. **Altyapı gerçekten çöker mi (ölçülebilir bir kapasite sınırı aşılıyor
   mu)?** — Yol B'nin "bozuk hissettirir mi" sorusundan farklı: bu soru
   HİSSE değil RAKAMA bakıyor (bağlantı sayısı, broadcast fan-out, DB
   bağlantı limiti, RAM). Evetse 1.0-zorunlu, tartışmasız.
2. **Tek moderatör fiilen yetişebilir mi?** — 20-30 kişide "dikkatli tek
   moderatör" (THREAT-MODEL satır 7/12) gerçekçiydi; 500'de değil.
3. **500 kişilik, artık herkesin herkesi şahsen tanımadığı bir toplulukta**
   ürün BOZUK, GÜVENSİZ ya da GÜVENSİZ HİSSETTİRİR mi? (Eski kuralın 1.
   maddesinin 500-ölçekli hali — "kapalı topluluk" güven varsayımı
   zayıfladığı için eşik daha düşük: eskiden "arkadaşlar arası kabul
   edilebilir" sayılan bazı boşluklar artık değil, ör. oturum kalıcılığı.)

Büyüme motoru vs. deneyim iyileştirme ayrımı (eski madde 3) hâlâ geçerli —
500 kullanıcı BİR KEZLİK bir davet dalgası, sürekli büyüme hedefi hâlâ YOK.

**Ateşlenmiş tetikleyicilerin sistematik taraması (2026-08-12):**
- **Üyelik modeli (`RoomMember`) — TETİKLEYİCİ FİİLEN ATEŞLENDİ.** Aşağıdaki
  madde >50 aktif kullanıcıyı tetikleyici olarak koymuştu, 500 bunu açıkça
  aşıyor. Ayrıca artık salt "deneyim" sorusu değil — kod okunarak doğrulandı
  (`apps/api/src/api/messages.gateway.ts:84-98`): her soket BAĞLANTIDA TÜM
  aktif odalara katılıyor (üyelik kavramı hiç yok), `broadcastToRoom`
  (`:251-268`) `server.in(roomId).fetchSockets()` kullanıyor — yani bir
  odaya gönderilen HER mesaj, o odada hiç mesaj görmemiş dahil, o an bağlı
  TÜM kullanıcılara gidiyor. 500 eşzamanlı bağlantıda bu artık bir UX
  sorunu değil, bir KAPASİTE sorunu (N=500 fan-out, her mesaj için). →
  **M7'ye alındı, 1.0-ZORUNLU.**
- **Mesaj arama (A2) + okundu durumu (A3):** aşağıdaki tablo satırlarında
  güncellendi — "20-30 kişi birkaç ayda scroll ile bulur" gerekçesi 500
  kullanıcı + muhtemelen çok daha yüksek mesaj hacminde ARTIK GEÇERLİ
  DEĞİL. Okundu durumu hâlâ DM'e bağımlı (DM kendisi de erteleniyor, bkz.
  M8) — bu yüzden A3 hâlâ V1.1'de kalıyor, ama A2 (arama) yeniden
  değerlendirildi → **M8'e (SONRA, 1.0 değil ama artık ciddi bir aday).**
- **Self-servis moderatör atama:** THREAT-MODEL satır 37'nin "tek-moderatör
  varsayımıyla tutarlı" gerekçesi 500 kullanıcıda ÇÖKÜYOR — tek moderatör
  500 kişiye yetişemez, ikinci moderatör eklemenin BUGÜNKÜ tek yolu elle
  SQL (`UPDATE "User" SET "role" = 'moderator'...`, `docs/RUNBOOK.md`
  §3.4). Kendi tetikleyicisi zaten "ikinci bir moderatör eklenirse" idi —
  500 kullanıcı hedefi bunu doğrudan ateşliyor. → **M7'ye alındı,
  1.0-ZORUNLU** (self-servis atama endpoint'i, `ModeratorGuard` zaten var).
- **Rate limit sayıları:** eski tetikleyici "M6 VEYA gerçek olay"dı, M6'da
  gözden geçirilip 20-30 ölçeğinde yeterli bulunmuştu
  (`docs/STATE.md`). 500 kullanıcıda global limit (100/60s, IP başına)
  YENİDEN gözden geçirilmeli — çok sayıda meşru kullanıcı aynı NAT/ofis
  IP'sinden gelirse yanlışlıkla bloklanabilir. → **M7'ye alındı, küçük bir
  gözden geçirme + muhtemel bir artış, 1.0-ZORUNLU (ucuz).**
- **Boş oda problemi TERSİNE döndü:** B5 (`/now` — platform nabzı) eskiden
  "M3 gelmeden çözülecek bir problem yok" diye ertelenmişti (boşluk
  sorunu). 500 kullanıcı × günde 1 oda hakkı = yüzlerce oda potansiyeli;
  `RoomHeader.tsx`'in bugünkü keşif mekanizması SADECE alfabetik sıralı
  düz bir buton listesi (`RoomsService.listRooms`, `orderBy:{name:'asc'}`)
  — aktiviteye göre sıralama/filtreleme YOK. Sorun artık "oda boş
  görünüyor" değil "oda BULUNAMIYOR." → **M7'ye alındı (ucuz: sıralamayı
  aktiviteye çevirmek), 1.0-ZORUNLU.** B5'in kendisi (tam `/now` görünümü)
  hâlâ V1.1'de kalabilir, ama TEMEL keşfedilebilirlik artık zorunlu.

**Üyelik modeli (`RoomMember`) + oda şifresi — orijinal madde, ARTIK TAMAMLANDI, yukarıya bakın:**
- ~~`docs/DATA-MODEL.md`'nin 7 varlığında `RoomMember` hiç yok...~~
  **Somut tetikleyici:** aktif kullanıcı sayısı >50 VEYA aktif oda sayısı
  >15 VEYA gerçek bir özel-oda talebi gelirse. → `M3` sonrası.
  **ATEŞLENDİ (2026-08-12, 500-kullanıcı kararı) — yukarıdaki tarama
  bölümüne taşındı, M7'ye eklendi.**
- **Oda moderasyonu (silme/yeniden adlandırma):** ~~20-30 kişilik,
  "dikkatli tek moderatör" varsayımlı bir toplulukta (THREAT-MODEL satır 7)
  nadir bir kötü-isimli oda için founder'ın manuel Postgres düzeltmesi
  kabul edilebilir~~ — **ÇÖZÜLDÜ (2026-08-05, M5 ikinci tur kapsam
  gözden geçirmesi):** tetikleyici zaten fırlamıştı — bu satırın "M4
  (moderasyon) şipse" tetikleyicisi, milestone numaralandırması
  kaydıktan sonra (moderasyon artık M5) hiç güncellenmemişti. `M5 Slice
  D` olarak eklendi (`docs/milestones/M5-moderation-abuse.md`).

**2026-08-06 — M5 Slice A uygulaması ertelemesi:**
- **Raporlayana durum takibi (raporum ne oldu?):** Slice A'da raporlayan
  gönderim anında bir onay görüyor ("raporlandı") ama SONRASINDA
  raporun çözülüp çözülmediğini/nasıl sonuçlandığını göremiyor — Faz
  1'in zaten kaydettiği "abuse-SLA" boşluğu (`docs/review/CRITIQUE.md`
  satır 135) ile aynı kategori. 20-30 kişilik bir toplulukta anlık
  onay yeterli bir taban çizgisi; kalıcı bir "raporlarım" görünümü şu an
  için cila. **Somut tetikleyici (2026-08-09 M6 kapsam gözden
  geçirmesinde netleştirildi — "M6 cila turu" ifadesi yanlıştı, M6
  kendi Out-of-scope'unda "sağlamlaştırma, cila/özellik değil" diyor,
  bu maddeyle çelişiyordu):** SADECE raporlayanlar "raporuma ne oldu"
  diye ikinci kez sorarsa. `M6`'ya alınmadı, bir sonraki özellik-odaklı
  milestone'a kaldı.

**2026-08-07 — M5 Slice B uygulaması ertelemeleri:**
- **"Kaldır-sonra-sustur" sırası çalışmıyor:** `ModerationQueueView.tsx`'in
  rapor satırı, "içeriği kaldır"/"reddet" tıklanınca hemen listeden
  kayboluyor (Slice A, test edilmiş, bilerek değiştirilmedi) — üzerindeki
  "sustur" butonu da onunla kayboluyor. Sadece "önce sustur, sonra kaldır/
  reddet" sırası çalışıyor. 20-30 kişilik bir toplulukta moderatörün bu
  sırayı öğrenmesi (buton görsel olarak solda/önce) tek seferlik bir
  alışkanlık — rapor kuyruğundan bağımsız bir "kullanıcı ara/sustur"
  affordance'ı şimdiden inşa etmek spekülatif. **Somut tetikleyici:**
  moderatör bu sırayı gerçekten sorun olarak bildirirse ("önce kaldırdım,
  sonra susturamadım" gibi).
- **Susturma süresi sabit (24 saat), seçilebilir değil:** backend
  (`MuteUserDto.durationHours`) zaten genel — `@Min(1) @Max(720)` — ama
  frontend v1 her zaman 24 gönderiyor. Tek moderatörlük bir toplulukta
  ilk sürüm için yeterli taban çizgisi; bir süre seçici UI'ı backend
  değişikliği gerektirmeyecek. **Somut tetikleyici:** founder gerçekten
  farklı bir süreye (ör. 1 saatlik uyarı vs. 7 günlük tekrar suç)
  ihtiyaç duyduğunu bildirirse.

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
| A15 | **Kalan Türkçe→İngilizce arayüz çevirisi** | 2 | M | **ÇÖZÜLDÜ** | M2 Slice G'den beri (bkz. `docs/milestones/M2-core-rooms-messaging.md` satır 505-569) yeni arayüz metni bilerek İngilizce, eski Türkçe component'ler bilerek olduğu gibi kalıyordu. **2026-08-21, M7b Slice I2'de bitirildi:** `apps/web/app/**/*.tsx`'in TÜMÜ (16 dosya) + karşılık gelen `apps/web/e2e/**` (22 dosya) + `apps/web/e2e-fullstack/**` (8 dosya) İngilizceye çevrildi, `<html lang="tr">` → `"en"` (WCAG 3.1.2), `DeleteAccountView.tsx`/`VerifyEmailView.tsx`'in artık gereksiz kalan alt-ağaç `lang="en"` işaretleri kaldırıldı. `apps/web/app/privacy` ve `apps/web/app/terms` BİLEREK dışarıda kaldı — bunlar zaten kendi ayrı `/privacy/en`+`/terms/en` rotalarıyla bilinçli-iki-dilli hukuki sayfalar, A13'ün (i18n) kapsamı. **Kapsam netliği (plan modunda kullanıcıyla netleştirildi):** SADECE frontend (`apps/web`) kapsandı — backend'in (`apps/api`) ~30 `throw new XException('Türkçe metin')` satırı kapsam DIŞI bırakıldı, bkz. A20. A13 (i18n/çok-ülke dil planı) ile KARIŞTIRILMASIN — bu satır tek-dilli arayüzün kendi iç tutarlılığıyla ilgiliydi, A13 çok-ülkeli gelecek planlamasıyla. |
| A16 | **`scope=all` (moderasyon oda listesi) sayfalaması** | 2 | S | V1.1 | M7a Slice B (`RoomMember` üyelik modeli, ADR-0009) `GET /rooms?scope=discoverable`'ı sayfaladı ama `scope=all`'ı (moderasyon paneli, üyelikten bağımsız TÜM odalar) BİLEREK sayfalamadı — kullanıcının review'ında bulunan gerçek boşluk, sessiz bırakılmadı. **Somut tetikleyici:** toplam `Room` satır sayısı (`SELECT COUNT(*) FROM "Room"`, RUNBOOK'un kendi SQL setiyle ölçülebilir) 100'ü geçtiğinde `scope=all` da `scope=discoverable`'ın AYNI cursor+limit mekanizmasıyla sayfalanmalı (`RoomModerationSection.tsx`'in kendi liste UI'ı bir "daha fazla göster" butonu kazanır) — mekanizma zaten var, sadece bu ikinci çağrı yerine uygulanması gerekiyor. |
| A17 | **`MessagesService.sendMessage`'ın row-contention'ı** | 5 | M | **ÇÖZÜLDÜ** | M7a Slice I'nin yük testinde bulundu, Slice J'de düzeltildi: `Room.lastActivityAt` transaction'dan çıkarıldı + ateşle-unut + 30sn debounce (`docs/milestones/M7a-scale-gate.md`'nin Slice J notları). GERÇEK yük testiyle doğrulandı — düzeltme TEK BAŞINA yeterli değildi, kalan darboğaz Prisma'nın varsayılan connection pool'uydu (`connection_limit`'i 30'a çıkarınca 100 bağlantıda hata %8'den %0'a indi, temiz A/B). 500 bağlantı taramasında `connection_limit=50` en iyi sonucu verdi (%9.9 hata) ama 100-150'de (Faz 1/2'nin gerçekçi ölçeği) `connection_limit=30` neredeyse sıfır hata (%0-0.67) — 500'ün kendisi hem local Docker'ın hem Postgres'in `max_connections=100` tavanına çarpıyor, tam temiz sonuç local'de alınamadı, kabul edilen kalıntı risk. **2026-08-19: founder `connection_limit=30`'u production `DATABASE_URL`'ine ekledi, deploy etti, doğruladı** — Render Postgres'in Basic-256mb planının `max_connections=100` olduğu resmi dokümantasyondan teyit edildi, 30 rahat bir marjla altında. Tamamen kapandı. |
| A18 | **Postgres plan kapasitesi (RAM/CPU/depolama) doğrulanmadı** | 3 | S | V1.1 | M7a-scale-gate.md'nin kendi AC'si bunu istiyordu ama Render'ın detaylı metrik paneli (RAM/CPU/depolama kullanım grafikleri) bir paket yükseltmesi gerektiriyor — founder'ın bugünkü Basic-256mb planında bu görünmüyor. `max_connections=100` AYRI olarak resmi dokümantasyondan doğrulandı (A17), bu madde SADECE RAM/CPU/depolamanın gerçek kullanım hacmine yeteceği sorusu. **Somut tetikleyici:** gerçek kullanıcı sayısı 50'yi geçince YA DA API'de yavaşlama/timeout gözlemlenirse — Render dashboard'unda paket yükseltilip metrikler kontrol edilir. Faz 1 (~50 kullanıcı) bu eşiğin altında kaldığı sürece bilerek beklemede — sessizce unutulmadı, ölçülmeden "yeterli" de denmedi. |
| A19 | **Geri bildirim `mailto:` hedefi kişisel gelen kutusu** | 2 | S | V1.1 | M7b Slice H2'de eklenen "geri bildirim" linki `ussasa155@gmail.com`'a gidiyor — kurumsal bir destek adresi yok, founder'ın kendi kararıyla bilerek kabul edilen bir kısıt (`RoomHeader.tsx`'in `FEEDBACK_EMAIL` sabiti, tek satırlık geçiş noktası olacak şekilde tasarlandı). **Somut tetikleyici:** support yükü kişisel gelen kutusunda karışmaya başlarsa YA DA kullanıcı sayısı Faz 2 (150) eşiğini geçerse — o zaman `support@koqep.com` gibi kurumsal bir adrese (muhtemelen Resend'in zaten kurulu olduğu domain üzerinden) geçilir. |
| A20 | **Backend hata mesajları hâlâ Türkçe (frontend'e sızıyor)** | 3 | M | V1.1 | M7b Slice I2 SADECE frontend'i (`apps/web`) çevirdi (A15) — `apps/api`'deki ~30 `throw new XException('Türkçe metin')` satırı BİLEREK kapsam dışı bırakıldı (plan modunda kullanıcıyla netleştirilen kasıtlı bir karar, unutkanlık değil). `lib/api.ts`'in `sendJson`'ı backend'in `err.message`'ını DOĞRUDAN fırlatıyor, 8+ frontend component'i (`AuthView`, `CreateRoomView`, `TotpSettingsView`, `BlockedUsersView`, `DiscoverRoomsView`, `ResetPasswordView`, `AssignModeratorSection` vb.) bunu `err instanceof ApiError ? err.message : "Connection error. Try again."` deseniyle kullanıcıya olduğu gibi gösteriyor — yani arayüzün geri kalanı İngilizce olsa da bu hata mesajları hâlâ Türkçe çıkacak. **Somut tetikleyici:** Faz 1 açılışından SONRA (gerçek kullanıcılar hata mesajlarıyla karşılaşmaya başlayınca) YA DA M9 i18n çalışması başlarsa — "biri şikayet ederse" gibi reaktif bir sinyale değil, Faz 1'in kendi açılış anına bağlı somut bir zamana dayanıyor. |

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

---

## F. 500-KULLANICI KAPSAM TURU (2026-08-12) — kritik kapsam değişikliği

M6 tamamen bitince, hedef kullanıcı sayısı 20-30'dan **500**'e çıktı ve
kullanıcı ayrıca büyük bir yeni özellik/boşluk listesi getirdi. Üç paralel
araştırma agent'ıyla (altyapı gerçekliği + ateşlenmiş tetikleyiciler,
spec'te-olan-ama-yapılmamış özelliklerin gerçek kod durumu, küçük UX
boşlukları + i18n maliyeti) TAMAMI kod okunarak doğrulandı — hiçbir madde
tahmine dayanmadı. Tam öncelik/saat analizi ve dilim planı yeni milestone
dosyalarında (`M7-scale-and-critical-fixes.md`, `M8-social-features.md`,
`M9-i18n.md`, `M10-ui-redesign.md`); burada sadece BACKLOG'un kendi
kova/karar mantığına giren maddeler listeleniyor.

### Kritik bulgu — oturum kalıcılığı muhtemelen "kırık" değil, YARIM BIRAKILMIŞ
`ADR-0002`'nin KENDİ "Decision" bölümü web istemcisinin token'ları
**httpOnly cookie'de** saklamasını söylüyor — ama gerçek kod
(`apps/web/app/page.tsx:9-13`) SADECE bellek-içi React state kullanıyor,
kendi yorumunda bunu ADR-0002'nin nihai hedefine "uyumlu bir ARA ADIM"
diye tanımlıyor. Yani bu, belirsiz bir durum değil — ADR'nin kendi
mekanizması hiç tamamlanmamış. Sonuç: sekme kapatma/reload = tam çıkış,
kurtarma yok. 500 gerçek kullanıcıda en çok şikayet edilecek şey bu olur.
**M7'ye 1.0-ZORUNLU olarak eklendi** (`M7-scale-and-critical-fixes.md`).

### Kova revizyonları (500-kullanıcı kriterine göre)
| # | Öğe | Eski kova | Yeni kova | Neden |
|---|---|---|---|---|
| A2 | Mesaj arama | V1.1 | **M8, BİLİNÇLİ ERTELEME — sessizce kayan bir "sonra" DEĞİL** | "20-30 kişi scroll ile bulur" gerekçesi 500'de çöktü (yukarıki "Karar kuralı (500 kullanıcı dönemi)" bölümüne bakın) — 500 kullanıcılık oda geçmişinde belirli bir mesajı bulmak scroll ile 30 kişilik odadakinden ÇOK daha maliyetli. Yine de M7'ye ALINMADI: ürün aramasız da ÇALIŞIYOR (Karar kuralı 1. madde geçmiyor), Postgres tam-metin index + endpoint + UI kendi başına ayrı bir dilim (bkz. `M8-social-features.md` Slice I, ~12-16 saat). **Tetikleyici:** M8'e girildiğinde bu dilim, reaksiyonlar/DM gibi diğer M8 kalemleriyle AYNI önceliklendirme turunda ele alınır — erken sıraya alınması için somut sinyal: RUNBOOK'un oda-aktivite sorgusuyla ölçülen ortalama oda mesaj sayısı >1000'i geçtiğinde scroll-ile-bulma pratik olarak imkansızlaşır. |
| — | `RoomMember` üyelik modeli | M3-sonrası (tetikleyici bekliyor) | **M7, 1.0-ZORUNLU** | Tetikleyici (>50 kullanıcı) ateşlendi + artık salt UX değil, broadcast fan-out kapasite sorunu (`messages.gateway.ts:84-98,251-268`). |
| — | Self-servis moderatör atama | Reddedildi (tek-moderatör varsayımı) | **M7, 1.0-ZORUNLU** | Kendi tetikleyicisi ("ikinci moderatör eklenirse") 500 hedefiyle ateşlendi. |
| B5 | `/now` platform nabzı | M3-sonrası | Kısmi: temel keşfedilebilirlik → **M7, 1.0-ZORUNLU**; tam `/now` görünümü → V1.1 kalır | Boş oda problemi tersine döndü (yüzlerce oda, sıfır keşif mekanizması). |

### Yeni maddeler — kullanıcının 2026-08-12 istek listesinden (bölüm 2-5)
Her biri: **durum** (kod okunarak doğrulandı) → **karar**. Tam gerekçe/saat
tahmini ilgili milestone dosyasında.

**Kimlik/hesap (bölüm 2):**
- Kullanıcı profili (bio+avatar+rozet): YOK (`User` modeli, doğrulandı — bio/avatar alanı hiç yok). Bio serbest metinse yeni moderasyon yüzeyi — kullanıcının kendi tespiti doğru. → **M8, SONRA.**
- Kullanıcı adı değiştirme + isim rezervasyonu: YOK (`users.service.ts`'de update metodu yok). Rezervasyon/mesaj-içinde-ad-saklama çakışması gerçek — → **M8, SONRA**, tasarım kararı M8'in kendi dosyasında.
- Kullanıcı adı VEYA e-posta ile giriş: bugün SADECE e-posta (`login.dto.ts:4`, `auth.service.ts:130-133`). Kullanıcının kendi tespiti doğru (rezervasyon sorunuyla çakışıyor) — **ÖNERİ: login'i KALICI olarak e-posta-only bırak, username-login hiç eklenmesin** (çakışan iki özelliği birlikte inşa etmek yerine, riskli kombinasyonu inşa etmemek). → **YAPMA**, M8'de tartışılıp kapatılacak.
- E-posta değiştirme: YOK. → **M8, SONRA.**
- Geçici hesap dondurma (30 gün): YOK, sadece kalıcı silme var (ADR-0005). → **M8, SONRA** — mevcut anonymize-on-delete zaten bir güvenlik ağı sağlıyor, acil değil.
- E-posta erişim kaybı kurtarma: YOK, gerçek çözümü yok (recovery-email/güvenlik sorusu ikisi de zayıf). → **Çözülmemiş, kayıtlı açık madde** (THREAT-MODEL'e eklendi), M8'de tekrar ele alınacak, aceleye getirilmeyecek.
- Şifre gücü + HaveIBeenPwned: sadece uzunluk kontrolü var (`signup.dto.ts:29-31`, min 8). HIBP k-anonymity ücretsiz/bağımlılıksız. → **M7, 1.0-ZORUNLU, ucuz.**
- Hesap-bazlı brute-force koruması: YOK, sadece global limit (`auth.controller.ts` login'de `@Throttle` yok). → **M7, 1.0-ZORUNLU.**

**E-posta doğrulama:**
- Link yerine kod: bugün link+token (`email-verification.service.ts:6,13-27`, 32-byte token). Değerlendirildi — **ÖNERİ: link kalsın**, kod'a geçişin mobilde gerçek bir kazancı var ama link zaten tek-tık, kod eklemek iki paralel akış bakımı demek düşük getiri için. → **YAPMA** (M8'de istenirse tekrar açılır).
- MX kaydı + tek-kullanımlık e-posta engelleme: YOK. Davet-kapılı bir sistemde spam-signup riski zaten düşük (agent'ın da not ettiği gibi). → **V1.1/SONRA, düşük öncelik.**

**DM:** Yeni model + WS yönlendirme + engelleme entegrasyonu + raporlama (THREAT-MODEL satır 10) hepsi gerçek, BÜYÜK bir iş (tahmini 40-60 saat, bkz. M8). → **BİLİNÇLİ ERTELEME, M8'e — sessizce kayan bir "sonra" DEĞİL.** 2026-08-12 kararı: 500 kişilik yarı-tanıdık grupta DM'siz "tanıdık hissi" 30 kişilik ölçekten DAHA çok azalır (herkesin herkesi tanıdığı küçük bir grupta özel konuşma ihtiyacı odalar üzerinden zaten karşılanıyordu, 500 yarı-tanıdık yabancı arasında değil) — ama ÜRÜN ÇALIŞMAYA DEVAM EDER, Yol/Karar kuralının 1. maddesini (bozuk/güvensiz hissettirir mi) GEÇMİYOR, sadece eksik hissettiriyor. M7'ye ALINMADI çünkü kendi başına 40-60 saatlik bir iş (M7'nin TAMAMI kadar büyük tek bir dilim) VE raporlama olmadan asla başlamaması gerektiği için (THREAT-MODEL satır 10) M8'in DM'siz açılan ilk dilimlerinden biri olamaz — moderasyon kapasitesi (M7a'nın self-servis moderatör ataması) gerçekten kullanılana kadar bilerek bekletiliyor (bkz. `M8-social-features.md`'nin kendi founder-işi maddesi). **Tetikleyici:** M8'e girildiğinde DM, Slice J olarak EN SON değil ama moderasyon kapasitesi doğrulanmadan da EN ÖNCE başlatılmaz — sıralama kararı M8'in kendi plan-modu turunda verilir.

**Ana sayfa (landing/onboarding):** Bugün `/` doğrudan `AuthView` (`page.tsx:16-24`), sıfır bağlam metni. 500 kişilik bir davet dalgasında ilk izlenim artık "birkaç arkadaşın tanıttığı" değil — → **M7, 1.0-ZORUNLU** ama KÜÇÜK kapsamlı (kopya + /privacy,/terms bağlantısı, tam bir pazarlama sayfası değil).

**Dil desteği (i18n):** Kullanıcının kendi maliyet analizi (4 gizli maliyet) kod okunarak DOĞRULANDI ve daha da büyük çıktı: 388 Türkçe-bağımlı Playwright seçici (`apps/web/e2e/**` 310 + `e2e-fullstack/**` 78), backend hata fırlatma noktalarının %90'ı (47/52) kod-değil-düz-Türkçe-string, sıfır i18n altyapısı, `User.locale` yok. Gerçekçi tahmin 60-100+ saat — bu turda **tek başına en büyük tek kalem**. → **Tam kapsamlı runtime dil değişimi M9'a (SONRA) ayrıldı**, ayrı ve bağımsız bir milestone olarak (özellik değil, çapraz-kesen bir altyapı değişikliği). M7'ye SADECE ucuz bir alt-küme alındı: zaten yıllardır bekleyen Türkçe→İngilizce UI geçişini (A15, M2 Slice G kararı) BİTİRMEK — runtime SEÇİM/`User.locale` OLMADAN, sadece varsayılanı tamamen İngilizceye çevirmek. Detay M7 dosyasında.

**Hukuki:** ToS/gizlilik EN+TR ayrı sürüm + çelişki durumunda hangisinin bağlayıcı olduğu sorusu avukata soru listesine eklendi (`docs/RUNBOOK.md`'ye değil, ADR-0001 şablonuyla ileride bir ADR'ye — kod değişikliği küçük, hukuki metin founder'ın işi). → **M7'ye kod-tarafı (versiyon seçme sayfası) eklendi, 1.0-ZORUNLU, küçük.**

**Spec'te olan ama hiç yapılmamış (bölüm 3) — durum + karar:**
- Terminal komutları (`/help` vb.): YOK, sıfır prefix-parsing (`RoomView.tsx:399-412` doğrulandı). Kimlik iddiasının merkezinde ama ÜRÜN ÇALIŞIYOR onsuz. → **M8, SONRA.**
- Mention + bildirim: YOK. Kullanıcı-dizini de yok (aşağıya bkz.) — mention'ın ön koşulu. → **M8, SONRA**, kullanıcı-dizini ile birlikte paketlenecek.
- Presence + yazıyor göstergesi: YOK (DATA-MODEL.md'nin "in-process" iddiası bile hiç kodlanmamış). → **M8, SONRA.**
- Reaksiyonlar: YOK. → **BİLİNÇLİ ERTELEME, M8'e — sessizce kayan bir "sonra" DEĞİL.** 2026-08-12 kararı: 500 kullanıcıda reaksiyonlar 30 kişilik ölçekte olduğundan DAHA önemli, iki somut nedenle — (1) büyük bir odada gürültü yaratmadan düşük-çaba etkileşim üretmenin TEK yolu (herkes mesaj yazamaz ama herkes reaksiyon verebilir), (2) `ReputationEvent`/XP sistemi BUGÜN sadece ham mesaj SAYISINI ödüllendiriyor (nicelik), kaliteyi/etkileşimi DEĞİL — reaksiyonlar bu sistemi besleyecek tek somut sinyal kaynağı olarak tasarlanmıştı, yokluğu M4'ün itibar sistemini niceliğe hapsediyor. M7'ye ALINMADI çünkü BACKLOG'un kendi karar kuralının 1. maddesini (olmadan ürün bozuk/güvensiz hissettirir mi) geçmiyor — ürün reaksiyonsuz da ÇALIŞIYOR, sadece eksik hissettiriyor. **Tetikleyici (bu erteleme yeniden açılmalı):** M7a sonrası ilk Faz 2 (150 kullanıcı) dönüşü verisinde kişi-başı-mesaj metriği düşükken sessiz-okuyucu oranı yüksekse (RUNBOOK'un DAU/dönüş sorgularıyla ölçülebilir) — bu, "insanlar okuyor ama düşük-çaba bir etkileşim yolu olmadığı için katılmıyor" sinyalidir, M8'de reaksiyonların ÖNCELİĞİNİ diğer M8 dilimlerinin (kullanıcı adı, DM vb.) ÖNÜNE alma gerekçesi olur.
- Okundu durumu (`ReadCursor`): DATA-MODEL.md'de yazılı ama şemada YOK — DOKÜMAN/KOD TUTARSIZLIĞI, doğrulandı. → **M8, SONRA**, DATA-MODEL.md bu turda düzeltildi (aşağıya bkz.) ki "var" sanılmasın.
- Yanıtlama/alıntı: YOK. → **M8, SONRA.**
- Kendi mesajını silme: YOK, sadece düzenleme var. Temel bir sohbet beklentisi. → **M7, 1.0-ZORUNLU, ucuz.**
- "Düzenlendi" göstergesi: BİLEREK ertelenmiş (M2 Slice B, `docs/milestones/M2-core-rooms-messaging.md:192-196`), hiç geri dönülmemiş. THREAT-MODEL satır 3'ün vektörünün yarısı hâlâ açık. → **M7, 1.0-ZORUNLU, ucuz** (veri zaten var, sadece görünüm kararı).
- Mesaj arama: yukarıda (A2 kova revizyonu).
- Kullanıcı dizini/oda üye listesi: YOK. Mention/DM'in ön koşulu. → **M8, SONRA** (mention ile birlikte).
- Sabitlenmiş mesaj, oda konusu/kuralları: YOK (`Room.description` var ama sadece tooltip, ön plana çıkmıyor). → **V1.1/SONRA.**
- Durum/rozet/achievement/davet-ağacı görselleştirme: hepsi zaten BACKLOG'da (B6/B9/C2/C3), zaten V1/V1.1 — kova değişmedi.
- Geçici odalar (TTL): zaten B9, V1.1 — kova değişmedi.

**Ürün/operasyon boşlukları (bölüm 4):**
- Ürün analitiği (kendi DB'den sorgu, üçüncü parti YOK): kullanıcının kendi gerekçesi (Faz 1'in riskiest-assumption testi bu grupla yapılacak, ölçmezsem test etmiş olmuyorum) güçlü ve ürünün kendi gizlilik duruşuyla tutarlı. → **M7, 1.0-ZORUNLU ama EN UCUZ HALİYLE**: bir dashboard DEĞİL, `docs/RUNBOOK.md` tarzı dokümante edilmiş SQL sorguları (DAU, kişi-başı mesaj, gün-1/gün-7 dönüş, oda-başına aktivite) — founder elle çalıştırır.
- Geri bildirim/duyuru kanalı: YOK. → **M7'ye EN UCUZ HALİYLE eklendi** (`mailto:` tabanlı bir geri bildirim linki + moderatörün pinlenmiş bir duyuru mesajı atabilmesi — yeni bir bildirim altyapısı DEĞİL), 1.0-ZORUNLU.
- Moderasyona itiraz yolu: KISMİ — susturma bildirimi VAR ama SÜRE dışında SEBEP yok (`ChatPanel.tsx:105-110`); içerik kaldırma bildirimi YOK (sessizce, `message:updated` genel kanalından, `messages.service.ts:20-21`). 500 kullanıcıda tek moderatörün YARGISI daha sık yanlış olacak, itiraz yolu olmadan bu bir adalet sorunu. → **M7, 1.0-ZORUNLU** (sebep alanı + mevcut bildirim kanallarını kullanarak sürme — yeni altyapı değil).

**Sohbeti "bozuk" hissettirenler (bölüm 5):**
- Taslak kaybı: doğrulandı, tek paylaşılan state (`RoomView.tsx:71`, oda değişince `setDraft("")`, satır 359-363). Ucuz düzeltme (`Record<roomId,string>`). → **M7, 1.0-ZORUNLU, çok ucuz.**
- Okunmamış göstergesi, yukarı-kaydırma bildirimi, sekme başlığı: hepsi `ReadCursor`/üyelik işine bağımlı. → **M8, SONRA**, M8'in ReadCursor/üyelik işiyle birlikte.
- Permalink: YOK. → **M8, SONRA.**
- İlk giriş deneyimi: sıfır onboarding, doğrulandı (`ChatPanel.tsx:74-75` sadece "henüz mesaj yok"). → **M7, 1.0-ZORUNLU**, landing/onboarding maddesiyle birlikte, ucuz.
- Zaman dilimi: aslında DOĞRU çalışıyor (`toLocaleTimeString` tarayıcı yereline çeviriyor, `MessageItem.tsx:27-32`) — sadece biçim sabit `tr-TR`. i18n'e bağlı, ayrı bir madde değil.
- Tıklanabilir linkler: YOK (`MessageContent.tsx` düz metin render ediyor, hiç linkify yok). Önizleme KESİNLİKLE olmasın kararı zaten doğru/mevcut (önizleme altyapısı hiç yok). → **M7, 1.0-ZORUNLU, ucuz** (linkify + `target=_blank rel=noopener`, önizleme yok).
- Unicode/zalgo: uzunluk dışında SIFIR karakter-türü kontrolü (`messages.gateway.ts:132-142` doğrulandı). Metin-only, monospace bir üründe özellikle etkili bir griefing yöntemi — ucuz bir düzeltme (birleşik işaret/grapheme sınırı). → **M7, 1.0-ZORUNLU.**

**M7 — Arayüz tasarım geçişi (bölüm 6):** kullanıcı bunu "M7" diye adlandırdı ama SIRALAMA nedeniyle **M10** olarak numaralandırıldı (M7 artık yukarıdaki ölçek/kritik-düzeltme dilimi) — gerekçe M10'un kendi dosyasında. İki-aşamalı yapı (önce tasarım kararı dokümanı, sonra kod) AYNEN korundu.
