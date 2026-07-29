import { test, expect } from "@playwright/test";

test("token_yoksa_gecersiz_baglanti_mesaji_gosterir", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(page.getByText("Geçersiz bağlantı.")).toBeVisible();
  await expect(page.getByLabel("yeni şifre")).toHaveCount(0);
});

test("gecerli_token_ile_sifre_guncellenince_basari_mesaji_gosterir", async ({
  page,
}) => {
  await page.route("**/auth/password-reset/confirm", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/reset-password?token=fake-token");
  await page.getByLabel("yeni şifre").fill("yeni-guclu-sifre");
  await page.getByRole("button", { name: "şifreyi güncelle" }).click();

  await expect(page.getByText("Şifren güncellendi.")).toBeVisible();
  await expect(page.getByRole("link", { name: "girişe dön" })).toBeVisible();
});

test("gecersiz_token_hata_mesajini_gosterir", async ({ page }) => {
  await page.route("**/auth/password-reset/confirm", (route) =>
    route.fulfill({
      status: 400,
      json: { message: "Bağlantı geçersiz ya da süresi dolmuş." },
    }),
  );

  await page.goto("/reset-password?token=expired-token");
  await page.getByLabel("yeni şifre").fill("yeni-guclu-sifre");
  await page.getByRole("button", { name: "şifreyi güncelle" }).click();

  await expect(
    page.getByText("Bağlantı geçersiz ya da süresi dolmuş."),
  ).toBeVisible();
});
