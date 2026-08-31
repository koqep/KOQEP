import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

// M10 Faz 2 Slice B: "blocked" artık TopBar'ın "account ▾" açılır menüsünün
// İÇİNDE - önce menüyü açmak gerekiyor (menü öğeleri sadece menü açıkken
// DOM'a render ediliyor, AccountMenu.tsx). Menü öğeleri role="menuitem"
// TAŞIYOR (doğru WAI-ARIA semantiği) - bu, <button>'ın implicit "button"
// rolünü EZER, getByRole("menuitem", ...) kullanılmalı.
async function openBlockedPanel(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "blocked" }).click();
}

test("liste_bosken_bos_durum_mesaji_gosterir", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await openBlockedPanel(page);

  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();
});

test("mevcut_engellenenler_listede_gorunur", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({
      json: [
        { email: "a@koqep.local", username: "auser" },
        { email: "b@koqep.local", username: "buser" },
      ],
    }),
  );

  await openBlockedPanel(page);

  await expect(page.getByText("auser")).toBeVisible();
  await expect(page.getByText("buser")).toBeVisible();
});

test("email_girip_engelleyince_listeye_eklenir", async ({ page }) => {
  await login(page);
  let blocked: Array<{ email: string; username: string }> = [];
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: blocked }),
  );
  await page.route("**/users/block", (route) => {
    blocked = [{ email: "kotu@koqep.local", username: "kotuuser" }];
    return route.fulfill({ json: { ok: true } });
  });

  await openBlockedPanel(page);
  await page.getByLabel("email").fill("kotu@koqep.local");
  await page.getByRole("button", { name: "block", exact: true }).click();

  await expect(page.getByText("kotuuser")).toBeVisible();
  await expect(page.getByLabel("email")).toHaveValue("");
});

test("bilinmeyen_email_engellenemez_hata_gosterir", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/users/block", (route) =>
    route.fulfill({
      status: 404,
      json: { message: "Kullanıcı bulunamadı." },
    }),
  );

  await openBlockedPanel(page);
  await page.getByLabel("email").fill("yok@koqep.local");
  await page.getByRole("button", { name: "block", exact: true }).click();

  await expect(page.getByText("Kullanıcı bulunamadı.")).toBeVisible();
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();
});

test("engeli_kaldirinca_listeden_cikar", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({
      json: [{ email: "kotu@koqep.local", username: "kotuuser" }],
    }),
  );
  await page.route("**/users/unblock", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await openBlockedPanel(page);
  await expect(page.getByText("kotuuser")).toBeVisible();

  await page.getByRole("button", { name: "unblock" }).click();

  await expect(page.getByText("kotuuser")).toHaveCount(0);
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();
});

test("kapat_butonu_sohbet_ekranina_doner", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await openBlockedPanel(page);
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();

  await page.getByRole("button", { name: "close" }).click();

  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
});

// M10 Faz 2 Slice A: panel artık gerçek bir overlay (SidePanel) - arka plan
// (oda butonları dahil) panel açıkken `inert`, yani etkileşimsiz. Eski
// davranış (arka plandaki bir butona basınca panelin SESSİZCE kapanıp
// context değiştirmesi) BİLEREK kaldırıldı - bu, standart modal/dialog
// semantiğiyle örtüşüyor (arka plana tıklamak dialog'u KAPATMAZ, sadece
// backdrop/Escape/kendi kapat butonu kapatır). Testler bu YENİ, doğru
// davranışı doğruluyor.
test("panel_acikken_arka_plandaki_oda_butonu_etkilesimsiz_panel_acik_kalir", async ({
  page,
}) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await openBlockedPanel(page);
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();

  // Arka plandaki oda butonu artık inert sarmalayıcının İÇİNDE (sidebar
  // Slice B'de TopBar+aside+ChatPanel'i saran AYNI div'in içinde) - gerçek
  // bir tıklama denemek (Playwright'ın actionability beklemesi yüzünden)
  // yavaş/kırılgan olurdu, doğrudan inert attribute'unun DOM'da olduğunu
  // doğrulamak side-panel.spec.ts'in genel mekanizma testiyle AYNI, daha
  // hızlı desen.
  await expect(page.locator("[inert]")).toHaveCount(1);
  await expect(
    page.locator("[inert]").getByRole("button", { name: "#test-oda" }),
  ).toBeVisible();
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();

  // Panel sadece kendi kapat yoluyla (Escape/backdrop/close butonu) kapanır.
  await page.keyboard.press("Escape");
  await expect(page.getByText("you haven't blocked anyone yet")).toHaveCount(0);
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
});

test("bir_panelden_digerine_gecmek_icin_once_kapatmak_gerekir", async ({
  page,
}) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "two-factor authentication" }).click();
  await expect(
    page.getByRole("button", { name: "start setup" }),
  ).toBeVisible();

  // "account ▾" tetikleyicisi de arka planda (aynı inert sarmalayıcının
  // İÇİNDE) - TOTP paneli açıkken TIKLANAMAZ (dolayısıyla menü açılıp
  // "blocked" öğesi DOM'a hiç render edilemez), panel değişmez.
  await expect(
    page.locator("[inert]").getByRole("button", { name: "account" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "start setup" }),
  ).toHaveCount(0);

  await openBlockedPanel(page);
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();
});
