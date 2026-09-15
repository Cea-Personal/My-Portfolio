import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basil Ogbonna | Data & AI Engineer",
  description: "The portfolio of Basil Ogbonna, a Senior Data Engineer and AI Engineer."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
