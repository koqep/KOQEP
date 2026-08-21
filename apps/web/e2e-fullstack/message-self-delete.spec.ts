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

test("mesajini_silince_karsi_sekmede_de_placeholder_gorunur_orijinal_gecmiste_kalir", async ({
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

  const originalContent = `silinecek-${Date.now()}`;

  const input = pageA.getByPlaceholder("mesaj yaz...");
  await input.fill(originalContent);
  await pageA.getByRole("button", { name: "gönder" }).click();

  await expect(pageB.getByText(originalContent)).toBeVisible({
    timeout: 10000,
  });

  const rowOnA = pageA.locator("li", { hasText: originalContent });
  await rowOnA.getByRole("button", { name: "sil" }).click();
  await rowOnA.getByRole("button", { name: "evet" }).click();

  // message:updated yayını gerçek zamanlı olarak hem gönderen sekmede hem
  // karşı sekmede placeholder'ı göstermeli.
  await expect(
    pageA.getByText("[Bu mesaj yazarı tarafından silindi.]"),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    pageB.getByText("[Bu mesaj yazarı tarafından silindi.]"),
  ).toBeVisible({ timeout: 10000 });
  await expect(pageA.getByText(originalContent)).toHaveCount(0);

  // Orijinal içerik geçmişte kalıyor (ADR-0005, hard-delete yok).
  const placeholderRowOnA = pageA.locator("li", {
    hasText: "[Bu mesaj yazarı tarafından silindi.]",
  });
  // Silinen mesaj KENDİ satırında "(düzenlendi)" göstermemeli - placeholder'ın
  // kendisi zaten "silindi" diyor, editedAt BİLEREK set edilmiyor. Sayfa
  // genelinde DEĞİL bu satıra ÖZGÜ kontrol - paylaşılan dev odasındaki
  // BAŞKA (bu testten bağımsız) düzenlenmiş mesajlar "(düzenlendi)" taşıyor
  // olabilir.
  await expect(placeholderRowOnA.getByText("(düzenlendi)")).toHaveCount(0);

  await placeholderRowOnA.getByRole("button", { name: "geçmiş" }).click();
  await expect(pageA.getByText(originalContent)).toBeVisible({
    timeout: 10000,
  });

  await contextA.close();
  await contextB.close();
});
