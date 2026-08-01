# KOQEP

<!-- KURAL: Bu dosya her session'da tamamen context'e yüklenir.
     150 satırı GEÇMEYECEK. Detay isteyen her şey docs/ veya .claude/rules/ içine gider.
     Bu HTML yorumları context'e yüklenmez, bakımcılar için buradadır. -->

## Ne yapıyoruz
KOQEP: davetiye ile büyüyen, terminal estetikli, metin-only, gerçek zamanlı sohbet platformu — niş ve küçük bir topluluk hedefli, kitlesel büyüme hedefi yok.
Detay: `docs/PRD.md` (sadece ürün kararları tartışılırken oku).

## Stack
- Runtime: Node 22 LTS
- Framework: NestJS (API + WebSocket gateway, tek deploy edilebilir servis — ADR-0003) + Next.js App Router (web istemcisi, ayrı deploy)
- DB: PostgreSQL + Prisma
- Test: Jest (unit/entegrasyon) + Playwright (uçtan uca)

## Komutlar
```
npm install                        # bağımlılıklar
npm run dev                        # local geliştirme (API + web)
npm test                           # tüm testler
npm test -- <path>                 # tek dosya (tercih et — hızlı)
npm run lint && npm run typecheck  # commit öncesi zorunlu
npm run db:migrate                 # migration çalıştır
```

## Dizin haritası
- `apps/api/src/api/` — HTTP + WebSocket handler'lar, iş mantığı yok
- `apps/api/src/services/` — iş mantığı burada yaşar
- `apps/api/src/db/` — şema + migration'lar (Prisma)
- `apps/web/` — Next.js istemcisi; oturum/iş mantığı sahibi değil, sadece token API'yi çağırır (ADR-0002)
- `apps/api/tests/` — testler, kaynak ağacını birebir yansıtır

## Değişmez kurallar
- İş mantığı `apps/api/src/services/` dışına YAZILMAZ. Handler'lar sadece validate + delegate eder.
- Şema değişikliği migration olmadan yapılmaz. El ile SQL çalıştırılmaz.
- `ReputationEvent` satırları sadece insert edilir, asla UPDATE edilmez (ADR-0004).
- Mesaj içeriği asla hard-delete edilmez; hesap silindiğinde sadece yazar bağlantısı anonimleştirilir (ADR-0005). **İSTİSNA:** bir odanın kendisi ADR-0006 kapsamında hard-delete edildiğinde (60 gün sıfır görüntülenme), o odaya ait mesajlar da odayla birlikte silinir (M3) — hesap silmedeki tek-kişinin-katkısını-canlı-thread'den-silme durumundan kategorik farklı, bilerek kayıtlı bir istisna.
- Oda durumu tek yönlü ilerler: active → archived → deleted (ADR-0006).
- Yeni bağımlılık eklemeden önce sor.
- `main` branch'e doğrudan commit atılmaz.
- Bir dosya 400 satırı geçtiyse bölünmesi konuşulur.
- Yorum satırı ekleme; kod kendini anlatsın. İstisna: "neden" açıklayan yorumlar.
- Test yazmadan feature "bitti" sayılmaz.

## Her göreve başlarken
1. `docs/STATE.md` oku — nerede kaldık, ne yarım.
2. Aktif milestone dosyasını oku: `docs/milestones/<aktif>.md`
3. Plan modunda planı çıkar, `docs/milestones/<aktif>.md` içine yaz, ONAY BEKLE.
4. Onay sonrası uygula.
5. Plan modundayken docs-only bir istek gelse bile önce `ExitPlanMode` çağrılır — plan dosyası dışındaki hiçbir dosya (STATE.md dahil) o onay olmadan düzenlenemez, ExitPlanMode sadece "implementasyona başla" anlamına gelmez.

## Her görev biterken
`/wrap` komutunu çalıştır (STATE.md günceller, checkbox işaretler, ADR gerekiyorsa açar).

## Nerede ne var (gerektiğinde oku, peşinen okuma)
- Ürün gereksinimleri → `docs/PRD.md`
- Sistem tasarımı → `docs/ARCHITECTURE.md`
- Veri modeli → `docs/DATA-MODEL.md`
- Tehdit modeli → `docs/THREAT-MODEL.md`
- Geçmiş kararlar ve nedenleri → `docs/decisions/`
- Terim sözlüğü → `docs/GLOSSARY.md`
- Çalışma düzeni → `docs/WORKFLOW.md`
- Değerlendirilmemiş fikirler / bilinçli reddedilenler → `docs/BACKLOG.md`
