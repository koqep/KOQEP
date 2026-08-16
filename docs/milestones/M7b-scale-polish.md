# M7b — Cila (500'e Ölçeklenme, Faz 1+)

*`M7-scale-and-critical-fixes.md`'nin BÖLÜNMÜŞ hali (2026-08-12, founder kararı).
M7a (`M7a-scale-gate.md`) kapıyı açmayı GERÇEKTEN engelleyen kalemleri kapsıyor —
bu dosya CİLA: hiçbiri Faz 1'in (ilk 50 davet) açılışını engellemiyor. Her kalem
kendi fazına göre sıralı; bazıları Faz 1 ile paralel/hemen sonra ("herhangi bir
zaman" — ucuz, ölçek argümanı yok), bazıları belirli bir faz eşiğinden ÖNCE
bitmesi gereken (moderasyon hacmi/oda sayısı/kimlik tutarlılığı büyüdükçe
gerekli hale gelen). Faz tanımları için `M7a-scale-gate.md`'nin "Aşamalı davet
planı" tablosuna bakın.*

## Goal
M7a'nın açtığı kapının ARDINDAN ürünü daha adil, daha keşfedilebilir ve daha
tutarlı hale getirmek — hiçbiri kapı açma koşulu değil, hepsi gerçek Faz 1/2
verisiyle zamanlanabilir.

## Demo
Susturulan/içeriği kaldırılan bir kullanıcı SEBEBİNİ görüyor; kullanıcı kendi
mesajını silebiliyor; düzenlenmiş bir mesaj "(düzenlendi)" gösteriyor; oda
listesi aktiviteye göre sıralanıyor; oda değiştirince taslak kaybolmuyor;
mesajlarda çıplak URL'ler tıklanabilir; zalgo/birleşik-işaret suistimaline
karşı bir sınır var; rate limit gerçek Faz 1 trafiğine göre ayarlanmış; bir
geri bildirim yolu + duyuru mesajı var; UI tamamen İngilizce.

## Estimated hours
**~47-67 saat çekirdek, +%20-25 tampon ile ~60-85 saat. 30 saat/hafta bütçeyle
~2-3 hafta** — Faz 1 AÇILDIKTAN SONRA, hatta kısmen Faz 1 ile PARALEL
yürütülebilir (kapı açma koşulu olmadığı için).

## Sıralama — hangi kalem hangi faz eşiğinden ÖNCE bitmeli

| Kalem | Saat | Faz eşiği | Neden bu faz |
|---|---|---|---|
| Geri bildirim/duyuru | 4-6 | **Faz 1 ile birlikte (önerilir)** | Aşamalı açılışın amacı ilk 50 kişiden gerçek geri bildirim toplamak — bu kalem o amacın kendisine hizmet ediyor, gecikmesi anlamsız. |
| Kendi mesajını silme | 5-7 | Herhangi bir zaman | Ucuz, temel bir sohbet beklentisi, kullanıcı sayısıyla ölçeklenen bir risk argümanı yok. |
| "Düzenlendi" göstergesi | 3-4 | Herhangi bir zaman | Aynı — veri zaten var (`MessageEdit`), sadece görünüm kararı. |
| Taslak kalıcılığı | 2-3 | Herhangi bir zaman | UX inceliği, ölçekle büyüyen bir risk yok. |
| Tıklanabilir linkler | 2-4 | Herhangi bir zaman | UX inceliği, ölçekle büyüyen bir risk yok. |
| Rate limit gözden geçirmesi | 3-5 | **Faz 1→2 arası** | GERÇEK trafik verisi gerektirir — Faz 0'da tahminle ayarlamak (eski M7 planının yaptığı gibi) veriyi görmeden karar vermek olurdu; Faz 1'in kendi verisiyle ayarlanır. |
| Oda keşfedilebilirliği | 5-7 | **Faz 2 (150) öncesi** | Oda sayısı kullanıcı sayısıyla birlikte büyür — Faz 1'de (~50 kullanıcı) muhtemelen hâlâ az sayıda oda var, alfabetik sıralama tolere edilebilir; Faz 2'ye kadar bitmeli. |
| Moderasyon itirazı | 12-15 | **Faz 2 (150) öncesi** | İtiraz ihtiyacı moderasyon HACMİYLE ölçeklenir — Faz 1'de (~50, çoğu founder'ın doğrudan tanıdığı) anlaşmazlıklar muhtemelen doğrudan konuşmayla çözülür; topluluk büyüdükçe (Faz 2) tek moderatörün yargısı daha sık yanlış olur, resmi bir itiraz yolu gerekli hale gelir. |
| Zalgo/birleşik-işaret koruması | 3-5 | **Faz 2 (150) öncesi** | İstismar riski "kimsenin kimseyi tanımadığı" yabancılaşma arttıkça büyür — Faz 1'in küçük, yarı-tanıdık grubunda düşük öncelik, Faz 2'ye kadar bitmeli. |
| Türkçe→İngilizce UI bitirme (A15) | 8-11 | **Faz 3 (500) öncesi** | Kimlik tutarlılığı sorunu, ölçekle büyüyen bir GÜVENLİK/ADALET riski değil — tam ölçekte (Faz 3) karışık-dil arayüzün verdiği tutarsız izlenim en çok kullanıcıyı etkiler, o yüzden Faz 3'e kadar (Faz 1/2 boyunca herhangi bir arada) bitmesi yeterli. |

**Not:** Bu sıralama KATI değil — M7a'nın kendi Risks bölümünün belirttiği gibi,
Faz 1'in ilk haftalarında beklenenden sert bir moderasyon vakası çıkarsa
moderasyon itirazı/zalgo koruması erken çekilebilir. Sıralama gerçek veriye
göre esner, taahhüt değil öncelik sırasıdır.

## Out of scope
- `M7a-scale-gate.md`'nin tüm kalemleri — değişmedi, ORADA bitti.
- `M8-social-features.md`, `M9-i18n.md`, `M10-ui-redesign.md` — değişmedi.

## Acceptance criteria
- [ ] Global rate limit Faz 1'in gerçek trafiğine göre gözden geçirildi, gerekirse artırıldı, karar kayıtlı.
- [ ] Susturma bildirimi SEBEP içeriyor; içerik kaldırma AYRI, hedefe özel bir bildirim üretiyor (genel `message:updated`'a gömülü değil).
- [ ] Kullanıcı kendi mesajını silebiliyor.
- [ ] Düzenlenmiş bir mesaj sıradan bir görüntüleyene "(düzenlendi)" gösteriyor.
- [ ] Oda listesi aktiviteye göre sıralanıyor/filtrelenebiliyor (sadece alfabetik değil).
- [ ] Bir geri bildirim yolu var (mailto tabanlı minimum) VE moderatör pinlenmiş bir duyuru mesajı atabiliyor.
- [ ] Mesajlarda çıplak URL'ler tıklanabilir (`target=_blank rel=noopener`), önizleme YOK.
- [ ] Birleşik-işaret/zalgo suistimaline karşı bir grapheme-sınırı var.
- [ ] Oda değiştirince yazılmakta olan taslak KAYBOLMUYOR.
- [ ] Zaten yıllardır bekleyen Türkçe→İngilizce UI geçişi (BACKLOG A15) BİTTİ — runtime dil SEÇİMİ olmadan, varsayılan tamamen İngilizce.

## Tasks — kod dilimleri (Claude uygular, her biri kendi plan-modu turu)

- [ ] **Slice D1 — Rate limit gözden geçirmesi.** ~3-5 saat. Global 100/60s limitin Faz 1'in GERÇEK trafiğine göre gözden geçirilmesi (muhtemelen artış, aynı NAT/ofis IP'sinden çok sayıda meşru kullanıcı senaryosu) — Faz 1→2 arası, tahminle değil ölçülmüş veriyle.
- [ ] **Slice D2 — Moderasyon itirazı + kendi mesajını silme + "düzenlendi" göstergesi.** ~20-26 saat (12-15 + 5-7 + 3-4). Susturma/içerik-kaldırmaya SEBEP alanı eklenir, içerik kaldırma için hedefe özel bir bildirim (mevcut WS kanalları yeniden kullanılır, yeni altyapı değil). Kendi mesajını silme: `ADR-0005`'in anonimleştirme desenine tutarlı bir soft-delete (içerik `[Bu mesaj yazarı tarafından silindi.]` gibi bir sabitle değiştirilir, `MODERATOR_REMOVED_CONTENT`'in kendi deseni). "Düzenlendi" göstergesi: veri zaten var (`MessageEdit` ilişkisi), sadece bir görünüm kararı.
- [ ] **Slice E — Oda keşfedilebilirliği + taslak kalıcılığı + zalgo koruması + tıklanabilir linkler.** ~14-20 saat (5-7 + 2-3 + 3-5 + 2-4). `RoomsService.listRooms`'a aktivite sıralaması, `RoomView.tsx`'in `draft` state'i `Record<roomId,string>`'e döner, mesaj içerik doğrulamasına grapheme-sınırı eklenir, `MessageContent.tsx`'e linkify (önizleme YOK). **Oda listesi kısmı M7a'nın Slice B'siyle (`RoomMember`, tamamlandı) aynı yüzeyi paylaşıyor.** **Açık bağımlılık:** M7a Slice B'nin `scope=discoverable`/`scope=all` keşif listeleri bu dilim inene kadar `name asc` (alfabetik) sıralı — oda sayısı arttıkça (özellikle Faz 2/3'te) kullanılamaz hale gelir, bu dilim oda sayısı büyümeden ÖNCE inmeli, sonraya bırakılabilecek bir cila maddesi değil.
- [ ] **Slice H2 — Geri bildirim/duyuru.** ~4-6 saat. `mailto:` linki (yeni backend gerekmiyor). Duyuru: moderatörün pinleyebileceği tek bir mesaj alanı (`Room` ya da ayrı küçük bir model — implementasyon sırasında karar). **Faz 1 açılışıyla birlikte yapılması önerilir** (kapı açma koşulu değil ama amaca en çok hizmet eden zamanlama).
- [ ] **Slice I2 — Türkçe→İngilizce UI geçişinin bitirilmesi (A15).** ~8-11 saat. A15'in kendi tetikleyicisi (İngilizce dosya oranı ≥%50) muhtemelen bu dilimin KENDİSİYLE ateşleniyor — kalan Türkçe component'ler İngilizceye çevrilir, **runtime dil SEÇİMİ/`User.locale` EKLENMEZ** (o M9'un tam kapsamı). Playwright seçicileri bu geçişle birlikte `data-testid`'e taşınmalı (388 Türkçe-bağımlı seçici, M9'un kendi maliyet analizinde) — **BU dilimde SADECE değişen dosyaların seçicileri güncellenir, TAM testid geçişi M9'a kalır** (aksi halde bu dilim M9'un maliyetini üstleniyor demektir).

## Tasks — founder'ın kendi eliyle yapacağı işler
- [ ] Faz 1'in ilk 2-3 haftasının rate-limit/hata loglarını gözden geçir (Slice D1'in girdisi).
- [ ] Faz 1 sırasında moderasyon vakalarının HACMİNİ takip et — Slice D2'nin (moderasyon itirazı) Faz 2'den erkene çekilip çekilmeyeceğine bu veriyle karar ver.

## Risks
- Bu dosyanın sıralaması M7a'nın Faz 1 verisine BAĞIMLI — M7a bitip Faz 1 gerçekten açılmadan bu dosyanın kendi plan-modu turlarının bir kısmı (özellikle rate limit, moderasyon itirazının zamanlaması) anlamlı şekilde başlayamaz. Slice E (oda keşfi, taslak, zalgo, link) ve Slice H2/I2 gibi veri-bağımsız kalemler M7a ile PARALEL de planlanabilir.
- Toplam 47-67 saatlik çekirdek tahmin, M7'nin (birleşik hali) kendi +%20-25 tampon dersini taşıyor — gerçekçi aralık 60-85 saat.
