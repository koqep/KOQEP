import { test, expect } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

test("yeni_oda_olusturunca_switchera_eklenir_ve_otomatik_secilir", async ({
  page,
}) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as {
        name: string;
        description?: string;
      };
      await route.fulfill({
        status: 201,
        json: {
          id: "room-yeni",
          name: body.name,
          description: body.description ?? null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
        },
      });
      return;
    }
    await route.fulfill({
      json: [
        {
          id: "room-general",
          name: "general",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
        },
      ],
    });
  });
  await page.route("**/rooms/*/messages", async (route) => {
    const url = new URL(route.request().url());
    const roomName = url.pathname.split("/")[2];
    await route.fulfill({
      json: {
        messages:
          roomName === "general"
            ? [
                {
                  id: "msg-general",
                  content: "genel odasindaki mesaj",
                  createdAt: new Date().toISOString(),
                  authorUsername: null,
                  roomId: "room-general",
                },
              ]
            : [],
        nextCursor: null,
      },
    });
  });

  await page.goto("/");

  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByText("genel odasindaki mesaj")).toBeVisible();

  await page.getByRole("button", { name: "+ new room" }).click();
  await page.getByLabel("room name").fill("elden-ring");
  await page.getByLabel("description (optional)").fill("Elden Ring tartışması");
  await page.getByRole("button", { name: "create" }).click();

  const newRoomButton = page.getByRole("button", { name: "#elden-ring" });
  await expect(newRoomButton).toBeVisible();
  await expect(newRoomButton).toHaveClass(/text-neutral-200/);
  await expect(page.getByText("genel odasindaki mesaj")).not.toBeVisible();
});

test("gunluk_limit_asilinca_hata_gosterilir", async ({ page }) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 429, json: {} });
      return;
    }
    await route.fulfill({
      json: [
        {
          id: "room-general",
          name: "general",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
        },
      ],
    });
  });
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "+ new room" }).click();
  await page.getByLabel("room name").fill("baska-oda");
  await page.getByRole("button", { name: "create" }).click();

  await expect(
    page.getByText("You can create at most 1 room per day. Try again later."),
  ).toBeVisible();
});
