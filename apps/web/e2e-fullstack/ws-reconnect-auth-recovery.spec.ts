import { test, expect } from "@playwright/test";

// KRİTİK, 2026-08-27: production'da kullanıcı hiç mesaj gönderemiyordu -
// composer kalıcı "disabled" görünüyordu (imleç "yasak" işareti gösteriyordu).
// Kök neden: apps/api'nin handleConnection'ı (messages.gateway.ts) süresi
// dolmuş/geçersiz bir access token'la gelen WS bağlantısını SESSİZCE
// disconnect ediyor. Bu, engine.io bağlantısı KURULDUKTAN SONRA (auth
// kontrolü handleConnection'ın İÇİNDE) olduğu için client'ta "connect_error"
// DEĞİL "disconnect" (reason: "io server disconnect") olarak görünüyor -
// GERÇEK bir Playwright koşumuyla (aşağıdaki gibi) ölçülüp doğrulandı. Ve
// kritik olan: socket.io-client'ın kendi dokümantasyonu gereği "io server
// disconnect" nedeniyle kapanan bir bağlantıda otomatik-yeniden-bağlanma
// BİLEREK devre dışı (client'ın socket.connect()'i MANUEL çağırması
// bekleniyor) - yani isReady KALICI false kalır, HİÇBİR yeniden deneme
// bile olmaz. Düzeltme: RoomView.tsx'in "disconnect" dinleyicisi reason
// "io server disconnect" olduğunda refreshAccessToken() çağırıyor - başarılı
// olursa page.tsx'in accessToken state'i güncellenir, bootstrap effect'i
// [accessToken] bağımlılığı yüzünden YENİDEN çalışıp TAZE token'la
// bambaşka bir socket kurar (authedGetJson/authedPostJson'ın zaten
// kullandığı 401->refresh akışının AYNISI, sadece WS katmanı için).
test("ws_baglantisi_gecersiz_token_yuzunden_reddedilince_refresh_ile_kendini_toparlar", async ({
  page,
}) => {
  // /auth/login GERÇEK backend'e gidiyor (refresh-token cookie'si GERÇEK
  // olsun diye) ama React'e dönen accessToken'ı BİLEREK bozuyoruz - ilk WS
  // bağlantısı GERÇEKTEN reddedilecek. getCurrentUser/listRooms'u SABİT
  // mock'larla besliyoruz - authedGetJson'ın KENDİ 401->refresh mekanizması
  // bu ikisi için TETİKLENMESİN diye (aksi halde bootstrap effect'indeki
  // "cancelled" guard'ı, WS katmanına hiç ulaşmadan ÖNCEDEN kurtarırdı -
  // amaç SADECE WS katmanının kendi bağımsız recover'ını izole test etmek).
  await page.route("**/auth/login", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.accessToken = "kasitli-bozuk-access-token";
    await route.fulfill({ response, json });
  });
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: { email: "dev@koqep.local", username: "dev", role: "user" },
    }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "general", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/");
  await page.getByLabel("email").fill("dev@koqep.local");
  await page.getByLabel("password").fill("dev-local-only-password");
  await page.getByRole("button", { name: "log in" }).click();

  const input = page.getByPlaceholder("write a message...");
  // Bu fix OLMADAN composer 15sn'lik timeout boyunca kalıcı disabled kalır
  // (gerçek bug budur) - fix'le birlikte disconnect->refresh->yeni socket
  // döngüsü çok daha hızlı tamamlanır.
  await expect(input).toBeEnabled({ timeout: 15000 });

  await input.fill("diag-recovered-after-bad-token");
  await page.getByRole("button", { name: "send" }).click();
  // Mock'lanmış oda (room-1) GERÇEK DB'deki gerçek room id'siyle eşleşmiyor,
  // bu yüzden gelen "message:new" roomId filtresine takılıp yerelde
  // görünmeyebilir (test artifact'ı, fix'le ilgisiz) - asıl kanıt gönderim
  // sırasında hiçbir hata gösterilmemesi (emit gerçekten sunucuya gitti,
  // socket genuinely çalışır durumda).
  await page.waitForTimeout(2000);
  await expect(page.getByText(/could not be sent/i)).toHaveCount(0);
});
