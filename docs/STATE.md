# STATE — Projenin canlı durumu

<!-- Bu proje boyunca en kritik dosya. Her session sonunda güncellenir.
     60 satırı geçmesin; geçmiş bilgi docs/decisions/ veya milestone dosyalarına taşınır. -->

**Son güncelleme:** 2026-07-28
**Aktif milestone:** M0 — Walking Skeleton (`docs/milestones/M0-walking-skeleton.md`)

## Şu an ne çalışıyor
- Henüz kod yok. `docs/REVIEW-BRIEF.md`'nin Phase 0-7'si tamamlandı ve onaylandı: PRD, mimari, veri modeli, tehdit modeli, güvenlik kuralları, 7 milestone (M0-M6), repo harness.

## Şu an üzerinde çalışılan
- **Görev:** M0 walking skeleton — henüz başlanmadı.
- **Dokunulan dosyalar:** yok (sadece `docs/` ve `.claude/` scaffolding).
- **Yarım kalan:** yok.
- **Sonraki adım:** `docs/milestones/M0-walking-skeleton.md`'deki görev listesiyle başla. İlk iş: deploy hedefini seç ve kod yazmadan önce oraya bir "hello world" deploy et (M0'ın en büyük riski budur).

## Bilinen sorunlar / teknik borç
- Henüz yok — kod yok.

## Yakın zamanda alınan kararlar
- 2026-07-28 — Ürün/mimari/veri/güvenlik/milestone kararlarının tamamı → `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/decisions/ADR-0002..0006`, `docs/DATA-MODEL.md`, `docs/THREAT-MODEL.md`, `docs/milestones/M0..M6`.
- 2026-07-28 — Kapasite kontrolü: M0-M6 gerçekçi tahmini 254-392 saat, bütçe 360 saat (30s/hafta × 12 hafta) — kenarda/üzerinde. M6'nın hukuki kontrol hariç kısmı 4. aya kaydırılabilir.

## Tuzaklar (Claude buraya düşmesin)
- `docs/BACKLOG.md` boş bir şablon DEĞİL — zaten dolu ve detaylı. Kapsam tartışılırken mutlaka oku. İçinde henüz PRD/ADR/THREAT-MODEL'e işlenmemiş 4 madde var: A8 veri dışa aktarma (KVKK gereksinimi, şu an eksik), B5 `/now` platform nabzı, B15 davetçi hesap verebilirliği, D5 ayrıcalıklı-işlem TOTP nüansı. Bunlara değinen bir görev gelirse, ilgili dokümanı güncellemeden önce kullanıcıya sor.
- M0'ın en büyük riski ilk kez production deploy/WS yönetmek — deploy hedefi kod yazmadan ÖNCE seçilip test edilmeli.
- TOTP kurtarma akışı gerçek bir davetten önce şahsen test edilmeli (kurtarmasız TOTP = kilitlenme, en büyük solo destek yükü).
- `ReputationEvent` sadece insert edilir, asla UPDATE edilmez. Mesaj içeriği asla hard-delete edilmez, sadece yazar anonimleştirilir.
