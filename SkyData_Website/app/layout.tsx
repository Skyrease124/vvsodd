import type { Metadata } from "next";
import "./globals.css";
import { SessionGuard } from "../components/session-guard";

export const metadata: Metadata = {
  title: "SkyData",
  description: "Your space to think, create, and build with SkyData.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><SessionGuard/>{children}</body>
    </html>
  );
}
