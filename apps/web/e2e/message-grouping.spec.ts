import { test, expect, type Page } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

// M10 Faz 2 Slice C: ardışık aynı-yazar mesajlarının gruplanması. Sabit
// (new Date() DEĞİL) ISO createdAt'ler kullanılıyor - eşik-sınırı testleri
// (bkz. aşağıda) tam bir zaman farkına bağımlı, saat dilimine bağımlı
// GÖRÜNEN saat metnini DEĞİL (o testler regex'le "herhangi bir HH:MM"
// eşleştiriyor - CI'nin saat dilimi bilinmiyor).
interface MockMessage {
  id: string;
  content: string;
  authorUsername: string | null;
  createdAt: string;
  editedAt?: string | null;
}

async function loginWithMessages(
  page: Page,
  messages: MockMessage[],
): Promise<void> {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: { email: "test@koqep.local", username: "test", role: "user" },
    }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "general", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({
      json: {
        messages: messages.map((m) => ({
          roomId: "room-1",
          editedAt: null,
          ...m,
        })),
        nextCursor: null,
      },
    }),
  );

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

test("ayni_yazar_esik_icinde_devam_mesaji_etiketsiz_hover_ile_saat_gorunur", async ({
  page,
}) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "ilk mesaj",
      authorUsername: "baskasi",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
    {
      id: "msg-2",
      content: "ikinci mesaj",
      authorUsername: "baskasi",
      createdAt: "2026-01-01T10:01:00.000Z",
    },
  ]);

  // Grup-başı: etiket TEK bir yerde görünür (ikinci mesajda tekrarlanmaz).
  await expect(page.getByText("baskasi:", { exact: true })).toHaveCount(1);

  const secondRow = page.locator("li", { hasText: "ikinci mesaj" });
  const secondRowTime = secondRow.getByText(/^\d{2}:\d{2}$/);
  await expect(secondRowTime).not.toBeVisible();

  await secondRow.hover();
  await expect(secondRowTime).toBeVisible();
});

test("farkli_yazar_esik_icinde_bile_grubu_kirar", async ({ page }) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "ilk mesaj",
      authorUsername: "baskasi",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
    {
      id: "msg-2",
      content: "ikinci mesaj",
      authorUsername: "digeri",
      createdAt: "2026-01-01T10:00:10.000Z",
    },
  ]);

  await expect(page.getByText("baskasi:", { exact: true })).toHaveCount(1);
  await expect(page.getByText("digeri:", { exact: true })).toHaveCount(1);
});

test("tam_5_dakika_grubu_kirmaz_5_dakika_1_saniye_kirar", async ({ page }) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "ilk mesaj",
      authorUsername: "baskasi",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
    {
      id: "msg-2",
      content: "tam bes dakika sonraki mesaj",
      authorUsername: "baskasi",
      createdAt: "2026-01-01T10:05:00.000Z",
    },
    {
      id: "msg-3",
      content: "bes dakika bir saniye sonraki mesaj",
      authorUsername: "baskasi",
      createdAt: "2026-01-01T10:10:01.000Z",
    },
  ]);

  // msg-2: msg-1'den tam 5:00 sonra - kesin (>) kıyas yüzünden HÂLÂ aynı
  // grupta, etiket YOK.
  await expect(
    page
      .locator("li", { hasText: "tam bes dakika sonraki mesaj" })
      .getByText("baskasi:", { exact: true }),
  ).toHaveCount(0);
  // msg-3: msg-2'den 5:01 sonra - eşiği aşıyor, grup KIRILIR, etiket VAR.
  await expect(
    page
      .locator("li", { hasText: "bes dakika bir saniye sonraki mesaj" })
      .getByText("baskasi:", { exact: true }),
  ).toHaveCount(1);
});

test("devam_mesajinin_edit_delete_history_butonlari_calisir", async ({
  page,
}) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "ilk mesaj",
      authorUsername: "test",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
    {
      id: "msg-2",
      content: "devam mesaji",
      authorUsername: "test",
      createdAt: "2026-01-01T10:00:30.000Z",
    },
  ]);
  await page.route("**/rooms/*/messages/*/edits", (route) =>
    route.fulfill({
      json: [
        { previousContent: "eski hal", editedAt: "2026-01-01T10:01:00.000Z" },
      ],
    }),
  );

  const secondRow = page.locator("li", { hasText: "devam mesaji" });
  // M11a Slice F: edit/delete/history butonları artık satır hover/focus'ta
  // görünür - "are you sure?"/cancel onay UI'ı hover'dan bağımsız kalıyor.
  await secondRow.hover();

  // history: aç/kapat, önceki içerik satırda görünür.
  await secondRow.getByRole("button", { name: "history" }).click();
  await expect(secondRow.getByText("eski hal")).toBeVisible();
  await secondRow.getByRole("button", { name: "hide history" }).click();
  await expect(secondRow.getByText("eski hal")).toHaveCount(0);

  // edit: form mevcut içerikle dolu açılır. secondRow'un hasText filtresi
  // CANLI değerlendirildiği için (Playwright), edit modunda içerik artık
  // bir <input value="..."> İÇİNDE - metin içeriği olarak görünmüyor,
  // secondRow filtresi eşleşmeyi KAYBEDER. Sayfa genelinde sorgula (aynı
  // anda tek bir mesaj edit modunda olabilir, belirsizlik riski yok).
  await secondRow.getByRole("button", { name: "edit" }).click();
  await expect(page.getByLabel("edit message")).toHaveValue("devam mesaji");
  await page.getByRole("button", { name: "cancel" }).click();

  // delete: iki adımlı onay UI'ı çalışır (WS round-trip mock'suz e2e/
  // süitin kapsamı dışında - message-delete.spec.ts'in AYNI deseni).
  await secondRow.hover();
  await secondRow.getByRole("button", { name: "delete", exact: true }).click();
  await expect(secondRow.getByText("are you sure?")).toBeVisible();
  await secondRow.getByRole("button", { name: "cancel" }).click();
  await expect(secondRow.getByText("are you sure?")).toHaveCount(0);
});

test("load_older_ile_onceden_grup_basi_olan_mesaj_devam_mesajina_doner", async ({
  page,
}) => {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: { email: "test@koqep.local", username: "test", role: "user" },
    }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "general", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages*", async (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("cursor");
    if (!cursor) {
      await route.fulfill({
        json: {
          messages: [
            {
              id: "msg-2",
              content: "yeni mesaj",
              authorUsername: "baskasi",
              createdAt: "2026-01-01T10:01:00.000Z",
              roomId: "room-1",
              editedAt: null,
            },
          ],
          nextCursor: "cursor-1",
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        messages: [
          {
            id: "msg-1",
            content: "eski mesaj",
            authorUsername: "baskasi",
            createdAt: "2026-01-01T10:00:00.000Z",
            roomId: "room-1",
            editedAt: null,
          },
        ],
        nextCursor: null,
      },
    });
  });

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();

  // Yükleme öncesi: "yeni mesaj" listenin tek/ilk öğesi - grup-başı, etiket var.
  await expect(
    page.locator("li", { hasText: "yeni mesaj" }).getByText("baskasi:", {
      exact: true,
    }),
  ).toHaveCount(1);

  await page.getByRole("button", { name: "load older messages" }).click();
  await expect(page.getByText("eski mesaj")).toBeVisible();

  // Yükleme sonrası: "eski mesaj" artık grup-başı (etiket VAR), "yeni mesaj"
  // artık devam mesajı (etiket KAYBOLDU) - kasıtlı geriye-dönük yeniden
  // gruplama (Slack/Discord emsali, ChatPanel.tsx'in isGroupStart yorumu).
  await expect(
    page.locator("li", { hasText: "eski mesaj" }).getByText("baskasi:", {
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.locator("li", { hasText: "yeni mesaj" }).getByText("baskasi:", {
      exact: true,
    }),
  ).toHaveCount(0);
});
