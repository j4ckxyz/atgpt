import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "co/core console",
  description:
    "Chat across the co/core cooperative, spend credits, and watch your agent's balance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${spaceMono.variable} font-sans antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
