import { toolCatalog } from "@toolbox/core";
import { notFound } from "next/navigation";
import { PdfToPngPage } from "../../tools/pdf-to-png/pdf-to-png-page";

export const metadata = {
  title: "Private PDF to PNG fixture",
  robots: { index: false, follow: false },
  alternates: { canonical: "/tools/pdf-to-png" },
};

export default function PdfToPngFixturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const tool = toolCatalog.find((candidate) => candidate.slug === "pdf-to-png");
  if (!tool) notFound();
  return <PdfToPngPage tool={tool} />;
}
