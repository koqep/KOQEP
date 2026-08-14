# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-08-14
**Aktif milestone:** **M7a** (`docs/milestones/M7a-scale-gate.md`) — Slice A (oturum kalıcılığı) TAMAMLANDI, dal `m7a/slice-a-session-persistence` (`docs/500-user-scope-review` dalının ÜSTÜNDE kurulu, o dal henüz main'e merge edilmedi — merge sırası buna bağımlı). M6 main'e MERGE EDİLDİ (A-G). M0-M6 TAMAMLANDI.

## Şu an ne çalışıyor
- **M0-M6 TAMAMEN BİTTİ.** Detaylar kendi milestone dosyalarının Plan notları bölümlerinde.
- **2026-08-12 — 500-kullanıcı kapsam turu:** hedef 20-30'dan 500'e çıktı, M7 **M7a** (kapı açma eşiği, ~98-131h/4-5.5hafta) / **M7b** (cila, ~47-67h/2-3hafta) 'ya bölündü + Faz 0→1(50)→2(150)→3(500) aşamalı davet planı. ADR taraması: ADR-0002 dışında hiçbir ADR yarım kalmamış. Reaksiyon/DM/mesaj-arama M8'e BİLİNÇLİ ERTELEME (sessiz kayma değil). Detay: `docs/BACKLOG.md` "F. 500-KULLANICI KAPSAM TURU", `M7a-scale-gate.md`'nin "Aşamalı davet planı" tablosu.
- **2026-08-14 — M7a Slice A (oturum kalıcılığı) TAMAMLANDI.** `ADR-0002`'nin httpOnly-cookie kararı bitirildi — SADECE refresh token cookie'ye taşındı (`koqep_rt`, `path:/auth`), access token bearer'da kaldı (bu yüzden `jwt-auth.guard.ts`/WS gateway'e HİÇ dokunulmadı). Double-submit CSRF (`koqep_csrf`, `path:/`) + çoklu-sekme rotasyon-yarışı için backend grace-period (10sn + tek kullanım, SADECE rotasyon-revoke'larında — logout ASLA tolere edilmez) + `INVALID_TOKEN_CODE` ayrımı (aşağıya bkz.). Tam tasarım/gerekçe: ADR-0002 Addendum. 202 birim+104 e2e (apps/api) + 67 Playwright (apps/web) testi geçti.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend + Sentry.

## Şu an üzerinde çalışılan
- **Görev:** M7a Slice A implementasyonu bitti, doğrulandı, dokümante edildi.
- **Sonraki adım:** Kullanıcı önce `docs/500-user-scope-review`, sonra `m7a/slice-a-session-persistence` dalını merge ederse, M7a'nın bir sonraki dilimi (muhtemelen Slice B — `RoomMember`, en büyük/en riskli) plan-modu turuyla başlar.

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.
- Rate limit sayıları gözden geçirildi (M6 Slice B) — gerçek 5 aktif limit 20-30 kişilik ölçekte yeterli bulundu, DEĞİŞTİRİLMEDİ (detay: milestone dosyası Slice B notları). M7b'de Faz 1'in gerçek trafiğiyle tekrar gözden geçirilecek.
- `User.role` alanı var, erişim kontrolü kodda çalışıyor ama production'da henüz kimse `moderator` değil — founder'ın kendi satırını elle SQL ile ayarlaması hâlâ öneriliyor (M7a Slice C self-servis atama getirecek).

## Yakın zamanda alınan kararlar
- DB hosting: Render Postgres, Internal Database URL — Neon/Supabase değil.
- WS transport: Socket.IO — bkz. `docs/decisions/ADR-0007`.
- Access token bellek-içi (React state), refresh token httpOnly cookie'de (`koqep_rt`, sadece `/auth` path'i) — bkz. ADR-0002 + 2026-08-14 Addendum'u.
- 2026-07-29 — `SEED_DEV_FIXTURES` opt-in env'i `NODE_ENV`'e bilerek güvenilmedi; sıfır-kullanıcılı DB bootstrap boşluğu `docs/THREAT-MODEL.md` Open items'a somut tetikleyiciyle eklendi.
- 2026-08-12 — ADR-0008: `totpSecret` şifreleme anahtar-kaybı KALICI (kurtarılamaz), rotasyon yolu YOK (bilinçli, gerekirse ikinci anahtar + re-encryption script'i gerekir) — ikisi de sessiz varsayım değil, ADR'de açıkça yazılı.
- 2026-08-14 — ADR-0002 Addendum: refresh-token rotasyon grace-period'ı (10sn+tek kullanım) SADECE `revokedByRotation:true` satırlarda geçerli — logout/confirmPasswordReset'in ANINDA iptali hiç etkilenmez, bilinçli ve dar bir taviz.

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula.
- CI'da job-seviyesi env değişkenleri JOB'LAR ARASI miras YOK — her job'ın kendi `env:` bloğu var, yeni bir env var eklerken HER job'ı tek tek kontrol et.
- Prisma client üretimi TEK kaynaktan: `apps/api/package.json`'daki `postinstall` script'i. Render servisi Blueprint'e bağlı DEĞİL — `render.yaml` değişiklikleri canlıya OTOMATİK yansımaz; bir env var'ın DEĞERİNİ değiştirmek de yansımayabilir, sadece tamamen SİLMEK işe yaradı.
- `.env`/`.env.*` dosyaları `Read`/`cat` için engelli; `@prisma/client` import edilince `.env`'i ayrıca sessizce (yeniden) yükler.
- `resend` SDK hata durumunda fırlatmaz, `{data, error}` döner — elle kontrol şart.
- **Sadece HTTP status koduna (`401` vb.) göre "retry et"/"oturumu düşür" gibi otomatik davranış tetikleme** — bu kod tabanında AYNI status kod hem "token geçersiz" hem TOTP/şifre gibi domain hataları için kullanılıyor (`totp.service.ts`, `deleteAccount`). M7a Slice A'da blanket 401-retry gerçek hataları sessizce yutan bir bug'a yol açtı, kendi Playwright süiti yakaladı — düzeltme: sadece `code:'INVALID_TOKEN'` taşıyan 401'lerde retry (`auth.service.ts`'in `INVALID_TOKEN_CODE`'u).
- Çift cookie kullanılan bir CSRF (double-submit) tasarımında **her cookie'nin `path`'i kendi erişim ihtiyacına göre ayrı seçilir** — JS'in okuyup header'a ekleyeceği cookie MUTLAKA `path:'/'` olmalı (dar bir path JS'in onu bazı sayfalardan hiç görememesi demek), httpOnly olan (JS'in hiç görmesi gerekmeyen) daha dar bir path'e (`/auth`) sahip olabilir.
- `apps/web/e2e/`'de artık paylaşılan bir fixture modülü var: `e2e/support/auth-mocks.ts` (`mockAuthSuccess`/`mockAuthRefreshUnavailable`/`mockRoomEndpoints`) — yeni bir auth-akışı testi yazarken kendi `page.route` mock'unu kopyalamak yerine BUNU kullan/genişlet, aksi halde 3. kez aynı 14-17 dosyaya dokunma sorunu tekrarlanır.
- Sıfır kullanıcılı bir DB'de `/auth/signup` kendi kendini başlatamaz — ilk kullanıcı her zaman elle `INSERT INTO "User"` + lokal `argon2.hash` gerektirir.
- Bash tool `git push`'u kullanıcının izin ayarları sessizce "denied" döndürebilir — kullanıcıdan onaylamasını iste, sessizce vazgeçme. Yerel Postgres Docker container'ı için önce `docker ps` ile kontrol et.
- `prisma migrate dev` migration dosyasını hemen uyguluyor — elle SQL eklemek için önce `--create-only` kullan.
- `@nestjs/throttler` iki tuzağı: (1) global+route-özel guard aynı `@Throttle()` metadata'sını AYRI sayaçla okur. (2) `blockDuration=0` bloğu sessizce sıfırlar — hep `ttl` ver.
- NestJS WS gateway'lerinde: varsayılan exception filtresi `WsException` DIŞINDAKİ her şeyi jenerik hataya çevirir; handler `Promise<void>` dönerse ack tetiklenmez; client `.emit` disconnect'te ack'i kaybeder, `.timeout()` şart.
- Plan modundayken `ExitPlanMode` SADECE "implementasyona başla" onayı DEĞİL — plan dosyası dışındaki HER dosyayı düzenlemenin (docs dahil) tek kilidi.
- `Message` interface'i İKİ ayrı dosyada tanımlı (`MessageItem.tsx`/`ChatPanel.tsx`) — birini değiştirirsen diğerini de kontrol et.
- Test harness'ın üretim davranışını EKSİK yansıttığı iki durum: (1) `apps/web` Playwright `next start` kullanıyor — kod değişikliğinden SONRA `npm run build` şart. (2) `apps/api`'nin e2e `TestingModule`'ü `ValidationPipe`'ı ÇALIŞTIRMAZ — kendi dosyanda test etmek istiyorsan elle ekle.
- Playwright: `page.route("**/rooms", ...)` sondaki `**` OLMADIĞI için query-string'li çağrıları eşleştirmez; `getByRole(...,{name:"sil"})` `exact:true` OLMADAN substring eşleşir.
- Windows'ta `npx playwright test` bazen `.gitignore`'a `test-results/` satırını UTF-16 ile ekler — commit'e girmeden `git checkout -- .gitignore` ile geri al.
