import { test, expect } from "@playwright/test";

test("gecerli_tokenle_dogrulama_basarili_mesaji_gosterir", async ({
  page,
}) => {
  await page.route("**/auth/verify-email", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/verify-email?token=a-valid-token");

  await expect(page.getByTestId("verify-email-success-message")).toHaveText(
    "Your email is verified. You can log in now.",
  );
  await expect(page.getByTestId("verify-email-back-to-login-link")).toBeVisible();
});

test("gecersiz_tokenle_hata_mesaji_gosterir", async ({ page }) => {
  await page.route("**/auth/verify-email", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Geçersiz veya süresi dolmuş doğrulama bağlantısı." },
    }),
  );

  await page.goto("/verify-email?token=an-expired-token");

  await expect(page.getByTestId("verify-email-error-message")).toHaveText(
    "This link is invalid or has expired.",
  );
});

test("token_yoksa_gecersiz_baglanti_mesaji_gosterir", async ({ page }) => {
  await page.goto("/verify-email");

  await expect(page.getByTestId("verify-email-invalid-link-message")).toHaveText(
    "Invalid link.",
  );
});
