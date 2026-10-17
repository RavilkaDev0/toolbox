import { toolCatalog } from "@toolbox/core";
import { notFound } from "next/navigation";
import { createPageMetadata } from "../../_lib/site-url";
import { PdfToPngPage } from "../../tools/pdf-to-png/pdf-to-png-page";

export const metadata = {
  ...createPageMetadata(
    "Private PDF to PNG fixture",
    "Development-only PDF to PNG preview.",
    "/tools/pdf-to-png",
  ),
  robots: { index: false, follow: false },
};

export default function PdfToPngFixturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const tool = toolCatalog.find((candidate) => candidate.slug === "pdf-to-png");
  if (!tool) notFound();
  return <PdfToPngPage tool={tool} />;
}
