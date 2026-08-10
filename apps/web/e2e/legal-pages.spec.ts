import { test, expect } from "@playwright/test";

test("gizlilik_sayfasi_taslak_uyarisi_gosterir_ve_ana_sayfaya_doner", async ({
  page,
}) => {
  await page.goto("/privacy");

  await expect(page.getByText("TASLAK")).toBeVisible();
  await page.getByRole("link", { name: "ana sayfaya dön" }).click();
  await expect(page).toHaveURL("/");
});

test("kullanim_sartlari_sayfasi_taslak_uyarisi_gosterir_ve_ana_sayfaya_doner", async ({
  page,
}) => {
  await page.goto("/terms");

  await expect(page.getByText("TASLAK")).toBeVisible();
  await page.getByRole("link", { name: "ana sayfaya dön" }).click();
  await expect(page).toHaveURL("/");
});
