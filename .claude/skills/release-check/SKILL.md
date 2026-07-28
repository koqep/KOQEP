---
name: release-check
description: Bir milestone'ı production'a çıkarmadan önce kullanılır. Kabul kriterleri, CI durumu, migration/rollback planı, sır sızıntısı ve STATE.md güncelliğini kontrol eder. Kullanıcı release, deploy, production'a çıkma veya yayına alma konusunda konuştuğunda tetiklenir.
---

# Release Kontrolü

Sırayı bozma:

1. **Aktif milestone dosyasını** (`docs/milestones/<aktif>.md`) oku — tüm kabul kriterleri işaretli mi?
2. **CI yeşil mi** doğrula: lint + typecheck + test.
3. **Migration'lar hazır mı** kontrol et: her yeni migration'ın rollback planı var mı (`new-migration` skill'i takip edildi mi)?
4. **Sır taraması:** kodda veya log'da secret, API key, PII var mı — `.claude/rules/security.md`'ye göre.
5. **`docs/STATE.md` güncel mi** — son `/wrap` ne zaman çalıştı, "şu an ne çalışıyor" doğru mu?
6. Release M6 kapsamındaysa (legal & launch readiness) ayrıca kontrol et:
   - ToS + gizlilik politikası canlı mı?
   - Uptime + hata takibi aktif mi?
   - Son yedek geri yükleme testi ne zamandı — hiç yapılmadıysa release'i durdur.
7. Değişiklik özeti hazırla: ne değişti, nasıl test edildi, bir şey ters giderse geri alma planı ne.

Yaygın hatalar:
- Migration'ı deploy'dan ayrı, elle çalıştırmak.
- Feature flag olmadan büyük davranış değişikliğini tek adımda açmak.
- STATE.md'yi güncellemeden release yapmak — üç hafta sonra doküman yalan söylemeye başlar.
