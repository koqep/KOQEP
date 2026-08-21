import { test, expect, type Page } from "@playwright/test";

// İkinci, sarf edilebilir seed'lenmiş dev kullanıcı
// (apps/api/src/db/dev-seed.constants.ts DEV_USER_2_*) - sadece bu test
// tarafından kullanılıp gerçekten silinir. Birincil dev kullanıcıyı
// (dev@koqep.local) silmek diğer fullstack testlerini kırardı (M2.5 Slice C).
const DEV_USER_2_EMAIL = "dev2@koqep.local";
const DEV_USER_2_PASSWORD = "dev-local-only-password-2";

async function loginAsDevUser2(page: Page): Promise<void> {
  await page.getByLabel("email").fill(DEV_USER_2_EMAIL);
  await page.getByLabel("password").fill(DEV_USER_2_PASSWORD);
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeEnabled({
    timeout: 15000,
  });
}

test("hesap_silinince_ayni_bilgilerle_giris_artik_basarisiz_olur", async ({
  page,
}) => {
  await page.goto("/");
  await loginAsDevUser2(page);

  await page.getByRole("button", { name: "delete account" }).click();
  await page.getByRole("button", { name: "delete my account" }).click();
  await page.getByLabel("current password").fill(DEV_USER_2_PASSWORD);
  await page
    .getByRole("button", { name: "permanently delete my account" })
    .click();

  await expect(page.getByLabel("email")).toBeVisible({ timeout: 15000 });
  await expect(page.getByPlaceholder("write a message...")).toHaveCount(0);

  await page.getByLabel("email").fill(DEV_USER_2_EMAIL);
  await page.getByLabel("password").fill(DEV_USER_2_PASSWORD);
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByText("E-posta veya şifre hatalı.")).toBeVisible({
    timeout: 15000,
  });
});
