import { test, expect, type Page } from "@playwright/test";

// Seed'lenmiş dev kullanıcı (apps/api/src/db/dev-seed.constants.ts).
const DEV_USER_EMAIL = "dev@koqep.local";
const DEV_USER_PASSWORD = "dev-local-only-password";

async function loginAsDevUser(page: Page): Promise<void> {
  await page.getByLabel("e-posta").fill(DEV_USER_EMAIL);
  await page.getByLabel("şifre").fill(DEV_USER_PASSWORD);
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeEnabled({
    timeout: 15000,
  });
}

test("mesaj_sadece_gonderildigi_odada_gorunur_diger_odaya_sizmaz", async ({
  page,
}) => {
  await page.goto("/");
  await loginAsDevUser(page);

  const generalButton = page.getByRole("button", { name: "#general" });
  const metaButton = page.getByRole("button", { name: "#meta" });
  await expect(generalButton).toBeVisible();
  await expect(metaButton).toBeVisible();

  const content = `oda-izolasyon-${Date.now()}`;

  // #general aktifken gönder (varsayılan aktif oda).
  const input = page.getByPlaceholder("mesaj yaz...");
  await input.fill(content);
  await page.getByRole("button", { name: "gönder" }).click();
  await expect(page.getByText(content)).toBeVisible({ timeout: 10000 });

  // #meta'ya geçince görünmemeli - roomId filtrelemesi ve ayrı geçmiş
  // fetch'i gerçekten çalışıyor mu, sadece local state'te kalıp kalmadığını
  // kanıtlar.
  await metaButton.click();
  await expect(page.getByText(content)).not.toBeVisible();

  // Geri #general'e dönünce hâlâ orada olmalı (gerçek DB kalıcılığı).
  await generalButton.click();
  await expect(page.getByText(content)).toBeVisible({ timeout: 10000 });
});
