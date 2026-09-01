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

// M10 Faz 2 Slice B: "invites" artık TopBar'ın "account ▾" açılır menüsünün
// İÇİNDE - önce menüyü açmak gerekiyor. M13 Slice B: artık "settings"
// panelinin İÇİNDE (role="button", role="menuitem" DEĞİL).
async function openInvitesPanel(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "settings" }).click();
  await page.getByRole("button", { name: "invites" }).click();
}

test("henuz_kazanilmis_davet_yoksa_aciklayici_bos_durum_gosterir", async ({
  page,
}) => {
  await login(page);
  await page.route("**/invites", (route) => route.fulfill({ json: [] }));

  await openInvitesPanel(page);

  await expect(
    page.getByText("you haven't earned any invites yet"),
  ).toBeVisible();
});

test("kazanilan_davetleri_kod_ve_durumuyla_listeler", async ({ page }) => {
  await login(page);
  await page.route("**/invites", (route) =>
    route.fulfill({
      json: [
        {
          code: "USED-CODE",
          createdAt: "2026-08-01T00:00:00.000Z",
          usedAt: "2026-08-02T00:00:00.000Z",
          revokedAt: null,
        },
        {
          code: "FRESH-CODE",
          createdAt: "2026-08-03T00:00:00.000Z",
          usedAt: null,
          revokedAt: null,
        },
        {
          code: "REVOKED-CODE",
          createdAt: "2026-08-04T00:00:00.000Z",
          usedAt: null,
          revokedAt: "2026-08-05T00:00:00.000Z",
        },
      ],
    }),
  );

  await openInvitesPanel(page);

  await expect(page.getByText("FRESH-CODE")).toBeVisible();
  await expect(page.getByText("USED-CODE")).toBeVisible();
  await expect(page.getByText("REVOKED-CODE")).toBeVisible();
  await expect(page.getByText("available", { exact: true })).toBeVisible();
  await expect(page.getByText("used", { exact: true })).toBeVisible();
  await expect(page.getByText("revoked", { exact: true })).toBeVisible();
});

test("davetci_hesap_verebilirligi_aciklama_satirini_gosterir", async ({
  page,
}) => {
  await login(page);
  await page.route("**/invites", (route) => route.fulfill({ json: [] }));

  await openInvitesPanel(page);

  await expect(
    page.getByText("one of your unused invites gets revoked"),
  ).toBeVisible();
});
