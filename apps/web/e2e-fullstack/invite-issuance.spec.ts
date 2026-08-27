import { test, expect } from "@playwright/test";

// M4 Slice B: manuel "davet oluştur" kaldırıldı, davetler artık sadece
// seviye atlayınca otomatik kazanılıyor. Bu yüzden ayrı, sarf edilebilir
// bir kullanıcı kullanıyoruz (apps/api/src/db/dev-seed.constants.ts
// DEV_USER_LEVELUP_*) - seed.ts her koşuda bunu eşiğin TAM BİR MESAJ
// öncesine sıfırlıyor, böylece test tek gerçek mesajla seviye atlatıp
// gerçek bir Invite satırı üretebiliyor (dev@koqep.local'i kullanmadık,
// çünkü diğer fullstack testler de onu kullanıyor - paylaşılan XP durumu
// bu testin güvenilirliğini bozardı).
const DEV_USER_LEVELUP_EMAIL = "levelup@koqep.local";
const DEV_USER_LEVELUP_PASSWORD = "dev-local-only-password-3";

test("seviye_atlayinca_kazanilan_kod_gercek_signupta_gercekten_calisir", async ({
  browser,
}) => {
  const inviterContext = await browser.newContext();
  const inviterPage = await inviterContext.newPage();

  await inviterPage.goto("/");
  await inviterPage.getByLabel("email").fill(DEV_USER_LEVELUP_EMAIL);
  await inviterPage.getByLabel("password").fill(DEV_USER_LEVELUP_PASSWORD);
  await inviterPage.getByRole("button", { name: "log in" }).click();
  await expect(inviterPage.getByPlaceholder("write a message...")).toBeEnabled({
    timeout: 15000,
  });

  // Seed eşiğin tam bir mesaj öncesine sıfırlıyor - bu tek gerçek mesaj
  // seviye atlatıp aynı transaction'da gerçek bir Invite satırı üretiyor.
  const input = inviterPage.getByPlaceholder("write a message...");
  await input.fill(`seviye-atlama-${Date.now()}`);
  await inviterPage.getByRole("button", { name: "send" }).click();
  await expect(inviterPage.getByText(`seviye-atlama-`)).toBeVisible({
    timeout: 10000,
  });

  // M10 Faz 2 Slice B: "invites" artık "account ▾" menüsünün içinde.
  await inviterPage.getByRole("button", { name: "account" }).click();
  await inviterPage.getByRole("menuitem", { name: "invites" }).click();
  // GET /invites en yeniden eskiye sıralıyor - az önce kazanılan davet
  // her zaman ilk satır, önceki bir koşudan kalan satırlardan etkilenmez.
  // M10 Faz 2 Slice A: panel artık overlay (SidePanel), arkadaki ChatPanel
  // HER ZAMAN mount kalıyor (inert) - sayfa genelinde page.getByRole
  // ("listitem") artık mesaj <li>'lerini DE eşleştirir (MessageItem.tsx da
  // <li>). Panelin kendi dialog'una daraltmak gerekiyor, aksi halde .first()
  // DOM sırasına göre yanlış bir listitem'i (bir mesajı) yakalayabilir.
  const inviteDialog = inviterPage.getByRole("dialog");
  const inviteRow = inviteDialog.getByRole("listitem").first();
  await expect(inviteRow).toBeVisible({ timeout: 10000 });
  const code = (await inviteRow.locator("span").first().textContent())?.trim();
  expect(code).toBeTruthy();

  const newUserContext = await browser.newContext();
  const newUserPage = await newUserContext.newPage();
  await newUserPage.goto("/");
  await newUserPage
    .getByRole("button", { name: "don't have an account? sign up" })
    .click();

  await newUserPage.getByLabel("invite code").fill(code as string);
  await newUserPage
    .getByLabel("email")
    .fill(`invited-${Date.now()}@koqep.local`);
  await newUserPage.getByLabel("username").fill(`invited${Date.now()}`);
  await newUserPage.getByLabel("password").fill("a-strong-new-password");
  // M6 Slice A: signup formu artık zorunlu bir onay checkbox'ı içeriyor,
  // işaretlenmeden "sign up" disabled kalıyor.
  await newUserPage.getByRole("checkbox").check();
  await newUserPage.getByRole("button", { name: "sign up" }).click();

  // Signup artık giriş yapmıyor (M2.5 Slice B) - bu testin kanıtladığı şey
  // "gerçek üretilen kod signup'ta gerçekten işe yarıyor mu", giriş akışı
  // ayrı bir testte (email-verification.spec.ts) kanıtlanıyor.
  await expect(
    newUserPage.getByText(
      "Click the link sent to your email to complete your signup.",
    ),
  ).toBeVisible({ timeout: 15000 });

  // Panel gerçekten kullanılmış durumu yansıtıyor mu - GET /invites'ın
  // gerçek DB durumunu doğru gösterdiğinin kanıtı. M7a Slice A'dan beri
  // reload = çıkış DEĞİL (httpOnly refresh-token cookie'si sağ kalıyor,
  // page.tsx mount'ta sessizce /auth/refresh dener) - tekrar login yerine
  // oturumun hâlâ açık olduğu doğrulanıyor (bkz. e2e/session-persistence.spec.ts).
  await inviterPage.reload();
  await expect(inviterPage.getByPlaceholder("write a message...")).toBeEnabled({
    timeout: 15000,
  });
  await expect(inviterPage.getByLabel("email")).toHaveCount(0);
  // M10 Faz 2 Slice B: "invites" artık "account ▾" menüsünün içinde.
  await inviterPage.getByRole("button", { name: "account" }).click();
  await inviterPage.getByRole("menuitem", { name: "invites" }).click();
  await expect(
    inviterPage
      .getByRole("dialog")
      .getByRole("listitem")
      .first()
      .getByText("used", { exact: true }),
  ).toBeVisible({ timeout: 10000 });

  await inviterContext.close();
  await newUserContext.close();
});
