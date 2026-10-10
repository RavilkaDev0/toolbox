import type { Metadata } from "next";
import Link from "next/link";
import "@toolbox/ui/styles.css";

export const metadata: Metadata = {
  title: {
    default: "Toolbox — useful tools, with privacy at the center",
    template: "%s | Toolbox",
  },
  description:
    "A local-first collection of document, image, QR and text tools. Tools will be listed when they are ready.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a
          className="sr-only absolute left-4 top-4 z-10 rounded-md bg-white px-4 py-2 text-indigo-900 focus:not-sr-only"
          href="#main-content"
        >
          Skip to main content
        </a>
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
            <Link className="text-lg font-bold tracking-tight text-foreground" href="/">
              Toolbox
            </Link>
            <nav
              aria-label="Main navigation"
              className="flex items-center gap-5 text-sm font-medium"
            >
              <Link className="rounded-sm underline-offset-4 hover:underline" href="/tools">
                Tools
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-16 border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-6 text-sm text-muted">
            Toolbox is in foundation development. No tools are published yet.
          </div>
        </footer>
      </body>
    </html>
  );
}
