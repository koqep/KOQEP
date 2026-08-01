import { test, expect } from "@playwright/test";

test("yeni_oda_olusturunca_switchera_eklenir_ve_otomatik_secilir", async ({
  page,
}) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    }),
  );
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

  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();

  await expect(page.getByText("genel odasindaki mesaj")).toBeVisible();

  await page.getByRole("button", { name: "+ yeni oda" }).click();
  await page.getByLabel("oda adı").fill("elden-ring");
  await page.getByLabel("açıklama (opsiyonel)").fill("Elden Ring tartışması");
  await page.getByRole("button", { name: "oluştur" }).click();

  const newRoomButton = page.getByRole("button", { name: "#elden-ring" });
  await expect(newRoomButton).toBeVisible();
  await expect(newRoomButton).toHaveClass(/text-neutral-200/);
  await expect(page.getByText("genel odasindaki mesaj")).not.toBeVisible();
});

test("gunluk_limit_asilinca_hata_gosterilir", async ({ page }) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    }),
  );
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
        },
      ],
    });
  });
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();

  await page.getByRole("button", { name: "+ yeni oda" }).click();
  await page.getByLabel("oda adı").fill("baska-oda");
  await page.getByRole("button", { name: "oluştur" }).click();

  await expect(
    page.getByText("Günde en fazla 1 oda oluşturabilirsin. Daha sonra tekrar dene."),
  ).toBeVisible();
});
