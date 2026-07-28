import { test, expect } from "@playwright/test";

test("mesaj_diger_sekmede_gercek_zamanli_gorunur_ve_reload_sonrasi_kalicidir", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto("/");
  await pageB.goto("/");

  const content = `round-trip-${Date.now()}`;

  const input = pageA.getByPlaceholder("mesaj yaz...");
  await expect(input).toBeEnabled({ timeout: 15000 });
  await input.fill(content);
  await pageA.getByRole("button", { name: "gönder" }).click();

  await expect(pageB.getByText(content)).toBeVisible({ timeout: 10000 });

  await pageB.reload();
  await expect(pageB.getByText(content)).toBeVisible({ timeout: 10000 });

  await contextA.close();
  await contextB.close();
});
