import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// M6 Slice B: source-map upload bilerek KAPALI - SENTRY_AUTH_TOKEN + zaten
// oluşturulmuş bir Sentry org/proje gerektiriyor (founder'ın henüz yapmadığı
// bir ön koşul), ayrıca Turbopack build'lerinde zaten yüklenmiyor (SDK'nın
// kendi tip tanımlarında not edilmiş). Sadece DSN-tabanlı hata yakalama.
export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
});
