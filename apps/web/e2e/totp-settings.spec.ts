import { test, expect } from "@playwright/test";
import {
  mockAuthSuccess,
  mockAuthRefreshUnavailable,
  mockRoomEndpoints,
} from "./support/auth-mocks";

async function loginWithoutTotp(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

// M10 Faz 2 Slice B: "two-factor authentication" artık TopBar'ın
// "account ▾" açılır menüsünün İÇİNDE - önce menüyü açmak gerekiyor.
async function openTotpPanel(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "two-factor authentication" }).click();
}

async function loginWithTotpEnabled(page: import("@playwright/test").Page) {
  let loginCallCount = 0;
  await page.route("**/auth/login", (route) => {
    loginCallCount += 1;
    if (loginCallCount === 1) {
      return route.fulfill({
        status: 401,
        json: {
          code: "TOTP_REQUIRED",
          message: "Geçerli bir TOTP kodu gerekli.",
        },
      });
    }
    return route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    });
  });
  await mockAuthRefreshUnavailable(page);
  await mockRoomEndpoints(page);

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await page.getByLabel("totp code").fill("123456");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

test("totp_kapaliyken_panel_kurulum_baslat_gosterir", async ({ page }) => {
  await loginWithoutTotp(page);

  await openTotpPanel(page);

  await expect(
    page.getByRole("button", { name: "start setup" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "turn off TOTP" }),
  ).toHaveCount(0);
});

test("kurulum_baslatinca_secret_ve_qr_ve_kod_alani_gorunur", async ({
  page,
}) => {
  await loginWithoutTotp(page);
  await page.route("**/auth/totp/setup", (route) =>
    route.fulfill({
      json: {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl:
          "otpauth://totp/KOQEP:test%40koqep.local?secret=JBSWY3DPEHPK3PXP&issuer=KOQEP",
      },
    }),
  );

  await openTotpPanel(page);
  await page.getByRole("button", { name: "start setup" }).click();

  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
  await expect(page.getByLabel("totp code")).toBeVisible();
  const qrImage = page.getByAltText("TOTP QR code");
  await expect(qrImage).toBeVisible();
  await expect(qrImage).toHaveAttribute("src", /^data:image\//);
});

test("dogru_kodla_etkinlestirince_kurtarma_kodlari_gosterilir_sonra_kapat_formuna_gecer", async ({
  page,
}) => {
  await loginWithoutTotp(page);
  await page.route("**/auth/totp/setup", (route) =>
    route.fulfill({
      json: {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl: "otpauth://totp/KOQEP:test%40koqep.local?secret=JBSWY3DPEHPK3PXP",
      },
    }),
  );
  const recoveryCodes = Array.from(
    { length: 8 },
    (_, index) => `aaaaaa-${index}00000`,
  );
  await page.route("**/auth/totp/enable", (route) =>
    route.fulfill({ json: recoveryCodes }),
  );

  await openTotpPanel(page);
  await page.getByRole("button", { name: "start setup" }).click();
  await page.getByLabel("totp code").fill("654321");
  await page.getByRole("button", { name: "enable" }).click();

  await expect(
    page.getByText("These codes won't be shown again."),
  ).toBeVisible();
  for (const code of recoveryCodes) {
    await expect(page.getByText(code)).toBeVisible();
  }

  await page.getByRole("button", { name: "saved it" }).click();

  await expect(
    page.getByRole("button", { name: "turn off TOTP" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "start setup" }),
  ).toHaveCount(0);
});

test("yanlis_kod_hata_gosterir_kurulum_yeniden_baslamaz", async ({ page }) => {
  await loginWithoutTotp(page);
  await page.route("**/auth/totp/setup", (route) =>
    route.fulfill({
      json: {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl: "otpauth://totp/KOQEP:test%40koqep.local?secret=JBSWY3DPEHPK3PXP",
      },
    }),
  );
  await page.route("**/auth/totp/enable", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Geçersiz TOTP kodu." },
    }),
  );

  await openTotpPanel(page);
  await page.getByRole("button", { name: "start setup" }).click();
  await page.getByLabel("totp code").fill("000000");
  await page.getByRole("button", { name: "enable" }).click();

  await expect(page.getByText("Geçersiz TOTP kodu.")).toBeVisible();
  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "enable" }),
  ).toBeVisible();
});

test("totp_aciksa_panel_dogrudan_kapatma_formuna_gecer_basarili_kapatma_sonrasi_kurulum_baslat_doner", async ({
  page,
}) => {
  await loginWithTotpEnabled(page);
  await page.route("**/auth/totp/disable", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await openTotpPanel(page);

  await expect(
    page.getByRole("button", { name: "turn off TOTP" }),
  ).toBeVisible();
  await page.getByLabel("totp code").fill("654321");
  await page.getByRole("button", { name: "turn off TOTP" }).click();

  await expect(
    page.getByRole("button", { name: "start setup" }),
  ).toBeVisible();
});

test("kapat_butonu_sohbet_ekranina_doner", async ({ page }) => {
  await loginWithoutTotp(page);

  await openTotpPanel(page);
  await expect(
    page.getByRole("button", { name: "start setup" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "close" }).click();

  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
});
