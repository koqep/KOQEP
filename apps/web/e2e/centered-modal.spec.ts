import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

// M13 Slice A: CenteredModal ortak sarmalayıcının kendi doğrulaması -
// side-panel.spec.ts'in AYNI 4 testi (TOTP eskiden SidePanel'in temsilciydi,
// şimdi CenteredModal'ın temsilcisi) + kendi mobil taşma testi. Panel-özel
// içerik zaten kendi spec dosyasında (totp-settings.spec.ts) test ediliyor.
// M13 Slice B: TOTP artık DOĞRUDAN bir menuitem DEĞİL - önce "settings"
// panelini açmak, SONRA oradaki (role="button") satıra tıklamak gerekiyor.
async function loginAndOpenTotpModal(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();

  const trigger = page.getByRole("button", { name: "account" });
  await trigger.click();
  await page.getByRole("menuitem", { name: "settings" }).click();
  await page.getByRole("button", { name: "two-factor authentication" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return trigger;
}

test("escape_ile_modal_kapanir_ve_odak_tetikleyiciye_doner", async ({ page }) => {
  const trigger = await loginAndOpenTotpModal(page);

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("backdrop_tiklamasiyla_modal_kapanir", async ({ page }) => {
  await loginAndOpenTotpModal(page);

  // Modal ortada - köşedeki backdrop'a tıkla.
  await page.mouse.click(10, 10);

  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("modal_acikken_arka_plan_gorunur_ama_etkilesimsiz", async ({ page }) => {
  await loginAndOpenTotpModal(page);

  // Görünür kalıyor (dim, unmount olmuyor).
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
  // Ama etkileşimsiz - inert attribute'u DOM'da.
  const chatWrapper = page.locator("[inert]");
  await expect(chatWrapper).toHaveCount(1);
});

test("tab_dongusu_modal_icinde_kalir", async ({ page }) => {
  const trigger = await loginAndOpenTotpModal(page);
  const dialog = page.getByRole("dialog");

  const focusable = dialog.locator(
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  const count = await focusable.count();
  expect(count).toBeGreaterThan(0);

  // Son elemana kadar Tab'la, bir Tab daha bas - ilk elemana sarmalı.
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Tab");
  await expect(focusable.first()).toBeFocused();

  // Modalin dışına (tetikleyici butona) odak hiç kaçmamalı.
  await expect(trigger).not.toBeFocused();
});

test("modal_baslik_koqep_onekiyle_gorunur", async ({ page }) => {
  await loginAndOpenTotpModal(page);

  await expect(
    page.getByRole("heading", { name: "KOQEP · two-factor authentication" }),
  ).toBeVisible();
});

// SidePanel'in "375px'te tam ekrana genişler" davranışının BİLEREK TERSİ -
// ortada bir modal mobilde de kenar boşluklu kalmalı, edge-to-edge DEĞİL
// (mobile-viewport.spec.ts'in side_panel_375px testiyle karşılaştır).
test("modal_375px_genislikte_kenar_bosluklu_tasmadan_gorunur", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await loginAndOpenTotpModal(page);

  const dialog = page.getByRole("dialog");
  const box = await dialog.boundingBox();
  expect(box?.width).toBeLessThan(375);
  expect(box?.x).toBeGreaterThan(0);
});
