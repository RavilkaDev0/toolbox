import { categories, getToolsForCategory } from "@toolbox/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.id }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find((item) => item.id === slug);

  if (!category) {
    return { title: "Category not found" };
  }

  return {
    title: category.title,
    description: category.description,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = categories.find((item) => item.id === slug);

  if (!category) {
    notFound();
  }

  const tools = getToolsForCategory(category.id);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12" id="main-content" tabIndex={-1}>
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-muted">
          <Link className="underline-offset-4 hover:underline" href="/tools">
            Tools
          </Link>{" "}
          / {category.title}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{category.title}</h1>
        <p className="mt-3 text-muted">{category.description}</p>
      </header>

      {tools.length === 0 ? (
        <p className="mt-8 rounded-xl border border-border bg-surface p-6 text-muted">
          No tools are published in this category yet.
        </p>
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
