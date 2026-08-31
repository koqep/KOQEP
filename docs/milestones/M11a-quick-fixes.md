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

**M11a TAMAMEN BİTTİ VE MAIN'DE** (PR #101). Merge sonrası CI'da bulunan
ayrı bir bug (`backfill-room-members.ts`'in P2003 retry'ı) da düzeltilip
main'e girdi — detay `docs/STATE.md` Tuzaklar.

**2026-08-29, M11a'nın devamı — iki küçük UI iyileştirmesi (kullanıcı isteği,
Slice C ve F'nin doğrudan devamı):**
- [x] Mesaj aksiyonları (edit/delete/history/report) artık tek bir "⋯"
      menüsünde, `AccountMenu`'nün `useDismissableMenu` deseniyle
      (`feat/message-actions-menu` dalı).
- [x] Şifre göster/gizle artık göz ikonlu BASILI-TUTMA (toggle değil)
      (`feat/password-hold-reveal` dalı).
İkisi de kendi bağımsız dalında, doğrulandı, push kullanıcı onayında —
detay aşağıda Plan notları'nda.

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

### Devam turu — mesaj aksiyonları menüsü + şifre basılı-tutma (2026-08-29)
Kullanıcı, main'e girdikten sonra gerçek kullanımla iki küçük iyileştirme
istedi, ikisi için de plan modu (kod yazmadan) çalıştırıldı, bir Plan
agent'ı tasarımı stres-test etti.

**Mesaj aksiyonları menüsü (`MessageItem.tsx`):** `AccountMenu.tsx`'in
`useDismissableMenu` deseni aynen kopyalandı. Onay UI'ı ("are you sure?"/
yes/cancel) ve "reported" span'ı menünün DIŞINDA kaldı (aktif/persistan
durum, hover'dan bağımsız). Gerçek bir implementasyon-öncesi bulgu: Plan
agent'ı `canViewHistory = isMine || moderator` invaryantını doğrulayıp
"⋯" tetikleyicisinin sil-onayı açıkken bile asla kaybolmadığını kanıtladı;
AYRICA `startEditing()`'in `isConfirmingDelete`'i temizlemediği küçük bir
yan-bug'ı önceden buldu, düzeltmeyle birlikte gönderildi. Gerçek bir
implementasyon-sırası bulgu (agent'ın ÖNGÖREMEDİĞİ): menünün "hep yukarı
aç" statik tasarımı, listenin en üstündeki bir satırda gerçek bir
Playwright ölçümüyle (`getBoundingClientRect()`, y:-34) viewport dışına
taştığı kanıtlandı — açılış anında dinamik ölçüme geçirildi. 6 test dosyası
`role="menuitem"` geçişine güncellendi (bazı `toHaveCount(0)`'lar da önce
menü açılarak anlamlı hale getirildi).

**Şifre basılı-tutma (`PasswordInput.tsx`):** inline SVG göz ikonu
(Avatar.tsx konvansiyonları, piksel-ızgara DEĞİL — tanınabilir glyph
gerekiyordu). Üç girdi modu simetrik down/up + `hasTrackedPressRef`
bayrağıyla ekran-okuyucu sentetik click'i (down/up üretmeden gelen)
zarif biçimde toggle'a düşürüldü. Yeni `password-input.spec.ts` (6 test,
önceden SIFIR kapsam) iki gerçek Playwright gotcha'sı buldu: React
`onMouseLeave`'in bubbling `mouseout`u dinlediği (ham `mouseleave`
`dispatchEvent`'i tetiklemiyor) ve erişilebilir adı show/hide arasında
değişen bir butonun TEK bir locator'a sabitlenemeyeceği (her adımda
güncel adla yeniden sorgulanmalı). Ayrıca `aria-label`'ın "password"
kelimesini İÇERMEMESİ gerektiği doğrulandı — mevcut testlerin HER YERDE
kullandığı `getByLabel("password")` ile substring çakışırdı.

**Yan bulgu (implementasyon sırasında, ayrı commit):** `seed.ts`'in dev
kullanıcı `upsert`'lerinin `update` dalı `emailVerifiedAt`'i hiç set
etmiyordu — yerel doğrulama sırasında keşfedilip düzeltildi, CI'ı
etkilemiyor (CI her koşuda taze DB'de `create` dalını kullanır).

**Doğrulama:** her iki dal için `npm run lint && npm run typecheck` +
`npx playwright test` (tam mock'lu süit, 119/119 dahil 6 yeni test) +
ilgili `e2e-fullstack` dosyaları + gerçek Playwright ekran görüntüleriyle
görsel doğrulama (menü konumu hem alt hem üst satırda, göz ikonunun iki
durumu).
