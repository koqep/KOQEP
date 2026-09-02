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

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "explore" }).click();
  await expect(page.getByText("#elden-ring — boss rush")).toBeVisible();

  await page.getByRole("button", { name: "join" }).click();

  await expect(page.getByRole("button", { name: "#elden-ring" })).toBeVisible();
  expect(joinedRoomId).toBe("room-elden-ring");
});

// M11c Slice B: şifreli oda göstergesi + inline şifre formu.
test("sifreli_oda_gostergeyle_gorunur", async ({ page }) => {
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
  await page.route("**/rooms", (route) => route.fulfill({ json: [] }));
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
  await page.route(
    (url) =>
      url.pathname.endsWith("/rooms") &&
      url.searchParams.get("scope") === "discoverable",
    (route) =>
      route.fulfill({
        json: { rooms: [room({ hasPassword: true })], nextCursor: null },
      }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "explore" }).click();
  await expect(page.getByText("password protected")).toBeVisible();
});

test("sifreli_odada_join_dogrudan_katilmiyor_sifre_formu_aciyor", async ({
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
  await page.route("**/rooms", (route) => route.fulfill({ json: [] }));
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
  await page.route(
    (url) =>
      url.pathname.endsWith("/rooms") &&
      url.searchParams.get("scope") === "discoverable",
    (route) =>
      route.fulfill({
        json: { rooms: [room({ hasPassword: true })], nextCursor: null },
      }),
  );
  let joinCalled = false;
  await page.route("**/rooms/room-elden-ring/join", async (route) => {
    joinCalled = true;
    await route.fulfill({ json: room({ hasPassword: true }) });
  });

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "explore" }).click();
  await page.getByRole("button", { name: "join" }).click();

  await expect(page.getByLabel("password", { exact: true })).toBeVisible();
  expect(joinCalled).toBe(false);
});

test("yanlis_sifreyle_hata_gosterir_form_acik_kalir", async ({ page }) => {
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
  await page.route("**/rooms", (route) => route.fulfill({ json: [] }));
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
  await page.route(
    (url) =>
      url.pathname.endsWith("/rooms") &&
      url.searchParams.get("scope") === "discoverable",
    (route) =>
      route.fulfill({
        json: { rooms: [room({ hasPassword: true })], nextCursor: null },
      }),
  );
  await page.route("**/rooms/room-elden-ring/join", (route) =>
    route.fulfill({ status: 401, json: { message: "Şifre hatalı." } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "explore" }).click();
  await page.getByRole("button", { name: "join" }).click();
  await page.getByLabel("password", { exact: true }).fill("yanlis-sifre");
  await page.getByRole("button", { name: "join", exact: true }).click();

  await expect(page.getByText("Şifre hatalı.")).toBeVisible();
  await expect(page.getByLabel("password", { exact: true })).toBeVisible();
});

test("dogru_sifreyle_katilir", async ({ page }) => {
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
  await page.route("**/rooms", (route) => route.fulfill({ json: [] }));
  await page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
  await page.route(
    (url) =>
      url.pathname.endsWith("/rooms") &&
      url.searchParams.get("scope") === "discoverable",
    (route) =>
      route.fulfill({
        json: { rooms: [room({ hasPassword: true })], nextCursor: null },
      }),
  );
  let joinedRoomId: string | undefined;
  await page.route("**/rooms/room-elden-ring/join", async (route) => {
    joinedRoomId = "room-elden-ring";
    await route.fulfill({ json: room({ hasPassword: true }) });
  });

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "explore" }).click();
  await page.getByRole("button", { name: "join" }).click();
  await page.getByLabel("password", { exact: true }).fill("dogru-sifre");
  await page.getByRole("button", { name: "join", exact: true }).click();

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

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await page.getByRole("button", { name: "explore" }).click();
  await expect(page.getByText("#oda-1", { exact: false })).toBeVisible();
  await expect(page.getByText("#oda-2", { exact: false })).toHaveCount(0);

  const loadMoreButton = page.getByRole("button", {
    name: "show more",
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

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  const generalRoomButton = page.getByRole("button", { name: "#general" });
  const eldenRingButton = page.getByRole("button", { name: "#elden-ring" });
  await expect(generalRoomButton).toBeVisible();
  await expect(eldenRingButton).toBeVisible();

  // Çekirdek oda (general) "ayrıl" affordance'ı GÖSTERMEZ - backend'in
  // kendi ForbiddenException reddiyle simetrik bir frontend kararı.
  await expect(
    generalRoomButton.locator("..").getByTitle("leave room"),
  ).toHaveCount(0);

  const leaveButton = eldenRingButton
    .locator("..")
    .getByTitle("leave room");
  await expect(leaveButton).toBeVisible();
  await leaveButton.click();

  expect(leaveCalled).toBe(true);
  await expect(eldenRingButton).toHaveCount(0);
});
