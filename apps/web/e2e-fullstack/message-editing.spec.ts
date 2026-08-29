import { test, expect, type Page } from "@playwright/test";

// Seed'lenmiş dev kullanıcı (apps/api/src/db/dev-seed.constants.ts).
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

test("mesaj_duzenlenince_karsi_sekmede_de_gunceller_gecmiste_eski_icerik_gorunur", async ({
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

  const originalContent = `duzenle-once-${Date.now()}`;
  const editedContent = `duzenle-sonra-${Date.now()}`;

  const input = pageA.getByPlaceholder("write a message...");
  await input.fill(originalContent);
  await pageA.getByRole("button", { name: "send" }).click();

  await expect(pageB.getByText(originalContent)).toBeVisible({
    timeout: 10000,
  });

  const rowOnA = pageA.locator("li", { hasText: originalContent });
  // M11a devamı: edit/history artık "message actions" ("⋯") menüsünün içinde.
  await rowOnA.hover();
  await rowOnA.getByRole("button", { name: "message actions" }).click();
  await rowOnA.getByRole("menuitem", { name: "edit" }).click();
  // Düzenleme moduna girince li'nin metni değişiyor (form/input, düz metin
  // değil) - rowOnA artık eşleşmez, bu yüzden buradan sonrası sayfa
  // genelinde bulunuyor (tek seferde en fazla bir mesaj düzenlenebilir).
  await pageA.getByLabel("edit message").fill(editedContent);
  await pageA.getByRole("button", { name: "save" }).click();

  // message:updated yayını gerçek zamanlı olarak hem gönderen sekmede
  // hem karşı sekmede içeriği güncellemeli.
  await expect(pageA.getByText(editedContent)).toBeVisible({
    timeout: 10000,
  });
  await expect(pageB.getByText(editedContent)).toBeVisible({
    timeout: 10000,
  });

  const editedRowOnA = pageA.locator("li", { hasText: editedContent });
  await editedRowOnA.hover();
  await editedRowOnA
    .getByRole("button", { name: "message actions" })
    .click();
  await editedRowOnA.getByRole("menuitem", { name: "history" }).click();

  await expect(pageA.getByText(originalContent)).toBeVisible({
    timeout: 10000,
  });

  await contextA.close();
  await contextB.close();
});
