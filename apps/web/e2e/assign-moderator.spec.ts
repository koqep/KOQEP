import { test, expect, type Page } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

async function login(page: Page) {
  await mockAuthSuccess(page);
  await page.route("**/rooms*", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "general", status: "active" }],
    }),
  );
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: {
        email: "test@koqep.local",
        username: "test",
        role: "moderator",
        mutedUntil: null,
      },
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
  await page.route("**/moderation/reports", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await page.getByRole("button", { name: "moderation" }).click();
}

test("moderator_panelinde_ata_ve_kaldir_formlari_gorunur", async ({
  page,
}) => {
  await login(page);

  await expect(
    page.getByRole("button", { name: "assign", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "revoke", exact: true }),
  ).toBeVisible();
});

test("dogru_bilgilerle_atama_basari_mesaji_gosterir", async ({ page }) => {
  await login(page);
  let assignBody: unknown;
  await page.route("**/moderation/users/assign-moderator", async (route) => {
    assignBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        id: "user-2",
        email: "yeni@koqep.local",
        role: "moderator",
        alreadyModerator: false,
      },
    });
  });

  await page.getByLabel("email", { exact: true }).first().fill("yeni@koqep.local");
  await page.getByLabel("your password").fill("a-strong-password");
  await page.getByRole("button", { name: "assign", exact: true }).click();

  await expect(page.getByText("moderator assigned")).toBeVisible();
  expect(assignBody).toEqual({
    email: "yeni@koqep.local",
    password: "a-strong-password",
    totpCode: undefined,
  });
});

test("yanlis_sifre_atamada_hata_gosterir", async ({ page }) => {
  await login(page);
  await page.route("**/moderation/users/assign-moderator", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "INVALID_CREDENTIALS", message: "Şifre hatalı." },
    }),
  );

  await page.getByLabel("email", { exact: true }).first().fill("yeni@koqep.local");
  await page.getByLabel("your password").fill("wrong-password");
  await page.getByRole("button", { name: "assign", exact: true }).click();

  await expect(page.getByText("Şifre hatalı.")).toBeVisible();
});

test("totp_gerekince_alan_belirir", async ({ page }) => {
  await login(page);
  await page.route("**/moderation/users/assign-moderator", (route) =>
    route.fulfill({
      status: 401,
      json: {
        code: "TOTP_REQUIRED",
        message: "Geçerli bir TOTP kodu gerekli.",
      },
    }),
  );

  await expect(page.getByLabel("totp code")).toHaveCount(0);
  await page.getByLabel("email", { exact: true }).first().fill("yeni@koqep.local");
  await page.getByLabel("your password").fill("a-strong-password");
  await page.getByRole("button", { name: "assign", exact: true }).click();

  await expect(page.getByLabel("totp code")).toBeVisible();
});

test("kaldirma_email_girip_submit_edince_basari_mesaji_gosterir", async ({
  page,
}) => {
  await login(page);
  let revokeBody: unknown;
  await page.route("**/moderation/users/revoke-moderator", async (route) => {
    revokeBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        id: "user-2",
        email: "eski@koqep.local",
        role: "user",
        wasNotModerator: false,
      },
    });
  });

  await page.getByLabel("email", { exact: true }).last().fill("eski@koqep.local");
  await page.getByRole("button", { name: "revoke", exact: true }).click();

  await expect(page.getByText("moderator role revoked")).toBeVisible();
  expect(revokeBody).toEqual({ email: "eski@koqep.local" });
});
