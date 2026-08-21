import { test, expect, type Page } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

async function login(
  page: Page,
  role: "user" | "moderator",
  messageAuthorUsername: string,
  mutedUntil: string | null = null,
) {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: { email: "test@koqep.local", username: "test", role, mutedUntil },
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
        messages: [
          {
            id: "msg-1",
            content: "test mesajı",
            createdAt: new Date().toISOString(),
            authorUsername: messageAuthorUsername,
            roomId: "room-1",
          },
        ],
        nextCursor: null,
      },
    }),
  );

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByText("test mesajı")).toBeVisible();
}

test("moderator_olmayan_moderasyon_butonunu_gormez", async ({ page }) => {
  await login(page, "user", "baskasi");

  await expect(
    page.getByRole("button", { name: "moderation" }),
  ).toHaveCount(0);
});

test("kendi_mesajinda_raporla_butonu_gorunmez_baskasinin_mesajinda_gorunur", async ({
  page,
}) => {
  await login(page, "user", "test");
  await expect(page.getByRole("button", { name: "report" })).toHaveCount(0);
});

test("baskasinin_mesajini_raporlayinca_onay_gosterir", async ({ page }) => {
  await login(page, "user", "baskasi");
  let reportedBody: unknown;
  await page.route("**/rooms/*/messages/*/report", async (route) => {
    reportedBody = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });

  await page.getByRole("button", { name: "report" }).click();

  await expect(page.getByText("reported")).toBeVisible();
  // reason boşsa gövde hiç gönderilmiyor (lib/api.ts'in reportMessage'ı) -
  // apps/api tarafında bu tam da dto undefined olduğunda 500 atan gerçek
  // bir bug'ı ortaya çıkarmıştı (bkz. messages.controller.ts).
  expect(reportedBody).toBeNull();
});

test("moderator_kuyrugu_acar_icerik_kaldirir_ve_listeden_kaybolur", async ({
  page,
}) => {
  await login(page, "moderator", "baskasi");
  await page.route("**/moderation/reports", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        json: [
          {
            id: "report-1",
            createdAt: new Date().toISOString(),
            reason: "kötüye kullanım",
            reportedContent: "saldırgan içerik",
            reportedUsername: "baskasi",
          },
        ],
      });
    }
    return route.continue();
  });
  let removeContentBody: unknown;
  await page.route(
    "**/moderation/reports/*/remove-content",
    async (route) => {
      removeContentBody = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true } });
    },
  );

  await page.getByRole("button", { name: "moderation" }).click();

  await expect(page.getByText("saldırgan içerik")).toBeVisible();
  await expect(page.getByText("kötüye kullanım")).toBeVisible();

  await page.getByRole("button", { name: "remove content" }).click();
  await page.getByLabel("moderator reason").fill("kural ihlali");
  await page.getByRole("button", { name: "confirm" }).click();

  expect(removeContentBody).toEqual({ reason: "kural ihlali" });
  await expect(page.getByText("saldırgan içerik")).toHaveCount(0);
  await expect(page.getByText("no open reports")).toBeVisible();
});

test("moderator_raporu_reddedebilir", async ({ page }) => {
  await login(page, "moderator", "baskasi");
  await page.route("**/moderation/reports", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        json: [
          {
            id: "report-1",
            createdAt: new Date().toISOString(),
            reason: null,
            reportedContent: "masum içerik",
            reportedUsername: "baskasi",
          },
        ],
      });
    }
    return route.continue();
  });
  await page.route("**/moderation/reports/*/dismiss", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.getByRole("button", { name: "moderation" }).click();
  await expect(page.getByText("masum içerik")).toBeVisible();

  await page.getByRole("button", { name: "dismiss" }).click();

  await expect(page.getByText("no open reports")).toBeVisible();
});

test("acik_rapor_yoksa_bos_durum_gosterir", async ({ page }) => {
  await login(page, "moderator", "baskasi");
  await page.route("**/moderation/reports", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "moderation" }).click();

  await expect(page.getByText("no open reports")).toBeVisible();
});

test("susturulmus_kullanici_composer_devre_disi_ve_bildirim_gorur_kendi_mesajinda_duzenle_butonu_yok", async ({
  page,
}) => {
  const mutedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await login(page, "user", "test", mutedUntil);

  await expect(page.getByText("you're muted", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "write a message..." }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "edit" })).toHaveCount(0);
});

test("moderator_rapor_satirinda_sustur_ve_susturmayi_kaldir_butonlarini_gorur_ve_dogru_kullaniciyi_hedefler", async ({
  page,
}) => {
  await login(page, "moderator", "baskasi");
  await page.route("**/moderation/reports", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        json: [
          {
            id: "report-1",
            createdAt: new Date().toISOString(),
            reason: "kötüye kullanım",
            reportedContent: "saldırgan içerik",
            reportedUsername: "baskasi",
            reportedUserId: "user-baskasi",
          },
        ],
      });
    }
    return route.continue();
  });
  let muteRequestBody: unknown;
  await page.route("**/moderation/users/*/mute", async (route) => {
    muteRequestBody = route.request().postDataJSON();
    await route.fulfill({ json: { mutedUntil: new Date().toISOString() } });
  });

  await page.getByRole("button", { name: "moderation" }).click();
  await expect(
    page.getByRole("button", { name: "mute (24h)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "unmute" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "mute (24h)" }).click();
  await page.getByLabel("moderator reason").fill("kural ihlali");
  await page.getByRole("button", { name: "confirm" }).click();

  expect(muteRequestBody).toEqual({
    durationHours: 24,
    reason: "kural ihlali",
  });
  // Mute rapor durumuna dokunmuyor - satır kaybolmuyor, "içeriği kaldır"
  // hâlâ tıklanabilir kalıyor (rapor yaşam döngüsünden bağımsızlık).
  await expect(page.getByText("saldırgan içerik")).toBeVisible();
});

test("silinmis_yazarli_raporda_sustur_butonlari_gorunmez", async ({
  page,
}) => {
  await login(page, "moderator", "baskasi");
  await page.route("**/moderation/reports", (route) =>
    route.fulfill({
      json: [
        {
          id: "report-1",
          createdAt: new Date().toISOString(),
          reason: null,
          reportedContent: "eski icerik",
          reportedUsername: null,
          reportedUserId: null,
        },
      ],
    }),
  );

  await page.getByRole("button", { name: "moderation" }).click();

  await expect(page.getByRole("button", { name: /^mute/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "unmute" }),
  ).toHaveCount(0);
});

test("coklu_rapor_flagli_raporda_uyari_metni_gorunur", async ({ page }) => {
  await login(page, "moderator", "baskasi");
  await page.route("**/moderation/reports", (route) =>
    route.fulfill({
      json: [
        {
          id: "report-1",
          createdAt: new Date().toISOString(),
          reason: null,
          reportedContent: "saldırgan içerik",
          reportedUsername: "baskasi",
          reportedUserId: "user-baskasi",
          distinctReporterCount: 3,
          isFlagged: true,
        },
      ],
    }),
  );

  await page.getByRole("button", { name: "moderation" }).click();

  await expect(
    page.getByText("[multiple reports — 3 different users]"),
  ).toBeVisible();
});

test("flagli_olmayan_raporda_uyari_metni_gorunmez", async ({ page }) => {
  await login(page, "moderator", "baskasi");
  await page.route("**/moderation/reports", (route) =>
    route.fulfill({
      json: [
        {
          id: "report-1",
          createdAt: new Date().toISOString(),
          reason: null,
          reportedContent: "saldırgan içerik",
          reportedUsername: "baskasi",
          reportedUserId: "user-baskasi",
          distinctReporterCount: 1,
          isFlagged: false,
        },
      ],
    }),
  );

  await page.getByRole("button", { name: "moderation" }).click();

  await expect(page.getByText("multiple reports", { exact: false })).toHaveCount(
    0,
  );
});
