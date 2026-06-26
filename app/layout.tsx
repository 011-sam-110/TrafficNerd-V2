import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrafficNerd — live traffic cameras of the world",
  description: "A live 3D globe of the world's open traffic cameras.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
