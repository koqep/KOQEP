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
| `CRON_SECRET` | Render dashboard **+** GitHub Actions secrets (aynı değer, iki yerde — ikisi de yazma-sadece, geri okunamaz) | Fiilen iki yerde ama hiçbiri "okunabilir" bir yedek değil | Veri kaybı değil — yeni değer üretip HER İKİ yere birden girmek yeterli. Güncellenene kadar sadece lifecycle-sweep cron'u 401 alır. |
| `RESEND_API_KEY` | Render dashboard | Asıl kaynağı zaten Resend'in kendi hesap paneli | Veri kaybı değil — Resend dashboard'undan yeniden üretilip girilir. E-posta gönderimi yeni key girilene kadar durur. |
| `DATABASE_URL` | Render dashboard, değeri Render Postgres instance'ının kendi bağlantı bilgisinden türüyor | Asıl kaynağı Render Postgres'in kendi paneli | Veri kaybı değil (DB'nin KENDİSİ ayrı bir şey) — Render Postgres panelinden yeniden kopyalanır. |

**Sentez:** yukarıdakilerin hepsinin ortak tek-nokta-arızası **Render hesabının kendisine erişim** — hesap erişimi kaybolursa (2FA cihazı, kurtarma e-postasına erişim vb.) hepsi aynı anda risk altına girer, `TOTP_ENCRYPTION_KEY`'in ayrıca yedeklenmesi tam olarak bunu telafi etmek için var. Render hesabının kendi kurtarma yolunun (2FA yedek kodları vb.) de güvenli bir yerde durduğundan emin olunmalı — bu da bir yedekleme kararı, ayrıca düşünülmeli.
