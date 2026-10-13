import { getPublishedTools, getToolBySlug, toolCatalog } from "@toolbox/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactQrPage } from "../contact-qr/contact-qr-page";
import { ImageCompressorPage } from "../image-compressor/image-compressor-page";
import { ImageResizerPage } from "../image-resizer/image-resizer-page";
import ImagesWorkspace from "../images-to-pdf/images-workspace";
import { MergePage } from "../merge-pdf/merge-page";
import { PdfToPngPage } from "../pdf-to-png/pdf-to-png-page";
import { PngJpgConverterPage } from "../png-jpg-converter/png-jpg-converter-page";
import { QrDesignerPage } from "../qr-designer/qr-designer-page";
import { RotatePage } from "../rotate-pdf/rotate-page";
import { SplitPage } from "../split-pdf/split-page";
import { WebpConverterPage } from "../webp-converter/webp-converter-page";
import { WifiQrPage } from "../wifi-qr/wifi-qr-page";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  const published = getPublishedTools().map((tool) => ({ slug: tool.slug }));
  if (process.env.NODE_ENV !== "production" && process.env.TOOLBOX_UI_FIXTURES === "1") {
    const localPreviews = ["qr-designer", "wifi-qr", "contact-qr"];
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
    ["qr-designer", "wifi-qr", "contact-qr"].includes(slug)
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

  return {
    title: tool.title,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getPageTool(slug);

  if (tool?.slug === "qr-designer") return <QrDesignerPage tool={tool} />;
  if (tool?.slug === "contact-qr") return <ContactQrPage tool={tool} />;
  if (tool?.slug === "wifi-qr") return <WifiQrPage tool={tool} />;
  if (tool?.slug === "merge-pdf") return <MergePage tool={tool} />;
  if (tool?.slug === "split-pdf") return <SplitPage tool={tool} />;
  if (tool?.slug === "rotate-pdf") return <RotatePage tool={tool} />;
  if (tool?.slug === "pdf-to-png") return <PdfToPngPage tool={tool} />;
  if (tool?.slug === "image-compressor") return <ImageCompressorPage tool={tool} />;
  if (tool?.slug === "image-resizer") return <ImageResizerPage tool={tool} />;
  if (tool?.slug === "png-jpg-converter") return <PngJpgConverterPage tool={tool} />;
  if (tool?.slug === "webp-converter") return <WebpConverterPage tool={tool} />;
  if (tool?.slug !== "images-to-pdf") {
    notFound();
  }

  return (
    <main className="container-site page max-w-workspace flex-1" id="main-content" tabIndex={-1}>
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link className="text-link" href="/tools">
          Tools
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="text-link" href="/categories/pdf">
          PDF
        </Link>
        <span aria-hidden="true">/</span>
        <span>{tool.title}</span>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">{tool.title}</h1>
      <p className="mt-3 text-muted-foreground">{tool.description}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        No uploads, registration or account. Your images and PDF stay in this browser tab.
      </p>
      <noscript>
        <p className="mt-6">Enable JavaScript to process images locally in your browser.</p>
      </noscript>
      <div className="mt-8">
        <ImagesWorkspace />
      </div>
      <section className="section flex flex-col gap-4" aria-labelledby="image-pdf-how">
        <h2 id="image-pdf-how" className="text-2xl font-semibold">
          How to turn images into a PDF
        </h2>
        <ol className="list-inside list-decimal">
          <li>Choose JPEG, PNG or static WebP images.</li>
          <li>Arrange thumbnails with drag and drop or Move up and Move down.</li>
          <li>
            Choose A4 or Letter with orientation and margins, or Auto to follow each image’s size.
          </li>
          <li>Use Fit to keep the whole image, or Fill to crop edges without stretching.</li>
          <li>Create the PDF, review its actual pages, and download the result.</li>
        </ol>
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="image-pdf-details">
        <h2 id="image-pdf-details" className="text-2xl font-semibold">
          What happens to image quality?
        </h2>
        <p className="text-muted-foreground">
          Each image becomes one PDF page. JPEG images are re-encoded at high quality; PNG and WebP
          retain transparency, which appears against a white page. Browser decoding applies image
          orientation and color conversion. Source metadata is removed. This tool does not compress
          PDFs or preserve archival color profiles; the result can be larger than the originals.
        </p>
        <p className="text-muted-foreground">
          Auto uses 96 pixels per inch. Animated images are not supported. If a selection exceeds
          the limits shown above, use smaller images or create separate PDFs. Cancel stops
          conversion; Reset clears images and the result.
        </p>
        <Link className="text-link" href="/categories/pdf">
          Explore the PDF category
        </Link>
        <Link className="text-link" href="/tools/merge-pdf">
          Combine existing PDF documents
        </Link>
        <Link className="text-link" href="/tools/split-pdf">
          Extract pages from a PDF
        </Link>
        <Link className="text-link" href="/tools/rotate-pdf">
          Rotate PDF pages
        </Link>
        <Link className="text-link" href="/tools/image-compressor">
          Compress an image
        </Link>
        <Link className="text-link" href="/tools/image-resizer">
          Resize an image
        </Link>
      </section>
    </main>
  );
}
