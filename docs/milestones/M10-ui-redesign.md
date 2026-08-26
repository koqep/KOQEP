# M10 — Arayüz Tasarım Geçişi

**Faz 1 (tasarım kararları) ONAYLANDI (2026-08-26).** **Faz 2 (kod) BAŞLADI — Slice A (panel deseni) TAMAMLANDI, `feat/m10-slice-a-side-panel` dalında, push onayında.** Kalan Faz 2 dilimleri aşağıdaki "Tasks — Faz 2 kod dilimleri" listesinde.

*Kullanıcı bu milestone'u kendi 2026-08-12 kapsam turunda "M7" diye adlandırdı. **Burada M10 olarak numaralandırıldı** — sıralama nedeniyle: M7 (`M7-scale-and-critical-fixes.md`) 500-kullanıcı hedefinin ATEŞLEDİĞİ, ölçüm/adalet/kapasite gibi ERTELENEMEZ düzeltmeleri kapsıyor, M8 kullanıcının istediği yeni özellikleri. Bu ikisi CIDDI yeni UI yüzeyleri yaratıyor (landing sayfası, oda listesi, DM arayüzü, bildirim/rozet UI'ları) — hepsini M10'un TASARIM KARARLARI olmadan inşa edip SONRA yeniden tasarlamak, kullanıcının kendi endişesini ("tasarım ikinci kez bozulur") doğrudan gerçekleştirir. Bu yüzden M10, saf kronolojik sırada DEĞİL, M7/M8'in HER yeni-yüzey-yaratan dilimiyle KOORDİNELİ ilerliyor — aşağıya bakın.*

**Goal:** Ürünün gerçek bir tasarım dili olsun — hiyerarşi, bileşen deseni, motion — M0'dan beri istenen ama hiç sistematik uygulanmayan akışkanlık dahil.
**Demo:** Header'da hesap işlemleri tek bir menüde; oda listesi dikey, okunmamış/aktif göstergeli; panel açılışı/oda geçişi/mesaj gelişi tutarlı bir motion diliyle.
**Estimated hours:** Faz 1 (tasarım kararları) TAMAMLANDI (2026-08-26). Faz 2 (kod): kapsamına göre ~50-90 saat + ASCII avatar/profil paneli eklendiği için biraz daha — kesin rakam onay sonrası, Faz 2 plan-modu turunda netleşir, burada VERİLEN bir üst sınır değil.

## Out of scope
- Yeni bir tasarım SİSTEMİ/kütüphanesi kurmak (Tailwind zaten var, kalıyor) — bu bir YENİDEN DÜZENLEME, sıfırdan yeniden yazma değil.

## Süreç — İKİ AŞAMALI, DOĞRUDAN KODA GEÇİLMEZ
Kullanıcının kendi talimatı: önce tasarım kararları dokümante edilip ONAYLANIR, SONRA koda dökülür.

### Faz 1 — Tasarım kararları (2026-08-26, kullanıcının Claude Design mockup'ına dayanıyor — kod YOK)

**Not — M7/M8 zaten bitti, bu artık "önce gelen tasarım" değil GERÇEK bir yeniden tasarım.** Bu bölüm ilk yazıldığında M7/M8 henüz başlamamıştı, "yeni yüzey yaratmadan önce M10'a bak" koordinasyonu bekleniyordu. Bugün M7a/M7b TAMAMEN bitti — mevcut yatay sekme + tek-satır header (`RoomHeader.tsx`) zaten canlı. Aşağıdaki kararlar o hâliyle çalışan UI'nin BİREBİR YENİDEN TASARIMI, ilk-kez-inşa değil.

**Mockup:** kullanıcının Claude Design'da hazırladığı ekran görüntüsü — üst bar (marka + oda aksiyonları solda, moderasyon/dil/hesap sağda), sol kenar çubuğunda dikey/aranabilir/okunmamış-sayaçlı oda listesi, ana panelde yazara-göre-gruplanmış mesajlar. Terminal kimliği (monospace, siyah-beyaz, `#`/`>` karakterleri) korunmuş.

**Hiyerarşi — üç katmana ayrılıyor (mockup'ta zaten görünen yapı):**
1. **Üst bar** (ince, tüm sayfada sabit): `KOQEP` marka + `+ new room` + `explore` solda; `moderation [N]` (sadece moderatörse, açık rapor sayısı rozetiyle) + `TR/EN` dil değiştirici + `hesap ▾` sağda.
2. **Sol kenar çubuğu** (yeni — bugün yok): oda listesi. Arama kutusu (`search rooms...`, istemci tarafında zaten yüklü oda listesini isimle filtreler, yeni bir endpoint gerekmez), altında dikey oda satırları.
3. **Ana panel** (oda içeriği): odanın kendi alt-başlığı (`#oda-adı` + açıklama + sağda `invite`/`room settings`/`leave`), mesaj listesi, composer.

`hesap ▾` menüsüne giren işlemler (bugün header'da eşit-ağırlıklı 6 ayrı buton): iki faktörlü doğrulama, engellenenler, davetler, geri bildirim, hesabı sil, çıkış yap. **Moderasyon menüye GİRMİYOR** — mockup'ta ayrı, rozetli bir üst-bar öğesi (moderatör olmayanlar için hiç görünmez, zaten bugünkü davranış). Oda-özel işlemler (`invite`/`room settings`/`leave`) global header'dan odanın kendi alt-başlığına taşınıyor — bugün `RoomHeader.tsx`'in `onLeaveRoom` odanın switcher satırındaki `×` düğmesiyle karışık duruyor, ayrılıyor.

**Oda listesi:** yatay sekmeden sol kenar çubuğuna, dikey liste. Aktif oda: sol kenarlık + daha açık metin (mockup'taki yeşil kenarlık — gerçek renk Faz 2'de token'lardan seçilir, terminal siyah-beyaz kimliğiyle çelişmeyecek bir vurgu, ör. `text-neutral-200` + `border-l`). Arşivlenmiş/ölü oda: mevcut `(archived)` etiketi + soluk metin korunur. Sıralama: `lastActivityAt`'e göre (zaten `Room` üzerinde var, yeni veri gerekmez).

**Panel deseni (kullanıcı onayı: sağdan kayan overlay).** Bugün `RoomView.tsx`'in `activePanel` state'i TOTP/blocked/delete-account açılınca sohbeti TAMAMEN değiştiriyor — bu deseni bozan gerçek bug, düzeltiliyor. Yeni davranış: panel sağdan üzerine kayar (`--motion-duration-base` + `--motion-ease-standard`), sohbet ARKADA/dim görünür kalır, ESC ya da kapat düğmesiyle bağlamı kaybetmeden döner. ~375px'te (M7a Slice D'nin garantisi) panel tam ekrana genişler. TOTP/blocked/delete-account/moderasyon/**YENİ profil paneli** hepsi AYNI mekanizmayı kullanır — tek tutarlı panel bileşeni (Faz 2'de muhtemelen mevcut `activePanel` union'ının üstüne ince bir `SidePanel` sarmalayıcısı).

**Mesaj ritmi:** aynı yazarın ARDIŞIK mesajları gruplanır — grubun İLK mesajı avatar+kullanıcı adı+saat gösterir (mockup'taki `03:12 mert` satırı), aynı gruptaki SONRAKİ mesajlar sadece içerik + hover'da saat (küçük, sola hizalı, avatar sütunuyla aynı girinti). Grup kırılır: farklı yazar VEYA aradan makul bir süre geçmişse (Faz 2'de somut eşik belirlenir, öneri: 5 dakika — Slack/Discord emsali). Veri zaten var (`message.authorUsername`), backend değişikliği gerekmiyor.

**Boş durumlar (Faz 2'de somut kopya yazılır, burada sadece yerleşim):** yeni oda → composer'ın üstünde ortalanmış tek satır ("henüz mesaj yok, ilk sen yaz" tarzı, `ChatPanel.tsx`'in mevcut boş-oda metnini genişletir). Discover'da sıfır sonuç → arama kutusunun altında tek satır. İlk giriş → `LandingIntro.tsx` zaten var, BU turda değişmiyor (M7a Slice G'nin kapsamıydı, redesign'in konusu değil).

**Motion kuralları — YENİ token YOK (Out-of-scope'a uygun), sadece mevcutların sistematik kullanımı:** panel açılış/kapanış → `--motion-duration-base` (240ms) + `--motion-ease-standard`. Oda geçişi (aktif oda değişince ana panelin içerik fade'i) → `--motion-duration-fast` (120ms), zaten `animate-fade-in`'in kullandığı desen. Yeni mesaj gelişi → `--motion-duration-fast`, tek satırlık bir fade+slight-slide (yeni, ama MEVCUT token'larla, yeni bir `--motion-*` değişkeni icat edilmiyor).

**Backend'i henüz olmayan ÜÇ mockup özelliği (kullanıcının belirttiği ikiye bir tane daha eklendi — bulundu, tahmin değil):**
1. **Presence sayısı** ("5 online") — M8'e ait, presence altyapısı hiç yok (`docs/BACKLOG.md` zaten doğrulamış).
2. **Son-mesaj önizlemesi** (oda listesi satırında) — yeni bir sorgu/veri gerektiriyor.
3. **Okunmamış sayısı** (mockup'taki `3`/`12` rozetleri) — **kullanıcının mesajında YOKTU ama aynı sınıf boşluk: `docs/milestones/M8-social-features.md:24`, `ReadCursor`'a dayanıyor, o da henüz yok.** Üçü de AYNI muameleyi görüyor.

Üçü de Faz 2'de PLACEHOLDER (ör. sabit/boş görünüm, rozet YOK sayı yerine) olarak bırakılıyor, gerçek implementasyon M8'e devrediliyor. `docs/BACKLOG.md`'ye Faz 2 başlamadan önce üç somut tetikleyici eklenecek (M8'in ilgili slice'ları başladığında).

**ASCII avatar (kullanıcı onayı: blok-karakter kimlik deseni, `docs/BACKLOG.md` B7'nin karşılığı — V1'de zaten duruyordu, bu turda ileri çekiliyor).** Kullanıcı ID'sinden (UUID) deterministik üretilen, simetrik bir küçük ızgara (GitHub identicon mantığı — ID'nin hash'i ızgara hücrelerinin dolu/boş durumunu belirler, dikey eksende ayna simetrisi), `░▒▓█` blok karakterleriyle render edilir, RENK YOK (monokrom, terminal kimliğine sadık). Saf fonksiyon — `id → desen`, sunucu tarafında hiçbir şey saklanmaz/hesaplanmaz, `apps/web`'de client-side üretilir (Faz 2'de tam algoritma + boyut (mesaj listesi için küçük, profil paneli için büyük render) belirlenir). Yükleme YOK, moderasyon maliyeti YOK, kullanıcı SEÇİMİ yok — `docs/BACKLOG.md`'nin daha önceki "seçimli avatar = yeni moderasyon yüzeyi" tespitini baştan eliyor.

**Profil paneli (YENİ — `docs/BACKLOG.md` satır 547'nin "bio+avatar+rozet: M8, SONRA" kararından SADECE avatar+temel-profil kısmı bu turda ileri çekiliyor, bio VE rozet M8'de kalıyor).** Aynı sağdan-kayan panel deseni. Açılış: kendi profilin için `hesap ▾` menüsünden; başka bir kullanıcının profili için mesaj listesindeki avatar/kullanıcı adına tıklayınca. İçerik: büyük ASCII avatar (aynı algoritma, büyük render) + kullanıcı adı + katılma tarihi (`User.createdAt`, zaten var) + seviye/toplam XP (`User.level`/`totalXp`, zaten var, `UsersService.getProfile`'da dönüyor). **Bio YOK** — kullanıcının bu turki açık kararı, moderasyon-yüzeyi riski daha sonra ayrıca sorulacak. Rozet YOK — M4'ün (itibar) kendi kapsamında ayrı bir görsel sistem gerektiriyor, bu redesign'in konusu değil.

**Backend dokunuşu (Faz 2 için not, bu turda kod YAZILMIYOR):** `UsersService.getProfile` bugün SADECE `req.user.sub` (kendi profilin) için, `email`/`mutedUntil`/`muteReason` gibi ÖZEL alanlar döndürüyor — başka bir kullanıcının profili için bunlar SIZDIRILAMAZ. Faz 2 yeni, AYRI bir "genel profil" endpoint'i gerektirecek (ör. `GET /users/:username/profile` → sadece `username`/`createdAt`/`level`/`totalXp`, `new-endpoint` skill'i izlenecek). Yeni bir DB kolonu GEREKMİYOR — avatar saklanmıyor (ID'den türetiliyor), bio/rozet zaten kapsam dışı.

**M7/M8'in yeni yüzeyleri için erken kararlar — ARTIK GEÇMİŞTE KALDI, referans amaçlı korunuyor:** landing/onboarding (M7a Slice G, bitti, redesign'e dahil değil), oda-listesi'nin M7a Slice B/M7b Slice E ile gelen şekli (bitti, YUKARIDAKİ "Oda listesi" kararıyla YENİDEN tasarlanıyor), M8'in bildirim/rozet/DM arayüzleri (M8 henüz başlamadı — o milestone kendi plan-modu turuna başlamadan önce BU bölümün ilgili kısmına (özellikle profil paneline rozet eklenmesi) bakmalı).

### Faz 2 — Uygulama (kod)
Faz 1 onaylandıktan SONRA, normal slice-bazlı kod dilimleri — her biri kendi plan-modu turu.

## Tasks — Faz 2 kod dilimleri (Claude uygular, her biri kendi plan-modu turu)
- [x] **Slice A — Panel deseni: sağdan-kayan overlay.** Tamamlandı (2026-08-26). `activePanel`in sohbeti tamamen değiştirme bug'ı düzeltildi — yeni `SidePanel.tsx` (backdrop+overlay, `role="dialog"`/`aria-modal`/focus-trap), `RoomHeader`+`ChatPanel` artık her zaman mount (native `inert` ile bastırılıyor). Detay: "Plan notları — Slice A uygulaması" bölümü.
- [ ] **Slice B — Header/sidebar ayrımı.** Üst bar (marka+oda aksiyonları+hesap▾) + sol kenar çubuğu (aranabilir dikey oda listesi) — bugünkü `RoomHeader.tsx`'in yatay sekme+tek-satır yapısının yerini alacak.
- [ ] **Slice C — Mesaj ritmi.** Ardışık aynı-yazar mesajlarının gruplanması (`ChatPanel.tsx`/`MessageItem.tsx`).
- [ ] **Slice D — Deterministik ASCII avatar.** Blok-karakter kimlik deseni (saf `id → desen` fonksiyonu), mesaj listesi + hesap menüsünde küçük render.
- [ ] **Slice E — Profil paneli.** Yeni `GET /users/:username/profile` (public-safe alan seti) + SidePanel'i kullanan yeni panel türü (kendi/başkasının profili, büyük avatar+kullanıcı adı+katılma tarihi+seviye/XP, bio/rozet YOK).
- [ ] **Slice F — Placeholder'lar.** Presence sayısı/son-mesaj önizlemesi/okunmamış rozetleri için görsel yer tutucular (`docs/BACKLOG.md` A24-A26'nın kod tarafı, gerçek implementasyon M8'e devrediliyor).

## Koordinasyon notu (M7/M8 ile) — 2026-08-26'da GÜNCELLENDİ, orijinal senaryo artık geçerli değil
Yazıldığında M7/M8 henüz başlamamıştı, aşağıdaki iki madde "önce M10'a bak" koordinasyonunu varsayıyordu:
- ~~M7 Slice B/Slice G kendi plan-modu turlarına başlamadan önce M10 Faz 1'in ilgili kısmı çözülmüş olmalı~~ — M7a/M7b TAMAMEN bitti, bu koordinasyon hiç gerçekleşmedi (M10 Faz 1 M7'den SONRA yazıldı). Sonuç: bugünkü oda-listesi/landing UI'ı M10'un tasarım kararları OLMADAN inşa edildi — Faz 2 bu yüzden "yeni yüzey ekleme" değil, "var olanı yeniden tasarlama" işi (yukarıdaki Faz 1 notunda işaretli).
- **M8 için hâlâ geçerli** — M8 henüz başlamadı. M8 Slice D (mention/bildirim), Slice G (okundu durumu/rozetler), Slice J (DM) kendi plan-modu turlarına başlamadan önce, o yüzeyin M10 Faz 1/Faz 2'deki karşılığına (özellikle profil paneline rozet ekleme, okunmamış-sayısı placeholder'ının gerçek implementasyonu) bakmalı.

## Risks
- Bu milestone'un saat tahmini KASITLI OLARAK belirsiz (Faz 2 rakamı yok) — Faz 1 bitmeden gerçek bir tahmin vermek kullanıcının kendi "doğrudan implementasyona geçme" talimatını ihlal eder.
- M8 kendi erken kararını almadan başlarsa (yukarıdaki güncellenmiş koordinasyon notu) kullanıcının asıl endişesi (tasarımın ikinci kez bozulması) gerçekleşir — `docs/milestones/M8-social-features.md`'nin kendi Sıradaki notuna da bu uyarı eklenmeli (Faz 2 başladığında).

## Plan notları

### Slice A — Panel deseni: sağdan-kayan overlay (2026-08-26, tamamlandı)
Bir Plan agent'ı somut tasarımı üretti (DOM/CSS yaklaşımı, focus-trap, motion, 7 panelin minimal-diff entegrasyonu) — ardından kod okurken kendi başıma bir tutarlılık boşluğu bulundu: `handleRoomSwitch` + `CreateRoomView`/`DiscoverRoomsView`'ın `onCreated`/`onJoined`'ı panel'i `setActivePanel("none")` ile ANLIK kapatıyordu, panelin kendi kapat butonu ise YENİ animasyonlu `requestClosePanel()` yolunu kullanacaktı — aynı ekranda iki farklı kapanma davranışı karışırdı. Hepsi `requestClosePanel()`'e çevrildi.

**İmplementasyon sırasında bulunan ve düzeltilen 2 gerçek bug (Plan agent'ının tasarımında da fark edilmemiş, gerçek Playwright koşumlarıyla bulundu):**

1. **`position:fixed` viewport'a değil `<main>`'in kendi kutusuna göre konumlanıyordu.** `RoomView.tsx`'in `<main>`'i `animate-fade-in` taşıyor — bu bir `transform` animasyonu, `fill-mode:both` yüzünden animasyon bittikten SONRA bile `transform:translateY(0)` kalıcı kalıyor. CSS spec'ine göre `none` DIŞINDAKİ herhangi bir transform değeri (kimlik matrisi bile) o elemanı `position:fixed` torunları için bir containing block yapar — `SidePanel` `<main>`'in İÇİNDE olduğu için viewport'un tamamını değil `<main>`'in `max-w-2xl` genişliğindeki kutusunu kaplıyordu (`document.elementFromPoint(10,10)` ile `<body>` dönmesi, backdrop'un gerçek `getBoundingClientRect()`'inin `{x:304, width:672}` çıkması ile KANITLANDI — Plan agent'ının tasarımı bunu öngörmemişti, teorik CSS analiziyle değil GERÇEK ölçümle bulundu). **Düzeltme:** `createPortal` ile `document.body`'e portal — DOM ağacındaki HERHANGİ bir gelecekteki transform/filter'dan bağımsız, kalıcı bir çözüm.
2. **Escape sonrası odak tetikleyici butona değil panelin kendi başlığına dönüyordu.** React mount'ta child effect'leri parent'ınkinden ÖNCE çalıştırıyor — panelin kendi `useFocusOnMount`'u (child) `SidePanel`'in `useFocusTrap`'inden (parent) ÖNCE çalışıp `document.activeElement`'i (parent'ın effect'i bunu okuduğunda) YANLIŞ yakalıyordu (paneldeki başlık, tetikleyici buton değil). **Düzeltme:** önceki-odaklı-eleman artık RENDER SIRASINDA (bir `useEffect` içinde değil, `useRef`'in initializer'ında) yakalanıyor — render tüm effect'lerden (child dahil) önce geldiği için doğru eleman garantili yakalanıyor.

**Davranış değişikliği (bilinçli, Faz 1'in "arkadaki chat ... etkileşimsiz" kararının doğrudan sonucu):** panel açıkken arka plan artık GERÇEKTEN etkileşimsiz (native `inert`) — eskiden arka plandaki başka bir tetikleyiciye (ör. `blocked` butonu TOTP paneli açıkken) basmak paneli SESSİZCE değiştirirdi, artık standart modal semantiğiyle bu tıklama hiçbir şey yapmıyor, önce mevcut panel kapatılmalı. `blocked-users.spec.ts`'in bunu varsayan 2 testi YENİ davranışı doğrulayacak şekilde güncellendi.

**Gerçek saat:** ~4-5h (Plan agent + tasarım review ~1h, 7 panel+RoomView+SidePanel+useFocusTrap implementasyonu ~1.5h, iki gerçek bug'ın bulunup düzeltilmesi ~1.5h, test yazımı+güncellemesi+dokümantasyon ~1h).

**Doğrulama:** `apps/web` lint/typecheck/build temiz. Yeni `side-panel.spec.ts` (5 test: Escape/backdrop/inert/focus-trap/scroll-pozisyonu regresyonu) + `mobile-viewport.spec.ts`'e 1 yeni test (375px tam ekran) + `blocked-users.spec.ts`'in güncellenen 2 testi dahil TÜM süit (100 test) iki kez üst üste geçti, flakiness yok.
