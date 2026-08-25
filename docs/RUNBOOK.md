# KOQEP — Olay Runbook'u

*Bir şey bozulduğunda ne yapılacağını anlatan tek doküman. Solo-founder/solo-moderatör bir operasyon için yazıldı (`docs/THREAT-MODEL.md` row 12) — 7/24 nöbet YOK, "kimi arayayım" değil "ben şimdi ne yapayım" için var. Kendi başına anlaşılır olacak şekilde yazıldı (`docs/WORKFLOW.md`'nin referans-doküman katmanı sadece istenince okunuyor, önceki bir oturum bağlamı varsayma).*

## 1. Sistem envanteri — ne bozulabilir

| Parça | Nerede yaşıyor | Durum/log nereden kontrol edilir |
|---|---|---|
| API + WebSocket gateway (tek servis, monolit — ADR-0003) | Render (`koqep-api`, `render.yaml`) | Render dashboard → servis logları, `GET /health` |
| Postgres (tek doğruluk kaynağı) | Render Postgres (Basic-256mb, `render.yaml`'ın işaret ettiği instance) | Render Postgres dashboard → Metrics/Connections |
| Web istemcisi | Vercel (ADR-0002 — oturum/iş mantığı sahibi değil, sadece API'yi çağırır) | Vercel dashboard → Deployments/Logs |
| Transactional e-posta (doğrulama, şifre sıfırlama) | Resend (`koqep.com` doğrulanmış domain) | Resend dashboard → Logs |
| Hata takibi | Sentry (`apps/api` + `apps/web`, M6 Slice B) | Sentry dashboard → Issues |
| CI/CD | GitHub Actions (`.github/workflows/ci.yml`) — production'a deploy ETMİYOR, sadece PR/main'i test ediyor | GitHub → Actions sekmesi |
| Cron (oda lifecycle sweep) | Render → `POST /internal/rooms/lifecycle-sweep`, GitHub Actions'tan tetikleniyor | GitHub Actions log'u + Render servis logu |
| Cron (trafik logu purge, 5651 — M6b Slice F) | Render → `POST /internal/traffic-logs/purge`, GitHub Actions'tan GÜNLÜK tetikleniyor (`.github/workflows/traffic-log-purge.yml`) — 18 aydan eski `TrafficLog` satırlarını siler | GitHub Actions log'u + Render servis logu |
| Uptime izleme | **Henüz kurulmadı** (M6 doc'un manuel listesinde, bekliyor) | — |

## 2. Genel ilk müdahale (her olay için önce bunlar)

1. `GET /health`'i kontrol et (Render'ın kendi `healthCheckPath`'i de bu — servis zaten kendi kendini izliyor).
2. Render dashboard → servis logları: son deploy'un `preDeployCommand`'ı (`db:migrate:deploy && db:seed && db:backfill-totp-secrets`) başarılı bitti mi? Bu adımlardan biri başarısız olursa Render deploy'u durdurur — bozuk bir sürüm canlıya çıkmaz, ama servis ESKİ sürümde donmuş kalabilir.
3. Sentry → Issues: yeni/artan bir hata var mı, ne zaman başladı (bir deploy'la mı çakışıyor).
4. GitHub Actions → son çalışan workflow yeşil mi (CI production'a deploy etmiyor ama bir PR'ın gerçekten test edildiğini doğrular).
5. Vercel dashboard → web tarafında ayrı bir build/deploy hatası var mı (API ile web ayrı platformlarda, biri çökerken diğeri ayakta kalabilir).

## 3. Bilinen olay senaryoları — tetikleyici → düzeltme

Aşağıdaki SQL'lerin hepsi Render Postgres konsolunda çalıştırılır. Kaynak: `docs/THREAT-MODEL.md`'nin "Open items" bölümü — gerekçe/tetikleyici detayı için oraya bakılabilir, buradaki amaç SQL'i tek yerde, aranabilir tutmak.

### 3.1 — Bir env var'ı Render dashboard'unda değiştirdim ama etkisi yok
`render.yaml` **canlı servise bağlı DEĞİL** (elle kurulmuş bir servis, Blueprint değil) — bu dosyadaki değişiklikler otomatik yansımaz, VE bir env var'ın sadece DEĞERİNİ değiştirmek de yansımayabilir. Gözlemlenen tek güvenilir yöntem: env var'ı Render dashboard'unda **tamamen SİL**, sonra **yeniden EKLE** yeni değeriyle.

### 3.2 — Sıfır kullanıcılı bir DB'de `/auth/signup` çalışmıyor / production'ı ilk kez ayağa kaldırıyorum
`signup()` her zaman geçerli bir `Invite` ister, `Invite.issuedById` var olan bir `User`'a FK'lidir — sıfır kullanıcıyla hiçbir uygulama-içi yol ilk kullanıcıyı oluşturamaz.

```bash
node -e "require('argon2').hash('<şifre>').then(console.log)"
```
Çıkan hash'i `AuthService`'in kullandığı argon2 ayarlarıyla birebir üretir. Sonra:
```sql
INSERT INTO "User" (id, email, username, "passwordHash", "emailVerifiedAt", "createdAt")
VALUES (gen_random_uuid(), '<email>', '<kullanıcı adı>', '<yukarıdaki hash>', now(), now());
```
`Invite` satırına gerek yok — bootstrap kullanıcı kimsenin davetini kullanmıyor.

### 3.3 — Bir kullanıcının (founder dahil) davet kotası sıfır, davet göndermesi lazım
Davetler artık SADECE seviye atlayınca otomatik kazanılıyor (`InvitesService.grantInvites`). **`totalXp`/`level`'i elle `UPDATE` ETME** — ADR-0004'ü ihlal eder (level, `ReputationEvent` log'unun bir türevi olmalı) VE zaten işe yaramaz (`grantInvites` sadece `sendMessage`'ın canlı transaction'ı içinde tetikleniyor).

Doğru yol:
```bash
node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"
```
(insan-seçimi bir kod DEĞİL — entropi garantisi için server'ın kendi ürettiği gibi rastgele üret.) Sonra:
```sql
INSERT INTO "Invite" (id, code, "createdAt", "issuedById")
VALUES (gen_random_uuid(), '<üretilen kod>', now(), '<kullanıcı id>');
```
Her denemede YENİ bir kod üret — aynı kodu tekrar kullanmak `Invite_code_key` unique constraint'ine takılır.

### 3.4 — Bir kullanıcıya moderatör rolü vermem gerekiyor
```sql
UPDATE "User" SET "role" = 'moderator' WHERE id = '<kullanıcı id>';
```
Kendi kendine yeten bir işlem — self-servis bir endpoint bilinçli olarak yok (M5'in kapsam dışı kararı, tek-moderatör ölçeğinde gerekmiyor).

### 3.5 — Bir moderatör yanlışlıkla bir mesajın içeriğini kaldırdı, geri almam gerekiyor
Orijinal içerik hiç silinmiyor, `MessageEdit.previousContent`'te duruyor:
```sql
UPDATE "Message" SET content = (
  SELECT "previousContent" FROM "MessageEdit"
  WHERE "messageId" = '<mesaj id>'
  ORDER BY "editedAt" DESC LIMIT 1
) WHERE id = '<mesaj id>';
```

### 3.6 — Bir kullanıcı TOTP'den tamamen kilitlendi (authenticator + 8 kurtarma kodu hepsi kayıp)
Kod-seviyesinde bir kurtarma yolu yok — doğrulanmış bir destek talebi üzerine:
```sql
UPDATE "User" SET "totpSecret" = NULL, "totpEnabledAt" = NULL WHERE id = '<kullanıcı id>';
```
Kullanıcı TOTP'yi sıfırdan yeniden kurar.

### 3.7 — `TOTP_ENCRYPTION_KEY` kayboldu (hem Render'da hem yedekte)
Bu, tek bir ortam değişkeninin kaybının GERÇEK VERİ KAYBINA yol açtığı TEK senaryo (ADR-0008) — AES-GCM'in kendi doğası gereği, yeni bir anahtar üretmek işe yaramaz, ESKİ anahtar olmadan mevcut şifreli satırlar KESİN olarak okunamaz. Kurtarma kodları AYRI ve tek-yönlü hash'li olduğu için bu senaryodan etkilenmez.

Toplu kurtarma (3.6'nın unscoped hali — TÜM etkilenen kullanıcılar için):
```sql
UPDATE "User" SET "totpSecret" = NULL, "totpEnabledAt" = NULL WHERE "totpSecret" IS NOT NULL;
```
Bu, TÜM kullanıcılar için TOTP'yi zorla kapatır — kalıcı hesap kilidi DEĞİL, sadece "authenticator'ını yeniden kur" maliyeti. Detay: `docs/decisions/ADR-0008-totp-secret-encryption.md`.

### 3.8 — Bir kullanıcı hesabını sildikten sonra eski bir mesajında kendini ifşa eden içeriğin kaldırılmasını istiyor
ADR-0005 (Addendum #2) + `docs/milestones/M6c-message-content-anonymization.md`: `deleteAccount()` sadece `Message.authorId`'yi null'lar, mesajın METNİNE dokunmaz — kullanıcı mesajında kendi adını/e-postasını/başka bir kimlik bilgisini paylaşmışsa, bu içerik hesap silindikten sonra da aynen okunabilir kalır (§3.5'in — moderatör içerik geri alma — BİREBİR ters-yönlü emsali). Talep kanalı: mevcut `FEEDBACK_EMAIL` (`RoomHeader.tsx`, `docs/BACKLOG.md` A19) — yeni bir e-posta/form yok, bu talepler için de aynı adres kullanılıyor.

Hedef mesajın id'si kullanıcının verdiği bağlamla (oda adı, yaklaşık zaman, içeriğin kendisinden bir parça) Render Postgres konsolundan `SELECT` ile bulunur, sonra üç tablo da güncellenir — `Message`'ın kendisi, o mesajın `MessageEdit` geçmişi (varsa), VE o mesaja ait bir `Report` snapshot'ı (varsa). `Report.messageId` `onDelete: SetNull` SADECE mesaj hard-delete edilirse tetiklenir (ör. odanın kendisi silinirse) — kullanıcı hesabı silinse bile `messageId` dolu kalır, bu yüzden `Report` satırı `reportedUserId` zaten null olmuş olsa da `messageId` üzerinden bulunabilir:

```sql
UPDATE "Message" SET content = '[Bu mesaj yazarı tarafından silindi.]' WHERE id = '<mesaj id>';
UPDATE "MessageEdit" SET "previousContent" = '[Bu mesaj yazarı tarafından silindi.]' WHERE "messageId" = '<mesaj id>';
UPDATE "Report" SET "reportedContent" = '[Bu mesaj yazarı tarafından silindi.]' WHERE "messageId" = '<mesaj id>';
```

Placeholder metni mevcut `AUTHOR_DELETED_CONTENT` sabitiyle (`apps/api/src/services/messages.service.ts`) bilerek AYNI tutuldu — uygulamanın kendi "silinmiş mesaj" görünümüyle tutarlı olsun diye. `docs/milestones/M6c-message-content-anonymization.md`'nin Slice B'si bu redaksiyonu (kullanıcının kendi seçimiyle) uygulama içine taşıyınca farklı bir sabit seçilirse, bu satır da eşleşecek şekilde güncellenmeli.

### 3.9 — Periyodik örneklem denetimi (M6c — 5651/KVKK avukat şartı, 2026-08-25)
Avukatın "makul çaba" çerçevesine (ADR-0005 Addendum #2) koyduğu şart: otomatik yapısal-PII taramasının (Slice C, `content-redaction.util.ts`) GERÇEKTEN işlediğini gösteren düzenli manuel kontrol. Bir istatistik/rapor bunu KANITLAMAZ — insan gözüyle örnek satırlara bakmak gerekiyor. Önerilen sıklık: AYDA BİR (avukat kesin bir sıklık belirtmedi, founder'ın kendi takdiri — sıklık artırılabilir/azaltılabilir).

**Adım 1 — Redakte edilmiş satırlardan rastgele örnek (redaksiyonun DOĞRU çalıştığını doğrula):**
```sql
SELECT id, content, "createdAt"
FROM "Message"
WHERE "authorId" IS NULL AND content = '[Bu mesaj yazarı tarafından silindi.]'
ORDER BY random()
LIMIT 10;
```
Beklenen: her satırın `content`'i tam olarak placeholder metin. Farklı bir şey görülüyorsa (ör. kısmi redaksiyon, hâlâ okunabilir bir PII parçası) gerçek bir regresyon — `content-redaction.util.spec.ts`'e yeni bir test eklenip kod düzeltilmeli.

**Adım 2 — Redakte EDİLMEMİŞ, anonimleştirilmiş satırlardan rastgele örnek (taramanın bir şey KAÇIRIP KAÇIRMADIĞINI kontrol et):**
```sql
SELECT id, content, "createdAt"
FROM "Message"
WHERE "authorId" IS NULL AND content != '[Bu mesaj yazarı tarafından silindi.]'
ORDER BY random()
LIMIT 10;
```
Beklenen: hiçbirinde göz-ile-fark-edilir bir e-posta/telefon/TC kimlik/isim YOK. Bir tanesinde varsa — regex kaçırmışsa (yapısal bir desen olduğu hâlde) gerçek bir bug, kaçırdığı isim/bağlamsal bir ifşaysa (regex'in bilinen sınırı) `docs/RUNBOOK.md`'nin §3.8'indeki manuel talep prosedürüyle o TEK satır elle redakte edilebilir.

**Audit izi — yeni bir tablo/otomatik log YOK, bu tabloya elle bir satır eklenir** (git commit geçmişi zaten zaman damgası+değişmezlik sağlıyor, tek-founder ölçeğinde ayrı bir DB tablosu aşırı mühendislik olurdu):

| Tarih | Kim | Örneklenen satır (Adım 1 / Adım 2) | Bulgu |
|---|---|---|---|
| — | — | — | İlk denetim henüz yapılmadı |

## 4. Yedekleme / restore

Render Postgres Basic-256mb ücretli bir plan olduğu için Point-in-Time Recovery (PITR) teorik olarak dahil (`render.com/docs/postgresql-backups`: "Render continually backs up paid Render Postgres databases", ayrıca workspace planından bağımsız 7 günlük logical backup retention). **Ama "yedek var" hiçbir zaman varsayılmaz — aşağıdaki sıra izlenir:**

1. **Doğrula (tatbikattan ÖNCE, zorunlu ön koşul):**
   - Recovery penceresi **workspace planına** bağlı (Hobby: 3 gün, Pro+: 7 gün) — bu, DB instance planından AYRI bir ayar, Render dashboard'undan hangisinin aktif olduğu doğrulanmalı.
   - PITR'ın bu SPESİFİK instance'da FİİLEN aktif olduğu (teorik "dahil" olması yetmez) dashboard'dan gözle doğrulanmalı.
2. **Tatbikat (doğrulama tamamlandıktan SONRA):**
   - Render Postgres konsolundan bir geri-yükleme noktası seç.
   - **CANLI DB'ye dokunmadan**, YENİ/ayrı bir veritabanına geri yükle (Render bunu destekliyorsa — bir backup/PITR noktasından yeni bir instance oluşturmak, canlıyı riske atmadan test etmenin yolu).
   - Geri yüklenen veriyi bilinen bir durumla (ör. belirli bir kullanıcı/oda/mesaj sayısı) karşılaştırarak bütünlüğü doğrula.
   - Gözlenen gerçek RTO (ne kadar sürdü) ve RPO'yu (ne kadar veri kaybı penceresi vardı) buraya not düş.
3. Bu iki adım da **founder'ın kendi eliyle yapacağı iş** (`docs/milestones/M6-launch-readiness.md`'nin manuel listesinde zaten var) — bu doküman sadece adımları tarif ediyor, "tatbikat yapıldı" diye iddia etmiyor.

## 5. Sırlar ve nerede yedeklendikleri

Değerlerin KENDİSİ hiçbir yerde yazılı değil — sadece envanter ve "kaybolursa nereden/nasıl geri alınır."

| Sır | Nerede yaşıyor | Render dışında yedek | Kaybolursa ne olur |
|---|---|---|---|
| `TOTP_ENCRYPTION_KEY` | Render dashboard | **EVET olmalı** (şifre yöneticisi vb. — ADR-0008/Slice E'nin kendi manuel görevi) | **KALICI VERİ KAYBI.** Mevcut şifreli `totpSecret` satırları sonsuza dek okunamaz — yeni bir değer üretmek işe yaramaz, gereken ESKİ değer. Toplu kurtarma: §3.7. |
| `JWT_SECRET` | Render dashboard | Yok, gerekmiyor | Veri kaybı DEĞİL — yeni değer üretilip girilir, tek etkisi mevcut access/refresh token'ların geçersiz olması (herkes yeniden giriş yapar). Düşük risk. |
| `CRON_SECRET` | Render dashboard **+** GitHub Actions secrets (aynı değer, iki yerde — ikisi de yazma-sadece, geri okunamaz) | Fiilen iki yerde ama hiçbiri "okunabilir" bir yedek değil | Veri kaybı değil — yeni değer üretip HER İKİ yere birden girmek yeterli. Güncellenene kadar lifecycle-sweep VE traffic-log purge (M6b Slice F) cron'ları 401 alır. |
| `RESEND_API_KEY` | Render dashboard | Asıl kaynağı zaten Resend'in kendi hesap paneli | Veri kaybı değil — Resend dashboard'undan yeniden üretilip girilir. E-posta gönderimi yeni key girilene kadar durur. |
| `DATABASE_URL` | Render dashboard, değeri Render Postgres instance'ının kendi bağlantı bilgisinden türüyor | Asıl kaynağı Render Postgres'in kendi paneli | Veri kaybı değil (DB'nin KENDİSİ ayrı bir şey) — Render Postgres panelinden yeniden kopyalanır. |

**Sentez:** yukarıdakilerin hepsinin ortak tek-nokta-arızası **Render hesabının kendisine erişim** — hesap erişimi kaybolursa (2FA cihazı, kurtarma e-postasına erişim vb.) hepsi aynı anda risk altına girer, `TOTP_ENCRYPTION_KEY`'in ayrıca yedeklenmesi tam olarak bunu telafi etmek için var. Render hesabının kendi kurtarma yolunun (2FA yedek kodları vb.) de güvenli bir yerde durduğundan emin olunmalı — bu da bir yedekleme kararı, ayrıca düşünülmeli.

## 6. Ürün analitiği

Dashboard YOK, üçüncü parti analitik YOK (`docs/BACKLOG.md:577`'nin kararı — ürünün gizlilik duruşuyla tutarlı). Bunun yerine founder'ın Render Postgres konsolundan elle çalıştıracağı, dokümante edilmiş SQL sorguları. Gün-bazlı sorgular (§6.1, §6.3, §6.6'nın haftalık hacim sorgusu) `Europe/Istanbul`'a çevriliyor — DB session timezone'u repoda hiçbir yerde ayarlı değil (Render Postgres varsayılanı UTC), ürün TR kullanıcı kitlesine göre; çevrilmeden gece 21:00-24:00 (TR) arası aktivite yanlış güne düşerdi. Mutlak-süre hesaplayan sorgular (§6.6'nın çözülme-süresi sorgusu) bundan etkilenmiyor (timezone-agnostic).

### 6.1 — Günlük aktif mesajlaşan kullanıcı (DAU)
"Aktif" = o gün en az bir mesaj atan kullanıcı. Sadece okuyan ama hiç mesaj atmayan kullanıcılar (şemada kullanıcı-seviyesinde "okundu" sinyali yok — `ReadCursor`, `DATA-MODEL.md`'de bahsediliyor ama şemada mevcut değil) bu sayıya girmiyor; bu boşluğun en yakın proxy'si §6.4'teki üye-eksi-yazar farkı.

```sql
SELECT
  ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')::date AS gun,
  COUNT(DISTINCT "authorId") AS mesaj_atan_kullanici_sayisi
FROM "Message"
WHERE "authorId" IS NOT NULL
  AND "createdAt" >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1;
```

### 6.2 — Kişi-başı-mesaj
Hem pay hem payda `"authorId" IS NOT NULL` ile filtreleniyor — hesabı silinmiş kullanıcıların (ADR-0005, `authorId` SetNull) geride kalan mesajları oranı şişirip paydaya hiç girmesin diye (aksi halde gerçek olmayan bir sayı çıkardı).

```sql
SELECT
  COUNT(*) AS toplam_mesaj,
  COUNT(DISTINCT "authorId") AS mesaj_atan_kullanici_sayisi,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT "authorId"), 0), 2) AS kisi_basi_mesaj
FROM "Message"
WHERE "authorId" IS NOT NULL
  AND "createdAt" >= now() - interval '30 days';
```

### 6.3 — Gün-1 / gün-7 dönüş
`pencere_tamamlandi = false` olan satırlar (kayıt gününden bu yana 7 günden az geçmiş) henüz ölçülemez — %0 görünmeleri normaldir, düşük dönüş anlamına gelmez.

```sql
WITH cohorts AS (
  SELECT
    id AS user_id,
    ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')::date AS kayit_gunu
  FROM "User"
),
day1_active AS (
  SELECT DISTINCT c.user_id, c.kayit_gunu
  FROM cohorts c
  JOIN "Message" m ON m."authorId" = c.user_id
  WHERE (m."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')::date = c.kayit_gunu + 1
),
day7_active AS (
  SELECT DISTINCT c.user_id, c.kayit_gunu
  FROM cohorts c
  JOIN "Message" m ON m."authorId" = c.user_id
  WHERE (m."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')::date = c.kayit_gunu + 7
)
SELECT
  c.kayit_gunu,
  COUNT(DISTINCT c.user_id) AS kohort_buyuklugu,
  (CURRENT_DATE - c.kayit_gunu) >= 7 AS pencere_tamamlandi,
  COUNT(DISTINCT d1.user_id) AS gun1_donen,
  ROUND(COUNT(DISTINCT d1.user_id)::numeric / NULLIF(COUNT(DISTINCT c.user_id), 0) * 100, 1) AS gun1_yuzde,
  COUNT(DISTINCT d7.user_id) AS gun7_donen,
  ROUND(COUNT(DISTINCT d7.user_id)::numeric / NULLIF(COUNT(DISTINCT c.user_id), 0) * 100, 1) AS gun7_yuzde
FROM cohorts c
LEFT JOIN day1_active d1 ON d1.user_id = c.user_id AND d1.kayit_gunu = c.kayit_gunu
LEFT JOIN day7_active d7 ON d7.user_id = c.user_id AND d7.kayit_gunu = c.kayit_gunu
GROUP BY c.kayit_gunu
ORDER BY c.kayit_gunu;
```

### 6.4 — Oda-aktivitesi (+ sessiz-üye proxy'si)
`RoomMember` + `Message` aynı anda LEFT JOIN edildiği için (fan-out riski — bir odanın 10 üyesi + 5 mesajı varsa join sonucu 50 satır üretir) mesaj sayan HER sütun `COUNT(DISTINCT ...)` kullanıyor, çıplak `COUNT(m.id)` yanlış sayardı. `sessiz_uye_tahmini` NEGATİF çıkabilir — bir kullanıcı üye olmadan mesaj atabilir (`RoomMember` erişim kontrolü değil, ADR-0009) ya da mesaj attıktan sonra odadan ayrılmış olabilir; negatif değer veri hatası değil, "üye olmayan/ayrılmış ama katkı yapmış kullanıcı" sayısını gösterir.

```sql
SELECT
  r.id,
  r.name,
  r.status,
  r."lastActivityAt",
  COUNT(DISTINCT rm."userId") AS uye_sayisi,
  COUNT(DISTINCT m.id) AS toplam_mesaj,
  COUNT(DISTINCT m.id) FILTER (WHERE m."createdAt" >= now() - interval '7 days') AS son_7_gun_mesaj,
  COUNT(DISTINCT m."authorId") AS mesaj_atan_kullanici_sayisi,
  COUNT(DISTINCT rm."userId") - COUNT(DISTINCT m."authorId") AS sessiz_uye_tahmini
FROM "Room" r
LEFT JOIN "RoomMember" rm ON rm."roomId" = r.id
LEFT JOIN "Message" m ON m."roomId" = r.id
WHERE r.status = 'active'
GROUP BY r.id, r.name, r.status, r."lastActivityAt"
ORDER BY son_7_gun_mesaj DESC;
```

### 6.5 — Davet ağacı
Bu dilimi motive eden asıl soru: "Discord'dan kaçanlar gerçekten daha az özellikli bir şey ister mi?" Davet ağacının şekli tam olarak bunu ölçer — birkaç kişi çoğu daveti mi tüketiyor (organik, sağlıklı büyüme) yoksa davetler dallanmadan mı ölüyor (ilgi çekmiyor)?

Davetçi başına kullanım oranı — bu sonuç zaten kullanım-sayısına göre sıralı, "en üretken davetçiler" ayrı bir sorgu gerektirmiyor, aynı çıktının üst satırları. Sıfır davet veren kullanıcılar listede hiç görünmüyor (INNER JOIN, kasıtlı — bu sıralamanın amacına girmiyor).

```sql
SELECT
  u.id AS davetci_id,
  u.username,
  COUNT(i.id) AS toplam_davet,
  COUNT(i."usedAt") AS kullanilan_davet,
  COUNT(i.id) FILTER (WHERE i."revokedAt" IS NOT NULL) AS iptal_edilen_davet,
  ROUND(COUNT(i."usedAt")::numeric / NULLIF(COUNT(i.id), 0) * 100, 1) AS kullanim_yuzdesi
FROM "User" u
JOIN "Invite" i ON i."issuedById" = u.id
GROUP BY u.id, u.username
ORDER BY kullanilan_davet DESC;
```

Davet zincirinin derinliği (organik dallanma vs. tek-seviye ölüm). `derinlik=0` kök kullanıcılar (founder/bootstrap, `"inviterId" IS NULL`). Sonuçta çoğunluk `derinlik=1`'de yığılıyorsa davetler dallanmadan ölüyor demektir; `derinlik≥2` kullanıcı sayısı arttıkça büyüme organik. Olağan davet akışında döngü oluşamaz (bir kullanıcı `inviterId`'yi sadece signup anında bir kez alır) ama bu şema-seviyesinde ZORLANAN bir kısıt değil — **bu sorgu makul sürede dönmezse (askıda kalırsa), muhtemel bir `inviterId` döngüsü var demektir, elle kontrol edilmeli.**

```sql
WITH RECURSIVE davet_zinciri AS (
  SELECT id, "inviterId", 0 AS derinlik
  FROM "User"
  WHERE "inviterId" IS NULL
  UNION ALL
  SELECT u.id, u."inviterId", dz.derinlik + 1
  FROM "User" u
  JOIN davet_zinciri dz ON u."inviterId" = dz.id
)
SELECT derinlik, COUNT(*) AS kullanici_sayisi
FROM davet_zinciri
GROUP BY derinlik
ORDER BY derinlik;
```

### 6.6 — Moderasyon yükü
`Report`+`ModerationAuditLog` production'da çalışıyor — 500 kişide tek-moderatörlü kapasite planlaması için haftalık rapor hacmi, çözülme süresi ve tekrar-raporlanan kullanıcı oranı gerekli.

Haftalık rapor hacmi:
```sql
SELECT
  date_trunc('week', ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')) AS hafta,
  COUNT(*) AS rapor_sayisi,
  COUNT(*) FILTER (WHERE status = 'resolved') AS cozulen,
  COUNT(*) FILTER (WHERE status = 'dismissed') AS reddedilen,
  COUNT(*) FILTER (WHERE status = 'open') AS acik
FROM "Report"
WHERE "createdAt" >= now() - interval '90 days'
GROUP BY 1
ORDER BY 1;
```

Çözülme süresi (sadece `resolvedAt` dolu satırlar — açık raporlar için tanımsız). Süre farkı iki mutlak zaman damgası arasındaki interval olduğu için timezone-agnostic, dönüşüm gerekmiyor:
```sql
SELECT
  ROUND(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600)::numeric, 1) AS ortalama_cozulme_saat,
  ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) / 3600)::numeric, 1) AS medyan_cozulme_saat,
  COUNT(*) AS cozulen_rapor_sayisi
FROM "Report"
WHERE "resolvedAt" IS NOT NULL;
```

Aynı kullanıcıya tekrar rapor oranı — yüksek bir oran, moderatörün aynı birkaç kullanıcıyla tekrar tekrar uğraştığını gösterir (münferit olaylardan farklı bir kapasite planlaması gerektirir):
```sql
WITH rapor_sayilari AS (
  SELECT "reportedUserId", COUNT(*) AS rapor_sayisi
  FROM "Report"
  WHERE "reportedUserId" IS NOT NULL
  GROUP BY "reportedUserId"
)
SELECT
  COUNT(*) AS raporlanan_kullanici_sayisi,
  COUNT(*) FILTER (WHERE rapor_sayisi > 1) AS birden_fazla_rapor_alan,
  ROUND(COUNT(*) FILTER (WHERE rapor_sayisi > 1)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS tekrar_rapor_yuzdesi
FROM rapor_sayilari;
```
