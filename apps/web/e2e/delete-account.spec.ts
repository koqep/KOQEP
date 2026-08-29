import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

// M10 Faz 2 Slice B: "delete account" artık TopBar'ın "account ▾" açılır
// menüsünün İÇİNDE - önce menüyü açmak gerekiyor.
async function openDeleteAccountPanel(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "delete account" }).click();
}

test("panel_acilir_onay_adimindan_sonra_form_gorunur", async ({ page }) => {
  await login(page);

  await openDeleteAccountPanel(page);
  await expect(page.getByText("This is permanent")).toHaveCount(0);

  await page.getByRole("button", { name: "delete my account" }).click();
  await expect(page.getByLabel("current password")).toBeVisible();
});

test("yanlis_sifre_hata_gosterir", async ({ page }) => {
  await login(page);
  await page.route("**/auth/delete-account", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "INVALID_CREDENTIALS", message: "Şifre hatalı." },
    }),
  );

  await openDeleteAccountPanel(page);
  await page.getByRole("button", { name: "delete my account" }).click();
  await page.getByLabel("current password").fill("wrong-password");
  await page
    .getByRole("button", { name: "permanently delete my account" })
    .click();

  await expect(page.getByText("Incorrect password.")).toBeVisible();
});

test("totp_gerekince_alan_belirir", async ({ page }) => {
  await login(page);
  await page.route("**/auth/delete-account", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "TOTP_REQUIRED", message: "Geçerli bir TOTP kodu gerekli." },
    }),
  );

  await openDeleteAccountPanel(page);
  await page.getByRole("button", { name: "delete my account" }).click();
  await page.getByLabel("current password").fill("a-strong-password");
  await page
    .getByRole("button", { name: "permanently delete my account" })
    .click();

  await expect(page.getByLabel("authenticator code")).toBeVisible();
});

test("basarili_silme_giris_ekranina_doner", async ({ page }) => {
  await login(page);
  await page.route("**/auth/delete-account", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await openDeleteAccountPanel(page);
  await page.getByRole("button", { name: "delete my account" }).click();
  await page.getByLabel("current password").fill("a-strong-password");
  await page
    .getByRole("button", { name: "permanently delete my account" })
    .click();

  await expect(page.getByLabel("email")).toBeVisible();
  await expect(page.getByPlaceholder("write a message...")).toHaveCount(0);
});

// M6c Slice B (ADR-0005 Addendum #2): checkbox varsayılan işaretli geliyor,
// istekle birlikte redactMessageContent:true gönderiliyor.
test("mesaj_icerigini_kaldir_kutusu_varsayilan_isaretli_ve_istekte_true_gonderilir", async ({
  page,
}) => {
  await login(page);
  let requestBody: unknown;
  await page.route("**/auth/delete-account", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });

  await openDeleteAccountPanel(page);
  await page.getByRole("button", { name: "delete my account" }).click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.getByLabel("current password").fill("a-strong-password");
  await page
    .getByRole("button", { name: "permanently delete my account" })
    .click();

  await expect(page.getByLabel("email")).toBeVisible();
  expect(
    (requestBody as { redactMessageContent?: boolean })
      .redactMessageContent,
  ).toBe(true);
});

test("mesaj_icerigini_kaldir_kutusu_isareti_kaldirilinca_istekte_false_gonderilir", async ({
  page,
}) => {
  await login(page);
  let requestBody: unknown;
  await page.route("**/auth/delete-account", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });

  await openDeleteAccountPanel(page);
  await page.getByRole("button", { name: "delete my account" }).click();
  await page.getByRole("checkbox").uncheck();
  await page.getByLabel("current password").fill("a-strong-password");
  await page
    .getByRole("button", { name: "permanently delete my account" })
    .click();

  await expect(page.getByLabel("email")).toBeVisible();
  expect(
    (requestBody as { redactMessageContent?: boolean })
      .redactMessageContent,
  ).toBe(false);
});
