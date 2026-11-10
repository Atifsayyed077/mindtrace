import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindTrace — Seven Days. A Better Understanding of Yourself.",
  description:
    "A private, playful 7-day AI-guided self-discovery journey. Five minutes a day for your brain. No cloud, no accounts elsewhere — everything stays on your device.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
