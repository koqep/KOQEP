import { test, expect } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "test-oda", status: "active" }],
    }),
  );

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

test("kod_blogu_pre_olarak_render_edilir_cevresindeki_metin_etkilenmez", async ({
  page,
}) => {
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({
      json: {
        messages: [
          {
            id: "msg-1",
            content: "önce ```const x = 1;``` sonra",
            createdAt: "2026-01-01T00:00:00.000Z",
            authorUsername: null,
            roomId: "room-1",
          },
        ],
        nextCursor: null,
      },
    }),
  );

  await login(page);

  const codeBlock = page.locator("pre");
  await expect(codeBlock).toBeVisible();
  await expect(codeBlock).toHaveText("const x = 1;");
  await expect(page.getByText("önce", { exact: false })).toBeVisible();
  await expect(page.getByText("sonra", { exact: false })).toBeVisible();
});

test("bitmemis_kod_blogu_cokmez_kalan_metni_kod_olarak_gosterir", async ({
  page,
}) => {
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({
      json: {
        messages: [
          {
            id: "msg-1",
            content: "metin ```bitmemiş blok",
            createdAt: "2026-01-01T00:00:00.000Z",
            authorUsername: null,
            roomId: "room-1",
          },
        ],
        nextCursor: null,
      },
    }),
  );

  await login(page);

  await expect(page.getByText("metin", { exact: false })).toBeVisible();
  await expect(page.locator("pre")).toHaveText("bitmemiş blok");
});

test("backtick_icermeyen_mesaj_hic_pre_olusturmaz", async ({ page }) => {
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({
      json: {
        messages: [
          {
            id: "msg-1",
            content: "sıradan bir mesaj",
            createdAt: "2026-01-01T00:00:00.000Z",
            authorUsername: null,
            roomId: "room-1",
          },
        ],
        nextCursor: null,
      },
    }),
  );

  await login(page);

  await expect(page.getByText("sıradan bir mesaj")).toBeVisible();
  await expect(page.locator("pre")).toHaveCount(0);
});
