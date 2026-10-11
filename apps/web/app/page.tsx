import { getPublishedTools } from "@toolbox/core";
import { ArrowRight, CheckCircle2, HardDrive, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { CatalogEmpty } from "./_components/catalog-empty";
import { CategoryGrid } from "./_components/category-grid";
import { ToolCard } from "./_components/tool-card";
import { ToolSearch } from "./_components/tool-search";

export default function HomePage() {
  const tools = getPublishedTools();
  return (
    <main className="container-site page flex-1" id="main-content" tabIndex={-1}>
      <section
        aria-labelledby="home-title"
        className="mx-auto flex max-w-copy flex-col items-center gap-6 pt-4 text-center sm:pt-10"
      >
        <p className="eyebrow">
          <span className="size-2 rounded-full bg-primary" />A more thoughtful toolbox
        </p>
        <h1 className="text-hero font-semibold tracking-tight" id="home-title">
          Useful tools, with <span className="text-primary">privacy at the center</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Everyday file tasks, made simpler. We are building focused tools for documents, images and
          text, with browser processing wherever possible.
        </p>
        <div className="w-full text-left">
          <ToolSearch />
        </div>
        <p className="text-sm text-muted-foreground">
          {tools.length
            ? "Images to PDF, Merge PDF, Split PDF and Rotate PDF are ready to use. Create, combine, extract and rotate pages locally without registration."
            : "No tools have been published yet. Each tool will appear after its behavior and limits have been tested."}
        </p>
        <Link className="text-link" href="/tools">
          Browse available tools
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>
      <section aria-labelledby="categories-title" className="section" id="categories">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3">Find your starting point</p>
            <h2 className="text-3xl font-semibold tracking-tight" id="categories-title">
              A place for every task
            </h2>
            <p className="mt-3 text-muted-foreground">Explore the categories taking shape.</p>
          </div>
          <Link className="text-link text-sm" href="/tools">
            View tool catalog
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <CategoryGrid />
      </section>
      <section aria-labelledby="published-title" className="section">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight" id="published-title">
          Published tools
        </h2>
        {tools.length ? (
          <ul className="tool-grid">
            {tools.map((tool) => (
              <li key={tool.id}>
                <ToolCard tool={tool} />
              </li>
            ))}
          </ul>
        ) : (
          <CatalogEmpty />
        )}
      </section>
      <section
        aria-labelledby="privacy-title"
        className="section rounded-2xl border border-border bg-surface p-6 sm:p-10"
        id="privacy"
      >
        <div className="max-w-copy">
          <p className="eyebrow mb-3">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Our approach
          </p>
          <h2 className="text-3xl font-semibold tracking-tight" id="privacy-title">
            Your files deserve care.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Privacy is a design requirement. These principles guide the tools we are building.
          </p>
        </div>
        <ul className="mt-8 grid gap-8 md:grid-cols-3">
          <li>
            <HardDrive aria-hidden="true" className="mb-4 size-5 text-primary" />
            <h3 className="font-semibold">Local whenever possible</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Browser-processable files will stay on your device. Any server processing must be
              clearly explained before you begin.
            </p>
          </li>
          <li>
            <SlidersHorizontal aria-hidden="true" className="mb-4 size-5 text-primary" />
            <h3 className="font-semibold">Clear limits, clear choices</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Accepted formats, file limits and processing details belong beside the action, where
              you can see them.
            </p>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" className="mb-4 size-5 text-primary" />
            <h3 className="font-semibold">Ready means tested</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Tools enter the catalog only after real sample files, error handling and cancellation
              have been checked.
            </p>
          </li>
        </ul>
      </section>
    </main>
  );
}
