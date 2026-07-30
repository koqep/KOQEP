# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-07-29
**Aktif milestone:** M2 (`docs/milestones/M2-core-rooms-messaging.md`) — Slice A+B+C bitti, D-G kaldı (7 slice: A-D backend, E-G frontend).

## Şu an ne çalışıyor
- **M0 + M1 TAMAMEN BİTTİ, `main`'e MERGE EDİLDİ.** M1: gerçek signup/login/TOTP/şifre-sıfırlama/block akışları `apps/web`'de, dev-login koddan tamamen silindi. Merge-sonrası bulunan bir güvenlik açığı (`seed.ts`'in dev fixture'ları production'a da yazması) `SEED_DEV_FIXTURES` opt-in env'iyle kapatıldı; kullanıcı production'da eski test hesaplarını silip **kendi ilk gerçek hesabını elle SQL ile bootstrap etti**. Detaylar `docs/milestones/M1-auth-invites.md`.
- **M2 kapsamı netleşti. Slice A+B `main`'e MERGE EDİLDİ; Slice C TAMAMLANDI ve doğrulandı, henüz merge edilmedi.** Slice A: 'genel' odası id/geçmişi korunarak 'general'e taşındı, 'meta' eklendi, mesajlaşma oda-parametreli oldu, `User.role` geldi. Slice B: `MessageEdit` + `message:edit` WS event'i + `message:updated` yayını + yazar/moderatöre gated geçmiş okuma. Slice C: `POST /invites` (gerçek, yüksek-entropili kod) + `@nestjs/throttler` (davet/signup/WS mesaj limitleri) — implementasyon sırasında kütüphanenin kendisinde iki gerçek hata/tuzak bulundu ve düzeltildi (bkz. Tuzaklar). `apps/web` üç slice'ta da hiç dokunulmadı, gerçek fullstack testle doğrulandı.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend.

## Şu an üzerinde çalışılan
- **Görev:** M2 Slice C kod + test + doküman tamamlandı, `m2/slice-c-invites-rate-limiting` branch'inde commit edilecek.
- **Yarım kalan:** Bu branch'in commit/push/merge edilmesi.
- **Sonraki adım:** M2 Slice D (temel yük testi, ~50 eşzamanlı WS bağlantısı) kendi plan modu turunu alacak — ya da kullanıcı frontend slice'larına (E-G) geçmek isterse o. Founder'ın kendi `User.role`'ünü elle `moderator` yapması hâlâ öneriliyor. TOTP kurtarma akışını gerçek bir davetten önce şahsen dene (hâlâ geçerli).

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.
- Rate limit sayıları (100/60s global, 5/saat davet, 20/60s signup, 10/10s WS) ayarlanabilir varsayılan — somut tetikleyici: M6 ships VEYA gerçek bir olay (yanlış engelleme ya da kaçan bir suistimal).
- `User.role` alanı var, erişim kontrolü kodda çalışıyor ama production'da henüz kimse `moderator` değil — founder'ın kendi satırını elle SQL ile ayarlaması hâlâ öneriliyor.

## Yakın zamanda alınan kararlar
- DB hosting: Render Postgres, Internal Database URL — Neon/Supabase değil.
- WS transport: Socket.IO — bkz. `docs/decisions/ADR-0007`.
- Access token bellek-içi (React state), localStorage/sessionStorage YOK — bkz. ADR-0002.
- M1'in slice-by-slice kararları (A-D backend, E1-E5 frontend) tekrar buraya taşınmadı — `docs/milestones/M1-auth-invites.md`'nin Plan notları bölümlerinde tam haliyle duruyor.
- 2026-07-29 — `SEED_DEV_FIXTURES` opt-in env'i: `NODE_ENV`'e bilerek güvenilmedi (kod tabanında hiç kullanılmıyordu, Render'ın set etme davranışı doğrulanamadı). `test-fullstack-e2e` CI job'ı `true` ile açık; `test` job'ı kapalı bırakıldı, testler değişmeden geçti.
- 2026-07-29 — Sıfır-kullanıcılı DB bootstrap boşluğu koda değil belgeye gitti: `docs/THREAT-MODEL.md` Open items'a somut tetikleyiciyle (M2'nin davet endpoint'i bunu da kapsamalı) eklendi.
- 2026-07-30 — M2 Slice A: oda adları `dev-seed.constants.ts`'ten yeni `core-rooms.constants.ts`'e taşındı (odalar "dev fixture" değil çekirdek altyapı). Gateway TÜM odalara değil sadece `CORE_ROOM_NAMES`'e join oluyor (paylaşılan test DB'sindeki rastgele-isimli test odalarını kirletmemek için, bilinçli M2-only basitleştirme). `message:send`'deki `roomName` opsiyonel, verilmezse ilk çekirdek odaya düşüyor — Slice E'ye kadar `apps/web`'i bozmamak için.
- 2026-07-30 — M2 Slice B: düzenleme WS'te (`message:edit`), REST `PATCH` değil — `sendMessage`'ın zaten REST karşılığı yok, aynı deseni izledi. Yayın `message:updated` (yeni event, `message:new` değil). Moderatör rolü JWT'ye eklenmedi, her okumada DB'den taze çekiliyor (nadiren değişen bir değer için token'ı genişletmeye değmedi). Public "düzenlendi" işareti bilerek eklenmedi (kapsam dışı, Slice F'nin kararı).
- 2026-07-30 — M2 Slice C: `POST /invites` kullanıcı-bazlı limit için `ThrottlerGuard`'ı extend etmiyor, `ThrottlerStorage`'ı doğrudan kullanan bağımsız bir guard (global APP_GUARD ile çakışmayı önlemek için, bkz. Tuzaklar). Davet kodu `randomBytes(12).toString('base64url')` — refresh token'la aynı desen, daha kısa (insan tarafından paylaşılacağı için).

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula (bu oturumda iki kez yapıldı, ikisi de doğru çıktı).
- CI'da job-seviyesi env değişkenleri TÜM adım/alt süreçlere sızar, ama JOB'LAR ARASI miras YOK — her job'ın kendi `env:` bloğu var, bir job'a eklenen değişken diğerlerinde sessizce eksik kalır. Yeni bir env var eklerken HER job'ı tek tek kontrol et.
- Prisma client üretimi TEK kaynaktan: `apps/api/package.json`'daki `postinstall` script'i — buildCommand/CI adımına gömmeye çalışma.
- Render servisi Blueprint'e bağlı DEĞİL, elle kuruldu — `render.yaml` değişiklikleri canlıya OTOMATİK yansımaz.
- `.env`/`.env.*` dosyaları `Read` için engelli — içerik değiştirmek için `Write` ile tam dosyayı körlemesine yeniden yaz.
- Render'da bir env var'ın DEĞERİNİ değiştirmek canlıya yansımayabilir — sadece tamamen SİLMEK işe yaradı, gözlemlendi. Mekanizma bilinmiyor, gelecekte aynı şeyi bekle.
- `@prisma/client` import edilince `.env`'i sessizce (yeniden) yükler; testte "env var yok" simüle etmek için `delete process.env.X` DEĞİL, boş string (`''`) kullan.
- `resend` SDK hata durumunda fırlatmaz, `{data, error}` döner — elle kontrol şart.
- `apps/web`'de token bellek-içi (ADR-0002) — reload oturumu düşürür, kasıtlı.
- Sıfır kullanıcılı bir DB'de `/auth/signup` kendi kendini başlatamaz — davetin `issuedById`'i var olan bir `User`'a FK'lidir. İlk kullanıcı her zaman elle `INSERT INTO "User"` + lokal `argon2.hash` gerektirir — "eksik davet kodu" sanıp Invite tablosuna uğraşma, önce User'ı elle yarat.
- Bash tool `git push`'u kullanıcının izin ayarları reddedebilir (sessizce "denied" döner, hata değil) — bu olursa kullanıcıdan onaylamasını ya da kendisinin push etmesini iste, sessizce vazgeçme ya da başka bir şey denemeye çalışma.
- Yerel Postgres Docker container'ı (`docker-compose.yml`) Docker Desktop kapalıyken çalışmaz ve Desktop'ı Bash'ten otomatik başlatmak güvenilir değil (denendi, path bulunamadı) — kullanıcıdan başlatmasını iste.
- `prisma migrate dev` migration dosyasını hemen uyguluyor — elle SQL eklemek (data-fix gibi) için önce `--create-only` kullan, YOKSA dosyayı sonradan editlemek checksum uyuşmazlığı yaratır. Düzeltmek `prisma migrate reset` gerektirir — bu Prisma'nın kendi "AI agent önce kullanıcıya sor" güvenlik kilidini tetikler (env var + kullanıcının TAM onay metnini ister), sessizce bypass edilemez, doğru davranış.
- Yeni bir tabloya `ON DELETE RESTRICT` FK eklerken (Prisma varsayılanı) mevcut e2e testlerin `afterAll` temizliğini kontrol et — ebeveyn satırı (ör. `Message`) artık çocuk satırı (ör. `MessageEdit`) olmadan silinemez, temizlik sırası tersten olmalı (önce çocuk, sonra ebeveyn). Slice B'de bu gerçek bir test hatası olarak yakalandı.
- `@nestjs/throttler`: aynı route'ta HEM global (APP_GUARD) HEM route-özel bir `ThrottlerGuard` alt sınıfı varsa, ikisi de AYNI `@Throttle()` metadata'sını okuyup birbirinden habersiz AYRI sayaç tutar (IP-bazlı + kullanıcı-bazlı gibi) — beklenmedik erken 429'lara yol açar, gerçek testte yakalandı. Farklı tracking mantığı gereken route'lar için `ThrottlerGuard`'ı extend etmek yerine `ThrottlerStorage`'ı doğrudan kullanan bağımsız bir `CanActivate` yaz.
- `@nestjs/throttler`'ın `storageService.increment()`'ine `blockDuration=0` vermek bloğu AYNI çağrı içinde sessizce sıfırlıyor (kaynak kodda doğrulandı) — limit aşılsa bile hep izin veriyormuş gibi görünür. `blockDuration` hep `ttl` (ya da üstü) olmalı, base `ThrottlerGuard` da belirtilmediğinde buna düşüyor.
