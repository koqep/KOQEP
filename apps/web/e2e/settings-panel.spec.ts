import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

// M13 Slice B: AccountMenu'nün eski 4 ayrı öğesi (two-factor authentication/
// blocked/invites/delete account) artık tek bir "settings" girişinin
// ARKASINDA - bu dosya o girişin AÇTIĞI paneli ve eski üst-seviye
// konumun gerçekten kalktığını doğruluyor. Panellerin kendi İÇERİĞİ zaten
// kendi spec dosyalarında (totp-settings/blocked-users/invite/
// delete-account.spec.ts) test ediliyor.
async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

test("settings_paneli_dort_satiri_button_rolüyle_gosterir", async ({
  page,
}) => {
  await login(page);

  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "settings" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "two-factor authentication" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "blocked" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "invites" })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "delete account" }),
  ).toBeVisible();

  // Satırlar role="menuitem" DEĞİL - bu panel bir role="menu" konteyneri
  // değil, role="dialog".
  await expect(
    dialog.getByRole("menuitem", { name: "delete account" }),
  ).toHaveCount(0);
});

// Regresyon-koruması: eski üst-seviye konum yanlışlıkla geri bırakılırsa
// bu test kırılır.
test("eski_ust_seviye_menuitemler_artik_yok", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "account" }).click();

  await expect(
    page.getByRole("menuitem", { name: "two-factor authentication" }),
  ).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "blocked" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "invites" })).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "delete account" }),
  ).toHaveCount(0);

  await expect(page.getByRole("menuitem", { name: "settings" })).toBeVisible();
});
