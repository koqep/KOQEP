import { test, expect, type Page } from "@playwright/test";

// Seed'lenmiş dev kullanıcı (apps/api/src/db/dev-seed.constants.ts).
const DEV_USER_EMAIL = "dev@koqep.local";
const DEV_USER_PASSWORD = "dev-local-only-password";
const DRAFT_STORAGE_PREFIX = "koqep:draft:";

async function loginAsDevUser(page: Page): Promise<void> {
  await page.getByLabel("email").fill(DEV_USER_EMAIL);
  await page.getByLabel("password").fill(DEV_USER_PASSWORD);
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeEnabled({
    timeout: 15000,
  });
}

function getDraftStorageKeys(page: Page): Promise<string[]> {
  return page.evaluate((prefix) => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return keys;
  }, DRAFT_STORAGE_PREFIX);
}

// localStorage yazımı 500ms debounce'lu (RoomView.tsx) - sabit bir sleep
// yerine beklenen değer görününceye kadar poll ediyoruz (bkz. testing.md /
// projenin genel "sabit sleep yok, poll et" kuralı).
function waitForDraftStorageValue(page: Page, expected: string): Promise<void> {
  return page.waitForFunction(
    ({ prefix, expected }) => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix) && localStorage.getItem(key) === expected) {
          return true;
        }
      }
      return false;
    },
    { prefix: DRAFT_STORAGE_PREFIX, expected },
    { timeout: 5000 },
  ) as unknown as Promise<void>;
}

test("taslak_oda_degistirince_kaybolmuyor_gonderilince_sadece_aktif_odanin_taslagi_temizlenir", async ({
  page,
}) => {
  await page.goto("/");
  await loginAsDevUser(page);

  const generalButton = page.getByRole("button", { name: "#general" });
  const metaButton = page.getByRole("button", { name: "#meta" });
  await expect(generalButton).toBeVisible();
  await expect(metaButton).toBeVisible();

  const input = page.getByPlaceholder("write a message...");
  const generalDraft = `general-taslak-${Date.now()}`;
  const metaDraft = `meta-taslak-${Date.now()}`;

  await input.fill(generalDraft);
  await metaButton.click();
  await expect(input).toHaveValue("");

  await input.fill(metaDraft);
  await generalButton.click();
  await expect(input).toHaveValue(generalDraft);

  await metaButton.click();
  await expect(input).toHaveValue(metaDraft);

  await page.getByRole("button", { name: "send" }).click();
  await expect(page.getByText(metaDraft)).toBeVisible({ timeout: 10000 });
  await expect(input).toHaveValue("");

  // meta'nın taslağı gönderimle temizlendi ama general'inki dokunulmamış
  // kalmalı - "sadece aktif odanın taslağı temizlenir" garantisi.
  await generalButton.click();
  await expect(input).toHaveValue(generalDraft);
});

test("taslak_localStorage_a_debounce_lu_yaziliyor_cikis_yapinca_tumu_silinir", async ({
  page,
}) => {
  await page.goto("/");
  await loginAsDevUser(page);

  const input = page.getByPlaceholder("write a message...");
  const draft = `localstorage-taslak-${Date.now()}`;
  await input.fill(draft);

  await waitForDraftStorageValue(page, draft);
  expect(await getDraftStorageKeys(page)).toHaveLength(1);

  // M10 Faz 2 Slice B: "log out" artık "account ▾" menüsünün içinde.
  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "log out" }).click();
  await expect(page.getByLabel("email")).toBeVisible();

  expect(await getDraftStorageKeys(page)).toHaveLength(0);
});
