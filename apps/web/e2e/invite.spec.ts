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

test("gosters_bos_durum_sonra_olusturunca_koda_ekler", async ({ page }) => {
  await login(page);
  let callCount = 0;
  await page.route("**/invites", async (route) => {
    callCount += 1;
    await route.fulfill({ json: { code: `INVITE-${callCount}` } });
  });

  await page.getByRole("button", { name: "invites" }).click();

  await expect(page.getByText("no invites yet")).toBeVisible();

  await page.getByRole("button", { name: "create invite" }).click();
  await expect(page.getByText("INVITE-1")).toBeVisible();

  await page.getByRole("button", { name: "create invite" }).click();
  await expect(page.getByText("INVITE-2")).toBeVisible();
  await expect(page.getByText("INVITE-1")).toBeVisible();
});

test("hiz_limiti_asilinca_dostane_mesaj_gosterir", async ({ page }) => {
  await login(page);
  await page.route("**/invites", (route) =>
    route.fulfill({
      status: 429,
      json: { statusCode: 429, message: "ThrottlerException: Too Many Requests" },
    }),
  );

  await page.getByRole("button", { name: "invites" }).click();
  await page.getByRole("button", { name: "create invite" }).click();

  await expect(
    page.getByText("You can create up to 5 invites per hour."),
  ).toBeVisible();
  await expect(page.getByText("ThrottlerException")).toHaveCount(0);
});
