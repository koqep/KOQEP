import { test, expect } from "@playwright/test";

test("token_yoksa_gecersiz_baglanti_mesaji_gosterir", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(page.getByText("Invalid link.")).toBeVisible();
  await expect(page.getByLabel("new password")).toHaveCount(0);
});

test("gecerli_token_ile_sifre_guncellenince_basari_mesaji_gosterir", async ({
  page,
}) => {
  await page.route("**/auth/password-reset/confirm", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/reset-password?token=fake-token");
  await page.getByLabel("new password").fill("yeni-guclu-sifre");
  await page.getByRole("button", { name: "update password" }).click();

  await expect(page.getByText("Your password has been updated.")).toBeVisible();
  await expect(page.getByRole("link", { name: "back to login" })).toBeVisible();
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
  await page.getByLabel("new password").fill("yeni-guclu-sifre");
  await page.getByRole("button", { name: "update password" }).click();

  await expect(
    page.getByText("This reset link is invalid or has expired."),
  ).toBeVisible();
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

  await expect(page.getByLabel("yeni şifre")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "şifreyi güncelle" }),
  ).toBeVisible();
});
