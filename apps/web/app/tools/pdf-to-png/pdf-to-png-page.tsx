import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import PdfToPngWorkspace from "./pdf-to-png-workspace";

export function PdfToPngPage({ tool }: { tool: ToolDefinition }) {
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
        Your PDF stays in this browser tab. No uploads, account or registration.
      </p>
      <noscript>
        <p className="mt-6">Enable JavaScript to render PDF pages locally in your browser.</p>
      </noscript>
      <div className="mt-8">
        <PdfToPngWorkspace />
      </div>
      <section className="section flex flex-col gap-4" aria-labelledby="pdf-to-png-how">
        <h2 id="pdf-to-png-how" className="text-2xl font-semibold">
          How to convert PDF pages to PNG
        </h2>
        <ol className="list-inside list-decimal">
          <li>Choose one static PDF and check its page count and first-page preview.</li>
          <li>Render all pages or enter page numbers and ranges such as 1-3,5.</li>
          <li>Choose 96 DPI for screen use or 192 DPI for a higher-resolution image.</li>
          <li>
            Choose a transparent or white background, render, review the output, and download.
          </li>
        </ol>
        <p className="text-muted-foreground">
          A single selected page downloads as a PNG. Multiple pages are bundled in a ZIP with one
          numbered PNG per page, in the selected source order. Page rotation and proportions are
          applied by PDF.js; text and vectors are rasterized at the chosen DPI, so anti-aliasing and
          color may differ from other PDF viewers.
        </p>
        <p className="text-muted-foreground">
          Files are limited to 8 MiB and 100 pages. Each rendered page is limited to 8 megapixels
          and 8,192 pixels on an edge; one operation is limited to 120 megapixels, 45 seconds, 16
          MiB per PNG, or a 32 MiB ZIP. Encrypted PDFs and documents containing interactive forms,
          annotations, links, layers, actions, signatures, or attachments are not supported. This
          tool does not sanitize PDF files.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="text-link" href="/tools/merge-pdf">
            Combine PDF documents
          </Link>
          <Link className="text-link" href="/tools/split-pdf">
            Extract pages from a PDF
          </Link>
          <Link className="text-link" href="/tools/rotate-pdf">
            Rotate PDF pages
          </Link>
          <Link className="text-link" href="/tools/images-to-pdf">
            Create a PDF from images
          </Link>
          <Link className="text-link" href="/categories/pdf">
            Explore PDF tools
          </Link>
        </div>
      </section>
    </main>
  );
}
