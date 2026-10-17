import { getPublishedTools, getToolBySlug, toolCatalog } from "@toolbox/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPageMetadata } from "../../_lib/site-url";
import { ToolPages } from "./tool-pages";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  const published = getPublishedTools().map((tool) => ({ slug: tool.slug }));
  if (process.env.NODE_ENV !== "production" && process.env.TOOLBOX_UI_FIXTURES === "1") {
    const localPreviews = [
      "qr-designer",
      "wifi-qr",
      "contact-qr",
      "password-generator",
      "word-counter",
      "case-converter",
    ];
    return [
      ...published,
      ...localPreviews
        .filter((slug) => !published.some((tool) => tool.slug === slug))
        .map((slug) => ({ slug })),
    ];
  }
  return published;
}

function getPageTool(slug: string) {
  const publishedTool = getToolBySlug(slug);
  if (publishedTool) return publishedTool;
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.TOOLBOX_UI_FIXTURES === "1" &&
    [
      "qr-designer",
      "wifi-qr",
      "contact-qr",
      "password-generator",
      "word-counter",
      "case-converter",
    ].includes(slug)
  )
    return toolCatalog.find((tool) => tool.slug === slug);
  return undefined;
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getPageTool(slug);

  if (!tool) {
    return { title: "Tool not found" };
  }

  return createPageMetadata(tool.title, tool.description, `/tools/${tool.slug}`);
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getPageTool(slug);
  if (!tool) notFound();
  return <ToolPages tool={tool} />;
}
