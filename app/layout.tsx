import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrafficNerd — live traffic cameras of the world",
  description: "A live 3D globe of the world's open traffic cameras.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Calm LIGHT by default; the shell flips data-theme on the client for the
    // optional dark toggle. Setting it here keeps SSR markup matching first paint.
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
