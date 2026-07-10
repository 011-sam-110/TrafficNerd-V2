import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenData — live global situational-awareness map",
  description:
    "A live satellite globe of the world's cameras, aircraft, satellites and global signals — hazards, conflict, infrastructure, markets and news on one map.",
  applicationName: "OpenData",
  // app/manifest.ts is auto-linked by Next; this is the explicit reference.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "OpenData", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// Calm LIGHT identity: light background, brand-teal browser/OS chrome.
export const viewport: Viewport = {
  themeColor: "#0e7d97",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Calm LIGHT by default; the shell flips data-theme on the client for the
    // optional dark toggle. Setting it here keeps SSR markup matching first paint.
    <html lang="en" data-theme="light">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
