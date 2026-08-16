import { test, expect } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

function room(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "room-elden-ring",
    name: "elden-ring",
    description: "boss rush",
    lastActivityAt: new Date().toISOString(),
    status: "active",
    ...overrides,
  };
}

test("odalari_kesfet_acilinca_uye_olunmayan_aktif_odalar_listelenir_katilinca_switchera_eklenir", async ({
  page,
}) => {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: {
        email: "test@koqep.local",
        username: "test",
        role: "user",
        mutedUntil: null,
      },
    }),
  );
  // Bare "/rooms" (sorgu YOK) - switcher'ın kendi "benim odalarım" bootstrap
  // çağrısı, "/rooms?scope=discoverable" ile AYNI URL'in başka bir path'i
  // değil, ayrı bir route.
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [
        {
          id: "room-general",
          name: "general",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
        },
      ],
    }),
  );
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
  await page.route(
    (url) =>
      url.pathname.endsWith("/rooms") &&
      url.searchParams.get("scope") === "discoverable",
    (route) =>
      route.fulfill({ json: { rooms: [room()], nextCursor: null } }),
  );
  let joinedRoomId: string | undefined;
  await page.route("**/rooms/room-elden-ring/join", async (route) => {
    joinedRoomId = "room-elden-ring";
    await route.fulfill({ json: room() });
  });

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();

  await page.getByRole("button", { name: "keşfet" }).click();
  await expect(page.getByText("#elden-ring — boss rush")).toBeVisible();

  await page.getByRole("button", { name: "katıl" }).click();

  await expect(page.getByRole("button", { name: "#elden-ring" })).toBeVisible();
  expect(joinedRoomId).toBe("room-elden-ring");
});

test("kesif_listesi_daha_fazla_goster_ile_sayfalanir", async ({ page }) => {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: {
        email: "test@koqep.local",
        username: "test",
        role: "user",
        mutedUntil: null,
      },
    }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [
        {
          id: "room-general",
          name: "general",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
        },
      ],
    }),
  );
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
  let secondPageRequested = false;
  await page.route(
    (url) =>
      url.pathname.endsWith("/rooms") &&
      url.searchParams.get("scope") === "discoverable",
    async (route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor");
      if (!cursor) {
        await route.fulfill({
          json: {
            rooms: [room({ id: "room-1", name: "oda-1" })],
            nextCursor: "oda-1",
          },
        });
        return;
      }
      expect(cursor).toBe("oda-1");
      secondPageRequested = true;
      await route.fulfill({
        json: {
          rooms: [room({ id: "room-2", name: "oda-2" })],
          nextCursor: null,
        },
      });
    },
  );

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();

  await page.getByRole("button", { name: "keşfet" }).click();
  await expect(page.getByText("#oda-1", { exact: false })).toBeVisible();
  await expect(page.getByText("#oda-2", { exact: false })).toHaveCount(0);

  const loadMoreButton = page.getByRole("button", {
    name: "daha fazla göster",
  });
  await expect(loadMoreButton).toBeVisible();
  await loadMoreButton.click();

  await expect(page.getByText("#oda-2", { exact: false })).toBeVisible();
  expect(secondPageRequested).toBe(true);
  await expect(loadMoreButton).toHaveCount(0);
});

test("cekirdek_olmayan_bir_odadan_switcher_uzerinden_ayrilinabilir_cekirdek_odada_ayril_butonu_yok", async ({
  page,
}) => {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: {
        email: "test@koqep.local",
        username: "test",
        role: "user",
        mutedUntil: null,
      },
    }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [
        {
          id: "room-general",
          name: "general",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
        },
        room(),
      ],
    }),
  );
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
  let leaveCalled = false;
  await page.route("**/rooms/room-elden-ring/leave", async (route) => {
    leaveCalled = true;
    await route.fulfill({ json: { ok: true } });
  });

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();

  const generalRoomButton = page.getByRole("button", { name: "#general" });
  const eldenRingButton = page.getByRole("button", { name: "#elden-ring" });
  await expect(generalRoomButton).toBeVisible();
  await expect(eldenRingButton).toBeVisible();

  // Çekirdek oda (general) "ayrıl" affordance'ı GÖSTERMEZ - backend'in
  // kendi ForbiddenException reddiyle simetrik bir frontend kararı.
  await expect(
    generalRoomButton.locator("..").getByTitle("odadan ayrıl"),
  ).toHaveCount(0);

  const leaveButton = eldenRingButton
    .locator("..")
    .getByTitle("odadan ayrıl");
  await expect(leaveButton).toBeVisible();
  await leaveButton.click();

  expect(leaveCalled).toBe(true);
  await expect(eldenRingButton).toHaveCount(0);
});
