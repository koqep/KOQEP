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
- [x] "TOTP kodu" ifadesi geçen her frontend etiketi (4 dosya) ve backend hata
      string'i (`totp.service.ts`, 4 satır) "authenticator" diyor.
- [x] E-posta doğrulanmamış bir hesapla giriş denemesi, kullanıcıya gelen
      kutusunu kontrol etmesini açıkça söyleyen bir hata mesajı gösteriyor.
- [x] Login/signup, reset-password, delete-account, assign-moderator şifre
      alanlarının hepsinde göster/gizle ikonu var ve çalışıyor.
- [x] `MessageItem.tsx`'in `isMine ? "you" : ...` özel durumu kaldırıldı — kendi
      mesajlarında da gerçek `authorUsername` görünüyor.
- [x] `GET /users/blocked` username döndürüyor, `BlockedUsersView.tsx` bunu
      gösteriyor.
- [x] Mesaj satırındaki avatar + edit/delete/history/report aksiyonları,
      Slice C'nin (M10) saat için kullandığı `group-hover`/focus mekanizmasıyla
      gizli/görünür — işlevleri (düzenleme/silme/geçmiş/raporlama) DEĞİŞMEDİ.

## Tasks
Plan modunda, orijinal kapsam turunun listesine göre harfler yeniden
sıralandı (aşağıdaki, gerçek implementasyonda kullanılan sıra):
- [x] **Slice A — Gerçek kullanıcı adı.** `MessageItem.tsx`'ten
      `isMine?"you":username` özel durumu kaldırıldı.
- [x] **Slice B — Blocked listesinde username.** `blocks.service.ts`
      (`listBlockedEmails` → `listBlockedUsers`, `{email,username}`) +
      `BlockedUsersView.tsx`.
- [x] **Slice C — Şifre göster/gizle.** Yeni paylaşılan `PasswordInput.tsx`
      (4 kopya yerine tek bileşen — dört formda aynı stateful toggle mantığı
      tekrarlanacaktı).
- [x] **Slice D — E-posta doğrulama hata mesajı.** `AuthView.tsx`
      `EMAIL_NOT_VERIFIED` code'unu `TOTP_REQUIRED` deseniyle özel işliyor.
- [x] **Slice E — "authenticator" etiketi.** 4 frontend dosyası + backend
      Türkçe hata metinleri (`totp.service.ts`, `auth.service.ts`).
- [x] **Slice F — Mesaj aksiyonları hover-reveal.** `MessageItem.tsx`'in
      avatar/buton grubuna Slice C'nin (M10) deseni.

**M11a TAMAMEN BİTTİ — tüm 6 dilim main'e MERGE İÇİN HAZIR** (`feat/m11a-quick-fixes`
dalı, main merge edilip conflict çözüldü, doğrulama sonrası kullanıcı push edecek).

## Risks
- ~~Slice C (şifre göster/gizle): dört farklı formda tekrar eden bir desen —
  ortak bileşene çıkarmak mı yoksa dört kopya mı, implementasyon planında
  netleşecek.~~ Ortak bileşen seçildi — Plan notları'na bakın (explicit
  htmlFor/id, implicit label-wraps-input DEĞİL).
- ~~Slice F: mevcut testler avatar/butonların HER ZAMAN DOM'da olduğunu
  varsayıyor olabilir.~~ Gerçekleşti — 8 test dosyasında `.hover()` eklendi,
  Plan notları'na bakın.

## Plan notları

### Implementasyon (2026-08-29)
Bir Explore agent'ı 6 maddenin tamamı için tam file:line dökümü çıkardı
(hiçbir madde tahmine dayanmadı), plan modu bunun üzerine kuruldu, kullanıcı
onayladı.

**Slice C tasarım kararı:** `PasswordInput.tsx` show/hide butonunu
label metniyle AYNI `<label>` içine KOYMADI — implicit label-wraps-input
deseninde (kod tabanının geri kalanının kullandığı) butonun görünür metni
("show"/"hide") label'ın erişilebilir adına karışıp `getByLabel("password")`
sorgularını kırardı. Bunun yerine explicit `htmlFor`/`id` kullanıldı — label
SADECE kendi metnini içeriyor, buton ayrı bir kardeş eleman.

**Slice F'de bulunan gerçek risk (implementasyon sırasında):** `invisible`
(Tailwind `visibility:hidden`) Playwright'ın actionability kontrolü için
elemanı tıklanamaz yapıyor — `.click()`/`toBeVisible()` çağıran HER mevcut
test önce satırı `.hover()` etmeli. 8 dosya güncellendi: `message-edit.spec.ts`,
`message-delete.spec.ts`, `moderation.spec.ts`, `message-grouping.spec.ts`
(mocklu e2e) + `message-self-delete.spec.ts`, `message-editing.spec.ts`
(fullstack). Avatar İSTİSNA — sadece `SmallAvatar` glyph'i hover-gizli, onu
saran `<button>` (profil açma) HER ZAMAN görünür/tıklanabilir kaldı, bu
yüzden `profile-panel.spec.ts` dokunulmadan geçti.

**Doğrulama:** `npm test` (apps/api, 319/319, iki kez), `npx playwright test`
(mock'lu, 113/113, iki build+koşum — ilk koşumda TOTP etiket testleri stale
build yüzünden 3 kez patladı, rebuild sonrası düzeldi), `npx playwright test
--config=playwright.fullstack.config.ts` (10/10 — ilk koşumda 2 test
`SEED_DEV_FIXTURES=true npm run db:seed` çalıştırılmadığı için patladı,
seed+backfill script'leri koşulunca düzeldi, STATE.md Tuzaklar'a eklendi).
`npm run lint && npm run typecheck` temiz.

**Commit yapısı:** dosya çakışmaları yüzünden (ör. `AuthView.tsx` Slice
C+D+E'nin ÜÇÜNÜ birden taşıyor) plandaki "6 ayrı commit" 4 commit'e
konsolide edildi — commit mesajları hangi slice'ları kapsadığını açıkça
listeliyor.
