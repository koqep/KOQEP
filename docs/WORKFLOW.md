# KOQEP — Çalışma Düzeni (Workflow)

Bu dosya insanlar içindir. Claude her session'da okumaz; sadece düzen değiştiğinde okunur.

---

## 0. Temel ilke: Harness > Prompt

Büyük projede kaliteyi belirleyen şey model değil, **etrafına kurduğun düzen**:
CLAUDE.md + rules + skills + hooks + subagent + testler.
Her session sıfır context ile başlar. O yüzden asıl soru şu:
**"Claude hiçbir şey hatırlamadan bu göreve girse, 5 dakikada doğru yere varır mı?"**
Cevap evet olacak şekilde dosyaları düzenle.

---

## 1. Katman modeli (en önemli tablo)

| Katman | Nerede | Ne zaman yüklenir | Ne koyulur |
|---|---|---|---|
| Sabit talimat | `CLAUDE.md` | **Her session, tamamı** | Komutlar, dizin haritası, değişmez kurallar. <150 satır. |
| Yola bağlı kural | `.claude/rules/*.md` (`paths:` frontmatter ile) | Eşleşen dosyaya dokunulunca | API kuralları, DB kuralları, UI kuralları |
| Yordam / workflow | `.claude/skills/<ad>/SKILL.md` | Sadece göreve uyunca | "Yeni endpoint ekle", "migration yaz", "release checklist" |
| Referans bilgi | `docs/*.md` | Sadece istenince (`@docs/X.md`) | PRD, mimari, veri modeli, ADR |
| Canlı durum | `docs/STATE.md` | Her görev başında (elle/komutla) | Nerede kaldık, yarım işler, tuzaklar |
| Otomatik hafıza | Claude'un kendi `MEMORY.md`'si | Her session (ilk 200 satır) | Claude'un kendi öğrendikleri — periyodik gözden geçir |
| Zorlayıcı kural | hooks (`.claude/settings.json`) | Olay bazlı, garantili | Lint, format, typecheck, yasak yollar |

**Altın kural:** Bir bilgi *her* session'da lazım değilse `CLAUDE.md`'ye girmez.

> Not: `@dosya.md` import'u CLAUDE.md içinde **token tasarrufu sağlamaz** — import edilen dosya
> da açılışta context'e yüklenir. Sadece düzen içindir. Tasarruf istiyorsan `paths:` scoped
> rules veya skills kullan.

---

## 2. Sprint / milestone düzeni

Milestone = **dikey dilim** (vertical slice). Katman değil.
Yanlış: "M1: tüm veritabanı katmanı". Doğru: "M1: kullanıcı kayıt olur, giriş yapar, profilini görür."

- **M0 — Walking Skeleton (1 hafta):** en ince uçtan uca akış. Repo + CI + 1 endpoint + 1 ekran + 1 test + deploy. Buradan sonra her şey bu iskelete eklenir.
- **M1..Mn (1–2 hafta):** her biri demo edilebilir, testli, doküman güncellenmiş halde biter.
- Bir milestone kapanmadan diğeri açılmaz.

Her milestone dosyası (`docs/milestones/Mx-....md`) şunları içerir:
hedef, kapsam dışı, kabul kriterleri, checkbox'lı görev listesi, riskler.
**Checkbox'ları Claude işaretler.** Ayrı bir TODO.md tutma — milestone dosyası TODO'dur.

---

## 3. Bir görevin hayat döngüsü

```
/clear                                  # temiz context — en ucuz optimizasyon
/task <görev adı>                       # STATE + aktif milestone okunur
  → plan modu: Claude planı yazar        (Shift+Tab ile plan modu)
  → plan docs/milestones/Mx.md içine yazılır
  → SEN onaylarsın                       ← burayı atlama
  → uygulama + test
/wrap                                   # STATE.md güncellenir, checkbox işaretlenir
git commit                              # küçük, tek amaçlı commit
```

Bir görev bir session'da bitmiyorsa görev fazla büyüktür. Böl.

---

## 4. Token / context ekonomisi

Etki sırasına göre:

1. **`/clear` alışkanlığı.** Her yeni görevde. `/compact` yavaş ve bilgi kaybettirir; ancak
   uzun bir işin ortasındaysan kullan.
2. **CLAUDE.md'yi kısa tut.** Uzun dosya sadece token yemez, kuralların *uyulma oranını* düşürür.
3. **Scout subagent.** "Şu subsystem'i keşfet ve bulgularını `docs/scratch/x.md`'ye yaz" de.
   Keşfin gürültüsü subagent'ın context'inde kalır, ana oturuma sadece özet gelir.
4. **Dosya adını sen ver.** "auth nerede?" yerine `src/services/auth.ts` de. Arama = token.
5. **Skills.** 12 farklı workflow'u CLAUDE.md'ye koyma; her biri skill olsun, sadece
   gerekince yüklensin.
6. **Testler bağlam taşır.** İyi test, "bu nasıl çalışıyordu" sorusunu context olmadan yanıtlar.
7. **Hooks.** "Commit'ten önce lint çalıştır" kuralını her session tekrar etmek yerine hook yap.
8. **Planı dosyaya yazdır.** Uzun oturumda context sıkışsa bile plan diskte durur.
9. `/context` ile ne yüklendiğini periyodik kontrol et.

---

## 5. Sık yapılan hatalar

| Hata | Sonuç | Doğrusu |
|---|---|---|
| 60 sayfa PRD'yi kod yazmadan önce bitirmek | Yarısı ilk sprintte çöpe gider | İnce PRD + milestone başına detaylı spec |
| CLAUDE.md'yi doküman deposu sanmak | Context şişer, kurallara uyum düşer | Router olarak kullan, detayı docs/'a it |
| Tek dev MASTER_PROMPT.md | Her session tam bedel ödenir, "ortada kaybolma" etkisi | Katmanlı, lazy-loading yapı |
| Dokümanı session sonunda güncellememek | 3 hafta sonra doküman yalan söyler | `/wrap` zorunlu ritüel |
| Aynı oturumda 5 farklı iş | Context zehirlenir, kalite düşer | Görev başına bir oturum |
| Testsiz ilerlemek | 10k satırda regresyon görünmez olur | Kabul kriteri = test |
| Onaysız plan | Yanlış yöne 400 satır | Plan modu + insan onayı |
| Dev diff'leri gözden geçirmemek | Sen kod tabanını tanımaz olursun | Her PR'ı oku, anlamadığını sor |
| Aynı düzeltmeyi ikinci kez yazmak | Sonsuz tekrar | İkinci kerede kurala dönüştür |
| Mimari kararı sadece kodda bırakmak | 2 ay sonra kimse "neden" bilmez | ADR yaz |

---

## 6. Gün 1'den production'a yol haritası

**Gün 1–2 — İskele**
Repo, `CLAUDE.md`, `docs/STATE.md`, ince `PRD.md`, `ARCHITECTURE.md` taslağı, M0 dosyası.
`/init` çalıştır, çıktısını **budayarak** kullan.

**Hafta 1 — M0 Walking Skeleton**
Uçtan uca en ince akış + CI + ilk deploy. CI ilk günden kurulur; sonradan kurmak pahalıdır.

**Hafta 2 — Harness'ı kur**
`.claude/rules/` (code-style, testing, security), 3–4 skill, `/task` ve `/wrap` komutları,
lint+typecheck hook'u, scout subagent.

**Hafta 3+ — Ritim**
Milestone → görev → plan → onay → uygula → `/wrap` → PR. Haftada bir "bakım" oturumu:
CLAUDE.md'yi buda, STATE.md'yi sadeleştir, Claude'un auto-memory'sini gözden geçir.

**Ölçek büyüyünce (>15k satır)**
Modül başına `src/<modul>/CLAUDE.md` (sadece o dizine girilince yüklenir),
`paths:` scoped rule'lar, paralel iş için git worktree.

**Production öncesi**
Release skill'i (migration planı, rollback, feature flag), security review skill'i,
performans bütçesi, gözlemlenebilirlik (log/metrik/trace), runbook.

---

## 7. Sorularının kısa cevapları

1. **Önce tam PRD?** Hayır. İnce PRD + M0 iskeleti. Detaylı spec milestone başına.
2. **Şu 9 dosya?** Fikir doğru, yerleşim yanlış. PROJECT/PRD → `docs/PRD.md`;
   TODO → milestone dosyaları; DATABASE → `docs/DATA-MODEL.md`; API → OpenAPI'den üret,
   elle yazma; UI/SECURITY/CODING_RULES → `.claude/rules/` (scoped); ARCHITECTURE → `docs/`.
   Eksik olan tek dosya: **STATE.md** — en kritik olanı.
3. **Daha iyi yapı?** Bu repoda kurulu olan katmanlı yapı.
4. **Token azaltma?** Bölüm 4.
5. **Tek MASTER_PROMPT?** Hayır. Her session tam bedel ödersin ve uzun bağlamda ortadaki
   kurallara uyum düşer.
6. **10k+ satır workflow'u?** Bölüm 3 + Bölüm 6.
7. **Milestone düzeni?** Bölüm 2 — dikey dilimler.
8. **Her görevde ne okunsun?** Otomatik: `CLAUDE.md` + eşleşen rules. Elle/komutla:
   `docs/STATE.md` + aktif milestone. Başka hiçbir şey peşinen okunmaz.
9. **Sık hatalar?** Bölüm 5.
10. **Mimar olsam?** Bölüm 6.
