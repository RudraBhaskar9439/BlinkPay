import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://blink-pay-web.vercel.app"),
  title: {
    default: "BlinkPay — Pay from what you already own",
    template: "%s · BlinkPay",
  },
  description: "AI-assisted, self-custodial exact-USDC payment routing on Monad.",
  applicationName: "BlinkPay",
  openGraph: {
    type: "website",
    siteName: "BlinkPay",
    title: "BlinkPay — Pay from what you already own",
    description: "One exact USDC invoice. Five self-custodial routes on Monad.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "BlinkPay — Pay from what you already own",
    description: "One exact USDC invoice. Five self-custodial routes on Monad.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f5ef",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
