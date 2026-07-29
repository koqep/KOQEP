# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-07-29
**Aktif milestone:** M1 TAMAMEN BİTTİ. M2 (`docs/milestones/M2-core-rooms-messaging.md`) henüz başlamadı, kapsamı netleşmedi.

## Şu an ne çalışıyor
- **M0 — Walking Skeleton TAMAMLANDI.** Tüm kabul kriterleri karşılandı, bu makinede bağımsız doğrulandı.
- **M1 — Real Auth: Invite Signup + Login TAMAMEN BİTTİ ve `main`'e MERGE EDİLDİ** (PR #9). Gerçek signup/login/TOTP/şifre-sıfırlama/block akışları `apps/web`'de; dev-login koddan tamamen silindi. Slice-by-slice detaylar `docs/milestones/M1-auth-invites.md`'nin Plan notları bölümlerinde.
- **Merge-sonrası güvenlik açığı bulunup kapatıldı, PR #10 ile merge edildi:** `seed.ts`'in dev kullanıcı + `DEV_INVITE_CODES` kısmı her deploy'da production'a da yazılıyordu (dev-login'le aynı risk sınıfı). `SEED_DEV_FIXTURES` opt-in env'i eklendi, varsayılan kapalı. Kullanıcı production'da eski test hesabını + `dev@koqep.local`'ı sildi, ardından **kendi ilk gerçek hesabını elle SQL ile bootstrap etti** (bkz. Tuzaklar) ve gerçek bir davet kodu üretti — hepsi doğrulandı, çalışıyor.
- Stack: NestJS (API+WS, Render) + Next.js (Vercel) + Postgres (Render Postgres) + Prisma + Resend.

## Şu an üzerinde çalışılan
- **Görev:** Oturum sonu. M2'nin kapsamı henüz netleşmedi; tek karar: gerçek bir davet-üretme endpoint'i M2'ye giriyor (bootstrap boşluğu + THREAT-MODEL'in Open items'ı bunu gerektiriyor) — `docs/milestones/M2-core-rooms-messaging.md`'ye sadece not olarak düşüldü, detaylı planlama yapılmadı.
- **Yarım kalan:** Bu not + bu STATE.md güncellemesi `docs/m2-invite-endpoint-note` branch'inde, henüz commit/push/merge edilmedi.
- **Sonraki adım:** M2 planını netleştirmek (başka bir bilgisayardan devam edilecek). TOTP kurtarma akışını gerçek bir davetten önce şahsen dene (M1'in en büyük solo-destek riski, hâlâ geçerli).

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.
- Gerçek bir "davet üret" endpoint'i yok — hem founder-invite akışı hem ilk-kullanıcı bootstrap'ı elle SQL'e dayanıyor (bkz. `docs/THREAT-MODEL.md` Open items). M2'de kapatılacak.

## Yakın zamanda alınan kararlar
- DB hosting: Render Postgres, Internal Database URL — Neon/Supabase değil.
- WS transport: Socket.IO — bkz. `docs/decisions/ADR-0007`.
- Access token bellek-içi (React state), localStorage/sessionStorage YOK — bkz. ADR-0002.
- M1'in slice-by-slice kararları (A-D backend, E1-E5 frontend) tekrar buraya taşınmadı — `docs/milestones/M1-auth-invites.md`'nin Plan notları bölümlerinde tam haliyle duruyor.
- 2026-07-29 — `SEED_DEV_FIXTURES` opt-in env'i: `NODE_ENV`'e bilerek güvenilmedi (kod tabanında hiç kullanılmıyordu, Render'ın set etme davranışı doğrulanamadı). `test-fullstack-e2e` CI job'ı `true` ile açık; `test` job'ı kapalı bırakıldı, testler değişmeden geçti.
- 2026-07-29 — Sıfır-kullanıcılı DB bootstrap boşluğu koda değil belgeye gitti: `docs/THREAT-MODEL.md` Open items'a somut tetikleyiciyle (M2'nin davet endpoint'i bunu da kapsamalı) eklendi.

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
