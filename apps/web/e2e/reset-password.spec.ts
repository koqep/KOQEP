import { test, expect } from "@playwright/test";

test("token_yoksa_gecersiz_baglanti_mesaji_gosterir", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(page.getByTestId("reset-password-invalid-link-message")).toHaveText(
    "Invalid link.",
  );
  await expect(page.getByTestId("reset-password-new-password")).toHaveCount(0);
});

test("gecerli_token_ile_sifre_guncellenince_basari_mesaji_gosterir", async ({
  page,
}) => {
  await page.route("**/auth/password-reset/confirm", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/reset-password?token=fake-token");
  await page.getByTestId("reset-password-new-password").fill("yeni-guclu-sifre");
  await page.getByTestId("reset-password-submit-button").click();

  await expect(page.getByTestId("reset-password-success-message")).toHaveText(
    "Your password has been updated.",
  );
  await expect(page.getByTestId("reset-password-back-to-login-link")).toBeVisible();
});

test("gecersiz_token_hata_mesajini_gosterir", async ({ page }) => {
  // M9 Slice D2: backend Slice C'den beri HER ZAMAN bir `code` döndürüyor
  // (burada gerçekçi hale getirildi) - ResetPasswordView artık HAM mesaj
  // yerine `translateErrorCode`'un çevirisini gösteriyor.
  await page.route("**/auth/password-reset/confirm", (route) =>
    route.fulfill({
      status: 400,
      json: {
        code: "INVALID_RESET_TOKEN",
        message: "Bağlantı geçersiz ya da süresi dolmuş.",
      },
    }),
  );

  await page.goto("/reset-password?token=expired-token");
  await page.getByTestId("reset-password-new-password").fill("yeni-guclu-sifre");
  await page.getByTestId("reset-password-submit-button").click();

  await expect(page.getByTestId("reset-password-error-message")).toHaveText(
    "This reset link is invalid or has expired.",
  );
});

// M9 Slice D2: ResetPasswordView AppShell zincirinin DIŞINDA - KENDİ
// readStoredLocale()/detectBrowserLocale() çağrısıyla locale'i çözüyor,
// bu test o bağımsız çözümlemeyi doğruluyor (AuthView'ın AppShell'den
// gelen prop yoluyla KARIŞTIRILMASIN).
test("localstoragede_tr_varken_sayfa_turkce_render_eder", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("koqep:locale", "tr");
  });

  await page.goto("/reset-password?token=fake-token");

  // `.toHaveAccessibleName()` - getByLabel'ın örtük "etiketi TAM OLARAK
  // bu" kontrolünü korur, testid'in kendisi locale'den bağımsız olduğu
  // için salt `.toBeVisible()` bu kanıtı KAYBEDERDİ.
  await expect(page.getByTestId("reset-password-new-password")).toHaveAccessibleName(
    "yeni şifre",
  );
  await expect(
    page.getByTestId("reset-password-submit-button"),
  ).toHaveAccessibleName("şifreyi güncelle");
});
