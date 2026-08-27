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

function mockMessage(page: import("@playwright/test").Page, content: string) {
  return page.route("**/rooms/*/messages*", (route) =>
    route.fulfill({
      json: {
        messages: [
          {
            id: "msg-1",
            content,
            createdAt: "2026-01-01T00:00:00.000Z",
            authorUsername: null,
            roomId: "room-1",
          },
        ],
        nextCursor: null,
      },
    }),
  );
}

test("url_iceren_mesaj_tiklanabilir_link_olarak_render_edilir_yeni_sekmede_acilir", async ({
  page,
}) => {
  await mockMessage(page, "bkz. https://koqep.dev/rehber devam");
  await login(page);

  const link = page.getByRole("link", { name: "https://koqep.dev/rehber" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://koqep.dev/rehber");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByText("bkz.", { exact: false })).toBeVisible();
  await expect(page.getByText("devam", { exact: false })).toBeVisible();
});

test("url_sonundaki_noktalama_href_e_dahil_edilmez", async ({ page }) => {
  await mockMessage(page, "linke bak (https://koqep.dev/sayfa).");
  await login(page);

  const link = page.getByRole("link", { name: "https://koqep.dev/sayfa" });
  await expect(link).toHaveAttribute("href", "https://koqep.dev/sayfa");
  await expect(page.getByText(").", { exact: false })).toBeVisible();
});

test("kod_blogu_icindeki_url_link_olmaz", async ({ page }) => {
  await mockMessage(page, "önce ```https://koqep.dev/kod``` sonra");
  await login(page);

  await expect(page.locator("pre")).toHaveText("https://koqep.dev/kod");
  // "feedback" (AccountMenu'nün mailto linki, M7b Slice H2 - M10 Faz 2
  // Slice B'de "account ▾" menüsüne taşındı, menü kapalıyken DOM'da bile
  // yok) bare getByRole("link") ile karışabilirdi - mesaj içeriğinden gelen
  // linklerle SINIRLI (http ile başlayan) filtre bu yüzden kalıcı.
  await expect(
    page.getByRole("link").filter({ hasText: "http" }),
  ).toHaveCount(0);
});

test("url_icermeyen_mesajda_hic_link_olusmaz", async ({ page }) => {
  await mockMessage(page, "sıradan bir mesaj");
  await login(page);

  await expect(page.getByText("sıradan bir mesaj")).toBeVisible();
  await expect(page.getByRole("link").filter({ hasText: "http" })).toHaveCount(0);
});
