import { test, expect } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

test("oda_duyurusu_varsa_banner_gorunur_ve_icindeki_link_tiklanabilir", async ({
  page,
}) => {
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [
        {
          id: "room-1",
          name: "test-oda",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
          announcement: "bkz. https://koqep.dev/kurallar",
        },
      ],
    }),
  );
  await login(page);

  await expect(page.getByText("announcement:")).toBeVisible();
  await expect(page.getByText("bkz.", { exact: false })).toBeVisible();
  const link = page.getByRole("link", { name: "https://koqep.dev/kurallar" });
  await expect(link).toHaveAttribute("href", "https://koqep.dev/kurallar");
});

test("oda_duyurusu_yoksa_banner_gorunmez", async ({ page }) => {
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [
        {
          id: "room-1",
          name: "test-oda",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
          announcement: null,
        },
      ],
    }),
  );
  await login(page);

  await expect(page.getByText("announcement:")).toHaveCount(0);
});
