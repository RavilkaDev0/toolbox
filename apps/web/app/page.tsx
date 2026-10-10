import { categories } from "@toolbox/core";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-14 sm:py-20" id="main-content" tabIndex={-1}>
      <section aria-labelledby="home-title" className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          Toolbox foundation
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" id="home-title">
          Useful tools, with privacy at the center
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          We are building a collection of simple tools that process files in your browser whenever
          possible. No tools have been published yet; each one will appear here after its behavior
          and limits have been tested.
        </p>
        <Link
          className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2 font-semibold text-white underline-offset-4 hover:underline"
          href="/tools"
        >
          Browse available tools
        </Link>
      </section>

      <section aria-labelledby="categories-title" className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" id="categories-title">
              Categories
            </h2>
            <p className="mt-2 text-muted">Browse the areas planned for the catalog.</p>
          </div>
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/tools"
          >
            View catalog status
          </Link>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                className="block h-full rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary"
                href={`/categories/${category.id}`}
              >
                <h3 className="font-semibold">{category.title}</h3>
                <p className="mt-2 text-sm text-muted">{category.description}</p>
                <p className="mt-4 text-sm font-medium text-primary">No tools published yet</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
