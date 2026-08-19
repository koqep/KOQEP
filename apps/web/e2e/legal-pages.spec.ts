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

test("gizlilik_sayfasinin_ingilizce_surumu_draft_uyarisi_gosterir_ve_ana_sayfaya_doner", async ({
  page,
}) => {
  await page.goto("/privacy/en");

  await expect(page.getByText("DRAFT")).toBeVisible();
  await page.getByRole("link", { name: "back to home" }).click();
  await expect(page).toHaveURL("/");
});

test("kullanim_sartlarinin_ingilizce_surumu_draft_uyarisi_gosterir_ve_ana_sayfaya_doner", async ({
  page,
}) => {
  await page.goto("/terms/en");

  await expect(page.getByText("DRAFT")).toBeVisible();
  await page.getByRole("link", { name: "back to home" }).click();
  await expect(page).toHaveURL("/");
});

test("gizlilik_sayfalari_arasinda_dil_degistirme_linki_dogru_calisir", async ({
  page,
}) => {
  await page.goto("/privacy");
  await page.getByRole("link", { name: "Switch to English" }).click();
  await expect(page).toHaveURL("/privacy/en");

  await page.getByRole("link", { name: "Türkçe sürüm" }).click();
  await expect(page).toHaveURL("/privacy");
});

test("kullanim_sartlari_sayfalari_arasinda_dil_degistirme_linki_dogru_calisir", async ({
  page,
}) => {
  await page.goto("/terms");
  await page.getByRole("link", { name: "Switch to English" }).click();
  await expect(page).toHaveURL("/terms/en");

  await page.getByRole("link", { name: "Türkçe sürüm" }).click();
  await expect(page).toHaveURL("/terms");
});
