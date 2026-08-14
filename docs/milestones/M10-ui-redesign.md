# M10 — Arayüz Tasarım Geçişi

*Kullanıcı bu milestone'u kendi 2026-08-12 kapsam turunda "M7" diye adlandırdı. **Burada M10 olarak numaralandırıldı** — sıralama nedeniyle: M7 (`M7-scale-and-critical-fixes.md`) 500-kullanıcı hedefinin ATEŞLEDİĞİ, ölçüm/adalet/kapasite gibi ERTELENEMEZ düzeltmeleri kapsıyor, M8 kullanıcının istediği yeni özellikleri. Bu ikisi CIDDI yeni UI yüzeyleri yaratıyor (landing sayfası, oda listesi, DM arayüzü, bildirim/rozet UI'ları) — hepsini M10'un TASARIM KARARLARI olmadan inşa edip SONRA yeniden tasarlamak, kullanıcının kendi endişesini ("tasarım ikinci kez bozulur") doğrudan gerçekleştirir. Bu yüzden M10, saf kronolojik sırada DEĞİL, M7/M8'in HER yeni-yüzey-yaratan dilimiyle KOORDİNELİ ilerliyor — aşağıya bakın.*

**Goal:** Ürünün gerçek bir tasarım dili olsun — hiyerarşi, bileşen deseni, motion — M0'dan beri istenen ama hiç sistematik uygulanmayan akışkanlık dahil.
**Demo:** Header'da hesap işlemleri tek bir menüde; oda listesi dikey, okunmamış/aktif göstergeli; panel açılışı/oda geçişi/mesaj gelişi tutarlı bir motion diliyle.
**Estimated hours:** Faz 1 (tasarım kararları): ~15-25 saat. Faz 2 (kod): kapsamına göre ~50-90 saat — kesin rakam Faz 1'in çıktısına bağlı, burada VERİLEN bir üst sınır değil.

## Out of scope
- Yeni bir tasarım SİSTEMİ/kütüphanesi kurmak (Tailwind zaten var, kalıyor) — bu bir YENİDEN DÜZENLEME, sıfırdan yeniden yazma değil.

## Süreç — İKİ AŞAMALI, DOĞRUDAN KODA GEÇİLMEZ
Kullanıcının kendi talimatı: önce tasarım kararları dokümante edilip ONAYLANIR, SONRA koda dökülür.

### Faz 1 — Tasarım kararları dokümanı (kod YOK)
Aşağıdaki somut sorunlar için YERLEŞIM/HİYERARŞİ/MOTION kararları yazılı hale getirilir, ExitPlanMode ile onaya sunulur:
- **Hiyerarşi:** header'daki 8+ eşit-ağırlıklı buton (oda geçişi ile hesap silme aynı seviyede) — hesap işlemleri tek bir menüye toplanır. Hangi işlemler o menüye girer, hangileri ana yüzeyde kalır?
- **Oda listesi:** yatay sekmeden dikey listeye — aktif işaret, okunmamış sayısı (M8 Slice G'ye bağımlı), ölü oda solukluğu nasıl gösterilir?
- **Panel deseni:** ayarlar/moderasyon açılınca sohbetin tamamen kaybolması yerine yan panel/overlay — hangi panel türü hangi durumda?
- **Mesaj ritmi:** aynı yazarın ardışık mesajları gruplanır mı, zaman damgası ne kadar soluk?
- **Boş durumlar:** yeni oda, boş kuyruk, ilk giriş (M7 Slice G'nin onboarding'i) — her biri için somut bir tasarım.
- **Motion kuralları:** M2'de kurulan motion token'larının (`--motion-duration-*`, `--motion-ease-*`) sistematik nerelerde kullanılacağı — panel açılışı, oda geçişi, mesaj gelişi.
- **M7/M8'in yeni yüzeyleri için erken kararlar** (bu dilimler kendi plan-modu turlarında M10 Faz 1'e referans verecek): landing/onboarding sayfasının temel yerleşimi, oda-listesi'nin M7 Slice B/E ile birlikte gelen yeni şekli, M8'in bildirim/rozet/DM arayüzlerinin TEMEL yerleşimi (detaylı değil, "nereye oturuyor" düzeyinde).

### Faz 2 — Uygulama (kod)
Faz 1 onaylandıktan SONRA, normal slice-bazlı kod dilimleri — kapsam Faz 1'in çıktısına göre burada güncellenir.

## Koordinasyon notu (M7/M8 ile)
- M7 Slice B (`RoomMember`, oda listesi UI'ı değişir) ve Slice G (landing/onboarding) kendi plan-modu turlarına BAŞLAMADAN ÖNCE, M10 Faz 1'in İLGİLİ kısmı (yukarıdaki "erken kararlar") çözülmüş olmalı — tam M10 değil, sadece o iki yüzey için yeterli karar.
- M8 Slice D (mention/bildirim), Slice G (okundu durumu/rozetler), Slice J (DM) için AYNI şekilde — kendi plan-modu turlarından önce M10'un ilgili erken kararı gerekir.
- Bu, M10'un TAMAMEN M7/M8'den SONRA gelmesi gerektiği anlamına GELMİYOR — SADECE yeni yüzey yaratan her dilimin kendi küçük tasarım kararını M10 şemsiyesinde, o dilimden önce alması gerektiği anlamına geliyor. M10'un geri kalanı (ASCII arka plan, yükleme animasyonları gibi BACKLOG'da duran cila maddeleri) gerçekten SONRA gelebilir.

## Risks
- Bu milestone'un saat tahmini KASITLI OLARAK belirsiz (Faz 2 rakamı yok) — Faz 1 bitmeden gerçek bir tahmin vermek kullanıcının kendi "doğrudan implementasyona geçme" talimatını ihlal eder.
- Koordinasyon notu doğru uygulanmazsa (M7/M8 dilimleri kendi erken kararlarını almadan başlarsa) kullanıcının asıl endişesi (tasarımın ikinci kez bozulması) gerçekleşir — bu riskin FARKINDA olmak, ilgili milestone dosyalarının Sıradaki notlarına da yazılacak.
