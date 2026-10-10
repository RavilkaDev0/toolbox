import { getPublishedTools, getToolBySlug } from "@toolbox/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedTools().map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return { title: "Tool not found" };
  }

  return {
    title: tool.title,
    description: tool.description,
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  return (
    <main className="container-site page max-w-workspace flex-1" id="main-content" tabIndex={-1}>
      <h1 className="text-3xl font-bold tracking-tight">{tool.title}</h1>
      <p className="mt-3 text-muted-foreground">{tool.description}</p>
      <p className="mt-8 rounded-xl border border-border bg-surface p-6 text-muted-foreground">
        This tool is not available yet.
      </p>
    </main>
  );
}
