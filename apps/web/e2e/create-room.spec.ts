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

  await page.goto("/app");

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

// M11c Slice B: opsiyonel şifre alanı.
test("sifre_ile_oda_olusturur", async ({ page }) => {
  await mockAuthSuccess(page);
  let postedBody: { name: string; password?: string } | undefined;
  await page.route("**/rooms", async (route) => {
    if (route.request().method() === "POST") {
      postedBody = route.request().postDataJSON() as {
        name: string;
        password?: string;
      };
      await route.fulfill({
        status: 201,
        json: {
          id: "room-gizli",
          name: postedBody.name,
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
          hasPassword: true,
        },
      });
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "+ new room" }).click();
  await page.getByLabel("room name").fill("gizli-oda");
  await page.getByLabel("password (optional)").fill("oda-sifresi-123");
  await page.getByRole("button", { name: "create" }).click();

  await expect(page.getByRole("button", { name: "#gizli-oda" })).toBeVisible();
  expect(postedBody?.password).toBe("oda-sifresi-123");
});

test("kisa_sifre_client_tarafinda_reddedilir_api_cagrilmaz", async ({
  page,
}) => {
  await mockAuthSuccess(page);
  let postCount = 0;
  await page.route("**/rooms", async (route) => {
    if (route.request().method() === "POST") {
      postCount++;
      await route.fulfill({ status: 201, json: {} });
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "+ new room" }).click();
  await page.getByLabel("room name").fill("kisa-sifreli-oda");
  await page.getByLabel("password (optional)").fill("kisa");
  await page.getByRole("button", { name: "create" }).click();

  await expect(
    page.getByText("Room password must be at least 8 characters."),
  ).toBeVisible();
  expect(postCount).toBe(0);
});

test("gunluk_limit_asilinca_hata_gosterilir", async ({ page }) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 429,
        json: {
          code: "RATE_LIMITED",
          message: "Çok fazla istek gönderdin, biraz sonra tekrar dene.",
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
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/app");
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

test("ayni_isimde_oda_varsa_hata_gosterilir", async ({ page }) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 409,
        json: {
          code: "ROOM_NAME_TAKEN",
          message: "Bu isimde bir oda zaten var.",
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
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "+ new room" }).click();
  await page.getByLabel("room name").fill("general");
  await page.getByRole("button", { name: "create" }).click();

  await expect(
    page.getByText("A room with this name already exists."),
  ).toBeVisible();
});
