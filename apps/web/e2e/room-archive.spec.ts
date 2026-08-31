import { test, expect } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

test("arsivi_goster_toggle_ile_arsivlenmis_oda_gorunur_ve_salt_okunur_composer_gosterir", async ({
  page,
}) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms*", async (route) => {
    const url = new URL(route.request().url());
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const rooms = [
      { id: "room-general", name: "general", status: "active" },
      ...(includeArchived
        ? [{ id: "room-eski", name: "eski-oda", status: "archived" }]
        : []),
    ];
    await route.fulfill({ json: rooms });
  });
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "#eski-oda" }),
  ).not.toBeVisible();

  await page.getByRole("button", { name: "show archived" }).click();

  const archivedButton = page.getByRole("button", {
    name: "#eski-oda (archived)",
  });
  await expect(archivedButton).toBeVisible();

  await archivedButton.click();

  await expect(page.getByText("this room is archived, read-only")).toBeVisible();
  await expect(page.getByPlaceholder("write a message...")).not.toBeVisible();
});
