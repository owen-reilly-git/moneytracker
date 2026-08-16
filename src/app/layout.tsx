import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import IosInstallHint from "@/components/IosInstallHint";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "moneytracker",
  description: "Shared expense tracking for roommates",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "moneytracker",
  },
  other: {
    // Next only emits the modern unprefixed `mobile-web-app-capable`
    // from `appleWebApp.capable` (iOS 17.4+ only). Older iOS needs the
    // vendor-prefixed tag too for true standalone (no Safari chrome).
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <SerwistProvider swUrl="/serwist/sw.js">
          {children}
          <IosInstallHint />
        </SerwistProvider>
      </body>
    </html>
  );
}
