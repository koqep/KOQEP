import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KOQEP",
  description: "Terminal-aesthetic, text-only, real-time chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 font-mono text-sm text-neutral-200 antialiased">
        {children}
      </body>
    </html>
  );
}
