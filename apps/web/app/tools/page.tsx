import { getPublishedTools } from "@toolbox/core";
import Link from "next/link";

export const metadata = {
  title: "Tools",
  description: "Browse Toolbox tools that are ready to use.",
};

export default function ToolsPage() {
  const tools = getPublishedTools();

  return (
    <main className="mx-auto max-w-6xl px-5 py-12" id="main-content" tabIndex={-1}>
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Tools</h1>
        <p className="mt-3 text-muted">
          This catalog only lists tools that are implemented and ready to use.
        </p>
      </header>

      {tools.length === 0 ? (
        <section
          aria-labelledby="empty-catalog-title"
          className="mt-10 rounded-xl border border-border bg-surface p-6"
        >
          <h2 className="text-lg font-semibold" id="empty-catalog-title">
            No tools are published yet
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            Planned tools stay out of the catalog until their processing, limits and error states
            are tested.
          </p>
          <Link
            className="mt-4 inline-block font-medium text-primary underline-offset-4 hover:underline"
            href="/"
          >
            Return to the homepage
          </Link>
        </section>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <li key={tool.id}>
              <Link
                className="block rounded-xl border border-border bg-surface p-5 hover:border-primary"
                href={`/tools/${tool.slug}`}
              >
                <h2 className="font-semibold">{tool.title}</h2>
                <p className="mt-2 text-sm text-muted">{tool.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
