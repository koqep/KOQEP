import { test, expect } from "@playwright/test";

const DEV_USER_EMAIL = "dev@koqep.local";
const DEV_USER_PASSWORD = "dev-local-only-password";

test("davet_kodu_uretilir_ve_yeni_kullanici_kaydinda_gercekten_calisir", async ({
  browser,
}) => {
  const inviterContext = await browser.newContext();
  const inviterPage = await inviterContext.newPage();

  await inviterPage.goto("/");
  await inviterPage.getByLabel("e-posta").fill(DEV_USER_EMAIL);
  await inviterPage.getByLabel("şifre").fill(DEV_USER_PASSWORD);
  await inviterPage.getByRole("button", { name: "giriş yap" }).click();
  await expect(inviterPage.getByPlaceholder("mesaj yaz...")).toBeEnabled({
    timeout: 15000,
  });

  await inviterPage.getByRole("button", { name: "invites" }).click();
  await inviterPage.getByRole("button", { name: "create invite" }).click();

  const codeItem = inviterPage.getByRole("listitem").first();
  await expect(codeItem).toBeVisible({ timeout: 10000 });
  const code = (await codeItem.textContent())?.trim();
  expect(code).toBeTruthy();

  const newUserContext = await browser.newContext();
  const newUserPage = await newUserContext.newPage();
  await newUserPage.goto("/");
  await newUserPage
    .getByRole("button", { name: "hesabın yok mu? kayıt ol" })
    .click();

  await newUserPage.getByLabel("davet kodu").fill(code as string);
  await newUserPage
    .getByLabel("e-posta")
    .fill(`invited-${Date.now()}@koqep.local`);
  await newUserPage.getByLabel("şifre").fill("a-strong-new-password");
  await newUserPage.getByRole("button", { name: "kayıt ol" }).click();

  await expect(newUserPage.getByPlaceholder("mesaj yaz...")).toBeEnabled({
    timeout: 15000,
  });

  await inviterContext.close();
  await newUserContext.close();
});
