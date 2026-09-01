# M13 — Panel sistemi + hesap menüsü yeniden tasarımı

*Kullanıcı Claude Design'da tüm panel sistemi (9 panel) için yeni bir
mekanizma tasarladı: sağdan-kayan overlay YERİNE, karartılmış arka plan
üzerinde ortada açılan bir pencere ("KOQEP · [panel adı]" + ✕ kapat).
AYRICA `AccountMenu.tsx`'in düz öğe listesi bir "settings" alt-grubu
altında toplanacak. M10'un KAPALI Faz 2'sinin panel-mekanizması kararının
(sağdan kayan overlay, bilinçli seçildi) TERSİNE dönüşü — M11b'nin landing/
onboarding kapsamıyla İLGİSİZ, bu yüzden ayrı bir milestone.*

**Goal:** Panel sisteminin (bugün 9 `activePanel` değeri: totp/blocked/
invites/delete-account/create-room/discover-rooms/moderation/sidebar/
profile) ve hesap menüsünün görsel dilini kullanıcının yeni tasarımıyla
hizala; feedback'i gerçek bir panele çevir; profile panelini zenginleştir.
**Demo:** Herhangi bir panel açıldığında ortada, karartılmış arka plan
üzerinde, "KOQEP · [panel adı]" başlıklı bir pencere açılıyor; hesap
menüsü artık profile/settings/log out — settings altında 2FA/blocked/
invites/feedback/delete account.
**Estimated hours:** ~16-24h (kapsam turu kararlarıyla netleşti — mesaj
sayısı ve davet-eden backend işi çıktı, TOTP boxed input ayrı bir slice'a
taşındı).

## Out of scope (2026-09-01 kapsam turunda kesinleşti)
- Backend'de "davet eden"/başkasının davet sayısı — THREAT-MODEL'in
  mevcut invite-tree-gizliliği duruşuyla ÇELİŞİYOR, kullanıcı onayıyla
  bu turdan çıkarıldı.
- Mesaj sayısı istatistiği — backlog'a ertelendi (kullanıcı onayı).
- `moderation` ve mobil `sidebar` panelleri — ESKİ (sağdan/soldan kayan)
  mekanizmada KALIYOR, ortada-modal'a geçmiyor (kullanıcı onayı, iki
  mekanizma bir arada yaşayacak).
- TOTP'nin 6 haneli kutucuklu kod girişi — ayrı, küçük bir slice/backlog
  maddesi olarak takip edilecek, bu turun kapsamı DEĞİL.
- WAI-ARIA APG'nin tam roving-tabindex tab/menü navigasyonu — proje
  hâlâ YAGNI duruşunu koruyor (`useDismissableMenu.ts`'in kendi yorumu).

## Acceptance criteria
- [x] Panel mekanizması: ortada modal, karartılmış arka plan
      (`rgba(0,0,0,0.8)`), "KOQEP · [panel adı]" başlığı + ✕, dış tıklama
      ile kapanıyor — moderation ve mobil sidebar ESKİ mekanizmada
      kalıyor. Mevcut 7 panel (new room/explore/profile/2FA/blocked/
      invites/delete account) taşındı; feedback HENÜZ yok (Slice C).
- [x] `AccountMenu.tsx`: invites/blocked/delete account/2FA "settings"
      panelinde (KENDİ paneli olarak açılıyor, flyout DEĞİL); profile/
      feedback/log out üst seviyede kalıyor (feedback Slice C'nin işi,
      henüz gerçek bir panel değil — bu yüzden "settings" altına
      TAŞINMADI).
- [x] Yeni bir "feedback" paneli var (bugünkü düz `mailto:` linkinin
      YERİNE) — açıklama + e-posta gösterimi + "write an email" butonu.
- [x] Profile paneli: seviye/XP/katılma tarihi ile zenginleşiyor — mesaj
      sayısı/davet sayısı/"davet eden" BU TURDA YOK (kapsam dışı, yukarı
      bkz.). Slice E'de tamamlandı, checkbox o sırada işaretlenmemişti —
      şimdi düzeltildi.

## Tasks
- [x] **Slice A — Panel mekanizması (SidePanel → ortada modal, 8 panel).**
      Tamamlandı (2026-09-01), `feat/centered-modal-panels` dalında.
      Detay Plan notları'nda.
- [x] **Slice B — AccountMenu "settings" paneli.** Tamamlandı
      (2026-09-01), `feat/account-settings-panel` dalında. Detay Plan
      notları'nda.
- [x] **Slice C — Yeni feedback paneli.** Tamamlandı (2026-09-01),
      `feat/feedback-panel` dalında. Detay Plan notları'nda.
- [x] **Slice D — Panel + login içerik görsel dili (buton/input).**
      Tamamlandı (2026-09-01), `feat/panel-content-styling` dalında.
      Detay Plan notları'nda.
- [x] **Slice E — Profile paneli görsel yeniden tasarımı.** Tamamlandı
      (2026-09-01), `feat/profile-layout` dalında. Detay Plan notları'nda.

## Risks
- **Test blast radius'u bu oturumun EN BÜYÜĞÜ** — 12 e2e dosyası panel
  açma/kapama mekaniğine dokunuyor, 7 dosya AccountMenu'nün DÜZ öğe
  listesine (`getByRole("menuitem", {name:...})`) bağımlı. Aşağıda
  ayrıntılı.
- **Gizlilik/THREAT-MODEL çatışması** — "davet eden" + başkasının davet
  sayısını herkese açık bir profilde göstermek, kodda VE THREAT-MODEL'de
  BİLEREK alınmış bir kararı tersine çeviriyor. Aşağıda ayrıntılı.

## Plan notları

### Kapsam turu (2026-09-01) — 3 paralel Explore agent'ıyla araştırıldı

**1. Panel mekanizması — göründüğünden KÜÇÜK bir değişiklik.**
`SidePanel.tsx` (80 satır) `document.body`'e portal'lanıyor (STATE.md'nin
`position:fixed`-transform-containing-block tuzağından kaçınmak için,
`RoomView.tsx`'in `<main>`'i `animate-fade-in` taşıdığı için ZORUNLU) —
bu portal AYNEN kalmalı, ortada-modal'da da GEÇERLİ bir sorun. Odak
tuzağı TAMAMEN `useFocusTrap.ts`'te (80 satır, elle yazılmış, Tab-döngüsü
+ Escape + odak-geri-yükleme + render-sırasında-yakalama) yaşıyor — bu
mantık pozisyondan (sağda/solda/ortada) TAMAMEN BAĞIMSIZ, DEĞİŞMEDEN
yeniden kullanılabilir. **Gerçek değişiklik SADECE:** dış wrapper'ın
`justify-end`/`justify-start` yerine `items-center justify-center`
olması, `animate-panel-slide-in/out(-left)` yerine yeni bir fade/scale
keyframe'i (mevcut `--motion-duration-base`/`--motion-ease-standard`
token'ları YENİDEN KULLANILARAK, yeni süre/easing İCAT EDİLMEDEN), ve
backdrop opaklığının `bg-black/60`'tan `rgba(0,0,0,0.8)`'e çıkması.
`RoomView.tsx`'te panel orkestrasyon katmanı ZATEN tek bir `activePanel`
union'ı + tek `requestClosePanel()` + tek mount noktası (M10 Faz 2'nin
bilinçli kararı) — bu da değişikliği KOLAYLAŞTIRIYOR, dokunulacak
tek bir yer var.

**Başlık deseni GERÇEK bir mimari değişiklik gerektiriyor:** bugün her
panel KENDİ `<h2 id={titleId}>` başlığını üretiyor (`SIDE_PANEL_TITLE_ID`
sabiti + `titleId` prop'u ile). Yeni tasarım "KOQEP · [panel adı]"
formatını TUTARLI şekilde İSTİYOR — bu, başlık metninin artık her panelin
KENDİ sorumluluğundan çıkıp SHELL'in (yeni modal wrapper'ının) sorumluluğuna
geçmesi demek: `RoomView.tsx`'te `activePanel`'e göre bir panel-adı
lookup'ı (`PANEL_TITLES: Record<ActivePanel, string>`) eklenmeli, 9
panel dosyasının HER BİRİ kendi `<h2>` başlığını KALDIRMALI. Küçük ama
9 dosyaya yayılan gerçek bir dokunuş.

**Hangi panellerin bu mekanizmaya geçtiği NETLEŞMEDİ — kullanıcının 8
panel listesi (new room/explore/profile/2FA/blocked/invites/feedback/
delete account) bugünkü 9 `activePanel` değerinden İKİSİNİ (moderation,
sidebar) DIŞARIDA bırakıyor:**
- `moderation` — moderatöre özel kuyruk paneli, farklı bir kullanım
  deseni (uzun içerik, sık aksiyon) — ortada-modal'a uygun mu, yoksa
  bilerek mi çıkarıldı, netleşmedi.
- `sidebar` — mobilde oda listesi, bugün SOLDAN kayan bir navigasyon
  çekmecesi (`side="left"` varyantı, `RoomSidebar.tsx`'in mobil kullanımı)
  — bu YAPISAL olarak bir "aksiyon paneli" değil bir navigasyon
  deseni, ortada-modal olarak KONSEPT OLARAK garip durabilir (kullanıcı
  gezinirken ortada bir pencere kapanıp açılması). Bilerek mi hariç,
  yoksa unutuldu mu belirsiz.

Eğer ikisi de HARİÇ tutulursa, `SidePanel.tsx` İKİ mekanizmayı BİRDEN
desteklemeli (eski sağdan/soldan-kayan `moderation`/`sidebar` için, yeni
ortada-modal diğer 8 için) — `variant` prop'u ile aynı dosyada, ya da iki
ayrı bileşen. Eğer HEPSİ (9'u da) geçerse, `SidePanel.tsx`'in ESKİ
mekanizması TAMAMEN kaldırılabilir, tek bir yeni bileşen yeterli — daha
temiz ama `sidebar`'ın navigasyon-deseni doğasıyla gerginlik riski var.

**2. AccountMenu "settings" alt-grubu — yeni bir UI deseni, kod
tabanında YOK.**
Bugün `AccountMenu.tsx` DÜZ 7 öğe: `profile` (koşullu), `two-factor
authentication`, `blocked`, `invites`, `feedback` (mailto linki, panel
DEĞİL), `delete account`, `log out`. Kullanıcının isteği `invites`/
`blocked`/`feedback`/`delete account`/`two-factor authentication`'ı
"settings" altına toplamak — `profile`/`log out` üst seviyede KALIYOR
(kullanıcının kendi listesinden çıkarım). Bu YENİ bir "nested menu" deseni
gerektiriyor — `useDismissableMenu.ts` ŞU AN tek-seviyeli (tek `isOpen`/
`onClose` çifti), iç içe bir flyout menü YOK. İKİ makul yaklaşım:
(a) "settings" bir flyout ALT-MENÜ açar (yeni ARIA/klavye deseni icat
etmek gerekir), (b) "settings" kendisi YENİ bir panel açar (5 öğeyi
buton/link listesi olarak İÇİNDE gösterir — panel mekanizması ZATEN
yeniden inşa ediliyor, bu YAKLAŞIM tutarlı ve daha AZ yeni kod).
**(b) öneriliyor** — yeni ARIA-submenu deseni icat etmekten kaçınır,
zaten inşa edilen panel mekanizmasını yeniden kullanır.

**3. Test blast radius — bu oturumun en büyüğü, iki ayrı kategori:**
- **Panel açma/kapama mekaniği:** `side-panel.spec.ts` (mekanizmanın
  KENDİSİNİ test ediyor — backdrop/Escape/focus-trap/slide-yönü
  assertion'ları SÖZ KONUSU OLABİLİR) + 11 BAŞKA dosya panel açıp
  kapatmayı KENDİ akışlarının bir PARÇASI olarak yapıyor
  (`mobile-viewport`, `profile-panel`, `blocked-users`, `totp-settings`,
  `moderation`, `assign-moderator`, `room-moderation`, `invite`,
  `delete-account`, `create-room`, `discover-rooms`) — TOPLAM 12 dosya.
- **AccountMenu düz-liste bağımlılığı:** `getByRole("menuitem",
  {name:...})` DOĞRUDAN 5 farklı erişilebilir ada bağımlı (`profile`,
  `two-factor authentication`, `blocked`, `invites`, `delete account`) —
  7 dosyada (`profile-panel`, `totp-settings`, `side-panel`, `invite`,
  `delete-account`, `blocked-users`, `mobile-viewport`). "Settings"
  alt-grubuna taşınan 4'ü (2FA/blocked/invites/delete-account) için bu
  seçiciler DEĞİŞMELİ (önce "settings" tıklanıp SONRA panel içindeki
  öğe bulunmalı) — `profile` menuitem'i muhtemelen DEĞİŞMİYOR (üst
  seviyede kalıyor).

**4. Backend/gizlilik — GERÇEK bir THREAT-MODEL çatışması bulundu, en
önemli bulgu bu.**
`PublicUserProfile` bugün SADECE 4 alan: `username`, `createdAt`, `level`,
`totalXp` — `messageCount`/`inviteCount`/`invitedBy` YOK.
- **Gün sayısı:** SIFIR backend işi — `createdAt` zaten dönüyor, frontend
  `Date.now() - createdAt` hesaplayabilir.
- **Mesaj sayısı:** yeni bir `prisma.message.count({where:{authorId}})`
  sorgusu gerekir — `Message`'ın `authorId`'de İNDEKSİ YOK (sadece
  `(roomId, createdAt)` composite index var), sık çağrılırsa yeni bir
  `@@index([authorId])` migration'ı gerekebilir. Orta büyüklükte,
  gerçek ama makul bir ek — gizlilik sorunu YOK (mesaj SAYISI, İÇERİĞİ
  değil).
- **Davet sayısı (BAŞKASININ) + "davet eden":** `InvitesService.
  listInvites()` bugün SADECE giriş yapmış kullanıcının KENDİ davetleri
  için var (`req.user.sub`, route param DEĞİL) — kodun İÇİNDE, tam bu
  konuyu ele alan bir yorum satırı var: "kimin kimi davet ettiğini bugün
  geri okuyan hiçbir uç nokta yok... bu YENİ bir gizlilik kararı." Yani
  bu SINIRLAMA bilerek konmuş, unutulmuş bir eksik DEĞİL.
  `User.inviterId` şeması FK olarak VAR (`auth.service.ts`'te sadece bir
  kez yazılıyor) ama HER yerde ÖZEL veri olarak davranılıyor:
  `MeService.exportUserData` KENDİ verisini export ederken bile
  `inviterId`'yi BİLEREK dışarıda bırakıyor (bunu doğrulayan bir test
  bile var: `expect(result.profile).not.toHaveProperty('inviterId')`).
  `THREAT-MODEL.md`'nin Sybil/koordineli-saldırı satırları (2026-08-12
  revize edildi) 500-kullanıcı ölçeğinde davet ağacının artık KİMSE
  tarafından tam görülemediğini, bunun ERİYEN ama GERÇEK bir güvenlik
  özelliği olduğunu AÇIKÇA yazıyor — "davet eden"i HERKESE AÇIK bir
  profilde göstermek bu duruşu DOĞRUDAN tersine çeviriyor, sybil/davet-
  ağacı haritalamayı KOLAYLAŞTIRIYOR. En yakın emsal (mesaj düzenleme
  geçmişi, satır 3) de KISITLAYICI yönde: "sadece yazara ve moderatöre
  görünür... halka açık değil (taciz/gözetleme aracı olmasını önler)."

**Açık kararlar (implementasyon planından ÖNCE netleşmeli, aşağıda
`AskUserQuestion` ile soruldu):**
1. "Davet eden" + başkasının davet sayısı HERKESE AÇIK profilde
   gösterilsin mi (THREAT-MODEL'in mevcut duruşunu tersine çevirir),
   SADECE kendi profilinde mi (aynı `ProfileView.tsx` hem kendi hem
   başkasının profili için kullanılıyor — "kendi profilim mi" ayrımı
   yapılabilir), yoksa bu turda HİÇ eklenmesin mi?
2. Mesaj sayısı bu turda eklensin mi (yeni sorgu + muhtemel index), yoksa
   backlog'a mı ertelensin?
3. Ortada-modal mekanizmasına HANGİ paneller geçiyor — kullanıcının
   listesindeki 8'i mi (moderation/sidebar hariç), yoksa 9'u (moderation
   dahil) mi, yoksa 10'u (mobil sidebar navigasyon çekmecesi de dahil) mi?
4. "Settings" alt-grubu KENDİSİ yeni bir panel mi açsın (önerilen, ARIA-
   submenu icat etmez), yoksa flyout bir alt-menü mü olsun?

**Kararlar (2026-09-01, `AskUserQuestion` ile netleşti — hepsi önerilen
seçenek):**
1. "Davet eden"/başkasının davet sayısı BU TURDA HİÇ EKLENMİYOR —
   THREAT-MODEL'in mevcut duruşu korunuyor.
2. Mesaj sayısı BACKLOG'A ERTELENİYOR — bu turda sadece zaten var olan
   alanlar (seviye/XP/katılma tarihi) kullanılıyor.
3. Ortada-modal mekanizmasına SADECE kullanıcının listelediği 8 panel
   geçiyor (moderation + mobil sidebar ESKİ mekanizmada kalıyor, iki
   mekanizma bir arada yaşıyor).
4. "Settings" kendi PANELİ olarak açılıyor — yeni bir ARIA-submenu
   deseni icat edilmiyor.

TOTP'nin 6 haneli kutucuklu girişi AYRI bir konu (kullanıcı "maliyetini
değerlendir" dedi, karar sormadı) — bulgular: bugün TEK bir
`<input type="text" aria-label="authenticator code">` (`TotpSettingsView.tsx`,
2 yerde aynı desen). 6 kutuya bölmek `totp-settings.spec.ts`'in
`getByLabel("authenticator code").fill(...)` desenini KIRAR (6 ayrı input
ya nasıl doldurulacak/nasıl tek bir erişilebilir ada bağlanacak yeniden
tasarlanmalı) + YENİ bir input-focus-ilerleme deseni (bir kutuya yazınca
otomatik SONRAKİne geçme) gerektirir — bu, panel-mekanizması işinden
TAMAMEN BAĞIMSIZ, kendi başına orta büyüklükte bir iş (~2-3h). **Öneri:**
bu turdan ÇIKARILIP ayrı, küçük bir slice olarak backlog'a alınsın —
panel mekanizması + AccountMenu + profile zaten yeterince büyük, aynı
turda TOTP input'unu da yeniden tasarlamak riski gereksiz büyütür.

### Slice A implementasyonu (2026-09-01) — tamamlandı

Plan modu (2 paralel Explore agent — biri `SidePanel.tsx`/`useFocusTrap.ts`/
`RoomView.tsx`/`globals.css` çekirdeğini, diğeri 7 panelin başlık/close
deseninin BİREBİR aynı olduğunu doğruladı) → kullanıcı onayı → uygulama,
`feat/centered-modal-panels` dalında (main'den, diğer M13 slice'larından
BAĞIMSIZ) 2 commit:

- `c1b31f3` — yeni `CenteredModal.tsx` (`SidePanel.tsx`'in AYNI iskeleti:
  `document.body` portal + `useFocusTrap` DEĞİŞMEDEN yeniden kullanıldı;
  yeni: ortada yerleşim, `fade+scale` animasyonu — YENİ `--motion-*`
  token'ı icat edilmeden mevcutlar kullanıldı, `bg-black/80` backdrop,
  paylaşılan "KOQEP · {title}" başlığı + ✕ (`aria-label="close"`, mevcut
  "close" testleriyle erişilebilir ad tutarlı)) + `globals.css`'e 2 yeni
  keyframe (`modal-in`/`modal-out`) + 7 panel bileşeninin (CreateRoomView/
  DiscoverRoomsView/ProfileView/TotpSettingsView/BlockedUsersView/
  InviteView/DeleteAccountView) kendi başlık+close bloğu ve
  `useFocusOnMount` çağrısı KALDIRILDI (artık `CenteredModal`'ın
  sorumluluğu) + `RoomView.tsx`'in `<SidePanel>` mount bloğu ikiye
  ayrıldı (`sidebar`/`moderation` → eski `SidePanel`, diğer 7 →
  `CenteredModal` + `PANEL_TITLES` lookup).
- `6c24b6e` — test dosyaları (aşağıda).

**Plan modunda bulunan, kapsam turunda YAKALANMAMIŞ gerçek bir kırılma:**
`side-panel.spec.ts`'in TÜMÜ + `mobile-viewport.spec.ts`'in bir testi
TOTP'yi "SidePanel mekanizmasının temsilcisi" olarak kullanıyordu — TOTP
CenteredModal'a taşınınca bu testler ARTIK SidePanel'i değil
CenteredModal'ı test eder hale gelirdi (sessizce yanlış). İkisi de
`moderation`'a geçirildi (moderatör-mock deseni `room-moderation.spec.ts`'ten
ödünç alındı) — SidePanel'in kendi doğrulaması artık moderation üzerinden,
CenteredModal'ın kendi doğrulaması yeni `centered-modal.spec.ts`'te
(AYNI 4 test + başlık-formatı + 375px mobil testi, SidePanel'in
"tam ekrana genişler" davranışının BİLEREK TERSİ — ortada, kenar
boşluklu).

**Doğrulama:** `npm run lint`+`typecheck` temiz, `npm run build` başarılı,
mock'lu Playwright süiti 135/135 yeşil, `e2e-fullstack` 8/10 (2 dosya —
`delete-account`/`invite-issuance` — bilinen dev-fixture tüketimi yüzünden
reseed olmadan tekrar koşulunca başarısız oluyor, KOD REGRESYONU DEĞİL,
bkz. STATE.md Tuzaklar), `apps/api` 319/319. Görsel doğrulama: TOTP +
create-room (CenteredModal, masaüstü+375px mobil) + moderation (ESKİ
SidePanel, DEĞİŞMEDİĞİNİ doğrulamak için) gerçek Playwright ekran
görüntüsüyle onaylandı — backdrop opaklığı, ortalanma, ✕ butonu, başlık
formatı, moderation'ın hâlâ sağdan kayan+`# moderation`+"close" metniyle
göründüğü gözle teyit edildi.

### Slice D kapsam turu (2026-09-01) — panel + login içerik görsel dili

Kullanıcı Slice A'nın SADECE dış kabuğu (konum/arka plan/başlık)
değiştirdiğini, panel İÇERİKLERİNİN (form alanları, butonlar, input
stilleri) hâlâ eski tasarımda olduğunu belirtti — landing/login/legal'in
görsel diline (pill butonlar, `#0a0a0a` input arka planı, ince gri
çerçeveler) geçmesi istendi. Kod okunarak doğrulanan bulgular, ikisi
gerçek bir sürpriz:

**"Pill buton" iddiası kod tabanıyla ÇELİŞİYORDU.** Landing'in CTA'ları,
`AuthView.tsx`'in submit/secondary butonları, `LegalPageShell.tsx`'in
footer linkleri — ÜÇÜ de KÖŞELİ (`rounded` class'ı kod tabanının
TAMAMINDA hiç kullanılmıyor, tek istisna `MessageContent.tsx`'in inline
kod bloğu, `rounded` = 0.25rem, pill DEĞİL). Yani "pill" gevşek bir
tanımdı — `AskUserQuestion` ile netleşti: asıl istenen landing/login/
legal'in ZATEN kullandığı köşeli solid (`bg-neutral-200`) + outline
(`border-neutral-800`) buton çiftini panellere taşımak, YENİ bir şekil
icat edilmiyor.

**"`#0a0a0a` input arka planı" da HİÇBİR yerde yoktu — landing'de hiç
input yok, legal'de hiç input yok, `AuthView.tsx`'in KENDİ input'ları
bile panellerle AYNI paylaşılan `inputClassName`'i (`bg-transparent`,
dolgu YOK) kullanıyor.** Yani bu istek bir MEVCUT deseni tekrarlamak
değil, GERÇEKTEN yeni bir karardı. `#0a0a0a` kendisi de yeni bir renk
DEĞİL — Tailwind'in `neutral-950`'siyle BİREBİR aynı (zaten
`bg-neutral-950`/`text-neutral-950` olarak kod tabanında kullanılıyor,
ör. `AuthView.tsx`'in submit butonunun metin rengi).

**"İnce gri çerçeveler" ZATEN mevcut** — `inputClassName`
(`formStyles.ts`) zaten `border border-neutral-800` taşıyor, panellerin
KENDİ butonları da zaten aynı `border-neutral-800`/`hover:border-neutral-600`
paletini kullanıyor. Bu üçüncü ayak, en az değişiklik gerektiren.

**Gerçek risk — `inputClassName` 11 dosyada paylaşılıyor, SADECE 7
panel+login DEĞİL:** grep ile doğrulandı — `MessageItem.tsx` (mesaj
DÜZENLEME input'u, sohbet akışının İÇİNDE, panel bile değil),
`ModerationQueueView.tsx`/`AssignModeratorSection.tsx`/
`RoomModerationSection.tsx` (moderasyon formları) ve `RoomSidebar.tsx`
(oda arama kutusu) de AYNI sabiti kullanıyor. Moderasyon + sidebar,
Slice A'da BİLEREK eski mekanizmada/görsel dilde bırakılmıştı —
paylaşılan `inputClassName`'in KENDİSİNİ değiştirmek bu kararı KISMEN
tersine çevirirdi (mekanizma değil ama görsel dil değişirdi).

**Açık kararlar (implementasyon planından ÖNCE netleşmeli, `AskUserQuestion`
ile soruldu — hepsi önerilen seçenek):**
1. "Pill" = mevcut köşeli solid/outline çifti (YENİ bir şekil icat
   edilmiyor, sadece panellere taşınıyor).
2. Input dolgusu HER YERDE (`formStyles.ts`'in `inputClassName`'i
   KENDİSİ değişiyor) — panel+login+mesaj düzenleme+moderasyon+oda arama
   AYNI anda etkileniyor.
3. Ardından ayrı bir soruyla netleşti: `inputClassName`'in KENDİSİ
   DEĞİL, SADECE panel+login input'larına YENİ bir ek class (ör.
   `inputClassName + " bg-neutral-950"`) eklensin — mesaj
   düzenleme/moderasyon/oda arama DOKUNULMAZ, Slice A'nın "moderasyon+
   sidebar eski kalıyor" kararıyla TUTARLI. (Not: kullanıcı önce "her
   yerde" dedi, SONRA blast radius'un 11 dosyaya (moderasyon/sidebar/
   mesaj-düzenleme dahil) yayıldığı gösterilince "sadece panel+login"e
   daraltıldı — iki soru birbirini takip etti, ikinci soru ilkini
   netleştirdi.)

**Kapsam (netleşen haliyle):**
- 7 panel (`CreateRoomView`/`DiscoverRoomsView`/`ProfileView`/
  `TotpSettingsView`/`BlockedUsersView`/`InviteView`/`DeleteAccountView`)
  + `AuthView.tsx` (M11b Slice E, YENİ tamamlandı — bu slice ONA DA
  dokunuyor, cross-milestone bir dokunuş).
- Panellerin/login'in input'ları: `inputClassName`'in ÜSTÜNE
  `bg-neutral-950` eklenir (`formStyles.ts` DEĞİŞMİYOR).
- Panellerin BİRİNCİL form-submit butonları (create/block/enable/start
  setup/turn off authenticator/saved it) landing'in solid CTA
  desenine (`bg-neutral-200 px-4 py-1.5 text-neutral-950
  hover:bg-neutral-100`) geçiyor. `DeleteAccountView`'ın İKİ butonu
  (`delete my account`/`permanently delete my account`) KIRMIZI/
  destructive renklendirmesini KORUYOR (sadece boyut/padding
  hizalanıyor, `bg-neutral-200`'e DÖNÜŞMÜYOR — tehlike rengi
  seyreltilmemeli).
- Liste-içi satır aksiyonları (`join`/`unblock`/`show more`) DEĞİŞMİYOR
  — bunlar panelin "birincil" eylemi değil, mevcut sade metin-link stili
  KALIYOR (yeni bir buton hiyerarşisi icat edilmiyor).

**Test etkisi — SIFIR beklenen risk:** grep ile doğrulandı, 7 panelin
HİÇBİR butonu/input'u className/style/renk üzerinden test edilmiyor —
TÜMÜ `getByRole("button", {name: <görünür metin>})` ile metin üzerinden
seçiliyor, hiçbir buton metni DEĞİŞMİYOR (sadece className). Aynı düşük-
risk deseni bu oturumun önceki slice'larında (D/E) zaten doğrulanmıştı.

**Kaba saat tahmini:** 7 panel + AuthView'ın buton/input className
güncellemesi (~2-3h) + görsel doğrulama (7 panel + login, masaüstü+375px
mobil, ekran görüntüsü) (~1.5-2h) ≈ **~4-5h** — bu oturumun en küçük
slice'larından biri, saf className değişikliği.

### Slice D implementasyonu (2026-09-01) — tamamlandı

Plan modu (mevcut araştırma yeterliydi, yeni Explore agent'ı gerekmedi —
tek bir ek kontrol: `PasswordInput.tsx`'in TÜM tüketicileri) → kullanıcı
onayı → uygulama, `feat/panel-content-styling` dalında (main'den, diğer
M13 slice'larından BAĞIMSIZ) 1 commit (`14edd32`):

- `formStyles.ts`'e `filledInputClassName` eklendi (`inputClassName`
  DEĞİŞMEDEN).
- `PasswordInput.tsx`'e opsiyonel `filled` prop'u eklendi (varsayılan
  `false`) — plan modunda `PasswordInput.tsx`'in 4 tüketicisi olduğu
  bulundu (`AuthView.tsx`/`DeleteAccountView.tsx` kapsamda,
  `ResetPasswordView.tsx`/`AssignModeratorSection.tsx` DEĞİL) — opt-in
  prop deseni bu ikisinin davranışını DEĞİŞTİRMEDEN korudu.
- 5 panel dosyası (`CreateRoomView`/`TotpSettingsView`/`BlockedUsersView`/
  `DeleteAccountView`) + `AuthView.tsx`: input'lar `filledInputClassName`'e,
  birincil form-submit butonları landing'in solid CTA'sına geçti.
  `DeleteAccountView`'ın 2 butonu KIRMIZI kaldı (sadece padding
  hizalandı). `ProfileView.tsx`/`InviteView.tsx`/`DiscoverRoomsView.tsx`:
  değişiklik yok (input/buton içermiyor ya da liste-aksiyonu-only).

**Görsel doğrulamada bulunan, kod DEĞİŞİKLİĞİ gerektirmeyen bir gözlem:**
`filledInputClassName`'in `bg-neutral-950` dolgusu, hem `CenteredModal.tsx`
hem `AuthPageShell.tsx`'in KENDİ arka planı ZATEN `bg-neutral-950`
olduğu için ekran görüntülerinde GÖRSEL OLARAK ayırt edilmiyor — input'un
tek belirgin sınırı hâlâ `border-neutral-800` çerçevesi (`#0a0a0a`
kararı LİTERAL olarak doğru uygulandı, sadece pratik kontrastı bu
bağlamda düşük). Kullanıcıya ekran görüntüsüyle bildirildi, kod
DEĞİŞTİRİLMEDİ — daha açık bir dolgu (ör. `neutral-900`) istenirse ayrı
bir küçük düzeltme.

**Doğrulama:** `npm run lint`+`typecheck` temiz, `npm run build` başarılı,
mock'lu Playwright süiti 135/135 yeşil (öngörülen SIFIR risk doğrulandı),
`e2e-fullstack` 8/10 (2 bilinen dev-fixture testi hariç, KOD REGRESYONU
DEĞİL), `apps/api` 319/319. Görsel doğrulama: create-room (dolgulu
input + solid CTA), login ekranı (email + `PasswordInput`'un `filled`
hali), delete-account (2 kırmızı butonun rengini KORUDUĞU) gerçek
Playwright ekran görüntüsüyle onaylandı.

### Slice E kapsam + implementasyon (2026-09-01) — tamamlandı

Kullanıcının orijinal M13 tasarımı profile paneli için ASCII avatar +
seviye/XP çubuğu + "profili düzenle" istiyordu. Plan modunda `AskUser
Question` ile 3 YENİ bulgu netleşti:

1. **Mevcut `LargeAvatar` GERÇEKTEN ASCII DEĞİL** — M10 Faz 2 Slice D+E
   BİLEREK unicode karakterlerden (░▒▓█) gerçek SVG'ye (25 rect, 5x5
   ızgara) geçirmişti. Geri dönmek bu kararı tersine çevirir VE 2 testi
   kırardı (25-rect sayım testi, SVG outerHTML karşılaştırma testi).
   **Karar: `LargeAvatar` AYNEN kaldı, DOKUNULMADI.**
2. **"Profili düzenle" için SIFIR backend desteği var** (`@Patch`/`@Put`
   grep'i `apps/api/src/api`'de sıfır sonuç — hiçbir updateProfile
   servisi/endpoint'i yok). **Karar: bu turdan ÇIKARILDI**, milestone'un
   kendi "sadece görsel dil" notuyla tutarlı.
3. **XP yüzdesi için `XP_PER_LEVEL` (35) backend-only** —
   `reputation.service.ts`'te tanımlı, frontend'e hiç açılmamış. **Karar:
   backend hesaplayıp `PublicUserProfile`'a EKLİYOR** (yeni migration
   YOK — DB kolonu değil, sorgu-zamanlı hesaplanan alan).

**Kullanıcının kendi isteğiyle kapsam genişledi:** küçük avatar
(`SmallAvatar`) mesaj satırlarından VE hesap menüsü tetikleyicisinden
TAMAMEN kaldırıldı. Ayrı bir kapsam turu GEREKMEDİĞİ değerlendirildi —
SADECE 2 dosyada kullanılıyordu (`MessageItem.tsx`, `AccountMenu.tsx`),
her ikisinde de zaten `aria-hidden` dekoratif bir SVG (tıklanabilirliğe
hiç katkı vermiyor), backend'e hiç dokunmuyor.

**Uygulama**, `feat/profile-layout` dalında (main'den, diğer M13
slice'larından BAĞIMSIZ — bu oturumda bir M13 slice'ının İLK KEZ
backend'e dokunduğu dal) 2 commit:
- `24dd8b3` — `UsersService.getPublicProfile` artık `xpProgressPercent`
  hesaplayıp dönüyor (`XP_PER_LEVEL` `reputation.service.ts`'ten import
  edildi), `lib/api.ts`'in tip aynası güncellendi, `ProfileView.tsx`'e
  `role="progressbar"` ile bir XP çubuğu eklendi (mevcut metin satırları
  AYNEN kaldı, sadece altına yeni bir eleman eklendi — mevcut testleri
  KIRMAMAK için), `SmallAvatar` `MessageItem.tsx`+`AccountMenu.tsx`'ten
  kaldırıldı (tıklanabilirlik metin etiketinden geliyor, DEĞİŞMEDİ).
- `59d8812` — `users.service.spec.ts`'e 1 güncelleme + 1 yeni test
  (`xpProgressPercent` hesaplaması, tam-seviye-katında %0 durumu),
  `profile-panel.spec.ts`'te `kucuk_avatar_...` testi SİLİNDİ (SmallAvatar
  kaldırılınca test edecek SVG kalmadı), mock'lara `xpProgressPercent`
  eklendi, yeni bir progress-bar testi eklendi.

**Doğrulama:** `npm run lint`+`typecheck` temiz (apps/api VE apps/web),
`npm run build` başarılı, mock'lu Playwright süiti 135/135 yeşil (net
test sayısı DEĞİŞMEDİ — 1 silindi, 1 eklendi), `apps/api` 320/320,
`e2e-fullstack` 8/10 (2 bilinen dev-fixture testi hariç, KOD REGRESYONU
DEĞİL). Görsel doğrulama: profile panelinde XP çubuğunun GERÇEKTEN doğru
oranda dolduğu (Slice D'nin input-dolgusu gözleminin AKSİNE, bu çubuk
kendi `border-neutral-800` çerçevesine karşı NET görünür kontrast
taşıyor), mesaj satırında/hesap menüsü tetikleyicisinde avatar glyph'inin
ARTIK HİÇ görünmediği, gerçek Playwright ekran görüntüsüyle onaylandı.

### Slice B kapsam turu + implementasyonu (2026-09-01) — tamamlandı

Kapsam turunda `AskUserQuestion` ile 2 karar netleşti:
1. **`feedback` ÜST SEVİYEDE KALIYOR** — kullanıcının bu tur mesajındaki
   4 öğelik listede zaten YOKTU (henüz gerçek bir panel değil, mailto
   linki olarak kalıyor — Slice C'nin işi).
2. **"← back to settings" YOK** — her panel kendi ✕'iyle TAMAMEN
   kapanıyor, sadece bir "settings" basamağı EKLENİYOR.

Plan modunda doğrulanan mimari düzeltme: `AccountMenu` `RoomView.tsx`'te
DEĞİL `TopBar.tsx`'te render ediliyor — plumbing 3 dosyaya yayıldı
(`AccountMenu.tsx`→`TopBar.tsx`→`RoomView.tsx`).

Uygulama, `feat/account-settings-panel` dalında (main'den, diğer M13
slice'larından BAĞIMSIZ) 2 commit:
- `13aaf3f` — yeni `SettingsView.tsx` (4 satır, `role="button"` — bu
  panel `role="dialog"`, `role="menu"` DEĞİL, `role="menuitem"` burada
  GEÇERSİZ ARIA olurdu); `AccountMenu.tsx`'in eski 4 ayrı öğesi
  (two-factor authentication/blocked/invites/delete account) TEK bir
  `settings` menuitem'ine indirgendi; `RoomView.tsx`'e `"settings"`
  `ActivePanel` değeri + `activePanel` doğrudan `"settings"`'ten bir
  alt-panele (`onNavigate={setActivePanel}`, kontravaryans sayesinde
  cast'siz) geçiyor.
- `93e56d4` — test dosyaları (aşağıda).

**Plan modunda YAKALANMAMIŞ, implementasyon sırasında koddan
akıl yürütülerek bulunan bir odak-yönetimi bug'ı (henüz başarısız bir
test görülmeden, salt reasoning ile):** `CenteredModal.tsx`
`useFocusOnMount()`'u ([] bağımlılıklı, SADECE mount'ta ateşlenen bir
effect) kullanıyordu. `"settings"`→`"totp"` gibi bir geçiş her ikisinin
de `RoomView.tsx`'in AYNI ternary dalına düşmesi yüzünden `CenteredModal`'ı
UNMOUNT ETMİYOR (`activePanel` `"none"`'a hiç uğramadan değişiyor) — bu,
uygulamanın tarihinde İLK KEZ ortaya çıkan bir senaryo (`inert=
{isPanelOpen}` önceden HER panel geçişini `"none"` üzerinden zorluyordu).
Mount effect'i bir daha ateşlenmediği için başlık odağı SESSİZCE
`document.body`'e düşerdi. **Çözüm:** `CenteredModal.tsx`'te paylaşılan
hook'un YERİNE LOKAL bir `useRef` + `useEffect(() => {...}, [title])`
— hem ilk mount'ta (her effect ilk render sonrası da çalışır) hem her
sonraki title değişiminde (yeni panele geçişte) başlığa odaklanıyor.
Paylaşılan `useFocusOnMount` hook'unun KENDİSİ değiştirilmedi (`
RoomSidebar.tsx`/`ModerationQueueView.tsx` bu senaryoyu YAŞAMIYOR).

**Doğrulama:** `npm run lint`+`typecheck` temiz (her adımdan sonra),
`npm run build` başarılı (apps/web+apps/api), mock'lu Playwright süiti
137/137 yeşil (İKİ tam koşum — 2 yeni test eklendi: settings paneli 4
satırının `role="button"` olduğu + eski üst-seviye menuitem'lerin artık
YOK olduğu regresyon-koruması), `e2e-fullstack` 10/10 (reseed sonrası,
KOD REGRESYONU DEĞİL geçen slice'lardaki 8/10 sadece reseed edilmemiş
dev-fixture tüketimiydi), `apps/api` 320/320. Görsel doğrulama: account
menüsünde artık TEK `settings` girişi (eski 4 öğe YOK) + settings
paneli (4 satır) + settings'ten `totp`'a geçişin ANİMASYONSUZ/akıcı
olduğu VE odağın gerçekten alt-panelin başlığına düştüğü (odak-fix'inin
gerçekten çalıştığının kanıtı, `toBeFocused()` assertion'ıyla da
doğrulandı) gerçek Playwright ekran görüntüsüyle onaylandı.

### Slice C implementasyonu (2026-09-01) — tamamlandı

Kapsam net, plan modunda yeni bir Explore/Plan agent'ı GEREKMEDİ (Slice B
zaten AYNI panel mekanizması + `AccountMenu`→`TopBar`→`RoomView` plumbing
hattını inşa etmişti, bu slice AYNI deseni 6. panel olarak uyguladı) —
tek araştırma: mevcut mailto linkinin (`AccountMenu.tsx`) ve panellerin
solid-CTA buton deseninin (Slice D, `bg-neutral-200 px-4 py-1.5
text-neutral-950 hover:bg-neutral-100`) kod OKUNARAK doğrulanması.

Uygulama, `feat/feedback-panel` dalında (main'den, diğer M13
slice'larından BAĞIMSIZ) 2 commit:
- `1ca7f91` — yeni `FeedbackView.tsx` (statik panel — `accessToken`
  gerekmiyor, veri çekmiyor): açıklama paragrafı + `FEEDBACK_EMAIL`
  metni (`select-all font-mono`) + Slice D'nin solid CTA sınıfını
  taşıyan bir "write an email" `mailto:` linki. `AccountMenu.tsx`'in
  `feedback` satırı `<a href="mailto:...">`'dan `settings`'le AYNI
  desende bir `<button role="menuitem" onClick={() =>
  select(onOpenFeedback)}>`'a değişti — artık DOĞRUDAN harici linke
  gitmiyor, panel açıyor. `FEEDBACK_EMAIL` importu `AccountMenu.tsx`'ten
  `FeedbackView.tsx`'e taşındı. `RoomView.tsx`'e `"feedback"`
  `ActivePanel` değeri + `PANEL_TITLES` girdisi + ternary dalı eklendi.
- `634ef28` — test dosyaları (aşağıda).

`FEEDBACK_EMAIL` sabiti (`docs/BACKLOG.md` A19'un bilinçli kısıtı,
kişisel gelen kutusu) DEĞİŞMEDİ — sadece sunum değişti (linkin
`href`'inde gizli → panelde görünür metin + buton).

**Test değişiklikleri:** yeni `apps/web/e2e/feedback-panel.spec.ts`
(panel açılıyor + açıklama/e-posta görünüyor, "write an email"
butonunun `href`'i doğru, kapat butonu sohbet ekranına dönüyor) +
`clickable-links.spec.ts`'in bir yorum satırı güncellendi (feedback
artık menüde bir `<a>` değil, gerçek mailto: linki panelin içinde —
assertion'ın KENDİSİ değişmedi).

**Ayrıca bu turda fark edilip düzeltildi:** M13'ün 4. acceptance
criteria'sı ("profile paneli seviye/XP/katılma tarihi ile
zenginleşiyor") Slice E'de zaten TAMAMLANMIŞTI (`ProfileView.tsx`
level/XP/join-date'i zaten gösteriyor) ama checkbox o sırada
işaretlenmemiş kalmıştı — bu turda düzeltildi.

**Doğrulama:** `npm run lint`+`typecheck` temiz (her adımdan sonra),
`npm run build` başarılı, mock'lu Playwright süiti 140/140 yeşil (İKİ
tam koşum — 3 yeni test eklendi), `e2e-fullstack` 10/10 (reseed
sonrası), `apps/api` 320/320 (bu slice backend'e hiç dokunmuyor,
etkilenmedi). Görsel doğrulama: account menüsünde `feedback` girişinin
artık düz bir menü öğesi olduğu (mailto linki DEĞİL) + feedback
panelinin (açıklama + e-posta + "write an email" butonu, Slice D'nin
solid CTA'sıyla tutarlı) gerçek Playwright ekran görüntüsüyle onaylandı.

**M13'ün TÜM dilimleri (A/B/C/D/E) artık tamamlandı.**
