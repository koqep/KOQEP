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
