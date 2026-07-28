# KOQEP — Backlog

<!-- Bu dosya TODO.md DEĞİLDİR. Aktif işler docs/milestones/ içindedir.
     Burası "bir gün belki" havuzu + bilinçli olarak reddedilmiş fikirlerin mezarlığı.
     Claude bu dosyayı her session okumaz; sadece kapsam tartışırken okunur. -->

**Puanlama:** Etki 1–5 (5 = ürün bunsuz çalışmaz) · Maliyet S/M/L · Kova: `V1` `V1.1` `V2` `ASLA`

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
