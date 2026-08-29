# M11b — Güven & giriş cilası

*Landing sayfasının genişlemesi + kayıtta gerçek okuma-onayı + ilk-giriş
deneyimi — üçü de "ilk izlenim" kategorisinde, M7'nin bilerek EN UCUZ
haliyle bıraktığı yerleri tamamlıyor. Kapsam turu: `docs/BACKLOG.md`'nin
"G. 2026-08-29 KAPSAM TURU" bölümü.*

**Goal:** M7'de bilinçli olarak "en ucuz seçenek" ile kapatılan landing/terms/
onboarding yüzeylerini, artık gerçek kullanım geri bildirimi geldiğine göre
gözden geçirip genişlet.
**Demo:** `/`'e giden bir ziyaretçi login formunun üstünde animasyonlu bir
arka plan + support linki + tanıtım metni görüyor; kayıt formunda terms/
privacy metni ekranda gösteriliyor, aşağı kaydırmadan onay tiki
aktifleşmiyor; ilk mesajını atan yeni kullanıcı yönlendirici bir ilk-adım
görüyor (kapsamı Slice C'de netleşecek).
**Estimated hours:** ~14-24h (Slice C netleşmeden kesin değil).

## Out of scope
- Tam interaktif `/tutorial` komutu — `docs/BACKLOG.md`'nin mevcut kararı
  ("1.0 için basit onboarding yeterli, tam tutorial V1.1") hâlâ geçerli,
  bu dilim onu geri açmıyor.
- Landing sayfasının ayrı bir route/state olması — M7a Slice A'nın kararı
  (tek ekran, login formunun üstünde) korunuyor, sadece o tek ekranın
  içeriği genişliyor.

## Acceptance criteria
- [ ] Landing ekranında (bugünkü `LandingIntro.tsx`) animasyonlu bir arka
      plan var (implementasyon planında somutlaşacak — CSS-only, terminal
      kimliğine uygun, ağır bir kütüphane gerektirmiyor).
- [ ] Landing ekranında support linki var (`AccountMenu`'nün kullandığı
      `FEEDBACK_EMAIL` sabiti yeniden kullanılıyor).
- [ ] Kayıt formunda terms/privacy metni bir modal/panel içinde GERÇEKTEN
      gösteriliyor (sadece dış linke değil).
- [ ] O metnin sonuna kadar kaydırılmadan onay checkbox'ı tıklanabilir
      olmuyor.
- [ ] Slice C'nin kapsamı (madde 2'nin genişlemesiyle mi karşılanıyor, yoksa
      post-signup ayrı bir adım mı) netleşmiş ve uygulanmış.

## Tasks
- [ ] **Slice A — Landing genişlemesi.** Kendi küçük tasarım turu (M10 Faz
      1 desenine benzer, kod yazmadan önce) — animasyon tekniği, support
      linki, kopya metni.
- [ ] **Slice B — Kaydırma-onaylı terms.** Mevcut TR/EN legal metni (zaten
      `/terms`, `/privacy` sayfalarında var) modal/panel içine gömme, scroll
      tracking, checkbox gate.
- [ ] **Slice C — Onboarding netleştirmesi.** Kullanıcıyla netleştir: madde
      2'nin genişlemesi yeterli mi, yoksa post-signup ayrı bir "ilk mesajını
      yaz" rehberi mi isteniyor — netleşmeden boyut/görev kesinleşmez.

## Risks
- Slice A: "animasyonlu arka plan" görsel bir karar, kod yazılmadan önce
  kullanıcı onayı gerekiyor (terminal kimliğine aykırı, ağır/dikkat dağıtıcı
  bir şey olmamalı — CLAUDE.md'nin "dikkat dağıtmayan" felsefesiyle gerilim
  riski var, tasarım turunda ele alınacak).
- Slice C: madde 17 kullanıcının kendi isteğiydi ama `docs/BACKLOG.md`'nin
  mevcut A5/onboarding kararıyla örtüşüyor olabilir — kapsamı netleşmeden
  bu dilime dahil edilmemeli, gereksiz iş riski var.
