import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Toaster as ToasterProvider } from "@/components/ui/toast";
import FirebaseInitializer from "./components/FirebaseInitializer";
import PrimarySearchAppBar from "./components/PrimarySearchAppBar";
import PwaControls from "./components/PwaControls";
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
  applicationName: "Flora Finder",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Flora Finder",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
        <FirebaseInitializer />
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ToasterProvider>
          <PrimarySearchAppBar />
          <PwaControls />
          {children}
        </ToasterProvider>
      </body>
    </html>
  );
}
