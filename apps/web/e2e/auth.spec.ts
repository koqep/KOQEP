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
  await page.getByRole("tab", { name: "sign up" }).click();

  await page.getByLabel("invite code").fill("DEV-INVITE-1");
  await page.getByLabel("email").fill("yeni@koqep.local");
  await page.getByLabel("username").fill("yenikullanici");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "sign up" }).click();

  // Signup artık giriş yapmıyor (M2.5 Slice B) - e-postayı doğrulaman
  // gerektiğini söyleyen nötr bir mesaj görünür, sohbet ekranına geçmez.
  await expect(
    page.getByText(
      "Click the link sent to your email to complete your signup.",
    ),
  ).toBeVisible();
  await expect(page.getByPlaceholder("write a message...")).toHaveCount(0);
});

test("onay_kutusu_isaretlenmeden_kayit_butonu_devre_disi_kalir", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByRole("tab", { name: "sign up" }).click();

  await page.getByLabel("invite code").fill("DEV-INVITE-1");
  await page.getByLabel("email").fill("yeni@koqep.local");
  await page.getByLabel("username").fill("yenikullanici");
  await page.getByLabel("password").fill("a-strong-password");

  await expect(page.getByRole("button", { name: "sign up" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "sign up" })).toBeEnabled();
});

test("kayit_ekraninda_kullanim_sartlari_ve_gizlilik_linkleri_dogru_hedefe_gider", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByRole("tab", { name: "sign up" }).click();

  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
    "href",
    "/terms",
  );
  await expect(
    page.getByRole("link", { name: "Privacy Policy" }),
  ).toHaveAttribute("href", "/privacy");
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
  await page.getByLabel("email").fill("dogrulanmamis@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(
    page.getByText(
      "Check your inbox — you need to verify your email before signing in.",
    ),
  ).toBeVisible();
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
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("yanlis-sifre");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByText("E-posta veya şifre hatalı.")).toBeVisible();
  await expect(page.getByLabel("authenticator code")).toHaveCount(0);
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
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  const totpField = page.getByLabel("authenticator code");
  await expect(totpField).toBeVisible();
  await totpField.fill("123456");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
  expect(loginCallCount).toBe(2);
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
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
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
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("koqep:locale")))
    .toBe("tr");
});

test("sifremi_unuttum_gonderince_notr_mesaj_gosterir", async ({ page }) => {
  await page.route("**/auth/password-reset/request", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/app");
  await page.getByRole("button", { name: "forgot your password?" }).click();

  await expect(page.getByLabel("password")).toHaveCount(0);
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByRole("button", { name: "send" }).click();

  await expect(
    page.getByText("If this email is registered, a reset link has been sent."),
  ).toBeVisible();

  await page.getByRole("button", { name: "back to login" }).click();
  await expect(page.getByRole("button", { name: "log in" })).toBeVisible();
});

// M11b Slice E: giriş/kayıt artık sekmeli bir kart - aktif sekme
// aria-selected="true" taşımalı, tıklanınca form alanları değişmeli.
test("sekme_secili_durumu_dogru_yansitir_ve_tiklaninca_form_degisir", async ({
  page,
}) => {
  await page.goto("/app");

  const loginTab = page.getByRole("tab", { name: "log in" });
  const signupTab = page.getByRole("tab", { name: "sign up" });
  await expect(loginTab).toHaveAttribute("aria-selected", "true");
  await expect(signupTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByLabel("invite code")).toHaveCount(0);

  await signupTab.click();
  await expect(loginTab).toHaveAttribute("aria-selected", "false");
  await expect(signupTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("invite code")).toBeVisible();
});

test("sifremi_unuttum_modunda_sekme_cubugu_gizlenir", async ({ page }) => {
  await page.goto("/app");

  await page.getByRole("button", { name: "forgot your password?" }).click();
  await expect(page.getByRole("tablist")).toHaveCount(0);
});

// M11b Slice A/D'deki AYNI desen: dekoratif ASCII arka planı ekran
// okuyucudan gizli olmalı.
test("dekoratif_canvas_arka_plani_ekran_okuyucudan_gizli", async ({
  page,
}) => {
  await page.goto("/app");

  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("aria-hidden", "true");
});
