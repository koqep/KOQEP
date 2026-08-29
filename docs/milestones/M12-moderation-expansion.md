# M12 — Moderasyon paneli genişlemesi

*Mevcut `ModerationQueueView`'ın (277 satır, tek düz rapor kuyruğu) 5 yeni
alanla genişlemesi: dashboard, kullanıcı arama+geçmiş, denetim kaydı
görüntüleyici, sistem sağlığı, toplu işlemler. Kapsam turu:
`docs/BACKLOG.md`'nin "G. 2026-08-29 KAPSAM TURU" bölümü.*

**Goal:** Moderatörün bugün SADECE rapor kuyruğu üzerinden erişebildiği
işlevleri (kullanıcı arama, denetim kaydı, sistem durumu, toplu aksiyon)
gerçek endpoint'ler + sekmeli bir panel yapısıyla aç.
**Demo:** Moderatör panelinde 4 sekme var (Raporlar / Kullanıcılar / Denetim
Kaydı / Sistem); dashboard sekmesi toplam kullanıcı/oda/son-24h mesaj/
bekleyen rapor sayısını gösteriyor; kullanıcı adıyla arama yapıp bir
kullanıcının mesaj geçmişini görebiliyor; denetim kaydı (kim/ne
zaman/hangi eylem/hangi hedef/sebep) filtrelenip sayfalanarak listeleniyor;
aktif WS bağlantı sayısı + cron'ların son çalışma zamanı görünüyor; birden
fazla rapor tek seferde çözülebiliyor.
**Estimated hours:** ~41-60h — kendi başına M8-dilimi büyüklüğünde.

## Out of scope
- Panelin ayrı bir pencerede açılması — kullanıcı kararı: **SidePanel'de
  kalıyor**, mevcut 9 panelle aynı mekanizma korunuyor.
- "Son hatalar" sistem-sağlığı alt-özelliği — Sentry zaten üçüncü parti
  SaaS olarak var, kendi panelini tekrarlamak düşük değer, bu dilimde YOK.
- Hesap dondurma moderatör aksiyonu — M8 Slice C'nin (henüz yapılmamış)
  hesap dondurma özelliğine bağımlı, o gelene kadar sadece mevcut mute
  kullanılabilir.
- İkinci bir moderatör/admin ayrıcalık katmanı — `ModeratorGuard` bugün
  tek düz rol (`user`/`moderator`), bu dilim bunu DEĞİŞTİRMİYOR; tüm
  moderatörler tüm yeni yüzeyleri (denetim kaydı dahil) aynı şekilde görür.

## Acceptance criteria
- [ ] `ModerationQueueView` sekmeli bir kabuğa taşındı; mevcut rapor
      kuyruğu davranışı "Raporlar" sekmesinde DEĞİŞMEDEN çalışıyor.
- [ ] Dashboard sekmesi: toplam kullanıcı, toplam aktif oda, son-24h mesaj,
      bekleyen (açık) rapor sayısı — 4 basit `count()` sorgusu.
- [ ] Kullanıcılar sekmesi: username ile arama, kullanıcı detayı, o
      kullanıcının mesaj geçmişi (sayfalanmış), doğrudan mute aksiyonu.
- [ ] Denetim Kaydı sekmesi: `ModerationAuditLog`'un filtrelenebilir,
      sayfalanmış bir listesi (moderatör/eylem-türü/tarih filtreleri).
- [ ] Sistem sekmesi: anlık WS bağlantı sayısı, `lifecycle-sweep` ve
      `traffic-log-purge` cron'larının son başarılı çalışma zamanı.
- [ ] Raporlar sekmesinde birden fazla rapor tek istekle
      dismiss/remove-content edilebiliyor.
- [ ] Tüm yeni endpoint'ler `ModeratorGuard` ile korunuyor.
- [ ] `docs/THREAT-MODEL.md`'ye kullanıcı arama+mesaj geçmişinin genişlettiği
      moderatör-erişim yüzeyine dair bir not eklendi.

## Tasks
Önerilen sıra (bağımlılık sırasına göre):
- [ ] **Slice A — Sekme kabuğu.** `ModerationQueueView`'ı sekmeli bir
      yapıya taşı, mevcut rapor kuyruğu "Raporlar" sekmesi olur (davranış
      değişmez). Kod tabanında İLK sekme deseni — kendi küçük tasarım
      kararı gerektirir.
- [ ] **Slice B — Dashboard.** 4 `count()` sorgusu + endpoint + kart grid.
- [ ] **Slice C — Denetim kaydı görüntüleyici.** GET endpoint (filtre +
      cursor pagination, `DiscoverRoomsView`'ın deseni) + liste UI.
- [ ] **Slice D — Kullanıcı arama + detay + mesaj geçmişi.** Moderatör-özel
      arama+detay endpoint'i, yazar-bazlı sayfalanmış mesaj geçmişi
      endpoint'i (yeni Prisma sorgusu), frontend alt-görünüm. En büyük
      parça; hesap-dondurma alt-aksiyonu M8 Slice C'ye bağımlı olduğu için
      o olmadan sadece mute sunulur.
- [ ] **Slice E — Sistem sağlığı.** WS bağlantı sayısı (`SocketRegistryService`
      zaten bellekte tutuyor, sadece dışa açılacak) + cron son-çalışma
      tablosu (yeni, her cron endpoint'i kendini damgalayacak).
- [ ] **Slice F — Toplu işlemler.** Bulk-resolve endpoint'i (array-of-ids,
      kod tabanında İLK emsal) + Slice D'nin kullanıcı-detay görünümünde
      çoklu-mesaj temizleme UI'ı. Slice D bitmeden başlamaz.

## Risks
- Slice A: sekme deseni kod tabanının hiçbir yerinde yok — `SidePanel`'in
  sabit `max-w-md` genişliğinin (448px) 4 sekmelik içeriği taşıyıp
  taşımadığı implementasyon sırasında gerçek ekranda doğrulanmalı.
- Slice D: bugün bir kullanıcıya SADECE rapor üzerinden ulaşılabiliyor —
  arbitrary arama+mesaj geçmişi gerçek bir gizlilik-yüzeyi genişlemesi,
  THREAT-MODEL notu implementasyonla BİRLİKTE gitmeli, sonradan eklenmemeli.
- Slice E: cron'lar GitHub Actions'tan tetikleniyor (`@nestjs/schedule`
  hiç kullanılmıyor) — "son çalışma zamanı" için yeni bir tablo/damgalama
  mekanizması gerekiyor, var olan bir şeyi açmak değil.
- Slice F: `ReputationEvent` insert-only kuralı gibi, toplu mesaj temizleme
  de ADR-0005'in "hard-delete yok, sadece anonimleştir" kuralına uymalı —
  mevcut tekil-mesaj kaldırma yolunun bir döngüde çağrılması mı, yoksa
  dedike bir toplu servis metodu mu, implementasyon planında karar
  verilecek.

## Plan notları

### Kapsam netleştirmesi (2026-08-29)
Kullanıcının ilk isteği ("admin/moderasyon paneli ayrı pencerede + yeni
özellikler") `AskUserQuestion` ile netleştirildi — "ayrı pencere" kısmı
reddedildi (SidePanel tutarlılığı korunuyor), "yeni özellikler" kısmı
kullanıcının kendi 5 maddelik listesiyle somutlaştı (dashboard, kullanıcı
yönetimi, denetim kaydı, sistem sağlığı, toplu işlemler). 3 paralel Explore
agent'ıyla mevcut kod durumu doğrulandı (RUNBOOK §6'daki SQL sorguları,
cron mekanizması, `ModerationAuditLog`'un write-only durumu, `ModeratorGuard`'ın
tek-tier yapısı, `ModerationQueueView`'ın mevcut şekli, `SidePanel`'in
genişlik kısıtı) — hiçbir madde tahmine dayanmadı, tam döküm sohbet
geçmişinde ve `docs/BACKLOG.md`'nin "G." bölümünde.
