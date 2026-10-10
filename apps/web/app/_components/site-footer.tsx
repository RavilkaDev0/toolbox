import { getPublishedTools } from "@toolbox/core";
import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="container-site flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight" translate="no">
            Toolbox<span className="text-primary">.</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Thoughtful tools. Less friction.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getPublishedTools().length === 0
              ? "In development. No tools are published yet."
              : "Built with privacy at the center."}
          </p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-6 text-sm">
          <Link className="text-link" href="/tools">
            Tool catalog
          </Link>
          <Link className="text-link" href="/#privacy">
            Privacy approach
          </Link>
        </nav>
      </div>
    </footer>
  );
}
