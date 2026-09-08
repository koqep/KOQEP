import { test, expect } from "@playwright/test";

test("gizlilik_sayfasi_onayli_politika_metnini_gosterir_ve_ana_sayfaya_doner", async ({
  page,
}) => {
  await page.goto("/privacy");

  // Sayfa-geneli negatif kontrol + `/terms`,`/privacy` (4 statik içerik
  // sayfası) BİLEREK testid kapsamı DIŞI - Faz 1'in 32 dosyalık listesinin
  // tamamen dışında, tek-dilli/statik sayfalar (bkz. Faz 2 Dalga 1 plan
  // notları).
  await expect(page.getByText(/\bTASLAK\b/)).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Veri Sorumlusu" }),
  ).toBeVisible();
  await page.getByTestId("legal-page-home-link").click();
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
  await page.getByTestId("legal-page-home-link").click();
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
  await page.getByTestId("legal-page-home-link").click();
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
  await page.getByTestId("legal-page-home-link").click();
  await expect(page).toHaveURL("/");
});

test("gizlilik_sayfalari_arasinda_dil_degistirme_linki_dogru_calisir", async ({
  page,
}) => {
  await page.goto("/privacy");
  await page.getByTestId("legal-page-switch-link").click();
  await expect(page).toHaveURL("/privacy/en");

  await page.getByTestId("legal-page-switch-link").click();
  await expect(page).toHaveURL("/privacy");
});

test("kullanim_sartlari_sayfalari_arasinda_dil_degistirme_linki_dogru_calisir", async ({
  page,
}) => {
  await page.goto("/terms");
  await page.getByTestId("legal-page-switch-link").click();
  await expect(page).toHaveURL("/terms/en");

  await page.getByTestId("legal-page-switch-link").click();
  await expect(page).toHaveURL("/terms");
});

// M11b Slice D: legal sayfalar artık landing'in görsel dilini (KOQEP marka
// bloğu + ASCII canvas arka planı, LegalPageShell.tsx) paylaşıyor - temsili
// olarak /terms üzerinde doğrulanıyor (4 sayfa da aynı shell'i kullanıyor).
test("legal_sayfada_koqep_marka_blogu_ve_dekoratif_canvas_gorunur", async ({
  page,
}) => {
  await page.goto("/terms");

  await expect(page.getByTestId("legal-page-brand")).toHaveText("KOQEP");
  await expect(page.getByTestId("ascii-background")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});
