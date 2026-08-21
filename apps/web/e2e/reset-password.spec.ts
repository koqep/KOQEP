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
  await page.route("**/auth/password-reset/confirm", (route) =>
    route.fulfill({
      status: 400,
      json: { message: "Bağlantı geçersiz ya da süresi dolmuş." },
    }),
  );

  await page.goto("/reset-password?token=expired-token");
  await page.getByLabel("new password").fill("yeni-guclu-sifre");
  await page.getByRole("button", { name: "update password" }).click();

  await expect(
    page.getByText("Bağlantı geçersiz ya da süresi dolmuş."),
  ).toBeVisible();
});
