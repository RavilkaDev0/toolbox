import type { Metadata } from "next";
import localFont from "next/font/local";
import "@toolbox/ui/styles.css";
import { AppFooter } from "./_components/site-footer";
import { AppHeader } from "./_components/site-header";

const geist = localFont({
  src: "./_fonts/geist-latin.woff2",
  variable: "--font-geist",
  display: "swap",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./_fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Toolbox — useful tools, with privacy at the center",
    template: "%s | Toolbox",
  },
  description:
    "Browser-based PDF, image, QR and text tools. Files and text stay in your browser while tools process them locally.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a
          className="sr-only absolute left-4 top-4 z-10 rounded-md bg-surface px-4 py-3 text-primary focus:not-sr-only"
          href="#main-content"
          tabIndex={0}
        >
          Skip to main content
        </a>
        <AppHeader />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
