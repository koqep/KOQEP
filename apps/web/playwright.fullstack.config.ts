import { defineConfig } from "@playwright/test";

// Ayrı bir config: apps/web'in hızlı, DB'siz `playwright.config.ts`'i
// sadece web sunucusunu ayağa kaldırır. Bu config ise gerçek uçtan uca
// (kritik akış) testi için hem apps/api hem apps/web'i birlikte
// ayağa kaldırır - test-web job'ının hızını/bağımsızlığını bozmamak
// için testDir bilinçli olarak farklı bir klasör.
export default defineConfig({
  testDir: "./e2e-fullstack",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: [
    {
      command: "npm --prefix ../api run start:prod",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      // PORT'u burada acikca sabitliyoruz: job-seviyesi bir PORT env'i
      // (CI'da oldugu gibi) hem bu komuta hem asagidaki `next start`'a
      // ayni anda sizip port catismasina yol acabilir (next start da
      // process.env.PORT'u onceliklendirir).
      env: { PORT: "3001" },
    },
    {
      command: "npm run start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      env: { PORT: "3000" },
    },
  ],
});
