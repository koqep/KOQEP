import { test, expect } from "@playwright/test";

test("oda_adi_ve_gecmis_mesaj_api_yanitindan_render_edilir", async ({
  page,
}) => {
  await page.route("**/auth/dev-login", (route) =>
    route.fulfill({ json: { accessToken: "fake-token" } }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({ json: [{ id: "room-1", name: "test-oda" }] }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({
      json: {
        messages: [
          {
            id: "msg-1",
            content: "merhaba dünya",
            createdAt: new Date().toISOString(),
            authorEmail: null,
          },
        ],
        nextCursor: null,
      },
    }),
  );

  await page.goto("/");

  await expect(page.getByRole("heading")).toContainText("test-oda");
  await expect(page.getByText("merhaba dünya")).toBeVisible();
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
});
