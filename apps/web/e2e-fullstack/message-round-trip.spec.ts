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

  // Token bellek-içi tutulduğu için (ADR-0002) reload oturumu düşürür -
  // bu yüzden tekrar giriş yapılıyor. Mesajın hâlâ orada olması artık
  // gerçekten DB kalıcılığını kanıtlıyor, geçici local state'i değil.
  await pageB.reload();
  await loginAsDevUser(pageB);
  await expect(pageB.getByText(content)).toBeVisible({ timeout: 10000 });

  await contextA.close();
  await contextB.close();
});
