# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-07-28
**Aktif milestone:** M0 — Walking Skeleton (`docs/milestones/M0-walking-skeleton.md`)

## Şu an ne çalışıyor
- M0'ın kod tarafı bitti ve `main`'de: CI (3 job — api birim/e2e, web lint/typecheck/smoke, tam-yığın Playwright e2e), Postgres+Prisma (`User`/`Room`/`Message`), seeded dev-login (JWT), seeded oda + terminal-tarzı Next.js ekranı, Socket.IO WS round-trip (gönder → gerçek-zamanlı-al → persist → reload'da kalıcı).
- Render'da apps/api için sadece bir "hello world" (`/health`) deploy edilmiş durumda — şu anki gerçek uygulama (DB'li, WS'li) HENÜZ canlıya deploy edilmedi.

## Şu an üzerinde çalışılan
- **Görev:** Yok — oturum kapatılıyor.
- **Yarım kalan:** M0'ın tek kalan maddesi: "Deploy to staging" — Render'da gerçek Postgres, migration+seed, gerçek `JWT_SECRET`/`WEB_ORIGIN`, `apps/web`'in ayrı deploy'u.
- **Sonraki adım:** Deploy görevine başla — kod tarafındaki tüm M0 kabul kriterleri karşılandı, sadece canlıya alma kaldı.

## Bilinen sorunlar / teknik borç
- `npm audit`: 32 high severity uyarı var, henüz değerlendirilmedi.
- Prisma majör sürüm güncellemesi bekliyor (6.x → 7.x) — şimdilik ertelendi.

## Yakın zamanda alınan kararlar
- 2026-07-28 — WS transport: Socket.IO, native ws değil — bkz. `docs/decisions/ADR-0007`.
- 2026-07-28 — Access token bellek-içi (React state) saklanıyor, localStorage/sessionStorage YOK — ADR-0002'nin httpOnly cookie hedefine uyumlu ara adım.
- 2026-07-28 — Oda keşfi `GET /rooms` ile yapılıyor; frontend oda adını hardcode etmiyor.

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — dolu ve detaylı; kapsam tartışılırken oku.
- TOTP kurtarma akışı gerçek bir davetten önce şahsen test edilmeli.
- `ReputationEvent` sadece insert edilir; mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
- "main güncel" / "merge oldu" iddialarını HER ZAMAN `git fetch` + `git log origin/main` ile bağımsız doğrula — bu oturumda bir kez iddia yanlış çıktı (merge fiilen olmamıştı).
- CI'da job-seviyesi env değişkenleri (örn. `PORT`) o job'daki TÜM adım/alt süreçlere sızar (`next start` da `PORT`'u önceliklendirir) — aynı job'da birden fazla uygulama çalışıyorsa env'i komut bazında scope'la (Playwright `webServer.env` gibi).
- Prisma client'ın üretilmesi (`prisma generate`) **tek kaynaktan**, `apps/api/package.json`'daki `postinstall` script'inden gelir — her `npm install`/`npm ci`'da (Render, CI, lokal fark etmez) otomatik çalışır. Bunu buildCommand veya tek bir CI adımına gömmeye ÇALIŞMA: `prisma migrate deploy` (CI/prod) `migrate dev` (lokal) gibi generate'i otomatik çalıştırmaz.
- Render servisi (`koqep-api`) Blueprint'e bağlı DEĞİL, "New Web Service" ile elle kuruldu (Blueprint Postgres ücret istediği için) — `render.yaml`'daki değişiklikler canlı servise OTOMATİK yansımaz, Build/Pre-Deploy Command ve env değişkenleri dashboard'dan elle girilmeli/güncellenmeli.
- `.env`/`.env.*` dosyaları proje ayarlarında `Read` için engelli (güvenlik) — içerik değiştirmek için `Write` ile tam dosyayı körlemesine yeniden yaz, `cat`/`Read` deneme.
