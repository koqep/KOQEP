import { test, expect } from "@playwright/test";

test("gecerli_tokenle_dogrulama_basarili_mesaji_gosterir", async ({
  page,
}) => {
  await page.route("**/auth/verify-email", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/verify-email?token=a-valid-token");

  await expect(
    page.getByText("Your email is verified. You can log in now."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "back to login" })).toBeVisible();
});

test("gecersiz_tokenle_hata_mesaji_gosterir", async ({ page }) => {
  await page.route("**/auth/verify-email", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Geçersiz veya süresi dolmuş doğrulama bağlantısı." },
    }),
  );

  await page.goto("/verify-email?token=an-expired-token");

  await expect(
    page.getByText("This link is invalid or has expired."),
  ).toBeVisible();
});

test("token_yoksa_gecersiz_baglanti_mesaji_gosterir", async ({ page }) => {
  await page.goto("/verify-email");

  await expect(page.getByText("Invalid link.")).toBeVisible();
});
