import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import RotateWorkspace from "./rotate-workspace";

export function RotatePage({ tool }: { tool: ToolDefinition }) {
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
        <p className="mt-6">Enable JavaScript to rotate PDF pages locally in your browser.</p>
      </noscript>
      <div className="mt-8">
        <RotateWorkspace />
      </div>
      <section className="section flex flex-col gap-4" aria-labelledby="rotate-how">
        <h2 id="rotate-how" className="text-2xl font-semibold">
          How to rotate PDF pages
        </h2>
        <ol className="list-inside list-decimal">
          <li>Choose one static PDF and review its page preview.</li>
          <li>Rotate all pages or enter a selection such as 1-3,5,8.</li>
          <li>Choose left 90°, right 90° or 180° and check the resulting angle preview.</li>
          <li>Apply the change, review the generated PDF and download it.</li>
        </ol>
        <p className="text-muted-foreground">
          Rotation updates each page’s PDF orientation value. Text, vector paths, image resources,
          page order and page boxes are retained without rasterizing the page. Existing page
          rotations are combined with the selected turn, so a page already at 90° can become 180°.
        </p>
        <p className="text-muted-foreground">
          Input and output are limited to 8 MiB, 100 pages, and 45 seconds. Encrypted PDFs and PDFs
          with forms, annotations, links, layers, actions, signatures or attachments are refused.
          Bookmarks, document-level metadata and interactive features are not promised. This tool
          does not sanitize PDFs or guarantee how another viewer handles a file.
        </p>
        <Link className="text-link" href="/tools/split-pdf">
          Extract pages from a PDF
        </Link>
        <Link className="text-link" href="/tools/merge-pdf">
          Combine PDF documents
        </Link>
        <Link className="text-link" href="/tools/images-to-pdf">
          Create a PDF from images
        </Link>
        <Link className="text-link" href="/categories/pdf">
          Explore PDF tools
        </Link>
      </section>
    </main>
  );
}
