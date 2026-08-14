import { test, expect, type Page } from "@playwright/test";

// Seed'lenmiş dev kullanıcı (apps/api/src/db/dev-seed.constants.ts) - gerçek
// bir şifre hash'i var (Slice A'dan beri), gerçek /auth/login akışından
// geçebiliyor. Dev-login artık frontend'de kullanılmıyor (Slice E1).
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

test("mesaj_diger_sekmede_gercek_zamanli_gorunur_ve_reload_sonrasi_kalicidir", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto("/");
  await pageB.goto("/");
  await loginAsDevUser(pageA);
  await loginAsDevUser(pageB);

  const content = `round-trip-${Date.now()}`;

  const input = pageA.getByPlaceholder("mesaj yaz...");
  await input.fill(content);
  await pageA.getByRole("button", { name: "gönder" }).click();

  await expect(pageB.getByText(content)).toBeVisible({ timeout: 10000 });

  // M7a Slice A'dan beri reload = çıkış DEĞİL (httpOnly refresh-token
  // cookie'si sağ kalıyor, page.tsx mount'ta sessizce /auth/refresh dener) -
  // tekrar login YAPILMIYOR, oturumun hâlâ açık olduğu doğrulanıyor.
  // Mesajın hâlâ orada olması gerçekten DB kalıcılığını kanıtlıyor, geçici
  // local state'i değil.
  await pageB.reload();
  await expect(pageB.getByPlaceholder("mesaj yaz...")).toBeEnabled({
    timeout: 15000,
  });
  await expect(pageB.getByLabel("e-posta")).toHaveCount(0);
  await expect(pageB.getByText(content)).toBeVisible({ timeout: 10000 });

  await contextA.close();
  await contextB.close();
});
