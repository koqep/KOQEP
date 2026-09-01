import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

// M13 Slice C: "feedback" artık DOĞRUDAN bir mailto: linki DEĞİL -
// diğer panellerle AYNI CenteredModal mekanizmasıyla açılan kendi paneli
// var (FeedbackView.tsx), gerçek mailto: linki panelin İÇİNDE.
async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

async function openFeedbackPanel(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "feedback" }).click();
}

test("hesap_menusunden_feedback_paneli_acilir_aciklama_ve_eposta_gorunur", async ({
  page,
}) => {
  await login(page);

  await openFeedbackPanel(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("we read every message")).toBeVisible();
  await expect(dialog.getByText("ussasa155@gmail.com")).toBeVisible();
});

test("write_an_email_butonu_dogru_mailto_adresine_sahip", async ({
  page,
}) => {
  await login(page);

  await openFeedbackPanel(page);

  const link = page.getByRole("link", { name: "write an email" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute(
    "href",
    "mailto:ussasa155@gmail.com?subject=KOQEP%20feedback",
  );
});

test("kapat_butonu_sohbet_ekranina_doner", async ({ page }) => {
  await login(page);

  await openFeedbackPanel(page);
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("button", { name: "close" }).click();

  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
});
