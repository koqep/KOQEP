import { test, expect } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

test("daha_eski_mesajlari_yukle_butonu_calisir_ve_tukenince_kaybolur", async ({
  page,
}) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "test-oda", status: "active" }],
    }),
  );

  let secondPageRequested = false;
  await page.route("**/rooms/*/messages*", async (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("cursor");

    if (!cursor) {
      await route.fulfill({
        json: {
          messages: [
            {
              id: "msg-2",
              content: "yeni-mesaj",
              createdAt: "2026-01-01T00:00:02.000Z",
              authorUsername: null,
              roomId: "room-1",
            },
          ],
          nextCursor: "cursor-1",
        },
      });
      return;
    }

    expect(cursor).toBe("cursor-1");
    secondPageRequested = true;
    await route.fulfill({
      json: {
        messages: [
          {
            id: "msg-1",
            content: "eski-mesaj",
            createdAt: "2026-01-01T00:00:01.000Z",
            authorUsername: null,
            roomId: "room-1",
          },
        ],
        nextCursor: null,
      },
    });
  });

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByText("yeni-mesaj")).toBeVisible();
  const loadOlderButton = page.getByRole("button", {
    name: "load older messages",
  });
  await expect(loadOlderButton).toBeVisible();
  await expect(page.getByText("eski-mesaj")).toHaveCount(0);

  await loadOlderButton.click();

  await expect(page.getByText("eski-mesaj")).toBeVisible();
  expect(secondPageRequested).toBe(true);
  await expect(page.getByText("yeni-mesaj")).toBeVisible();
  await expect(loadOlderButton).toHaveCount(0);
});
