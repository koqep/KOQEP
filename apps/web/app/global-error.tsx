"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// M6 Slice B: App Router'ın kök error boundary'si - instrumentation-client.ts
// TEK BAŞINA React render hatalarını yakalamıyor, bu dosya olmadan bir sınıf
// hata Sentry'ye hiç ulaşmaz. Kendi <html>/<body>'sini render eder (kök
// layout'un KENDİSİ patladığında devreye giriyor, layout.tsx artık render
// edilemiyor demektir) - bu yüzden globals.css'in stilini burada elle
// tekrarlıyoruz.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="bg-neutral-950 font-mono text-sm text-neutral-200 antialiased">
        <main className="mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
          <h1 className="mb-4 text-neutral-400">
            <span className="text-muted">#</span> bir şeyler ters gitti
          </h1>
          <p className="text-neutral-400">
            Beklenmedik bir hata oluştu. Sayfayı yenilemeyi dene.
          </p>
        </main>
      </body>
    </html>
  );
}
