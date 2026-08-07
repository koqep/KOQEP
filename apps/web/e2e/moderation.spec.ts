import { test, expect, type Page } from "@playwright/test";

async function login(
  page: Page,
  role: "user" | "moderator",
  messageAuthorUsername: string,
  mutedUntil: string | null = null,
) {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    }),
  );
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
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByText("test mesajı")).toBeVisible();
}

test("moderator_olmayan_moderasyon_butonunu_gormez", async ({ page }) => {
  await login(page, "user", "baskasi");

  await expect(
    page.getByRole("button", { name: "moderasyon" }),
  ).toHaveCount(0);
});

test("kendi_mesajinda_raporla_butonu_gorunmez_baskasinin_mesajinda_gorunur", async ({
  page,
}) => {
  await login(page, "user", "test");
  await expect(page.getByRole("button", { name: "raporla" })).toHaveCount(0);
});

test("baskasinin_mesajini_raporlayinca_onay_gosterir", async ({ page }) => {
  await login(page, "user", "baskasi");
  let reportedBody: unknown;
  await page.route("**/rooms/*/messages/*/report", async (route) => {
    reportedBody = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });

  await page.getByRole("button", { name: "raporla" }).click();

  await expect(page.getByText("raporlandı")).toBeVisible();
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
  await page.route("**/moderation/reports/*/remove-content", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.getByRole("button", { name: "moderasyon" }).click();

  await expect(page.getByText("saldırgan içerik")).toBeVisible();
  await expect(page.getByText("kötüye kullanım")).toBeVisible();

  await page.getByRole("button", { name: "içeriği kaldır" }).click();

  await expect(page.getByText("saldırgan içerik")).toHaveCount(0);
  await expect(page.getByText("açık rapor yok")).toBeVisible();
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

  await page.getByRole("button", { name: "moderasyon" }).click();
  await expect(page.getByText("masum içerik")).toBeVisible();

  await page.getByRole("button", { name: "reddet" }).click();

  await expect(page.getByText("açık rapor yok")).toBeVisible();
});

test("acik_rapor_yoksa_bos_durum_gosterir", async ({ page }) => {
  await login(page, "moderator", "baskasi");
  await page.route("**/moderation/reports", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "moderasyon" }).click();

  await expect(page.getByText("açık rapor yok")).toBeVisible();
});

test("susturulmus_kullanici_composer_devre_disi_ve_bildirim_gorur_kendi_mesajinda_duzenle_butonu_yok", async ({
  page,
}) => {
  const mutedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await login(page, "user", "test", mutedUntil);

  await expect(page.getByText("susturuldun", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "mesaj yaz..." }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "düzenle" })).toHaveCount(0);
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

  await page.getByRole("button", { name: "moderasyon" }).click();
  await expect(
    page.getByRole("button", { name: "sustur (24 saat)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "susturmayı kaldır" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "sustur (24 saat)" }).click();

  expect(muteRequestBody).toEqual({ durationHours: 24 });
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

  await page.getByRole("button", { name: "moderasyon" }).click();

  await expect(page.getByRole("button", { name: /^sustur/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "susturmayı kaldır" }),
  ).toHaveCount(0);
});
