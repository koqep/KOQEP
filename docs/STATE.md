# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-08-19
**Aktif milestone:** **M7a** (`docs/milestones/M7a-scale-gate.md`) — Slice A/B/C/F main'e MERGE EDİLDİ. Slice G tamamlandı, dal `m7a/slice-g-landing-legal` henüz yerelde, push kullanıcının onayına kalıyor. Sıradaki dilim Slice H (analitik SQL). M0-M6 TAMAMLANDI.

## Şu an ne çalışıyor
- **M0-M6 TAMAMEN BİTTİ.** Detaylar kendi milestone dosyalarının Plan notları bölümlerinde.
- **2026-08-12 — 500-kullanıcı kapsam turu:** hedef 20-30'dan 500'e çıktı, M7 **M7a** (kapı açma eşiği) / **M7b** (cila) 'ya bölündü. Detay: `docs/BACKLOG.md` "F. 500-KULLANICI KAPSAM TURU".
- **2026-08-14/15/16 — M7a Slice A/B/C TAMAMLANDI, main'e merge edildi.** Oturum kalıcılığı (ADR-0002 Addendum), `RoomMember` üyelik modeli (ADR-0009), self-servis moderatör atama/kaldırma.
- **2026-08-18 — M7a Slice F (hesap sertleştirme) TAMAMLANDI.** `PasswordPolicyService` HaveIBeenPwned k-anonymity ile bilinen sızdırılmış şifreleri reddediyor (signup+parola-sıfırlama, fail-open). `User.failedLoginCount`/`lockedUntil`/`lockoutNotifiedAt` ile hesap-bazlı brute-force kilidi — SADECE yanlış şifre sayaca dahil (TOTP değil, griefing riski), kilitli durum İSTEMCİYE HİÇ sızmıyor (enumeration riski), bildirim e-postası yanıtı BEKLEMEDEN ateşleniyor (zamanlama-oracle riski) + 12sn soğuma penceresi taşıyor. `THREAT-MODEL.md` satır 2 kapatıldı, `verifyCurrentPassword` yolu için AYRI açık bir madde bırakıldı. 238 birim+130 e2e (apps/api, iki koşu) + 75 Playwright (apps/web) testi geçti.
- **2026-08-19 — M7a Slice G (landing/onboarding + hukuki EN/TR) TAMAMLANDI.** `/` artık `AuthView`'ın üstünde kısa, İngilizce bir tanıtım bloğu (`LandingIntro.tsx`) gösteriyor — ayrı route/state yok (kullanıcının bu turda seçtiği ucuz tasarım). `/privacy/en`+`/terms/en` yeni statik sayfalar (i18n framework yok), 4 sayfada dil-değiştirme linki + "hangi dil bağlayıcı" sorusunun hukuki incelemeden geçmediğini belirten not. 81 Playwright testi geçti.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend + Sentry.

## Şu an üzerinde çalışılan
- **Görev:** Slice G implementasyonu bitti, doğrulandı, dokümante edildi. Push kullanıcının onayında.
- **Sonraki adım:** Slice G main'e merge edilince, M7a'nın bir sonraki dilimi (Slice H — ürün analitiği SQL sorguları) plan-modu turuyla başlar.

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.
- `GET /rooms?scope=all` (moderasyon) sayfalanmıyor — somut tetikleyici `docs/BACKLOG.md` A16'da.
- `AuthService.verifyCurrentPassword` (deleteAccount + assignModerator reauth) hesap kilidi KORUMASI ALMIYOR — somut tetikleyici `THREAT-MODEL.md`'nin yeni open item'ında.

## Yakın zamanda alınan kararlar
- Access token bellek-içi (React state), refresh token httpOnly cookie'de — bkz. ADR-0002 + Addendum.
- 2026-08-16 — moderatör atama HERHANGİ bir mevcut moderatörden yapılabiliyor (founder-only kısıtlama YOK) — atama reauth istiyor, kaldırma istemiyor.
- 2026-08-18 — hesap kilidi bildirimi e-postası `login()`'in yanıt yolundan TAMAMEN çıkarıldı (await edilmiyor) — bir dış API çağrısını (Resend/HIBP) güvenlik-kritik bir yanıt yolunda await etmek zamanlama-tabanlı bir enumeration oracle'ı yaratır, ateşle-unut şart.

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula.
- CI'da job-seviyesi env değişkenleri JOB'LAR ARASI miras YOK — her job'ın kendi `env:` bloğu var.
- Render servisi Blueprint'e bağlı DEĞİL — `render.yaml`/env var DEĞİŞİKLİĞİ canlıya otomatik yansımaz, sadece env var'ı tamamen SİLMEK güvenilir çalıştı.
- `.env`/`.env.*` dosyaları `Read`/`cat` için engelli; `@prisma/client` import edilince `.env`'i ayrıca sessizce (yeniden) yükler.
- **Sadece HTTP status koduna göre otomatik davranış tetikleme** — AYNI status kod hem "token geçersiz" hem domain hataları için kullanılıyor; sadece `code:'INVALID_TOKEN'` taşıyan 401'lerde retry.
- `apps/web/e2e/support/auth-mocks.ts` paylaşılan fixture — yeni auth-akışı testi yazarken kopyalamak yerine BUNU kullan/genişlet.
- Bash tool `git push`'u kullanıcının izin ayarları sessizce "denied" döndürebilir — kullanıcıdan onaylamasını iste.
- `prisma migrate dev` migration dosyasını hemen uyguluyor — elle SQL eklemek için önce `--create-only` kullan.
- NestJS WS gateway'lerinde: `WsException` DIŞINDAKİ her şey jenerik hataya çevrilir; `.emit` disconnect'te ack'i kaybeder, `.timeout()` şart.
- Plan modundayken `ExitPlanMode` SADECE "implementasyona başla" onayı DEĞİL — plan dosyası dışındaki HER dosyayı düzenlemenin tek kilidi.
- Test harness üretim davranışını EKSİK yansıtıyor: (1) `apps/web` Playwright `next start` kullanıyor — kod değişikliğinden SONRA `npm run build` şart, aksi halde eski build sessizce servis edilir. (2) `apps/api`'nin e2e `TestingModule`'ü `ValidationPipe`'ı ÇALIŞTIRMAZ.
- Playwright: `page.route("**/rooms", ...)` sondaki `**` OLMADIĞI için query-string'li çağrıları eşleştirmez (ayrı bir route/predicate gerekir); `getByText`/`getByRole` `exact:true` OLMADAN substring eşleşir — yeni bir buton/başlık metni eklerken mevcut metinlerle substring çakışmasını kontrol et (`room-moderation.spec.ts`'in `getByText("odalar")`'ı "odaları keşfet" butonuyla ÇAKIŞTI, M7a Slice B).
- Birden fazla bağımsız sorguyu (`Promise.all`) tek bir `createMany`'e yazan bir backfill script'i, PARALEL e2e worker'ların AYNI DB'ye eşzamanlı yazdığı testlerde okuma-yazma arasında FK ihlaline çarpabilir (M7a Slice B'de gerçekleşti) — hatayı yakalayıp geçerli id'lere göre filtreleyip retry et, YUTMA. Aynı sebeple böyle bir script'in idempotentlik testinde "ikinci koşu global sayım sıfır" assert ETME (yarış-güvenli değil) — belirli bir satırın `createdAt`'inin değişmediğini kontrol et (`backfillTotpSecrets`'ın kendi deseni).
- Genel desen (Slice B'de VE Slice C'de tekrar çıktı): paylaşılan e2e DB'sinde "sistemde toplam X satır var" gibi GLOBAL bir sayıya dayanan bir e2e assertion'ı YAZMA (diğer test dosyalarının/yerel geçmişin bıraktığı satırlar sayıyı bilinmez kılar) — o sınırı kontrollü bir mock'la unit testte kanıtla, e2e'de sadece SENİN yarattığın satırlarla deterministik olan tarafı test et.
- Güvenlik-kritik bir yanıt yolunda (login, reauth vb.) dış bir API çağrısını (email, HIBP, ...) `await` ETME — yanıt süresi çağrının başarılı/başarısız olmasına göre ölçülebilir şekilde değişir, bu da (ör. "hesap var mı" gibi) sızdırmamaya çalıştığın bilgiyi zamanlama üzerinden sızdırır (M7a Slice F'de kilit-bildirimi e-postası tam bunu yapıyordu). `void`+kendi try/catch'iyle ateşle-unut yap, ayrıca DB'ye YAZAN bir yan etkiyse (`lockoutNotifiedAt` gibi) e2e testlerinde sabit `sleep` yerine kısa bir polling ile bekle.
- Yeni bir `overrideProvider(X)` e2e-mock kuralı eklerken (testing.md), İLK gerçek çağrı noktasını (ör. `AuthService.signup`) DEĞİL, o servisin TÜM gerçek çağrı noktalarını grep'le (`grep -rl "post('/auth/signup')"` gibi) — M7a Slice F'de `PasswordPolicyService` override'ı ilk planda sadece 1 dosyaya eklenmişti, gerçekte 5 dosya gerekiyordu.
