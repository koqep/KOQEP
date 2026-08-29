# M11c — Şifre-korumalı odalar

*Odaya katılım için şifre — mesaj içeriği şifrelemesi DEĞİL (kullanıcı
kararı, bkz. Plan notları). Kapsam turu: `docs/BACKLOG.md`'nin "G.
2026-08-29 KAPSAM TURU" bölümü.*

**Goal:** `Room`'a opsiyonel bir katılım-şifresi ekle — mesaj içeriği,
moderasyon, raporlama akışlarının HİÇBİRİNE dokunmadan.
**Demo:** Oda kurucusu oda oluştururken opsiyonel bir şifre belirliyor;
şifreli bir odaya katılmaya çalışan biri önce şifre giriyor, yanlışsa
giremiyor; moderatör şifreli bir odanın içeriğini her zamanki gibi
görebiliyor/moderasyon yapabiliyor (şifre onu etkilemiyor).
**Estimated hours:** ~15-20h.

## Out of scope
- **Gerçek mesaj-içeriği şifrelemesi** — kullanıcı kararıyla ELENDİ (bkz.
  Plan notları): anahtar yönetimi + moderasyon/raporlama sisteminin
  "okunabilir içerik" varsayımıyla çelişkisi, ~40-60h+ ek risk. Bu dilimde
  YOK, ileride ayrı bir tartışma/milestone gerektirir.
- Şifre-korumalı odanın `scope=discoverable` listesinden gizlenmesi/farklı
  görünmesi — implementasyon planında ayrıca netleştirilecek, bu dosyada
  varsayılan: normal keşif listesinde görünür, sadece katılım şifre ister.

## Acceptance criteria
- [ ] `Room` modeli opsiyonel bir şifre-hash alanına sahip (migration).
- [ ] Oda oluşturma akışında opsiyonel bir şifre alanı var.
- [ ] `joinRoom` (bugün açık bir upsert, `Room.RoomMember`'ın erişim-kontrolü
      OLMADIĞI şemanın kendi doc yorumunda belirtiliyor) artık şifreli bir
      oda için doğru şifre gerektiriyor, yanlış şifrede reddediyor.
- [ ] Moderatör aksiyonları (mute, remove-content, room-level moderasyon)
      şifreli odalarda AYNEN çalışıyor — hiçbir yeni kısıt yok.
- [ ] Şifre hash'lenerek saklanıyor (düz metin DEĞİL, mevcut login-şifresi
      hash'leme deseniyle tutarlı).

## Tasks
- [ ] **Slice A — Şema + backend.** Migration, `joinRoom`'un şifre
      doğrulaması, oda oluşturma DTO'suna opsiyonel şifre alanı.
- [ ] **Slice B — Frontend.** `CreateRoomView.tsx`'e opsiyonel şifre alanı,
      katılım akışına şifre isteme adımı.

## Risks
- Bugün HİÇBİR odada erişim-kontrolü yok (`RoomMember` bilerek "access
  control DEĞİL" diye tasarlandı) — bu, kod tabanına eklenen İLK gerçek
  erişim-gating mekanizması. Diğer akışların (WS auto-join, `listRooms`,
  mevcut "herkes her odaya girebilir" varsayımı) şifreli bir oda için
  gerçekten doğru davrandığını doğrulamak, tahmin edilenden daha fazla yer
  dokunmayı gerektirebilir — implementasyon planında dikkatle taranmalı.

## Plan notları

### Kapsam kararı (2026-08-29)
Kullanıcı "şifreli oda" isteğini `AskUserQuestion` ile netleştirdi: iki
seçenek sunuldu — (a) şifre-korumalı katılım, moderasyon/raporlama
etkilenmez, ~15-20h; (b) gerçek mesaj-içeriği şifrelemesi, anahtar yönetimi
+ THREAT-MODEL etkisi (şifreli içerik mevcut moderasyon sisteminin
"okunabilir içerik" varsayımıyla çelişir), ~40-60h+. **Kullanıcı (a)'yı
seçti.** Bu dosya sadece (a)'yı kapsıyor.
