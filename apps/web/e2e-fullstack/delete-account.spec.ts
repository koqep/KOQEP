import { test, expect, type Page } from "@playwright/test";

// İkinci, sarf edilebilir seed'lenmiş dev kullanıcı
// (apps/api/src/db/dev-seed.constants.ts DEV_USER_2_*) - sadece bu test
// tarafından kullanılıp gerçekten silinir. Birincil dev kullanıcıyı
// (dev@koqep.local) silmek diğer fullstack testlerini kırardı (M2.5 Slice C).
const DEV_USER_2_EMAIL = "dev2@koqep.local";
const DEV_USER_2_PASSWORD = "dev-local-only-password-2";

async function loginAsDevUser2(page: Page): Promise<void> {
  await page.getByLabel("e-posta").fill(DEV_USER_2_EMAIL);
  await page.getByLabel("şifre").fill(DEV_USER_2_PASSWORD);
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeEnabled({
    timeout: 15000,
  });
}

test("hesap_silinince_ayni_bilgilerle_giris_artik_basarisiz_olur", async ({
  page,
}) => {
  await page.goto("/");
  await loginAsDevUser2(page);

  await page.getByRole("button", { name: "hesabı sil" }).click();
  await page.getByRole("button", { name: "delete my account" }).click();
  await page.getByLabel("current password").fill(DEV_USER_2_PASSWORD);
  await page
    .getByRole("button", { name: "permanently delete my account" })
    .click();

  await expect(page.getByLabel("e-posta")).toBeVisible({ timeout: 15000 });
  await expect(page.getByPlaceholder("mesaj yaz...")).toHaveCount(0);

  await page.getByLabel("e-posta").fill(DEV_USER_2_EMAIL);
  await page.getByLabel("şifre").fill(DEV_USER_2_PASSWORD);
  await page.getByRole("button", { name: "giriş yap" }).click();

  await expect(page.getByText("E-posta veya şifre hatalı.")).toBeVisible({
    timeout: 15000,
  });
});
