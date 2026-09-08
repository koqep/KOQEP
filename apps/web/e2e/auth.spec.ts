import { test, expect } from "@playwright/test";
import {
  mockAuthRefreshUnavailable,
  mockRoomEndpoints,
} from "./support/auth-mocks";

// Bu dosyadaki HER test page.goto("/app") çağırıyor - page.tsx'in mount-time
// sessiz-refresh bootstrap'ı (M7a Slice A) bu yüzden her testte tetikleniyor,
// mocklanmazsa gerçek ağa düşer/asılı kalır.
test.beforeEach(async ({ page }) => {
  await mockAuthRefreshUnavailable(page);
});

test("kayit_basarili_olunca_dogrulama_mesaji_gosterir_giris_ekranina_gecmez", async ({
  page,
}) => {
  await page.route("**/auth/signup", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/app");
  await page.getByTestId("auth-signup-tab").click();

  await page.getByTestId("auth-invite-code-input").fill("DEV-INVITE-1");
  await page.getByTestId("auth-email-input").fill("yeni@koqep.local");
  await page.getByTestId("auth-username-input").fill("yenikullanici");
  await page.getByTestId("auth-password").fill("a-strong-password");
  await page.getByTestId("auth-accept-terms-checkbox").check();
  await page.getByTestId("auth-submit-button").click();

  // Signup artık giriş yapmıyor (M2.5 Slice B) - e-postayı doğrulaman
  // gerektiğini söyleyen nötr bir mesaj görünür, sohbet ekranına geçmez.
  await expect(page.getByTestId("auth-signup-complete-message")).toHaveText(
    "Click the link sent to your email to complete your signup.",
  );
  await expect(page.getByTestId("chat-panel-composer-input")).toHaveCount(0);
});

test("onay_kutusu_isaretlenmeden_kayit_butonu_devre_disi_kalir", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByTestId("auth-signup-tab").click();

  await page.getByTestId("auth-invite-code-input").fill("DEV-INVITE-1");
  await page.getByTestId("auth-email-input").fill("yeni@koqep.local");
  await page.getByTestId("auth-username-input").fill("yenikullanici");
  await page.getByTestId("auth-password").fill("a-strong-password");

  await expect(page.getByTestId("auth-submit-button")).toBeDisabled();
  await page.getByTestId("auth-accept-terms-checkbox").check();
  await expect(page.getByTestId("auth-submit-button")).toBeEnabled();
});

test("kayit_ekraninda_kullanim_sartlari_ve_gizlilik_linkleri_dogru_hedefe_gider", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByTestId("auth-signup-tab").click();

  await expect(page.getByTestId("auth-terms-link")).toHaveAttribute(
    "href",
    "/terms",
  );
  await expect(page.getByTestId("auth-privacy-link")).toHaveAttribute(
    "href",
    "/privacy",
  );
});

test("dogrulanmamis_e_posta_ile_giris_hatasi_gosterir", async ({ page }) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: {
        code: "EMAIL_NOT_VERIFIED",
        message: "E-postanı doğrulaman gerekiyor.",
      },
    }),
  );

  await page.goto("/app");
  await page.getByTestId("auth-email-input").fill("dogrulanmamis@koqep.local");
  await page.getByTestId("auth-password").fill("a-strong-password");
  await page.getByTestId("auth-submit-button").click();

  await expect(page.getByTestId("auth-error-message")).toHaveText(
    "Check your inbox — you need to verify your email before signing in.",
  );
});

test("yanlis_bilgiler_hata_gosterir_totp_alani_gorunmez", async ({
  page,
}) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: {
        code: "INVALID_CREDENTIALS",
        message: "E-posta veya şifre hatalı.",
      },
    }),
  );

  await page.goto("/app");
  await page.getByTestId("auth-email-input").fill("test@koqep.local");
  await page.getByTestId("auth-password").fill("yanlis-sifre");
  await page.getByTestId("auth-submit-button").click();

  // M9 Slice D2: AuthView artık `translateErrorCode`'a bağlı - varsayılan
  // (İngilizce) locale'de backend'in HAM Türkçe mesajı yerine doğru
  // çevrilmiş metin gösteriliyor (bu TAM DA M9'un düzelttiği bug'dı).
  await expect(page.getByTestId("auth-error-message")).toHaveText(
    "Incorrect email or password.",
  );
  await expect(page.getByTestId("auth-totp-code-input")).toHaveCount(0);
});

test("totp_gerekince_alan_belirir_dogru_kodla_giris_tamamlanir", async ({
  page,
}) => {
  let loginCallCount = 0;
  await page.route("**/auth/login", (route) => {
    loginCallCount += 1;
    if (loginCallCount === 1) {
      return route.fulfill({
        status: 401,
        json: {
          code: "TOTP_REQUIRED",
          message: "Geçerli bir TOTP kodu gerekli.",
        },
      });
    }
    return route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    });
  });
  await mockRoomEndpoints(page);

  await page.goto("/app");
  await page.getByTestId("auth-email-input").fill("test@koqep.local");
  await page.getByTestId("auth-password").fill("a-strong-password");
  await page.getByTestId("auth-submit-button").click();

  const totpField = page.getByTestId("auth-totp-code-input");
  await expect(totpField).toBeVisible();
  await totpField.fill("123456");
  await page.getByTestId("auth-submit-button").click();

  await expect(page.getByTestId("chat-panel-composer-input")).toBeVisible();
  expect(loginCallCount).toBe(2);
});

// Regresyon (2026-09-04): backend hem "kod eksik" hem "kod yanlış"
// durumunda AYNI TOTP_REQUIRED kodunu/mesajını döndürüyor - frontend bu
// ikisini state'ten (alan zaten açık mıydı) ayırt edip ikincisinde hata
// göstermeli, aksi halde kullanıcı yanlış kod girince sessizce takılıyor.
test("yanlis_totp_kodu_girilince_hata_gosterir_dogru_kodla_devam_edebilir", async ({
  page,
}) => {
  let loginCallCount = 0;
  await page.route("**/auth/login", (route) => {
    loginCallCount += 1;
    if (loginCallCount <= 2) {
      return route.fulfill({
        status: 401,
        json: {
          code: "TOTP_REQUIRED",
          message: "Geçerli bir TOTP kodu gerekli.",
        },
      });
    }
    return route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    });
  });
  await mockRoomEndpoints(page);

  await page.goto("/app");
  await page.getByTestId("auth-email-input").fill("test@koqep.local");
  await page.getByTestId("auth-password").fill("a-strong-password");
  await page.getByTestId("auth-submit-button").click();

  const totpField = page.getByTestId("auth-totp-code-input");
  await expect(totpField).toBeVisible();
  await expect(page.getByTestId("auth-error-message")).toHaveCount(0);

  await totpField.fill("000000");
  await page.getByTestId("auth-submit-button").click();
  await expect(page.getByTestId("auth-error-message")).toHaveText(
    "Invalid authenticator code.",
  );
  await expect(totpField).toBeVisible();

  await totpField.fill("123456");
  await page.getByTestId("auth-submit-button").click();

  await expect(page.getByTestId("chat-panel-composer-input")).toBeVisible();
  expect(loginCallCount).toBe(3);
});

// M9 Slice B: giriş anında localStorage'daki tercih login isteğine
// localeHint olarak ekleniyor.
test("login_istegi_localstoragedaki_tercihi_localehint_olarak_gonderir", async ({
  page,
}) => {
  let postedBody: { localeHint?: string } | undefined;
  await page.route("**/auth/login", async (route) => {
    postedBody = route.request().postDataJSON() as { localeHint?: string };
    await route.fulfill({
      json: { accessToken: "fake-access-token", refreshToken: "fake-refresh-token" },
    });
  });
  await mockRoomEndpoints(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: {
        email: "test@koqep.local",
        username: "test",
        role: "user",
        mutedUntil: null,
        muteReason: null,
        locale: "tr",
      },
    }),
  );
  // localStorage'a AÇIKÇA bir tercih yazılıyor - readStoredLocale()
  // detectBrowserLocale()'den ÖNCELİKLİ, testin ortam diline (varsayılan
  // tarayıcı dili) bağımlı olmaması için.
  await page.addInitScript(() => {
    window.localStorage.setItem("koqep:locale", "tr");
  });

  await page.goto("/app");
  // M9 Slice D2: AuthView artık locale='tr' iken GERÇEKTEN Türkçe
  // label'lar render ediyor (AppShell'in tek-noktalı locale çözümlemesi,
  // giriş ÖNCESİ) - testid'ler locale'den BAĞIMSIZ aynı kalıyor.
  await page.getByTestId("auth-email-input").fill("test@koqep.local");
  await page.getByTestId("auth-password").fill("a-strong-password");
  await page.getByTestId("auth-submit-button").click();

  // M9 Slice D5: composer artık `dict`'e bağlı - giriş sonrası User.locale
  // "tr" olduğu için placeholder da GERÇEKTEN Türkçe render ediyor.
  await expect(page.getByTestId("chat-panel-composer-input")).toBeVisible();
  expect(postedBody?.localeHint).toBe("tr");
});

// M9 Slice B: giriş sonrası localStorage artık sadece bir ayna - backend'in
// döndürdüğü User.locale, localStorage'daki (farklı) tercihin ÜZERİNE
// yazar.
test("giris_sonrasi_localstorage_backendin_donduru_locale_ile_senkronlanir", async ({
  page,
}) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: { accessToken: "fake-access-token", refreshToken: "fake-refresh-token" },
    }),
  );
  await mockRoomEndpoints(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: {
        email: "test@koqep.local",
        username: "test",
        role: "user",
        mutedUntil: null,
        muteReason: null,
        locale: "tr",
      },
    }),
  );
  // Giriş ÖNCESİ localStorage "en" diyor - backend'in "tr" yanıtı bunu
  // EZMELİ.
  await page.addInitScript(() => {
    window.localStorage.setItem("koqep:locale", "en");
  });

  await page.goto("/app");
  await page.getByTestId("auth-email-input").fill("test@koqep.local");
  await page.getByTestId("auth-password").fill("a-strong-password");
  await page.getByTestId("auth-submit-button").click();

  // M9 Slice D5: composer artık `dict`'e bağlı - backend'in döndürdüğü
  // User.locale "tr" olduğu için placeholder da GERÇEKTEN Türkçe render
  // ediyor (bu testin kendi amacına - locale senkronunu doğrulamaya -
  // AYRICA bir kanıt).
  await expect(page.getByTestId("chat-panel-composer-input")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("koqep:locale")))
    .toBe("tr");
});

test("sifremi_unuttum_gonderince_notr_mesaj_gosterir", async ({ page }) => {
  await page.route("**/auth/password-reset/request", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/app");
  await page.getByTestId("auth-forgot-password-button").click();

  await expect(page.getByTestId("auth-password")).toHaveCount(0);
  await page.getByTestId("auth-email-input").fill("test@koqep.local");
  await page.getByTestId("auth-submit-button").click();

  await expect(page.getByTestId("auth-reset-requested-message")).toHaveText(
    "If this email is registered, a reset link has been sent.",
  );

  await page.getByTestId("auth-back-to-login-button").click();
  await expect(page.getByTestId("auth-submit-button")).toBeVisible();
});

// M11b Slice E: giriş/kayıt artık sekmeli bir kart - aktif sekme
// aria-selected="true" taşımalı, tıklanınca form alanları değişmeli.
test("sekme_secili_durumu_dogru_yansitir_ve_tiklaninca_form_degisir", async ({
  page,
}) => {
  await page.goto("/app");

  const loginTab = page.getByTestId("auth-login-tab");
  const signupTab = page.getByTestId("auth-signup-tab");
  await expect(loginTab).toHaveAttribute("aria-selected", "true");
  await expect(signupTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByTestId("auth-invite-code-input")).toHaveCount(0);

  await signupTab.click();
  await expect(loginTab).toHaveAttribute("aria-selected", "false");
  await expect(signupTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("auth-invite-code-input")).toBeVisible();
});

test("sifremi_unuttum_modunda_sekme_cubugu_gizlenir", async ({ page }) => {
  await page.goto("/app");

  await page.getByTestId("auth-forgot-password-button").click();
  await expect(page.getByRole("tablist")).toHaveCount(0);
});

// M11b Slice A/D'deki AYNI desen: dekoratif ASCII arka planı ekran
// okuyucudan gizli olmalı.
test("dekoratif_canvas_arka_plani_ekran_okuyucudan_gizli", async ({
  page,
}) => {
  await page.goto("/app");

  await expect(page.getByTestId("ascii-background")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

// Fix (2026-09-03): henüz hesabı olmayan bir ziyaretçi için dil
// değiştirme kutusu YOKTU - D1/D2'nin locale kaynağı User.locale
// (backend), ama bu kullanıcı için henüz bir User kaydı yok. AuthPageShell'e
// LandingPage.tsx'in AYNI görsel deseniyle (rol/aria-pressed) eklendi.
test("giris_ekranindaki_tr_en_kutusu_dili_degistirir_ve_form_state_korunur", async ({
  page,
}) => {
  await page.goto("/app");

  await expect(page.getByTestId("auth-login-tab")).toBeVisible();

  // Form state - toggle sonrası KAYBOLMAMALI (AuthView unmount OLMUYOR,
  // sadece dict/locale prop'ları değişiyor).
  await page.getByTestId("auth-email-input").fill("test@koqep.local");

  // "language" grubu artık gerekmiyor - testid'ler sayfa genelinde zaten
  // benzersiz, ayrı bir sarmalayıcıya scope'lamaya gerek yok.
  await expect(page.getByTestId("auth-locale-tr-button")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByTestId("auth-locale-tr-button").click();

  // Sekmenin GERÇEKTEN Türkçe metne geçtiğini kanıtlar (testid sabit
  // kalır, içerik değişir).
  await expect(page.getByTestId("auth-login-tab")).toHaveAccessibleName(
    "giriş yap",
  );
  await expect(page.getByTestId("auth-locale-tr-button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("auth-email-input")).toHaveValue(
    "test@koqep.local",
  );

  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("koqep:locale")))
    .toBe("tr");

  // Geri EN'e dönmek de çalışmalı (tek yönlü bir geçiş değil).
  await page.getByTestId("auth-locale-en-button").click();
  await expect(page.getByTestId("auth-login-tab")).toHaveAccessibleName(
    "log in",
  );
});

// M9 Slice D2 (Dalga A): AppShell'in TEK-noktalı locale çözümlemesi -
// localStorage'da "tr" varken TÜM giriş-öncesi kabuk (AuthPageShell'in
// KENDİ metinleri dahil) Türkçe render etmeli, sadece AuthView'ın DEĞİL.
test("localstoragede_tr_varken_giris_ekrani_turkce_render_eder", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("koqep:locale", "tr");
  });

  await page.goto("/app");

  // `.toHaveAccessibleName()` - getByRole(...,{name:})/getByLabel'ın
  // örtük olarak yaptığı "erişilebilir adı TAM OLARAK bu" kontrolünü
  // korur (dekoratif aria-hidden ikon/önekleri, ör. "< " ok işareti,
  // erişilebilir isim hesabına GİRMEZ - `.toHaveText()` bunları DAHİL
  // ederdi, ham metin ile erişilebilir isim burada FARKLI şeyler).
  await expect(page.getByTestId("auth-login-tab")).toHaveAccessibleName(
    "giriş yap",
  );
  await expect(page.getByTestId("auth-signup-tab")).toHaveAccessibleName(
    "kayıt ol",
  );
  await expect(page.getByTestId("auth-email-input")).toHaveAccessibleName(
    "e-posta",
  );
  await expect(page.getByTestId("auth-password")).toHaveAccessibleName(
    "şifre",
  );
  await expect(
    page.getByTestId("auth-forgot-password-button"),
  ).toHaveAccessibleName("şifreni mi unuttun?");
  // AuthPageShell'in KENDİ metinleri - AuthView'dan AYRI bir prop yolu
  // (RoomView'ın dict zincirine hiç girmiyor), ayrıca doğrulanmalı.
  // `auth-tagline` orijinalde `getByText` idi (saf metin, ikon yok) -
  // `.toHaveText()` doğru; linkler `getByRole(link,{name:})` idi -
  // `.toHaveAccessibleName()` gerekiyor (`auth-back-to-home-link`
  // dekoratif "< " ön eki taşıyor, gerçek bir koşumda YAKALANDI).
  await expect(page.getByTestId("auth-tagline")).toHaveText(
    "sadece metin · davetle katılım",
  );
  await expect(
    page.getByTestId("auth-back-to-home-link"),
  ).toHaveAccessibleName("ana sayfaya dön");
  await expect(page.getByTestId("auth-help-link")).toHaveAccessibleName(
    "yardım",
  );
});

// M9 Slice D2: `translateErrorCode`'un GERÇEK bilingual kanıtı - sadece
// varsayılan İngilizce'nin BİREBİR korunduğunu değil, `tr` locale'de
// GERÇEKTEN Türkçe çevirinin göründüğünü de kanıtlar.
test("tr_localede_yanlis_bilgiler_hatasi_turkce_gosterilir", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("koqep:locale", "tr");
  });
  // Backend'in HAM mesajı BİLEREK sözlükteki çeviriden FARKLI - test
  // SADECE sözlük değeri görünürse ("E-posta veya şifre hatalı.")
  // GERÇEKTEN `translateErrorCode`'un kullanıldığını kanıtlar (ham
  // mesajın sessizce geçtiği bir passthrough'la KARIŞTIRILMASIN).
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: {
        code: "INVALID_CREDENTIALS",
        message: "kimlik doğrulama başarısız (ham backend metni)",
      },
    }),
  );

  await page.goto("/app");
  await page.getByTestId("auth-email-input").fill("test@koqep.local");
  await page.getByTestId("auth-password").fill("yanlis-sifre");
  await page.getByTestId("auth-submit-button").click();

  await expect(page.getByTestId("auth-error-message")).toHaveText(
    "E-posta veya şifre hatalı.",
  );
  // Sayfa-geneli negatif kontrol - tek bir hedef elemana bağlı DEĞİL
  // (ham backend metninin SAYFANIN HİÇBİR YERİNDE sızmadığını kanıtlıyor),
  // testid'e taşınmıyor.
  await expect(
    page.getByText("kimlik doğrulama başarısız (ham backend metni)"),
  ).toHaveCount(0);
});
