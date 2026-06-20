import type { Metadata, Viewport } from "next";
import { Nunito, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "atGPT",
  description: "atGPT — a ChatGPT-style interface for the co/core network.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${nunito.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
