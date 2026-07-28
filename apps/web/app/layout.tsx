import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KOQEP",
  description: "Terminal estetikli, metin-only, gerçek zamanlı sohbet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="bg-neutral-950 font-mono text-sm text-neutral-200 antialiased">
        {children}
      </body>
    </html>
  );
}
