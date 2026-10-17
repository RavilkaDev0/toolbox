import { categories, getToolsForCategory } from "@toolbox/core";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogEmpty } from "../../_components/catalog-empty";
import { CategoryGrid, categoryIcons } from "../../_components/category-grid";
import { ToolCard } from "../../_components/tool-card";
import { createPageMetadata } from "../../_lib/site-url";

type CategoryPageProps = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.id }));
}
export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find((item) => item.id === slug);
  return category
    ? createPageMetadata(category.title, category.description, `/categories/${category.id}`)
    : { title: "Category not found" };
}
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = categories.find((item) => item.id === slug);
  if (!category) notFound();
  const tools = getToolsForCategory(category.id);
  const Icon = categoryIcons[category.id];
  return (
    <main className="container-site page flex-1" id="main-content" tabIndex={-1}>
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
      >
        <Link className="text-link" href="/tools">
          Tools
        </Link>
        <ChevronRight aria-hidden="true" className="size-4" />
        <span aria-current="page">{category.title}</span>
      </nav>
      <header className="max-w-copy">
        <span className="icon-tile mb-5">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h1 className="text-hero font-semibold tracking-tight">{category.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{category.description}</p>
      </header>
      <section className="mt-10" aria-labelledby="category-tools-title">
        <h2 className="mb-6 text-xl font-semibold" id="category-tools-title">
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
          <CatalogEmpty title="No tools are published in this category yet." />
        )}
      </section>
      <section className="section" aria-labelledby="related-categories-title">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight" id="related-categories-title">
          Explore other categories
        </h2>
        <CategoryGrid exclude={category.id} />
      </section>
    </main>
  );
}
