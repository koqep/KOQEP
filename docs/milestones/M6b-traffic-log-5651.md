# M6b — 5651 Trafik Bilgisi Saklama

*M6'nın kendi AC #2'sinin gerçek sonucu: avukattan bağlayıcı cevap geldi (18 ay), M6 zaten "TAMAMLANDI" işaretli olduğu için bu kapsam M6'ya geri eklenmedi, ayrı bir dosya açıldı. M7b'nin "cila, kapı açma koşulu değil" felsefesine de UYMUYOR — bu ölçek-tetiklenmeli bir iyileştirme değil, gerçek trafik başlamadan önce bitmesi gereken bir YASAL zorunluluk.*

**Goal:** 5651 sayılı Kanun'un trafik bilgisi saklama yükümlülüğünü (18 ay, avukat cevabı 2026-08-21) karşılayacak bir `TrafficLog` altyapısı kurmak — bugün kod sıfır IP/bağlantı logu tutuyor, bu bilinçli bir tasarım kararıydı (Sentry `ip:false`), şimdi yasal olarak tersine çevrilmesi gerekiyor.

**Demo:** Bir REST isteği ve bir WebSocket bağlantısı sonrasında `TrafficLog` tablosunda gerçek istemci IP'si (Render+Cloudflare proxy zincirinden doğru okunmuş), hizmet türü, başlama/bitiş zamanı ve bütünlük hash'i içeren satırlar oluşuyor; 18 aydan eski satırlar otomatik cron ile siliniyor; hesap silinse bile ilgili satırlar `userId` alanı `NULL`'a düşerek (retention süresi boyunca) hayatta kalıyor.

**Estimated hours:** ~23-35 saat çekirdek (Senaryo B — kendi hash'imiz), +8-15 saat koşullu (Senaryo A — nitelikli zaman damgası, avukat "gerekiyor" derse). +%20-25 tampon → **gerçekçi aralık ~28-44 saat (Senaryo B) / ~38-62 saat (Senaryo A dahil).** Detaylı kapsam gözden geçirmesi: aşağıdaki "Plan notları" bölümü.

## Out of scope
- Nitelikli zaman damgası entegrasyonu (Senaryo A) — avukatın "nitelikli gerekiyor" cevabı GELMEDEN inşa edilmiyor, boşa harcanan iş olmasın diye. Cevap gelince bu dosyaya ayrı bir Slice olarak eklenir.
- ADR-0005'in anonimleştirme yaklaşımının Türkiye içtihadıyla uyumluluğu — AYRI bir açık soru, bu dilimin kapsamı DEĞİL (avukata henüz sorulmadı, bkz. founder işleri).
- Port bilgisinin yakalanması — Cloudflare arkasında muhtemelen mimari olarak MÜMKÜN DEĞİL, teknik bir çözüm uydurulmuyor, avukata geri sorulacak.
- Gizlilik politikasının gerçek hukuki metni — M6 AC #1'in zaten bekleyen kapsamı, burada sadece trafik logu saklamasının o metne dahil edilmesi gerektiği not düşülüyor.

## Acceptance criteria
- [ ] Gerçek istemci IP'si Render+Cloudflare proxy zincirinden GÜVENLİ şekilde okunuyor (`trust proxy` sayısal hop sayısına sabit, `true` DEĞİL — header sahteciliğine kapalı), hem REST hem WS için.
- [ ] `TrafficLog` tablosu var — `userId` FK'si `onDelete: SetNull` (Cascade DEĞİL, ADR-0005 Addendum), append-only (UPDATE yok, `ReputationEvent`/`ModerationAuditLog` deseniyle tutarlı).
- [ ] Her REST isteği ve her WS bağlantı-başlangıcı/bitişi bir `TrafficLog` satırı üretiyor — IP, hizmet türü, başlama/bitiş zamanı, (mümkünse) aktarılan veri miktarı.
- [ ] Her satır bir bütünlük hash'i taşıyor (Senaryo B minimum: `sha256Hex`, zaten var — `crypto.util.ts`) + sunucu zaman damgası.
- [ ] 18 aydan eski satırlar OTOMATİK siliniyor (mevcut `lifecycle-sweep` cron desenine benzer yeni bir cron), erken silme YOK, süresiz tutma YOK.
- [ ] Mevcut TÜM test süiti (birim + e2e + Playwright) yeni cross-cutting middleware ile YEŞİL — hiçbir mevcut test bu değişiklik yüzünden kırılmıyor.
- [ ] `docs/THREAT-MODEL.md`, `docs/decisions/ADR-0005-data-retention-anonymize.md`, `docs/DATA-MODEL.md` gerçek şemayı yansıtacak şekilde güncel (bu dosyanın kapsam-gözden-geçirme turu bu güncellemelerin bir kısmını ZATEN yaptı — bkz. Plan notları).
- [ ] Postgres depolama kapasitesi kararı verildi (plan yükseltmesi gerekip gerekmediği, `docs/BACKLOG.md` A18) — TrafficLog inşa edilmeden ÖNCE.

## Tasks — kod dilimleri (Claude uygular, her biri kendi plan-modu turu)
- [ ] **Slice A — Proxy/IP zinciri doğrulama + `trust proxy` sertleştirme.** ~4-6 saat. `apps/api/src/main.ts`'e `app.set('trust proxy', N)` (N, founder'ın Render/Cloudflare dashboard doğrulamasına bağlı — ÖN KOŞUL, aşağıdaki founder işine bakın), `CF-Connecting-IP` öncelikli okuma. **Yan bulgu:** `@nestjs/throttler`'ın global `ThrottlerGuard`'ı bugün `req.ip`'ye dayanıyor ve muhtemelen ZATEN yanlış IP görüyor (trust proxy hiç ayarlanmamış) — bu dilimde düzeltilir, 5651'den bağımsız gerçek bir düzeltme.
- [ ] **Slice B — `TrafficLog` şeması + migration.** ~2-3 saat. `ReputationEvent`/`ModerationAuditLog` deseni (UUID id, `SetNull` FK, `@@index` kullanıcı+zaman) birebir emsal.
- [ ] **Slice C — REST middleware/interceptor.** ~5-7 saat. Her istekte IP+hizmet türü+zaman+hash'i yazan bir interceptor, + testler.
- [ ] **Slice D — WS gateway entegrasyonu.** ~4-6 saat. `messages.gateway.ts`'in `handleConnection`/`handleDisconnect`'ine `CONNECTION_START`/`CONNECTION_END` satırları (iki ayrı immutable satır, UPDATE yok — bütünlük hash'i bozulmasın diye), + testler.
- [ ] **Slice E — Bütünlük hash'i (Senaryo B).** ~1-2 saat. Mevcut `sha256Hex` (`crypto.util.ts`) her satır için çağrılır, yeni bağımlılık yok. *(Koşullu Slice E2 — Senaryo A, nitelikli zaman damgası: avukat cevabı gelirse ~8-15 saat, ayrı bir tur.)*
- [ ] **Slice F — 18 aylık otomatik silme cron'u.** ~2-3 saat. Yeni `POST /internal/traffic-logs/purge` + mevcut `CronSecretGuard` deseni + GitHub Actions workflow adımı (`lifecycle-sweep.yml`'a benzer, AYRI iş — oda lifecycle'ıyla kavramsal olarak ilgisiz).
- [ ] **Slice G — Mevcut test süitiyle uyumluluk taraması.** ~3-5 saat. Yeni middleware TÜM REST/WS isteklerine dokunduğu için mevcut yüzlerce testin (birim+e2e+Playwright) test-DB'sinde beklenmedik satır birikmesi/izolasyon sorunu yaratıp yaratmadığı doğrulanır — regresyon riski yüksek, tampon payı büyük tutuldu.
- [x] **Slice H (docs) — THREAT-MODEL/ADR-0005/DATA-MODEL/BACKLOG güncellemeleri.** TAMAMLANDI (2026-08-21, bu dosyanın kendi kapsam-gözden-geçirme turunda) — detay aşağıdaki "Plan notları" bölümünde. Kalan doküman işi (gizlilik politikası metnine trafik logu saklamasının eklenmesi) M6 AC #1'in kapsamı, kod dilimleri bittikten sonra.

## Tasks — founder'ın kendi eliyle yapacağı işler
- [ ] **Avukata İKİ ek soru sor.** (a) ADR-0005'in anonimleştirme (anonymize-on-delete) yaklaşımı Türkiye içtihadıyla uyumlu mu — 2026-08-21'de SADECE trafik saklama süresi soruldu, bu AYRI. (b) 5651'in "port bilgisi" unsuru içerik/yer sağlayıcı (KOQEP'in kendi statüsü) için gerçekten gerekli mi — Cloudflare arkasında mimari olarak muhtemelen yakalanamıyor (bkz. Plan notları madde 1).
- [ ] **Render + Cloudflare dashboard'undan proxy zincirini doğrula (Slice A'nın ön koşulu).** API domaini Cloudflare'den turuncu-bulut (proxied, `CF-Connecting-IP` header'ı gerçekten var) mı yoksa DNS-only (gri bulut, Cloudflare aradan çıkıyor) mı — repo'da bu bilgi yok, sadece dashboard'dan görülebilir. Yanlış varsayımla `trust proxy` ayarlamak ya IP'yi hiç yakalamaz ya da header sahteciliğine açık bırakır.
- [ ] **Senaryo A/B kararı (bütünlük — nitelikli zaman damgası mı, kendi hash'imiz mi).** Avukata sorulacak: kanun nitelikli/lisanslı bir zaman damgası hizmeti (TÜBİTAK KamuSM, E-Güven vb.) mi istiyor, yoksa sistemin kendi hash+zaman kaydı yeterli mi. Maliyet farkı: Senaryo A +8-15 saat geliştirme + sürekli işletme ücreti, Senaryo B ~1-2 saat + sıfır işletme maliyeti ama hukuki risk.
- [ ] **Postgres depolama kapasitesi kararı.** 500 kullanıcı/18 ay kaba hesabı (~5.3GB, Plan notları madde 6) Basic-256mb planının 5GB limitine çok yakın/aşıyor — TrafficLog inşa edilmeden ÖNCE bir plan yükseltmesi gerekip gerekmediğine karar verilmeli (`docs/BACKLOG.md` A18).
- [ ] Gizlilik politikasının gerçek hukuki metnine (M6 AC #1, hâlâ bekliyor) trafik logu saklamasının açıkça belirtilmesi.

## Plan notları — 2026-08-21 kapsam gözden geçirmesi

Kullanıcının 8 maddelik somut soru listesi (kapsam, gerçek IP, şema, bütünlük, saklama/imha, depolama boyutu, etkilenen dokümanlar, tahmin/milestone kararı) üç paralel Explore agent'ıyla (backend request/connection handling; doküman/tehdit-modeli; şema/büyüklük) + doğrudan `Read`/`Grep` ile araştırıldı, kod YAZILMADI (kullanıcının açık talebi).

**1. Kapsam:** 5651'in trafik bilgisi unsurlarından (IP, başlama/bitiş zamanı, hizmet türü, veri miktarı, port, abone kimliği) PORT HARİÇ hepsi mimaride yakalanabilir. Port bilgisi Cloudflare arkasında muhtemelen mimari olarak imkansız (CF'nin standart bir "orijinal port" header'ı yok) — teknik bir çözüm uydurulmadı, avukata geri sorulacak somut bir soru olarak founder işlerine eklendi.

**2. Gerçek IP — gerçek bir yan bulgu:** `apps/api/src/main.ts`'de `trust proxy` HİÇ ayarlanmamış — Express varsayılanı `req.ip`'yi doğrudan soket bağlantısından okuyor. Bunun sonucu: `@nestjs/throttler`'ın global rate-limit guard'ı (`app.module.ts:64-70,106`) muhtemelen BUGÜN ZATEN yanlış IP'yi görüyor (Render'ın upstream IP'sini, gerçek istemci IP'sini değil) — 5651'den bağımsız, kendi başına gerçek bir düzeltme gereksinimi, Slice A'ya eklendi.

**3. Şema:** Kullanıcının kritik uyarısı (`TrafficLog.userId` Cascade İLE bağlanmamalı) mevcut kod tabanının kendi deseniyle zaten tutarlı — `Message.author`/`ReputationEvent`/`ModerationAuditLog` hepsi `SetNull`. **Immutability kararı:** WS "start"/"end"i AYNI satırda UPDATE ETMEK yerine iki ayrı immutable satır önerildi — bir satırı UPDATE etmek onun bütünlük hash'ini (madde 4) geçersiz kılar.

**4. Bütünlük — iki senaryo, avukata bırakıldı:** Senaryo B (kendi `sha256Hex`'imiz, zaten var, ~1-2 saat, sıfır işletme maliyeti ama hukuki risk) MVP olarak kod diliminin çekirdeğine dahil edildi (her halükarda gerekli). Senaryo A (nitelikli zaman damgası, TÜBİTAK KamuSM/E-Güven, +8-15 saat + sürekli işletme ücreti) avukat "gerekiyor" derse AYRI, koşullu bir alt-dilim olarak eklenecek — şimdiden inşa edip boşa harcanmasın diye.

**5. Saklama/imha:** Mevcut `lifecycle-sweep` cron deseni (GitHub Actions saatlik → `POST /internal/rooms/lifecycle-sweep` → `CronSecretGuard`) doğrudan yeniden kullanılabilir, yeni bir cron altyapısı GEREKMİYOR — ayrı bir `/internal/traffic-logs/purge` endpoint'i (tek-sorumluluk, oda lifecycle'ıyla karıştırılmıyor) öneriliyor.

**6. Depolama — hesaplandı, tahmin edilmedi:** Açıkça işaretlenmiş varsayımlarla (500 kullanıcı, günde ~35 satır/kullanıcı — RUNBOOK/BACKLOG'da gerçek DAU rakamı yok) 18 ay için **~9.6 milyon satır, ~5.3 GB** — Render Postgres Basic-256mb planının 5GB depolama limitine ÇOK YAKIN/AŞIYOR, SADECE trafik logu için, uygulamanın geri kalan verisi HARİÇ. `docs/BACKLOG.md` A18'in tetikleyicisini somutlaştırdı, çapraz referans eklendi.

**7. Etkilenen dokümanlar — BU TURDA YAPILDI:** `docs/THREAT-MODEL.md` row 8 + open items (5651 tek maddesi ikiye ayrıldı: süre CEVAPLANDI, anonimleştirme yaklaşımı HÂLÂ AÇIK — kullanıcının netleştirmesiyle), `docs/decisions/ADR-0005-data-retention-anonymize.md` Addendum (TrafficLog'un SetNull istisnası, ADR-0006'nın hard-delete istisnasından KATEGORİK OLARAK FARKLI olduğu netleştirildi), `docs/DATA-MODEL.md` Retention tablosuna yeni satır, `docs/BACKLOG.md` A18 çapraz referansı, `docs/milestones/M6-launch-readiness.md` AC #2 (kısmen cevaplandı, hâlâ açık) + go-live listesine yeni zorunlu madde. Sentry `ip:false` ile kendi DB'mizde IP tutmanın ÇELİŞMEDİĞİ netleştirildi (biri üçüncü-taraf SaaS'a PII sızdırmama kararı, diğeri kendi güvenli DB'mizde yasal saklama zorunluluğu — ayrı katmanlar).

**Kullanıcının `ExitPlanMode` reddiyle netleşen kritik nokta:** avukata 2026-08-21'de SADECE trafik-saklama SÜRESİ soruldu — ADR-0005'in anonimleştirme yaklaşımı AYRICA sorulmadı/onaylatılmadı. İlk taslağım bu ikisini `docs/THREAT-MODEL.md` row 8'de tek bir open-item altında topluyordu; kullanıcı ikisinin AYRI sorular olduğunu ve anonimleştirme sorusunun hâlâ tamamen açık kaldığını netleştirdi — THREAT-MODEL güncellemesi buna göre ikiye ayrıldı, avukata sorulacaklar listesine eklendi.

**8. Tahmin + milestone kararı:** Çekirdek ~23-35 saat (Senaryo B), +8-15 saat koşullu (Senaryo A) — +%20-25 tampon ile ~28-44 / ~38-62 saat. **Ayrı milestone açıldı** (bu dosya) — M7b'nin "cila" felsefesiyle çelişiyor (yasal zorunluluk, ölçek-tetiklenmeli değil), M6 zaten kapanmış sayılıyor, kapsamın kendisi (yeni tablo + cross-cutting middleware + güvenlik-kritik proxy doğrulaması + olası depolama-planı yükseltmesi) kendi başına bir milestone'u hak ediyor.

Doğrulama: bu tur SADECE kapsam gözden geçirmesi ve dokümantasyon — kod/test yazılmadı (kullanıcının açık talebi). Her kod diliminin (A-G) kendi implementasyonu, bu dosya onaylandıktan SONRA, ayrı bir plan-modu turuyla başlayacak.

## Risks
- Avukatın anonimleştirme sorusuna vereceği cevap gerçek bir engel çıkarabilir (ör. daha katı bir okuma ADR-0005'in tamamının yeniden tasarlanmasını gerektirebilir) — bu iş, o cevap gelmeden başlamıyor.
- Depolama tahmini (madde 6) açıkça işaretlenmiş VARSAYIMLARA dayanıyor — gerçek Faz 1 trafiği gözlemlendikçe rakam önemli ölçüde değişebilir, plan yükseltmesi kararı erken/geç kalabilir.
- Cross-cutting middleware'in (Slice C/D) mevcut yüzlerce testle uyumluluğu (Slice G) öngörülemeyen sürprizler taşıyabilir — bu yüzden tampon payı bilerek büyük tutuldu.
