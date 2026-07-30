# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-07-30
**Aktif milestone:** M2 (`docs/milestones/M2-core-rooms-messaging.md`) — TAMAMLANDI (backend A-D + frontend E-G), Slice G henüz merge edilmedi.

## Şu an ne çalışıyor
- **M0 + M1 TAMAMEN BİTTİ, `main`'e MERGE EDİLDİ.** M1: gerçek signup/login/TOTP/şifre-sıfırlama/block akışları `apps/web`'de, dev-login koddan tamamen silindi. Merge-sonrası bulunan bir güvenlik açığı (`seed.ts`'in dev fixture'ları production'a da yazması) `SEED_DEV_FIXTURES` opt-in env'iyle kapatıldı; kullanıcı production'da eski test hesaplarını silip **kendi ilk gerçek hesabını elle SQL ile bootstrap etti**. Detaylar `docs/milestones/M1-auth-invites.md`.
- **M2 TAMAMLANDI.** Backend (Slice A-D: çekirdek odalar, mesaj düzenleme+geçmiş, davet üretme+rate limiting, yük testi) `main`'e MERGE EDİLDİ. Frontend (Slice E: oda değiştirici, F: düzenleme+geçmiş UI, G: davet-üretme UI) de MERGE EDİLDİ — Slice G ile birlikte arayüz metni Türkçe'den İngilizce'ye geçmeye başladı (kullanıcı kararı, sadece görünen metin, kademeli). Her slice'ın kararları/tuzakları `docs/milestones/M2-core-rooms-messaging.md`'nin kendi Plan notları bölümlerinde tam haliyle duruyor — burada tekrar edilmiyor.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend.

## Şu an üzerinde çalışılan
- **Görev:** M2 Slice G kod + test + doküman tamamlandı, `m2/slice-g-invite-ui` branch'inde commit edildi.
- **Yarım kalan:** Bu branch'in merge edilmesi — M2'nin son parçası.
- **Sonraki adım:** M2 bitince M3'e geçiş kullanıcının kararı. Kalan Türkçe→İngilizce arayüz çevirisi (Slice G dışındaki bileşenler + testleri) ayrı, kapsamı belirlenmemiş bir görev. Founder'ın kendi `User.role`'ünü elle `moderator` yapması hâlâ öneriliyor.

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
- 2026-07-30 — M2 Slice A-F kararları (oda-parametreli mesajlaşma, `message:updated`, rate limiting tuzakları, yük testi, oda değiştirici, `GET /users/me` + düzenleme/geçmiş UI) tekrar buraya taşınmadı — `docs/milestones/M2-core-rooms-messaging.md`'nin ilgili Plan notları bölümlerinde tam haliyle duruyor.
- 2026-07-30 — `apps/web/AGENTS.md`/`CLAUDE.md` kaldırıldı: kullanıcı hiç yazmadı, muhtemelen önceki bir Claude Code oturumunun uydurduğu sahte bir "agent kuralları" dosyasıydı (var olmayan bir yol okumayı istiyordu). Talimat hiç çalıştırılmadı.
- 2026-07-30 — M2 Slice G: `ApiError`'a `status: number` eklendi (429'u ham `ThrottlerException` string'i yerine dostane mesajla göstermek için) — mevcut hiçbir çağrı yeri değişmedi. Davet kodları session-only listede birikiyor (silinmiyor), panoya kopyalama yok (hiç precedent'i yoktu). Bu slice'tan itibaren arayüz metni İngilizce (kullanıcı kararı) — geri kalan Türkçe bileşenlerin çevirisi ayrı bir görev.

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
