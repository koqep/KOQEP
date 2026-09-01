# M11b — Güven & giriş cilası

*Landing sayfasının genişlemesi + kayıtta gerçek okuma-onayı + ilk-giriş
deneyimi — üçü de "ilk izlenim" kategorisinde, M7'nin bilerek EN UCUZ
haliyle bıraktığı yerleri tamamlıyor. Kapsam turu: `docs/BACKLOG.md`'nin
"G. 2026-08-29 KAPSAM TURU" bölümü.*

**Goal:** M7'de bilinçli olarak "en ucuz seçenek" ile kapatılan landing/terms/
onboarding yüzeylerini, artık gerçek kullanım geri bildirimi geldiğine göre
gözden geçirip genişlet.
**Demo:** `/`'e giden bir ziyaretçi login formunun üstünde animasyonlu bir
arka plan + support linki + tanıtım metni görüyor; kayıt formunda terms/
privacy metni ekranda gösteriliyor, aşağı kaydırmadan onay tiki
aktifleşmiyor; ilk mesajını atan yeni kullanıcı yönlendirici bir ilk-adım
görüyor (kapsamı Slice C'de netleşecek).
**Estimated hours:** ~23-33h (Slice A tamamlandı, gerçek maliyeti ~19-25h
oldu — routing geçişi 2026-08-30 kapsam turunda tahmin edilenle uyumlu
çıktı).

## Out of scope
- Tam interaktif `/tutorial` komutu — `docs/BACKLOG.md`'nin mevcut kararı
  ("1.0 için basit onboarding yeterli, tam tutorial V1.1") hâlâ geçerli,
  bu dilim onu geri açmıyor.
- ~~Landing sayfasının ayrı bir route/state olması~~ **KARAR TERSİNE
  DÖNDÜ (2026-08-30), UYGULANDI (2026-08-31):** kullanıcının gerçek
  tasarımı `/`'i saf bir pazarlama sayfasına çevirdi, giriş/kayıt yeni bir
  `/app` route'una taşındı — M7a Slice A'nın "tek ekran" kararı BİLEREK
  terk edildi, gerekçe ve tam maliyet aşağıda Plan notları'nda.
- Tam site-geneli TR/EN i18n — sadece landing'in KENDİ metni + doğru
  dildeki terms/privacy linki değişiyor, "giriş yap" sonrası her zamanki
  gibi İngilizce (M9'un kapsamı, dokunulmuyor).
- JetBrains Mono / yeni bir web font — sistem monospace kalıyor.
- Footer'da discord linki — gerçek bir sunucu/davet URL'i yok, founder
  sağlayınca ayrı, ucuz bir ek olarak eklenir.

## Acceptance criteria
- [x] `/` gerçek bir pazarlama landing'i — başlık/açıklama/3 özellik
      kutusu/footer, canvas tabanlı ASCII arka plan animasyonu
      (`prefers-reduced-motion` saygılı), TR/EN kutusu (SADECE bu
      sayfanın kendi metni).
- [x] `/app` yeni route'u bugünkü `page.tsx`'in TÜM davranışını taşıyor
      (bootstrap → AuthView ya da RoomView) — `/` tamamen statik, kendi
      auth kontrolü YOK.
- [x] `LandingIntro.tsx` kaldırıldı (yeni landing tarafından tamamen
      karşılanıyor).
- [x] 34 test dosyasındaki `goto("/")` → `goto("/app")` + 9 iç link
      (`/terms`, `/terms/en`, `/privacy`, `/privacy/en`,
      `ResetPasswordView.tsx`, `VerifyEmailView.tsx`) `/app`'e güncellendi.
- [x] Landing ekranında support linki var (`AccountMenu`'nün kullandığı
      `FEEDBACK_EMAIL` sabiti yeniden kullanılıyor).
- [ ] Kayıt formunda terms/privacy metni bir modal/panel içinde GERÇEKTEN
      gösteriliyor (sadece dış linke değil). — **Slice B, henüz yapılmadı.**
- [ ] O metnin sonuna kadar kaydırılmadan onay checkbox'ı tıklanabilir
      olmuyor. — **Slice B, henüz yapılmadı.**
- [ ] Slice C'nin kapsamı (madde 2'nin genişlemesiyle mi karşılanıyor, yoksa
      post-signup ayrı bir adım mı) netleşmiş ve uygulanmış.

## Tasks
- [x] **Slice A — Landing sayfası + routing geçişi.** Tamamlandı
      (2026-08-31), `feat/landing-page` dalında. Detay Plan notları'nda.
- [ ] **Slice B — Kaydırma-onaylı terms.** Mevcut TR/EN legal metni (zaten
      `/terms`, `/privacy` sayfalarında var) modal/panel içine gömme, scroll
      tracking, checkbox gate.
- [ ] **Slice C — Onboarding netleştirmesi.** Kullanıcıyla netleştir: madde
      2'nin genişlemesi yeterli mi, yoksa post-signup ayrı bir "ilk mesajını
      yaz" rehberi mi isteniyor — netleşmeden boyut/görev kesinleşmez.
- [x] **Slice D — Legal sayfaların görsel dili landing'le hizalanması.**
      Tamamlandı (2026-08-31), `feat/legal-pages-visual` dalında (main'den,
      `feat/landing-page`'den BAĞIMSIZ). Detay Plan notları'nda.
- [x] **Slice E — Login/register (AuthView.tsx) görsel yeniden tasarımı.**
      Tamamlandı (2026-09-01), `feat/auth-visual-redesign` dalında (main'den,
      Slice D'den BAĞIMSIZ). Detay Plan notları'nda.

## Risks
- ~~Slice A: "animasyonlu arka plan" görsel bir karar, kod yazılmadan önce
  kullanıcı onayı gerekiyor.~~ Kullanıcı Claude Design'da kendi tasarımını
  üretip onayladı, implementasyon tamamlandı.
- ~~Slice A, gerçek risk: routing geçişinin maliyeti~~ **ÇÖZÜLDÜ
  (2026-08-31):** 34 test dosyası + 9 iç link güncellendi, tüm mock'lu +
  fullstack süit yeşil (aşağıda Plan notları).
- Slice C: madde 17 kullanıcının kendi isteğiydi ama `docs/BACKLOG.md`'nin
  mevcut A5/onboarding kararıyla örtüşüyor olabilir — kapsamı netleşmeden
  bu dilime dahil edilmemeli, gereksiz iş riski var.

## Plan notları

### Slice A kapsam turu (2026-08-30) — kullanıcının Claude Design tasarımı
Kullanıcı Claude Design'da bir landing mockup üretip inceledi, tam
kararlarıyla geldi (başlık metni, yerleşim, canvas animasyon formülü,
renk/tipografi, ASCII karakter rampası). Kod tabanı okunarak doğrulanan
bulgular + 4 açık karar `AskUserQuestion` ile netleştirildi:

**Routing (en büyük bulgu):** bugün `page.tsx` TEK `/` route'unda hem
bootstrap-kontrolü (geçerli oturum varsa RoomView'a düşer) hem landing+
auth'u birlikte yapıyor. Yeni tasarım `/`'in saf pazarlama sayfası olmasını
gerektiriyor — bugünkü TÜM `page.tsx` mantığı yeni bir `/app` route'una
taşınacak (isim kullanıcıya önerildi, onaylandı). Zaten oturumu açık bir
ziyaretçi `/`'e gelirse **BİLEREK** landing'i görecek (saf statik kalması
için) — `/app`'e geçince anlık devam ediyor, tek fazla tıklama kabul
edildi (kullanıcı onayladı, `AskUserQuestion`).

**TR/EN kutusu:** M10'un kendi mockup'ındaki AYNI switcher, tam bu
gerekçeyle (`docs/BACKLOG.md` A27) "yarım no-op" diye çıkarılmıştı. Bu
turda FARKLI bir karar verildi (kullanıcı onayladı) çünkü kapsam GERÇEKTEN
dar ve TAM çalışıyor: SADECE landing'in kendi metni + doğru dildeki
terms/privacy linki değişiyor, "giriş yap" sonrası her zamanki gibi
İngilizce — M10'daki gibi "başka bir şeyi yarım bırakan" bir switcher
DEĞİL.

**Font:** JetBrains Mono (`next/font/google` ile KENDİ sunucusunda
barındırılacaktı, Google'a runtime isteği/gizlilik sorunu olmazdı) YERİNE
mevcut sistem monospace korunuyor — kullanıcı kararı, yeni bir görsel
bağımlılık istemedi.

**Discord linki:** kod tabanında arandı, gerçek bir KOQEP discord sunucusu/
davet URL'i YOK (sadece "Discord'a benzemesin" rakip-kıyaslamaları var) —
bu turda footer'dan çıkarıldı, founder gerçek bir URL sağlayınca ayrı, ucuz
bir ek olarak eklenecek.

**Terminal cursor süresi:** tasarım "KOQEP" yanında 620ms'lik bir yanıp
sönen imleç istiyor — ama `globals.css`'te ZATEN `.terminal-cursor`
(`--motion-duration-cursor-blink: 1000ms`) var, `ChatPanel.tsx`'te
kullanılıyor. İmplementasyonda YENİ bir süre icat ETMEDEN mevcut class/
token'ı yeniden kullanmak önerilir (tutarlılık, sihirli-sayı-yok kuralı) —
620ms'nin tasarımda bu mevcut token'dan habersiz seçildiği varsayılıyor.

**Canvas animasyonu — implementasyon gereksinimleri (araştırıldı, henüz
kod yazılmadı):**
- `requestAnimationFrame` kullanılmalı (`setInterval` DEĞİL) — rAF sekme
  arka plana alınınca tarayıcı tarafından otomatik duraklatılır (bedava pil
  tasarrufu), 5-frame'de-bir-çiz mantığı rAF callback'i içindeki bir frame
  sayacıyla uygulanmalı.
  `prefers-reduced-motion: reduce`'a SAYGI GÖSTERMELİ — animasyon
  döngüsü hiç başlamamalı (tek bir sabit kare ya da hiçbir şey). Kod
  tabanında BUGÜN `prefers-reduced-motion` desteği HİÇ YOK (mevcut
  `fade-in`/`panel-slide-*`/`terminal-cursor` animasyonlarının hiçbiri
  kontrol etmiyor) — bu, kod tabanı için İLK örnek olacak.
- `aria-hidden="true"` — Avatar.tsx'in dekoratif-SVG konvansiyonuyla
  aynı, ekran okuyucuya hiçbir şey ifade etmiyor.
- `useEffect` cleanup'ında `cancelAnimationFrame` ŞART — aksi halde
  landing'den `/app`'e geçince (client-side navigation) döngü arka planda
  sızabilir.
- 4000+ hücrelik bir `fillText` döngüsü (1280×720'de ~15px hücre) saniyede
  ~12 kez (5 frame'de bir, ~60fps'te) — hafif değil ama SADECE landing'de
  yaşıyor (chat UI'sinde değil), opaklık çok düşük (0.05-0.21) zaten
  "dikkat dağıtmayan" felsefesiyle örtüşüyor.

**Yeniden gözden geçirilmiş saat tahmini (Slice A tek başına):**
landing bileşeni + copy (~3-4h) + canvas animasyon (~2-3h) + `/app` route'u
+ mevcut mantığın taşınması (~1-2h) + 34 test dosyasının `goto` güncellemesi
+ doğrulama (~3-5h) + 9 iç link güncellemesi (~1h) + `LandingIntro.tsx`
kaldırma (~0.5h) + dar-kapsamlı TR/EN toggle (~1-2h) + görsel doğrulama
(Playwright ekran görüntüleri, mobil dahil) (~1-2h) ≈ **~17-24h tek
başına** — milestone'un TOPLAM eski tahminini (~14-24h) tek dilim
yutuyor, üstteki Estimated hours buna göre güncellendi.

### Slice A implementasyonu (2026-08-31) — tamamlandı
Plan modu (1 Plan agent, kod okuyarak stres-test etti) → kullanıcı onayı
("Çeviriler uygun, onaylıyorum. Uygula.") → uygulama, `feat/landing-page`
dalında 3 commit:

- `91001b7` — `LandingPage.tsx` + `AsciiBackground.tsx` (yeni) +
  `AppShell.tsx`'e taşınan eski `page.tsx` mantığı + yeni `/app/page.tsx`
  (`Suspense`-sarılı, `ResetPasswordView.tsx`'in deseni) + `AuthView.tsx`'e
  `initialMode` prop'u + `LandingIntro.tsx` silindi.
- `ab1adf4` — 34 test dosyası (33 mekanik `goto` swap + `landing.spec.ts`
  tam yeniden yazım) + yeni `mobile-viewport.spec.ts` testi.
- Planın EKSİK bıraktığı EN çevirisi (başlık/açıklama/alt-başlık/3 kutu)
  taslak olarak üretilip kullanıcıya onaylatıldı, implementasyona öyle
  girdi.

**Plandan sapmalar, ikisi de gerçek test/görsel kanıtla bulunup
düzeltildi:**
1. `legal-pages.spec.ts` kırıldı — plan `/` → `/app` linklerinin HEPSİNİ
   güncellemeyi varsaymıştı, ama privacy/terms sayfalarındaki "geri" linki
   METİN OLARAK "back to home" diyor — `/`'in kendisi artık gerçek "home"
   olduğu için o 4 link (`privacy`×2, `terms`×2) `/`'DE KALMALI, `/app`'e
   değil. Test hatasıyla yakalanıp düzeltildi (Tuzaklar'a eklendi).
2. Canvas deseni gerçek ekranda spec'in kendi "çok soluk, dikkat
   dağıtmayan" hedefinden daha yoğun çıktı — rampa boşluk oranı ~%9'dan
   ~%50'ye, opaklık tavanı 0.21'den 0.10'a düşürüldü (kullanıcı onayı,
   `AskUserQuestion`, ekran görüntüsüyle). Formülün kendisi DEĞİŞMEDİ.

**Doğrulama:** `npm run lint`+`typecheck` temiz, `npm run build` başarılı
(`/` `○ Static` olarak prerender ediliyor), mock'lu Playwright süiti
124/124 yeşil (2 kez koşuldu), `e2e-fullstack` 8/8 (2 dosya —
`delete-account`/`invite-issuance` — bilinen dev-fixture tüketimi yüzünden
reseed olmadan tekrar koşulunca başarısız oluyor, KOD REGRESYONU DEĞİL,
bkz. STATE.md Tuzaklar). Görsel doğrulama: masaüstü + 375px mobil + canvas
animasyonu + TR/EN toggle, gerçek Playwright ekran görüntüsüyle onaylandı.

### Slice D (2026-08-31) — legal sayfalara landing görsel dili

Kullanıcı terms/privacy'nin (4 dosya: TR/EN × terms/privacy) landing'in
renk/tipografi/buton stilini VE animasyonlu ASCII arka planını almasını
istedi. Kapsam turu (`AskUserQuestion`, 4 karar, hepsi önerilen seçenek)
sonrası implementasyon planı onaylandı, `feat/legal-pages-visual` dalında
(main'den, `feat/landing-page`'den BAĞIMSIZ — ayrı PR olarak incelensin
diye kullanıcı onayladı) uygulandı, 2 commit:

- `0770683` — yeni `LegalPageShell.tsx` (`"use client"`, KOQEP marka
  bloğu + pill-buton footer + `AsciiBackground` — sayfa metni `children`
  olarak server component kalıyor) + 4 sayfa dosyası bu shell'i kullanacak
  şekilde güncellendi.
- `2ea7a1a` — `legal-pages.spec.ts`'e marka bloğu+canvas testi, yeni
  `mobile-viewport.spec.ts` 375px testi.

**Kararlar (hepsi önerilen seçenek):** KOQEP logo+imleç+alt-başlık
eklendi; "buton stili" = mevcut iki footer linkinin (ana sayfaya dön/dil
değiştir) landing'in pill/outline buton görünümünü alması; canvas
`absolute` DEĞİL `fixed` (legal sayfalar 3000+px, `absolute` 4-5x hücre
maliyeti olurdu); paylaşılan `LegalPageShell.tsx` (sayfa metni `children`
olarak kalıyor, DRY ihlali yok).

**Gerçek bug, ekran görüntüsüyle bulundu (plandan sapma):** `AsciiBackground`
+ `className="fixed inset-0"` (`h-full w-full` OLMADAN) canvas'ı sadece
kendi içsel 300×150 boyutunda, sol-üst köşede bıraktı — `canvas` bir
"replaced element", `position:fixed`+`inset:0` TEK BAŞINA (width/height
`auto` iken) onu viewport'a GERMİYOR (CSS2.1 §10.3.8). `LandingPage.tsx`'in
`absolute` varyantı bunu `h-full w-full`'u className'e dahil ederek zaten
doğru yapıyordu, `fixed`'e geçerken bu iki class'ı taşımayı unuttum — ilk
ekran görüntüsü sorunu kanıtladı, `h-full w-full` eklenip düzeltildi,
sonraki ekran görüntüsü (masaüstü + scroll edilmiş + 375px mobil) canvas'ın
artık tam viewport'u kapladığını VE sayfa kaydırılınca yerinde SABİT
kaldığını (transform-containing-block tuzağına düşmediğini) doğruladı.

**Drive-by düzeltme:** Türkçe terms/privacy sayfaları önceden HİÇBİR
`lang` override'ı taşımıyordu (sadece İngilizce sürümler `lang="en"`
taşıyordu) — kök `<html lang="en">` olduğu için TR sayfalar işaretlenmemiş
kalıyordu (WCAG 3.1.2). `LegalPageShell`'in `lang` prop'u ile TR sayfalar
artık `lang="tr"` alıyor, EN sayfalar hiç override almıyor (kök zaten
`en` — `LandingPage.tsx`'in deseniyle aynı).

**Doğrulama:** `npm run lint`+`typecheck` temiz, `npm run build` başarılı
(4 route hâlâ `○ Static`), mock'lu Playwright süiti 126/126 yeşil (2 kez
koşuldu, canvas-boyut bugu düzeltildikten SONRA), `apps/api` testleri
319/319 (proje kuralı, etkilenmiyor ama bir kez koşuldu). Görsel doğrulama:
masaüstü üst/scroll edilmiş + 375px mobil üst/footer, gerçek Playwright
ekran görüntüsüyle onaylandı — bug BU doğrulama adımında yakalandı, teste
güvenip atlanmadı.

### Slice E kapsam turu (2026-09-01) — login/register görsel yeniden tasarımı

Kullanıcı Claude Design'da `/app`'in giriş/kayıt kartı için landing/legal
ile AYNI görsel dilde bir tasarım üretti: üstte KOQEP marka bloğu + TR/EN
kutusu, altta tek kartlı sekmeli (giriş/kayıt) form, kart dışı altta
"ana sayfaya dön"/"yardım" linkleri, aynı `AsciiBackground.tsx` (daha
düşük opaklıkla). `AuthView.tsx`/`AppShell.tsx`/`PasswordInput.tsx` okunarak
doğrulanan bulgular:

**State/handler mantığı DEĞİŞMEDEN JSX/stil değişimi — MÜMKÜN, doğrulandı.**
`AuthView.tsx`'in `mode`/`totpRequired`/`resetRequested`/`signupComplete`
state'i ve `handleSubmit`/`switchMode` mantığı JSX'ten TAMAMEN ayrık — sadece
`return` bloğu değişecek. **Ama üçüncü bir mod var, tasarımda YOK:**
`mode` sadece `"login"`/`"signup"` değil, `"forgot-password"` de var (bugün
"forgot your password?" linkiyle girilen ayrı bir ekran). Sekmeli tasarım
SADECE giriş/kayıt'ı kapsıyor — `forgot-password` durumunun sekme
çubuğuyla nasıl bir arada duracağı tasarımda BELİRTİLMEMİŞ, açık karar.

**`PasswordInput.tsx` DEĞİŞİKLİKSİZ yeniden kullanılabilir** — zaten
`inputClassName`'i (kart içi diğer alanlarla aynı stil) kullanıyor, zaten
tam genişlik (`w-full pr-8`) davranışı doğru (M11a'nın width-bug düzeltmesi).

**AsciiBackground `fixed`+`h-full`+`w-full` deseni — Slice D'nin bulduğu
hatayı BAŞTAN doğru kurmak için:** `AppShell.tsx`'in auth dalı bugün
`<main className="animate-fade-in mx-auto flex min-h-dvh max-w-sm ...">`
— `LegalPageShell.tsx`'teki AYNI kural burada da geçerli: canvas bu
`animate-fade-in` taşıyan `<main>`'in KARDEŞİ olmalı (İÇİNDE değil), VE
`className`'i `pointer-events-none fixed inset-0 h-full w-full` olmalı
(SADECE `fixed inset-0` canvas'ı 300×150 içsel boyutta sol-üstte bırakır,
STATE.md Tuzaklar'da artık yazılı).

**Component sınırı önerisi:** legal sayfalardaki `LegalPageShell.tsx`
deseniyle tutarlı — dış chrome (KOQEP marka bloğu + TR/EN kutusu +
AsciiBackground + alt linkler) `AppShell.tsx`'in auth dalına (ya da yeni
küçük bir `AuthPageShell.tsx`'e) yerleşir, `AuthView.tsx` SADECE kart
içeriğini (sekmeler + form) üretmeye devam eder — bugünkü "shell dış
chrome'u taşır, iç bileşen kendi içeriğini üretir" ayrımı korunur.

**Test etkisi — Slice D'den (0 dosya) FARKLI, gerçek bir maliyet var:**
`getByLabel("email")`/`getByLabel("password")` DEĞİŞMEZSE (etiket metni
aynı kalır, sadece placeholder EKLENİR — hiçbir test placeholder kontrol
etmiyor, grep ile doğrulandı) VE "log in"/"sign up" buton erişilebilir adı
AYNEN KALIRSA (LandingPage.tsx'in `<span aria-hidden="true">&gt; </span>log
in` deseniyle — "> " süsü `aria-hidden` içinde, erişilebilir ada
KARIŞMIYOR), 35 dosyanın PAYLAŞILAN login-boilerplate'i (auth-mocks.ts
SADECE ağ mock'unu merkezîleştiriyor, UI adımlarını DEĞİL — her dosya
KENDİ `getByLabel(...).fill()`/`getByRole("button",{name:"log in"})`
adımlarını tekrarlıyor) ETKİLENMEZ. **Ama mod-değiştirme kontrolü
KESİNLİKLE değişiyor** — bugünkü "don't have an account? sign up" metni
tasarımda "kayıt ol'a geç" (kısa, sekme-benzeri) oluyor, bu METİN
DEĞİŞİYOR — grep ile TAM olarak 2 dosya bunu kullanıyor
(`auth.spec.ts` 3 test, `e2e-fullstack/invite-issuance.spec.ts` 1 kullanım)
+ `auth.spec.ts`'in "forgot your password?"/"back to login" testi (aynı
dosya). **Toplam gerçek test maliyeti: ~2 dosya, TAHMİN EDİLENDEN çok daha
küçük** — ilk bakışta "35 dosya login yapıyor" korkusu yanlış çıktı, çünkü
asıl riskli metin (mod-değiştirme linki) sadece 2 dosyada kullanılıyor.

**TR/EN switcher — landing/legal'den FARKLI, gerçek bir komplikasyon
bulundu:** `AuthView.tsx` BUGÜN tamamen İngilizce ama bunun bir kısmı
YANILTICI bir görünüm — `err.message` (satır 88) BACKEND'İN HAM hata
mesajını gösteriyor, ve `AuthService`'in yorum satırı (81-83) bunu doğruluyor:
"Backend'in ham mesajı Türkçe (A20, backend hata metinleri henüz
çevrilmedi)". `auth.spec.ts`'in KENDİSİ bunu kanıtlıyor —
`E-posta veya şifre hatalı.` (satır 113) TÜRKÇE bir backend mesajını
BİREBİR bekliyor. Yani BUGÜN BİLE, "İngilizce" arayüzde birçok gerçek hata
(yanlış şifre, geçersiz davet kodu, rate-limit vb.) TÜRKÇE görünüyor —
SADECE `TOTP_REQUIRED`/`EMAIL_NOT_VERIFIED` gibi BİLİNEN kodlar frontend'in
kendi İngilizce mesajıyla override ediliyor. Bir TR/EN kutusu eklemek, bu
İKİ konudan birine düşer: (a) SADECE statik metni (sekme etiketleri,
prompt satırı, alt-başlık) çevirmek — ama kullanıcı "EN" seçse bile birçok
gerçek hata YİNE Türkçe kalır (YANILTICI, "İngilizce seçtim ama hata
Türkçe" şikayeti riski), (b) hata mesajlarını da kapsayan TAM bir çeviri —
bu A20'nin (backend hata metinleri i18n) kapsamı, BU turun BOYUTUNU
KATLAR. `docs/BACKLOG.md` A27'nin reddettiği "yarım no-op" riskinden
DAHA CİDDİ bir versiyon — landing/legal'de HİÇ dinamik/backend-kaynaklı
metin yoktu, burada VAR.

**Açık kararlar (implementasyon planından ÖNCE netleşmeli, aşağıda
`AskUserQuestion` ile soruldu):**
1. TR/EN kutusu bu turda eklensin mi (yukarıdaki backend-mesaj
   komplikasyonuyla), yoksa sayfa şimdilik İngilizce mi kalsın?
2. `forgot-password` modu sekmeli tasarımda nasıl görünsün — sekme çubuğu
   TAMAMEN gizlenip SADECE reset formu mu gösterilsin (bugünkü davranışın
   birebir chrome'lu hali), yoksa sekmeler görünür ama pasif mi kalsın?

**Kaba saat tahmini:** shell/kart restructuring (~2-3h) + sekme mekanizması
+ forgot-password entegrasyonu (~1-2h) + AsciiBackground `fixed` kurulumu
(~0.5h, Slice D'den öğrenilen doğru desenle) + ~2 test dosyasının mod-
değiştirme metni güncellemesi (~0.5h) + görsel doğrulama (login+register+
forgot-password × masaüstü/mobil, ekran görüntüsü) (~1.5-2h) ≈ **~6-8h**
(TR/EN kararına göre ±1-2h) — Slice D'ye yakın, Slice A'dan küçük.

**Kararlar (2026-09-01, `AskUserQuestion` ile netleşti — ikisi de önerilen
seçenek):**
1. TR/EN kutusu BU TURDA EKLENMİYOR — sayfa İngilizce kalıyor, yanıltıcı
   kısmi-çeviri riski (backend hata mesajları hâlâ Türkçe dönebiliyor, A20
   henüz yapılmadı) hiç oluşmuyor. TR/EN, A20 tamamlanınca ayrıca ele
   alınabilir.
2. `forgot-password` modunda sekme çubuğu TAMAMEN gizleniyor — bugünkü
   davranışın birebir aynısı (sadece reset formu + "girişe dön" linki),
   yeni chrome ile ama mantık değişmiyor.

### Slice E implementasyonu (2026-09-01) — tamamlandı

Plan modu (Explore agent + doğrudan araştırma, kod okuyarak stres-test
etti) → kullanıcı onayı ("Onaylıyorum, uygula. İkincil buton kararı (her
iki sekmede de simetrik) doğru varsayım, onaylıyorum.") → uygulama,
`feat/auth-visual-redesign` dalında (main'den, `feat/legal-pages-visual`'dan
BAĞIMSIZ) 2 commit:

- `beb50df` — yeni `AuthPageShell.tsx` (`LegalPageShell.tsx`'in aynı
  deseni) + `AppShell.tsx`'in auth dalı onu kullanacak şekilde güncellendi
  + `AuthView.tsx`'in SADECE `return` bloğu yeniden yazıldı (state/handler
  mantığı DEĞİŞMEDEN) — kod tabanında İLK `role="tablist"`/`"tab"`
  kullanımı (WAI-ARIA APG'nin tam roving-tabindex/ok-tuşu navigasyonu
  bilerek İCAT EDİLMEDİ, native Tab+Enter/Space yeterli kabul edildi).
- `04ed45c` — `auth.spec.ts` (3 satır) + `invite-issuance.spec.ts` (1
  satır) mod-değiştirme seçicisi güncellendi + 3 yeni test.

**Çeviri kararları (plandan, implementasyona ONAYLANMIŞ haliyle girdi):**
"giriş yap"→"log in", "kayıt ol"→"sign up", "kayıt ol'a geç"→"sign up"
(landing'in KENDİ "+ sign up" outline CTA'sıyla birebir), "ana sayfaya
dön"→"back to home", "yardım"→"help", placeholder'lar İngilizce örneklere
çevrildi (`you@example.com`, `captain_49`).

**İkincil mod-değiştirme butonu simetrik uygulandı** (kullanıcı onayı) —
brief SADECE login sekmesi için "kayıt ol'a geç" yazmıştı, register
sekmesi için tekrarlamamıştı; bugünkü davranışla (her iki yönde de
switch-butonu) tutarlılık için HER İKİ sekmede de eklendi.

**Doğrulama:** `npm run lint`+`typecheck` temiz, `npm run build` başarılı
(`/app` hâlâ `○ Static`), mock'lu Playwright süiti 129/129 yeşil (34+3
yeni test dahil), `e2e-fullstack` 10/10 (yerel Postgres `docker compose
up`+migrate+seed+backfill zinciriyle taze hazırlandı — `invite-issuance.
spec.ts`'in gerçek sekme tıklamasıyla signup akışı DOĞRULANDI), `apps/api`
319/319. Görsel doğrulama: login/signup/forgot-password × masaüstü/375px
mobil, gerçek Playwright ekran görüntüsüyle onaylandı — kart taşmıyor,
aktif sekme görsel olarak ayırt edilebilir, canvas `opacity-50` ile
landing'den gerçekten daha soluk.
