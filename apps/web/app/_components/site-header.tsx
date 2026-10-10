import { buttonVariants } from "@toolbox/ui/components/button";
import { ArrowUpRight, Layers } from "lucide-react";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="container-site flex min-h-20 flex-wrap items-center justify-between gap-3 py-4">
        <Link
          className="flex min-h-11 items-center gap-2 text-xl font-semibold tracking-tight"
          href="/"
          aria-label="Toolbox home"
        >
          <span className="icon-tile">
            <Layers aria-hidden="true" className="size-5" />
          </span>
          <span translate="no">
            Toolbox<span className="text-primary">.</span>
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm"
        >
          <Link className="text-link" href="/#categories">
            Categories
          </Link>
          <Link className="text-link hidden sm:inline-flex" href="/#privacy">
            Our approach
          </Link>
          <Link className={buttonVariants("outline")} href="/tools">
            Tools
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
