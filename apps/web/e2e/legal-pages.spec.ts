import { test, expect } from "@playwright/test";

test("gizlilik_sayfasi_onayli_politika_metnini_gosterir_ve_ana_sayfaya_doner", async ({
  page,
}) => {
  await page.goto("/privacy");

  await expect(page.getByText(/\bTASLAK\b/)).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Veri Sorumlusu" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "ana sayfaya dön" }).click();
  await expect(page).toHaveURL("/");
});

test("kullanim_sartlari_sayfasi_onayli_metni_gosterir_ve_ana_sayfaya_doner", async ({
  page,
}) => {
  await page.goto("/terms");

  await expect(page.getByText(/\bTASLAK\b/)).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Taraflar ve Kapsam" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "ana sayfaya dön" }).click();
  await expect(page).toHaveURL("/");
});

test("gizlilik_sayfasinin_ingilizce_surumu_onayli_politika_metnini_gosterir_ve_ana_sayfaya_doner", async ({
  page,
}) => {
  await page.goto("/privacy/en");

  await expect(page.getByText(/\bDRAFT\b/)).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Data Controller" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "back to home" }).click();
  await expect(page).toHaveURL("/");
});

test("kullanim_sartlarinin_ingilizce_surumu_onayli_metni_gosterir_ve_ana_sayfaya_doner", async ({
  page,
}) => {
  await page.goto("/terms/en");

  await expect(page.getByText(/\bDRAFT\b/)).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Parties and Scope" }),
  ).toBeVisible();
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

// M11b Slice D: legal sayfalar artık landing'in görsel dilini (KOQEP marka
// bloğu + ASCII canvas arka planı, LegalPageShell.tsx) paylaşıyor - temsili
// olarak /terms üzerinde doğrulanıyor (4 sayfa da aynı shell'i kullanıyor).
test("legal_sayfada_koqep_marka_blogu_ve_dekoratif_canvas_gorunur", async ({
  page,
}) => {
  await page.goto("/terms");

  await expect(page.getByText("KOQEP", { exact: true })).toBeVisible();
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("aria-hidden", "true");
});
