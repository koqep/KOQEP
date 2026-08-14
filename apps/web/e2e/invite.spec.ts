import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
}

test("henuz_kazanilmis_davet_yoksa_aciklayici_bos_durum_gosterir", async ({
  page,
}) => {
  await login(page);
  await page.route("**/invites", (route) => route.fulfill({ json: [] }));

  await page.getByRole("button", { name: "invites" }).click();

  await expect(
    page.getByText("henüz kazanılmış bir davetin yok"),
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

  await page.getByRole("button", { name: "invites" }).click();

  await expect(page.getByText("FRESH-CODE")).toBeVisible();
  await expect(page.getByText("USED-CODE")).toBeVisible();
  await expect(page.getByText("REVOKED-CODE")).toBeVisible();
  await expect(page.getByText("kullanılabilir")).toBeVisible();
  await expect(page.getByText("kullanıldı")).toBeVisible();
  await expect(page.getByText("iptal edildi")).toBeVisible();
});

test("davetci_hesap_verebilirligi_aciklama_satirini_gosterir", async ({
  page,
}) => {
  await login(page);
  await page.route("**/invites", (route) => route.fulfill({ json: [] }));

  await page.getByRole("button", { name: "invites" }).click();

  await expect(
    page.getByText("kullanılmamış bir davetin iptal edilir"),
  ).toBeVisible();
});
