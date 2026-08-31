import { test, expect, type Page } from "@playwright/test";

// Seed'lenmiş dev kullanıcı (apps/api/src/db/dev-seed.constants.ts) - gerçek
// bir şifre hash'i var (Slice A'dan beri), gerçek /auth/login akışından
// geçebiliyor.
const DEV_USER_EMAIL = "dev@koqep.local";
const DEV_USER_PASSWORD = "dev-local-only-password";

async function loginAsDevUser(page: Page): Promise<void> {
  await page.getByLabel("email").fill(DEV_USER_EMAIL);
  await page.getByLabel("password").fill(DEV_USER_PASSWORD);
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeEnabled({
    timeout: 15000,
  });
}

// M2.5 Slice D: bağlantı kesikken kaçırılan mesajların manuel reload
// gerekmeden otomatik geri dolduğunu kanıtlıyor - message-round-trip.spec.ts
// zaten reload sonrası kalıcılığı kanıtlıyor, bu test reload'suz reconnect
// yolunu kanıtlıyor.
test("baglanti_kesilip_geri_gelince_kacirilan_mesaj_reload_gerekmeden_geri_dolar", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto("/app");
  await pageB.goto("/app");
  await loginAsDevUser(pageA);
  await loginAsDevUser(pageB);

  await contextA.setOffline(true);
  // socket.io'nun kopukluğu algılayıp gönder butonunu disabled'a çevirmesini
  // bekle - bu, bağlantının gerçekten kesildiğinin ölçülebilir kanıtı
  // (sabit bir sleep yerine).
  await expect(pageA.getByRole("button", { name: "send" })).toBeDisabled({
    timeout: 10000,
  });

  const content = `reconnect-backfill-${Date.now()}`;
  await pageB.getByPlaceholder("write a message...").fill(content);
  await pageB.getByRole("button", { name: "send" }).click();
  await expect(pageB.getByText(content)).toBeVisible({ timeout: 10000 });

  // pageA bağlantısı kesikken bu mesajı hiç görmemiş olmalı.
  await expect(pageA.getByText(content)).toHaveCount(0);

  await contextA.setOffline(false);

  // Reload YOK - reconnect-backfill'in kendisi mesajı geri getirmeli.
  await expect(pageA.getByText(content)).toBeVisible({ timeout: 15000 });

  await contextA.close();
  await contextB.close();
});
