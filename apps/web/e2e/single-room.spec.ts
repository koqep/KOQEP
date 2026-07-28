import { test, expect } from "@playwright/test";

test("oda_adi_gorunur_ve_mesaj_inputu_var", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading")).toContainText("genel");
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
});
