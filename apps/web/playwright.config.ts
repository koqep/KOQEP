import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  // M6 Slice D: dar-viewport testi ayrı bir projede - mevcut 62 testi
  // ikiye katlamamak için mobile-375 SADECE mobile-viewport.spec.ts'i,
  // desktop onun DIŞINDAKİ her şeyi çalıştırıyor. devices['iPhone 13']
  // gibi hazır preset'ler WebKit'e geçiyor, CI sadece chromium kuruyor
  // (.github/workflows/ci.yml) - bu yüzden browserName sabit chromium,
  // sadece viewport override ediliyor.
  projects: [
    { name: "desktop", use: {}, testIgnore: /mobile-viewport\.spec\.ts/ },
    {
      name: "mobile-375",
      use: { viewport: { width: 375, height: 667 }, browserName: "chromium" },
      testMatch: /mobile-viewport\.spec\.ts/,
    },
  ],
});
