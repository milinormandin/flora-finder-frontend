import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Toaster as ToasterProvider } from "@/components/ui/toast";
import PrimarySearchAppBar from "./components/PrimarySearchAppBar";
import "./globals.css";

const manrope = localFont({
  src: "../public/fonts/manrope.ttf",
  weight: "200 800",
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "Flora Finder — Hawaiʻi’s plant field guide",
    template: "%s | Flora Finder",
  },
  description: "Explore Hawaiʻi’s plants, learn about their habitats, and keep a personal plant list.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F4EE",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ToasterProvider>
          <PrimarySearchAppBar />
          {children}
        </ToasterProvider>
      </body>
    </html>
  );
}
