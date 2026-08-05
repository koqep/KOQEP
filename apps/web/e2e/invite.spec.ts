import { test, expect } from "@playwright/test";

async function mockRoomEndpoints(page: import("@playwright/test").Page) {
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "test-oda", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
}

async function login(page: import("@playwright/test").Page) {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    }),
  );
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
        { code: "USED-CODE", createdAt: "2026-08-01T00:00:00.000Z", usedAt: "2026-08-02T00:00:00.000Z" },
        { code: "FRESH-CODE", createdAt: "2026-08-03T00:00:00.000Z", usedAt: null },
      ],
    }),
  );

  await page.getByRole("button", { name: "invites" }).click();

  await expect(page.getByText("FRESH-CODE")).toBeVisible();
  await expect(page.getByText("USED-CODE")).toBeVisible();
  await expect(page.getByText("kullanılabilir")).toBeVisible();
  await expect(page.getByText("kullanıldı")).toBeVisible();
});
