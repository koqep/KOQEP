# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-08-01
**Aktif milestone:** M3 (`docs/milestones/M3-user-rooms-lifecycle.md`) — Slice A-C'ye bölündü, Slice A TAMAMEN BİTTİ, `main`'e MERGE EDİLDİ (PR #29). Slice B (arşiv yaşam döngüsü) plan modu onaylandı, uygulama henüz başlamadı. M2.5 TAMAMEN BİTTİ, `main`'e MERGE EDİLDİ.

## Şu an ne çalışıyor
- **M0 + M1 + M2 + M2.5 (tüm 6 dilim: username/e-posta doğrulama/hesap silme/WS güvenilirlik/geçmiş sayfalama/kod bloğu) TAMAMEN BİTTİ, `main`'e MERGE EDİLDİ.** Detaylar kendi milestone dosyalarının Plan notları bölümlerinde.
- **2026-07-30 — LANSMAN KARARI + büyük kapsam denetimi:** KOQEP "beta" değil, 20-30 kişilik kapalı davetli bir gruba **eksiksiz 1.0** olarak çıkacak. Sonuç `docs/BACKLOG.md`'nin "2026-07-30 — LANSMAN KARARI" bölümünde.
- **2026-07-31 — M3 kapsam gözden geçirmesi: A/B/C dilimlerine bölündü.** Kod okuyarak iki kritik açık bulundu (milestone'un Tasks listesinde hiç yoktu): WS gateway sadece çekirdek odaları katılıyor (kullanıcı odaları gerçek zamanlı hiç ulaşmaz — Slice A'ya dahil), `sendMessage` oda durumunu hiç kontrol etmiyor (Slice B'ye dahil). Gerçek bir kural çatışması bulundu: `CLAUDE.md`'nin "mesaj asla hard-delete edilmez" kuralı ile ADR-0006'nın oda hard-delete'i — kullanıcıya soruldu, oda silinince mesajları da siliniyor kararı verildi, `CLAUDE.md`+ADR-0006'ya kayıtlı istisna eklendi. Detay: milestone Plan notları.
- **2026-08-01 — M3 Slice A tamamlandı.** `POST /rooms` + günde-1 rate limit + WS join-set düzeltmesi + `description`/`lastActivityAt` tooltip sinyali. Tam doğrulama: apps/api (lint/typecheck/build temiz, birim 98/98, e2e 46/46), apps/web (lint/typecheck/build temiz, mocked e2e 42/42). Detay: milestone dosyasının "Plan notları — Slice A uygulaması" bölümü.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend.

## Şu an üzerinde çalışılan
- **Görev:** M3 Slice B (arşiv yaşam döngüsü) plan modu onaylandı (2026-08-01) — tasarım milestone dosyasının "Plan notları — Slice B tasarımı" bölümünde tam haliyle duruyor. Oturum limiti nedeniyle UYGULAMA HENÜZ BAŞLAMADI, sadece plan dokümante edildi.
- **Sonraki adım:** Bir sonraki oturumda `m3/slice-b-archive-lifecycle` dalı açılıp Slice B'nin onaylı tasarımı uygulanacak. Ayrıca bağımsız, sırası kullanıcının tercihine kalmış bir iş var: `RoomView.tsx` bölme refactor'ü (küçük, ayrı dilim — Slice B'ye GÖMÜLMEYECEK, kullanıcının 2026-08-01 kararı). Founder'ın kendi `User.role`'ünü elle `moderator` yapması hâlâ öneriliyor.

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
- 2026-07-30 — M2 Slice A-G kararları (oda-parametreli mesajlaşma, `message:updated`, rate limiting tuzakları, yük testi, oda değiştirici, düzenleme/geçmiş + davet UI, `ApiError.status`, sahte `apps/web/AGENTS.md`/`CLAUDE.md` kaldırma, arayüzün kademeli İngilizceye geçişi) tekrar buraya taşınmadı — `docs/milestones/M2-core-rooms-messaging.md`'nin Plan notları bölümlerinde tam haliyle duruyor.

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
- `prisma migrate dev --create-only` mevcut satırları olan bir tabloya varsayılansız zorunlu kolon eklerken ("nasıl doldurulsun" sorusu insan girdisi gerektirdiğinde) non-interactive ortamda tamamen REDDEDİYOR, dosya bile üretmiyor. Çözüm: migration klasörünü/`migration.sql`'i elle oluştur (nullable ekle → veri koru şekilde doldur → NOT NULL/UNIQUE'e sıkılaştır, tek dosyada), sonra `prisma migrate dev` (dosya zaten varsa sadece uygular). M2.5 Slice A'da `User.username` için kullanıldı.
- M2.5 gibi ayrı bir docs-only branch'in (`docs/1.0-scope-audit`) hemen ardından gelen bir slice, o dokümana referans veriyorsa `main`'den değil O BRANCH'TEN dallanmalı — yoksa milestone dosyası bile yok olur (Slice A'da olduğu gibi, sonradan `git merge` ile düzeltildi).
- Sahte/placeholder CI env değerleri (ör. eski `RESEND_API_KEY: ci-only-test-key`) sadece o değeri kullanan TÜM kod yolları hatayı sessizce yutuyorsa güvenlidir — bir yol sessizce yutmayı bırakınca aynı sahte değer aniden CI'ı kırar. Dış servisi DI ile override edilemeyen canlı süreçlerde (fullstack e2e'nin `start:prod`'u gibi) sahte'lemek gerekirse: kesin string eşitliği kullan (`=== 'fake'`, TRUTHY DEĞİL), SADECE ihtiyaç duyan job'a ekle, production sızmasını `render.yaml`'ı statik tarayan bir testle koru (`NODE_ENV`'e güvenme — `SEED_DEV_FIXTURES` kararında da reddedildi).
- `SEED_DEV_FIXTURES`'ın seed'lediği dev kullanıcı Slice B'den beri `emailVerifiedAt` olmadan giriş yapamıyordu (`seed.ts` bunu set etmiyordu) — lokal DB'de migration backfill'i eski satırı zaten doğrulamış olduğu için GÖRÜNMEDİ, CI'ın her koşuda kurduğu SIFIR satırlı taze DB'de create dalı ilk kez çalışıp açığa çıktı. Ders: "CI'da kırmızı, lokalde yeşil" bir e2e/seed sorununu gerçekten doğrulamak için kalıcı lokal DB'ye değil, taze bir throwaway Postgres container'ına karşı test et.
- Bir e2e testinde YENİ bir `Room` oluşturma (`prisma.room.create`) — odalar alfabetik sıralanıyor ve `RoomView.tsx` ilk odayı otomatik seçiyor, rastgele isimli bir test odası "general"den önce sıralanıp fullstack testlerin varsaydığı varsayılan odayı sessizce değiştirir. Slice C'de bu gerçek bir regresyon olarak yakalandı (3 fullstack test kırıldı). Test bir odaya ihtiyaç duyarsa mevcut çekirdek odayı (`CORE_ROOM_NAMES[0]`) upsert ile kullan.
- NestJS WS gateway'lerinde: varsayılan exception filtresi `WsException` DIŞINDAKİ her şeyi jenerik "Internal server error"a çeviriyor (kaynak kodda doğrulandı) — yapısal bir hata sinyali (`code` alanlı) istiyorsan `WsException({code:...})` fırlat. Ayrıca handler `Promise<void>` dönerse ack callback'i (başarıda bile) hiç tetiklenmiyor — gerçek bir değer dönmesi şart; client'ta da düz `.emit(event,payload,cb)` disconnect'te ack'i sessizce kaybeder, `.timeout()` şart. M2.5 Slice D'de üçü de kaynak okunarak doğrulandı, sonra e2e'de kanıtlandı.
- `messages.gateway.ts`'in `handleConnection`'ı bağlantıda hangi odalara `client.join()` edileceğini SABİT bir listeden (`CORE_ROOM_NAMES`) alıyordu — dinamik/kullanıcı-üretimi kaynaklar (M3'te oda) eklerken bu tür "bağlantı anında sabit bir listeye katıl" desenlerini MUTLAKA ara: yeni kaynak var olsa bile hiçbir soket ona hiç katılmaz, gerçek zamanlı teslimat sessizce kırılır. Milestone dokümanının Tasks listesi bunu hiç anmıyordu, sadece kod okuyarak bulundu.
