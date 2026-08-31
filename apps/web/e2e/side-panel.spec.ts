import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

// M10 Faz 2 Slice A: panel mekanizması (SidePanel) 7 farklı panelin ortak
// sarmalayıcısı - TOTP panelini temsilci olarak kullanıyoruz, panel-özel
// içerik zaten kendi spec dosyasında (totp-settings.spec.ts) test ediliyor.
// M10 Faz 2 Slice B: TOTP artık "account ▾" menüsünün içinde - dönen
// "trigger" artık menuitem DEĞİL, "account" butonunun kendisi (menuitem
// panel açılır açılmaz DOM'dan kalkıyor, AccountMenu.tsx'in select()'i
// odağı ÖNCE "account" butonuna veriyor - bkz. o dosyadaki yorum).
async function loginAndOpenTotpPanel(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();

  const trigger = page.getByRole("button", { name: "account" });
  await trigger.click();
  await page.getByRole("menuitem", { name: "two-factor authentication" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return trigger;
}

test("escape_ile_panel_kapanir_ve_odak_tetikleyiciye_doner", async ({ page }) => {
  const trigger = await loginAndOpenTotpPanel(page);

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("backdrop_tiklamasiyla_panel_kapanir", async ({ page }) => {
  await loginAndOpenTotpPanel(page);

  // Panel sağda max-w-md - sol tarafta kalan backdrop'a tıkla.
  await page.mouse.click(10, 10);

  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("panel_acikken_arka_plan_gorunur_ama_etkilesimsiz", async ({ page }) => {
  await loginAndOpenTotpPanel(page);

  // Görünür kalıyor (dim, unmount olmuyor).
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
  // Ama etkileşimsiz - inert attribute'u DOM'da.
  const chatWrapper = page.locator("[inert]");
  await expect(chatWrapper).toHaveCount(1);
});

test("tab_dongusu_panel_icinde_kalir", async ({ page }) => {
  const trigger = await loginAndOpenTotpPanel(page);
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

  // Panelin dışına (tetikleyici butona) odak hiç kaçmamalı.
  await expect(trigger).not.toBeFocused();
});

test("panel_kapanip_acilinca_mesaj_listesi_scroll_pozisyonu_korunur", async ({
  page,
}) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "test-oda", status: "active" }],
    }),
  );
  const manyMessages = Array.from({ length: 60 }, (_, i) => ({
    id: `msg-${i}`,
    content: `mesaj ${i}`,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
    authorUsername: "biri",
    roomId: "room-1",
    editedAt: null,
  }));
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: manyMessages, nextCursor: null } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
  await expect(page.getByText("mesaj 0")).toBeVisible();

  // En eski mesaja (listenin başı) kaydır.
  await page.getByText("mesaj 0").scrollIntoViewIfNeeded();
  await expect(page.getByText("mesaj 0")).toBeInViewport();

  // Panel aç/kapat - kırmızı test bunu unmount/remount'ta kaybederdi.
  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "two-factor authentication" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(page.getByText("mesaj 0")).toBeInViewport();
});
