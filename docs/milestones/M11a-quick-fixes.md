# M11a — Hızlı düzeltmeler

*Production kullanım denetiminde (2026-08-29) bulunan, birbirinden bağımsız,
ucuz UX/kopya düzeltmeleri — hiçbiri yeni bir veri modeli veya mimari karar
gerektirmiyor. Kapsam turu: `docs/BACKLOG.md`'nin "G. 2026-08-29 KAPSAM TURU"
bölümü.*

**Goal:** Tek oturumda bitirilebilecek büyüklükte 6 bağımsız düzeltmeyi tek
dilimde topla — en ucuz, en düşük riskli, sıradaki gerçek iş.
**Demo:** TOTP kurulum ekranı "authenticator" diyor; yanlış e-posta/şifreyle
giriş denemesi doğrulama gerekiyorsa gelen kutusunu kontrol etmeyi söylüyor;
şifre alanlarında göster/gizle ikonu çalışıyor; kendi mesajlarında "you"
değil gerçek kullanıcı adı görünüyor; engellenenler listesinde e-posta değil
kullanıcı adı görünüyor; mesaj satırındaki avatar/edit/delete/history/report
sadece hover/focus'ta görünüyor, işlevleri aynen çalışıyor.
**Estimated hours:** ~11-17h.

## Out of scope
- Madde 11 (AccountMenu → profil sayfası taşıma) — kullanıcı kararı: **şimdilik
  dokunulmuyor**, M10 Slice B'nin kararı aynen kalıyor.
- Madde 7 (Explore geliştirmesi) — kapsam hâlâ belirsiz, kullanıcının somut
  özellik listesi vermesini bekliyor, bu dilimde yok.

## Acceptance criteria
- [ ] "TOTP kodu" ifadesi geçen her frontend etiketi (4 dosya) ve backend hata
      string'i (`totp.service.ts`, 4 satır) "authenticator" diyor.
- [ ] E-posta doğrulanmamış bir hesapla giriş denemesi, kullanıcıya gelen
      kutusunu kontrol etmesini açıkça söyleyen bir hata mesajı gösteriyor.
- [ ] Login/signup, reset-password, delete-account, assign-moderator şifre
      alanlarının hepsinde göster/gizle ikonu var ve çalışıyor.
- [ ] `MessageItem.tsx`'in `isMine ? "you" : ...` özel durumu kaldırıldı — kendi
      mesajlarında da gerçek `authorUsername` görünüyor.
- [ ] `GET /users/blocked` username döndürüyor, `BlockedUsersView.tsx` bunu
      gösteriyor.
- [ ] Mesaj satırındaki avatar + edit/delete/history/report aksiyonları,
      Slice C'nin saat için kullandığı `group-hover`/focus mekanizmasıyla
      gizli/görünür — işlevleri (düzenleme/silme/geçmiş/raporlama) DEĞİŞMEDİ.

## Tasks
Her biri küçük, bağımsız bir commit — plan modu gerektirmeyecek kadar net,
ama her biri kendi testiyle gelir (`.claude/rules/testing.md`):
- [ ] **Slice A — "authenticator" etiketi.** 4 frontend dosyası + `totp.service.ts`.
- [ ] **Slice B — E-posta doğrulama hata mesajı.** Login hata metni netleştirme.
- [ ] **Slice C — Şifre göster/gizle.** 4 alan, ortak bir `PasswordInput`
      bileşeni ya da her alana ayrı ikon (implementasyon planında karar).
- [ ] **Slice D — Gerçek kullanıcı adı.** `MessageItem.tsx`'ten 3 satırlık
      ternary kaldırma.
- [ ] **Slice E — Blocked listesinde username.** `blocks.service.ts` +
      `BlockedUsersView.tsx`.
- [ ] **Slice F — Mesaj aksiyonları hover-reveal.** `MessageItem.tsx`'in
      avatar/buton grubuna Slice C'nin deseni.

## Risks
- Slice C (şifre göster/gizle): dört farklı formda tekrar eden bir desen —
  ortak bileşene çıkarmak mı yoksa dört kopya mı, implementasyon planında
  netleşecek (kod tabanında henüz böyle bir input-wrapper emsali yok).
- Slice F: `message-grouping.spec.ts`/`clickable-links.spec.ts` gibi mevcut
  testler avatar/butonların HER ZAMAN DOM'da olduğunu varsayıyor olabilir
  (görünürlük CSS ile kontrol edilirse sorun yok, `display:none`/koşullu
  render edilirse test seçicileri kırılabilir) — implementasyon planında
  hangi mekanizmanın kullanılacağı netleştirilecek.
