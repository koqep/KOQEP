# M6 — Legal & Launch Readiness

*Gerçek kullanıcı verisini sorumlu şekilde tutmak için gereken son parçalar: gizlilik politikası, 5651/KVKK kontrolü, izleme, yedekleme, erişilebilirlik.*

**Goal:** Close the remaining Phase 1/5 open items before pointing real acquisition efforts (the manifesto/waitlist test from `docs/review/CRITIQUE.md`'s Riskiest Assumption) at the product.
**Demo:** Privacy policy and ToS are live and linked; a simulated outage triggers an alert within minutes; a backup is restored successfully in a test environment.
**Estimated hours:** 42–68h founder-hours (revised 2026-08-09 — see "Plan notları" below: `User.totpSecret` field-level encryption + `GET /me/export` added as real gaps found by a fresh scope review; accessibility scope grew further once the actual contrast math and the repeated weak-focus-indicator pattern were found, not just the aria-* count). The 5651/KVKK legal check adds calendar time waiting on a third party, on top of these hours — see capacity check.

## Out of scope
- Anything not required to responsibly hold real user data — this is a hardening milestone, not a feature milestone.

## Acceptance criteria
- [ ] Privacy policy and ToS are published and linked from signup, and state a minimum age (KVKK's child-data provisions) — a policy line + a signup checkbox, not an ID-verification flow. Consent must be **provable** (a recorded acceptance timestamp on `User`), not just enforced client-side. The required gate does not go live in production with placeholder legal text — see Slice A.
- [ ] The 5651/KVKK legal check covers BOTH the anonymize-on-delete approach (ADR-0005, `docs/THREAT-MODEL.md` row 8) AND whether Turkish law requires connection/traffic log retention for a platform like this (today the codebase logs zero IP addresses/connection metadata, confirmed by reading the source — `docs/review/CRITIQUE.md` line 105 flags this as a separately FATAL-severity risk from the anonymization question, not the same question). Not just this review's best guess.
- [ ] An uptime check and error tracker are live and alerting the founder.
- [ ] A documented backup/restore runbook exists and has been exercised at least once — a real restore, not just a backup that's never been tested. A general "something broke at 3am, now what" runbook is written alongside it, not a separate task.
- [ ] The UI passes a real accessibility pass, not a token one: `aria-*`/semantic-role coverage across every component (3 uses exist today, all incidental/test-targeting, not deliberate work), keyboard navigability, and a **real, computed** contrast fix — not a "CRT effect" (no such effect exists in the code, confirmed by grep; that framing was wrong) but the actual default/idle text color (`text-neutral-600` on `bg-neutral-950`, ~2.53:1 computed contrast ratio, used 64 times across 13 components) failing WCAG AA outright, plus the repeated weak focus-indicator pattern (`outline-none focus:border-neutral-600`, independently duplicated in 9 components, same failing color) that strips native focus rings app-wide.
- [ ] The web app is usable at common mobile viewport widths (checked, not assumed) — no broken/overflowing layout at ~375px (`RoomHeader.tsx`'s 8+ unwrapped buttons + room tabs are the confirmed failure point), the TOTP setup QR code is actually scannable on a phone (today it renders as tiny ASCII art requiring horizontal scroll — a **functional**, not cosmetic, blocker for the device most people enable 2FA from), and at least one narrow-viewport Playwright check exists so this doesn't silently regress (zero device/viewport test coverage exists today).
- [ ] `User.totpSecret` is encrypted at rest, not stored in plaintext — `docs/THREAT-MODEL.md`'s own open item already names "M6 ships" as one of its two triggers for this; it was simply never carried into this milestone's own list until this review.
- [ ] A user can export their own data (`GET /me/export` — their messages + profile, as JSON/text; KVKK/GDPR portability, `docs/BACKLOG.md` item A8, V1-bucketed but never carried into this milestone until this review). Minimal, not a self-serve UI — matches the product's own "everything is already text" identity.
- [x] Transactional email (password reset, M1 Slice C) sends from a verified, branded domain with SPF/DKIM/DMARC configured — not Resend's shared `onboarding@resend.dev` sender. Done 2026-07-29, ahead of this milestone: `koqep.com` connected via Cloudflare, auto-configure added SPF/DKIM/DMARC, "Verified" in Resend.

## Tasks — kod dilimleri (Claude uygular, her biri kendi plan-modu turu)
- [ ] **Slice A — Gizlilik/ToS sayfa iskeleti + kanıtlanabilir onay.** `/privacy`, `/terms` sayfaları (açıkça taslak işaretli placeholder içerik), `User`'a onay-zaman-damgası kolonu (migration), signup formunda zorunlu checkbox + linkler + server-side DTO validasyonu. Zorunlu kapı gerçek hukuki metin gelmeden production'a alınmaz.
- [ ] **Slice B — Hata takibi entegrasyonu + rate limit gözden geçirmesi.** Sentry (ücretsiz tier) veya benzeri, `apps/api` + `apps/web`, PII-güvenli yapılandırma (mesaj içeriği/email event'lere sızmaz). Uptime izleme bu dilimde DEĞİL (mevcut `GET /health`'e dış bir servisin bağlanması, kod değişikliği gerekmiyor — manuel listeye). **Ek (2026-08-09 M6 kapsam gözden geçirmesinde bulundu — ateşlenmiş bir tetikleyici):** `docs/milestones/M2-core-rooms-messaging.md`'nin kendi "proposed defaults, not final" notu dört rate limit sayısı için (100/60s global, 5/saat davet, 20/60s signup, 10/10s WS) tam olarak "M6 ships" tetikleyicisini yazmıştı (`totpSecret`'la AYNI iki-taraflı tetikleyici stili) — gerçek bir olay beklenmeden, bu dilimde gözden geçirilip (hata takibi verisiyle birlikte) gerekirse ayarlanır.
- [ ] **Slice C — Erişilebilirlik geçişi.** Kontrast düzeltmesi (`text-neutral-600` varsayılan durumu), odak göstergesi düzeltmesi (9 dosyadaki tekrar eden `outline-none focus:border-neutral-600`, paylaşılan bir token'a çıkarılabilir), `jsx-a11y` kural setinin `recommended`'a yükseltilmesi (zaten kurulu, sadece 6 dar kural aktif — config değişikliği, yeni bağımlılık yok), klavye-only gezinme kontrolü, modal-benzeri görünümlerin (`ModerationQueueView`, `CreateRoomView`) odak tuzağı kontrolü.
- [ ] **Slice D — Mobil responsive geçiş + TOTP QR düzeltmesi + viewport test altyapısı.** `RoomHeader.tsx` Tailwind breakpoint'leriyle düzeltilir; sabit `max-w-2xl` düzeni diğer component'lerde de taranır; TOTP QR'ın mobilde taranabilir hale getirilmesi AÇIKÇA bu dilimde (genel taramada kaybolmasın diye); en az bir dar-viewport Playwright projesi/spec'i eklenir.
- [ ] **Slice E — `User.totpSecret` alan-seviyesi şifreleme.** Yeni bir geri-döndürülebilir şifreleme yardımcı fonksiyonu (bugün `crypto.util.ts`'de sadece tek-yönlü `sha256Hex` var), yeni `TOTP_ENCRYPTION_KEY` sırrı, **geriye dönük backfill migration'ı** (production'da bugün düz-metin satırlar var — sadece yeni yazımları şifrelemek yetmez), `savePendingSecret`'ın (onay-öncesi düz-metin yazan ikinci yol) da kapsanması. Kendi başına tam bir tur, başka bir dilime katılmıyor (blast radius büyük — yanlış sıra TÜM aktif TOTP kullanıcılarını kilitler).
- [ ] **Slice F (docs) — Yedekleme/restore + genel olay runbook'u taslağı.** Claude yazar (THREAT-MODEL.md'nin zaten dağınık halde var olan manuel-SQL prosedürleri ham malzeme — ilk-kullanıcı bootstrap prosedürü dahil, bkz. THREAT-MODEL.md'nin güncellenmiş row 13 notu). Runbook'un gerçek tatbikatı manuel listede.
- [ ] **Slice G — Minimal veri dışa aktarma (`GET /me/export`).** Kullanıcının kendi mesajlarını/profilini JSON veya düz metin olarak alması — 2026-08-09 kapsam gözden geçirmesinde onaylandı.

## Tasks — founder'ın kendi eliyle yapacağı işler (kod DEĞİL, ayrı bir liste)
- [ ] **5651/KVKK hukuki kontrol.** Bir avukata ADR-0005'in anonymize-on-delete yaklaşımını VE genişletilmiş soruyu (bağlantı/trafik logu saklama zorunluluğu var mı) sordurmak. **En erken başlaması gereken iş** — üçüncü tarafa bağlı takvim süresi kod dilimleriyle paralel yürür.
- [ ] **Gizlilik Politikası + Kullanım Şartları'nın gerçek hukuki metni** (Slice A'nın iskeletine girecek) — yaş eşiği dahil (KVKK çocuk verisi hükümleri). Yaş eşiği hukuki kontrolün cevabını beklemeden uydurulmaz.
- [ ] **Yedeğin gerçekten var olduğunu doğrula (tatbikatın ÖN KOŞULU, 2026-08-09'da eklendi — daha önce hiç doğrulanmamıştı).** Render Postgres Basic-256mb ücretli bir plan olduğu için otomatik Point-in-Time Recovery (PITR) teorik olarak dahil (Render'ın kendi dokümantasyonu, `render.com/docs/postgresql-backups`: "Render continually backs up paid Render Postgres databases"; ayrıca 7 günlük logical backup retention, workspace planından bağımsız) — ama (a) recovery penceresi **workspace planına** bağlı (Hobby: 3 gün, Pro+: 7 gün — DB instance planından FARKLI bir ayar, hangisi kullanıldığı Render dashboard'undan doğrulanmalı), (b) PITR'ın bu SPESİFİK instance'da fiilen aktif olduğu (teorik "dahil" olması yetmez) dashboard'dan gözle doğrulanmalı. "Yedek var" varsayılmıyor, kontrol ediliyor — tatbikat bu doğrulamadan SONRA yapılır.
- [ ] **Yedekleme/restore tatbikatı** — Render Postgres konsoluna karşı gerçek bir restore denemesi (yukarıdaki doğrulama tamamlandıktan sonra).
- [ ] **Uptime izleme kurulumu** — mevcut `GET /health`'e ücretsiz bir dış servis (UptimeRobot vb.) bağlamak.
- [ ] **`TOTP_ENCRYPTION_KEY`'in Render dashboard'una elle girilmesi** (Slice E'nin bir parçası — `render.yaml` diff'i tek başına yetmez, STATE.md'nin kendi tuzağı).
- [x] Verify a sending domain in Resend (SPF/DKIM/DMARC DNS records) and set `EMAIL_FROM_ADDRESS` to a branded sender — `docs/BACKLOG.md` item A11, previously flagged but unplaced; became concrete once M1 Slice C started actually sending email. Done 2026-07-29 (`koqep.com` via Cloudflare, `EMAIL_FROM_ADDRESS=noreply@koqep.com` being set in `apps/api/.env`).

## Go-live kontrol listesi

M6'nın gerçek teslimatı bu liste — dilimler bitince "hazırız" otomatik varsayılmaz, bu kapı AÇIKÇA kontrol edilir. **İlk 20-30 gerçek kullanıcı (founder'ın kendi hesabı hariç) davet edilmeden ÖNCE aşağıdakilerin HEPSİ yeşil olmalı:**

- [ ] `/privacy` ve `/terms` gerçek (taslak değil) hukuki metinle yayında, signup checkbox'ı zorunlu ve kanıtlanabilir (`User` üzerinde kayıtlı zaman damgası).
- [ ] 5651/KVKK hukuki kontrolü tamamlandı — hem anonimleştirme yaklaşımı HEM bağlantı/trafik logu saklama sorusu cevaplandı, hukuki kontrolün bulgusu varsa uygulandı (ör. gerçekten log saklama gerekiyorsa, bu kod işi launch'tan önce bitmiş olmalı).
- [ ] Hata takibi VE uptime izleme canlı, founder'a gerçek bir bildirim (email/push) test edilerek doğrulandı — sadece "kurulu" değil, "gerçekten haber veriyor."
- [ ] Yedeğin var olduğu doğrulandı (PITR aktif + doğru workspace planı) VE en az bir gerçek restore tatbikatı başarıyla tamamlandı. Genel olay runbook'u yazılı ve erişilebilir.
- [ ] Erişilebilirlik: kontrast düzeltmesi + odak göstergesi düzeltmesi + `jsx-a11y` yükseltmesi merge edildi, klavye-only bir gezinme denemesi yapıldı.
- [ ] Mobil: `RoomHeader.tsx` ~375px'te taşmıyor, TOTP QR telefondan taranabiliyor, dar-viewport Playwright testi CI'da yeşil.
- [ ] `User.totpSecret` şifreli — hem yeni yazımlar hem mevcut satırlar (backfill tamamlandı, round-trip decrypt doğrulandı), `TOTP_ENCRYPTION_KEY` Render dashboard'unda ayarlı.
- [ ] `GET /me/export` çalışıyor ve gerçek bir kullanıcı verisiyle (founder'ın kendi hesabı) uçtan uca denendi.
- [ ] Rate limit sayıları gözden geçirildi (yukarıdaki Slice B eki) — değiştirilmedi bile olsa, bilinçli bir "şu an bu sayılar yeterli" kararı kayıtlı.
- [x] E-posta gönderim domaini doğrulanmış (SPF/DKIM/DMARC) — zaten tamamlandı.

Bu liste tamamen yeşil olmadan `docs/review/CRITIQUE.md`'nin Riskiest Assumption testi (manifesto/waitlist) gerçek yabancılara açılmaz — sadece founder'ın zaten bildiği/davet ettiği kapalı çevre için M6'yı beklemeden devam etmek ayrı bir karar, bu listenin kapsamı dışında.

## Risks
- The legal check may reveal a real blocker (e.g., a stricter reading of 5651) — mitigation: start it early enough (parallel with code slices) that a finding here doesn't become a late surprise that delays launch.
- Slice E's backfill migration has real blast radius (every existing TOTP-enabled user) — mitigate with the `new-migration` skill's expand/contract discipline (write, backfill, verify round-trip decrypt, then cut over), not treated as an ordinary service-layer change.
- Slice A's required consent checkbox must not go live in production before real legal text exists behind `/privacy`/`/terms` — a required-but-uninformed consent flow is arguably worse than today's no-checkbox state under KVKK.

---

## Plan notları — 2026-08-09 kapsam gözden geçirmesi

M5 tamamen bitince M6'ya taze bir gözle geçildi — M3/M4/M5'in kullandığı aynı disiplin: milestone dosyası + çapraz referanslı dosyalar (`docs/BACKLOG.md`, `docs/THREAT-MODEL.md`, `docs/PRD.md`, ADR-0005, `docs/review/CRITIQUE.md`) taze okundu, iddialar gerçek kod okunarak (grep + doğrudan okuma + `npx eslint --print-config` + kontrast hesabı) doğrulandı, hiçbir doc claim'i sınanmadan kabul edilmedi. M6 kendi "Out of scope"unda "büyüme değil sağlamlaştırma" dediği için ölçüt M3/M4/M5'in büyüme-odaklı "Yol B"si değil: **"gerçek kullanıcı verisini tutmadan önce bunu atlamak sorumsuzluk mu?"**

Bir Plan agent'ıyla çapraz kontrol edildi (kod tabanını bağımsız okuyup 8 somut bulgu getirdi) — en kritik iddiaları (kontrast oranı, jsx-a11y'nin aktif kural sayısı, A8'in BACKLOG'da terk edilmişliği, TOTP QR'ın mobil taranamazlığı) ayrıca bağımsız doğruladım, hepsi rakamıyla eşleşti.

**Doküman çapraz-referans boşlukları (M3/M4/M5'te tekrarlayan desen — bir milestone'un kendi metni, başka bir dokümanın zaten kaydettiği bir gerekliliği hiç taşımamış):**
1. `docs/THREAT-MODEL.md` satır 39, `User.totpSecret`'ın düz metin durduğunu ve "M6 ships" ifadesini kendi somut tetikleyicilerinden biri olarak zaten yazmış — ama bu M6'nın kendi Tasks/AC'sine hiç aktarılmamıştı. Şimdi Slice E olarak eklendi.
2. `docs/BACKLOG.md` satır 331, A8 (veri dışa aktarma, KVKK/GDPR zorunluluğu, V1 bucket) 2026-07-30 LANSMAN KARARI denetiminde B1/B5/B10/A2/A3 gibi açıkça yeniden değerlendirilmedi — sessizce terk edildi. Kullanıcıya soruldu (AskUserQuestion): minimal `GET /me/export` mi, yoksa gerekçeli bir BACKLOG ertelemesi mi — **minimal endpoint** seçildi, Slice G olarak eklendi.
3. `docs/review/CRITIQUE.md` satır 105, 5651 log-saklama yükümlülüğünü GDPR/KVKK'dan AYRI, [FATAL]-seviyeli bir bulgu olarak işaretlemiş — M6'nın AC #2'si sadece ADR-0005'in anonymize-on-delete yaklaşımını adlandırıyordu, log-saklama sorusunu hiç. AC #2'nin metni genişletildi (kod tabanında bugün SIFIR IP/bağlantı logu olduğu da not edildi — hukuki kontrolün cevaplaması gereken ek bir soru, önceden inşa edilmiyor).

**Milestone metninin kendisindeki bir hata:** Kontrast maddesi "CRT-effect" diye çerçevelenmişti — `apps/web` genelinde `crt`/`scanline`/`glow` için SIFIR eşleşme, böyle bir efekt hiç yok, kod okunarak doğrulandı. Gerçek ve daha ciddi bulgu: varsayılan/idle metin rengi `text-neutral-600` (`#525252`) `bg-neutral-950` (`#0a0a0a`) üzerinde — relative luminance formülüyle hesaplanan kontrast oranı **~2.53:1**, WCAG AA'nın 4.5:1 eşiğinin ciddi altında, 13 component'te 64 kullanım (neredeyse her nav/buton/etiketin varsayılan hali). İlişkili ikinci bulgu: 9 component BAĞIMSIZ olarak aynı `outline-none focus:border-neutral-600` string'ini tanımlıyor — native focus ring'i kaldırıp AYNI başarısız rengi koyuyor, muhtemelen WCAG 2.4.7/2.4.11 ihlali, login/signup dahil her metin alanında.

**Agent'ın bulduğu, milestone metninde hiç anılmayan iki ek bulgu:**
- `jsx-a11y` zaten kurulu (Next.js'in `core-web-vitals` config'i üzerinden) ama `npx eslint --print-config` ile doğrulandı: sadece 6 dar kural aktif (`alt-text`, `aria-props`, `aria-proptypes`, `aria-unsupported-elements`, `role-has-required-aria-props`, `role-supports-aria-props`) — davranışsal kurallar (`click-events-have-key-events`, `label-has-associated-control` vb.) YOK. Lint bugün yeşil çünkü test edilecek neredeyse hiçbir `aria-*` kullanımı yok — Slice C bunu `recommended`'a yükseltip kalıcı bir regresyon kapısına çevirecek (yeni bağımlılık gerekmiyor).
- `TotpSettingsView.tsx` QR kodu `qrcode-terminal` ile ASCII sanat olarak `<pre className="overflow-x-auto text-[8px] leading-[8px]">` içinde render ediyor — yatay scroll sayfayı bozmuyor ama scroll edilerek görülen bir QR kod telefon kamerasıyla TARANAMAZ. 2FA kurulumu tanım gereği çoğunlukla authenticator'ın olduğu telefonda yapılır — bu kozmetik değil, FONKSİYONEL bir mobil engel, Slice D'ye açıkça eklendi (genel "her component'i tara" turunda kaybolmasın diye).

**Slice sıralama/kapsam kararları:**
- Slice E (totpSecret şifreleme), agent'ın bulduğu gerçek blast-radius nedeniyle kendi başına tam bir tur — `crypto.util.ts`'de bugün sadece tek-yönlü `sha256Hex` var, geri-döndürülebilir bir yardımcı fonksiyon sıfırdan yazılmalı, YENİ `TOTP_ENCRYPTION_KEY` sırrı hem koda hem `render.yaml`'a hem Render dashboard'una (STATE.md'nin kendi tuzağı — render.yaml değişiklikleri canlıya otomatik yansımıyor) elle eklenmeli, VE production'da bugün düz-metin satırlar olduğu için geriye dönük bir backfill migration gerekiyor (`savePendingSecret`'ın onay-öncesi ikinci yazım yolu dahil) — sırayı yanlış kurmak tüm aktif TOTP kullanıcılarını aynı anda kilitler.
- Slice A'nın onay kutusu KVKK anlamında "kanıtlanabilir" olmalı (yeni bir `User` kolonu, sadece frontend+DTO validasyonu değil) VE gerçek hukuki metin gelmeden production'daki zorunlu kapı AÇILMAYACAK — kod merge edilebilir, canlıya alınması ayrı bir karar.
- Hukuki kontrol (5651/KVKK) EN ERKEN başlar, kod dilimleriyle paralel yürür — milestone'un kendi Risks bölümü zaten bunu söylüyordu, değişmedi.

Doğrulama: bu tur sadece kapsam gözden geçirmesi, kod yazılmadı. Her kod diliminin (A-G) kendi implementasyonu ayrı bir plan-modu turuyla başlayacak — M3/M4/M5 ritmi.

### Sıradaki (2026-08-09'da güncellendi — bkz. aşağıdaki ikinci tur)
Kapsam gözden geçirmesi onaylandı, sonra kullanıcının dört maddelik ikinci turu işlendi. Slice A (privacy/ToS iskeleti + kanıtlanabilir onay) kendi plan-modu turuyla başlayacak.

## Plan notları — 2026-08-09 ikinci tur (kullanıcının dört maddelik gözden geçirmesi)

Kullanıcı ilk turu onayladı ama dört nokta daha buldu — hepsi `docs/BACKLOG.md` ve `docs/THREAT-MODEL.md`'nin SİSTEMATİK olarak taranmasını gerektiriyordu, ilk tur sadece totpSecret/A8 gibi tek tek örnekleri yakalamıştı.

**1-2. Ateşlenmiş tetikleyici taraması.** `docs/BACKLOG.md`'deki her "Somut tetikleyici" (7 tane) ve `docs/THREAT-MODEL.md`'nin "Open items" bölümündeki her "Concrete trigger" (6 tane) tek tek okunup değerlendirildi. Sonuç:
- **M6'ya alındı:** Rate limit sayılarının gözden geçirilmesi (`docs/milestones/M2-core-rooms-messaging.md`'nin kendi "M6 ships" tetikleyicisi — totpSecret'la BİREBİR aynı iki-taraflı stil, ilk turda gözden kaçmıştı) → Slice B'nin eki.
- **Ateşlendi ama bilinçli olarak M6'ya ALINMADI** (M6'nın kendi Out-of-scope'u — "sağlamlaştırma, özellik değil" — testini geçmedikleri için), tetikleyici metni güncellendi/kapatıldı: (a) çok-satırlı kod yapıştırma/composer `<textarea>` yükseltmesi (M3 şipti, ürün özelliği), (b) resend-verification-email endpoint'i (M3 şipti, onboarding-kolaylığı, TOTP-kilitlenme kurtarmasıyla AYNI kategoride kabul edildi), (c) raporlayana durum takibi ("M6 cila turu" ifadesi YANLIŞTI, M6 cila turu değil — düzeltildi).
- **Zaten çözülmüş, kapatıldı:** invite-issuance audit tablosu (M5 Slice E gerçekten uygulandı, ihtiyaç duymadı).
- **Stale/obsolete, doküman düzeltildi:** THREAT-MODEL.md row 13 (invite-issuance endpoint) — M2 Slice C GERÇEKTEN inşa etmişti (`POST /invites`) ama M4 Slice B SONRA tamamen kaldırmıştı (auto-grant modeline geçiş) — satır hâlâ "inşa edilecek" diye yazıyordu, iki milestone geriden. Row 35 (sıfır-kullanıcı bootstrap) aynı köke bağlıydı, düzeltildi. Row 40 (TOTP tam-kilitlenme kurtarması) "hiçbir admin/rol kavramı yok" diyordu — M5 tam olarak bunu inşa etti (`role: moderator`, `ModeratorGuard`), öncül artık yanlış, tetikleyici metni güncellendi.

**3. Yedeğin var olduğu hiç doğrulanmamıştı.** "Restore tatbikatı" manuel listedeydi ama restore edilecek bir yedek olduğu VARSAYILMIŞTI, doğrulanmamıştı. Render'ın kendi dokümantasyonu (`render.com/docs/postgresql-backups`, `render.com/pricing` — WebFetch/WebSearch ile doğrulandı) okundu: Basic-256mb ücretli bir plan olduğu için PITR teorik olarak dahil, ama recovery penceresi (Hobby: 3 gün / Pro+: 7 gün) DB planından ayrı bir "workspace planı" ayarına bağlı — hangisinin kullanıldığı ve PITR'ın bu SPESİFİK instance'da fiilen aktif olduğu hiçbir yerde doğrulanmamış. Manuel listeye tatbikattan ÖNCE gelen ayrı bir doğrulama maddesi eklendi.

**4. "Yayına hazırız" anı hiçbir yerde tanımlı değildi.** Dilimler (A-G) + manuel işler bitince otomatik "hazırız" varsaymak yerine, milestone dosyasına açık bir **"Go-live kontrol listesi"** bölümü eklendi — ilk 20-30 gerçek kullanıcıyı davet etmeden önce hepsi yeşil olması gereken somut bir liste (hukuki metin yerinde, yedek doğrulandı, izleme gerçekten bildirim gönderiyor, TOTP şifreli, export çalışıyor, rate limit kararı kayıtlı vb.).

Doğrulama: bu tur da sadece doküman — `docs/BACKLOG.md` (4 tetikleyici metni güncellendi/kapatıldı), `docs/THREAT-MODEL.md` (3 satır düzeltildi), `docs/milestones/M6-launch-readiness.md` (rate limit görevi + yedek-doğrulama maddesi + go-live listesi eklendi). Kod yazılmadı.

### Sıradaki
İkinci tur işlendi. Slice A (privacy/ToS iskeleti + kanıtlanabilir onay) kendi plan-modu turuyla başlayacak.
