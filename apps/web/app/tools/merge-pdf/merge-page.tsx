import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import MergeWorkspace from "./merge-workspace";

export function MergePage({ tool }: { tool: ToolDefinition }) {
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
        Your documents stay in this browser tab. No uploads, account or registration.
      </p>
      <noscript>
        <p className="mt-6">Enable JavaScript to merge PDFs locally in your browser.</p>
      </noscript>
      <div className="mt-8">
        <MergeWorkspace />
      </div>
      <section className="section flex flex-col gap-4" aria-labelledby="merge-how">
        <h2 id="merge-how" className="text-2xl font-semibold">
          How to merge PDF documents
        </h2>
        <ol className="list-inside list-decimal">
          <li>Choose two or more static PDF files.</li>
          <li>Check their page counts and first-page previews.</li>
          <li>Drag documents into order or use Move up and Move down.</li>
          <li>Merge, inspect the generated pages, and download your PDF.</li>
        </ol>
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="merge-limits">
        <h2 id="merge-limits" className="text-2xl font-semibold">
          What is preserved?
        </h2>
        <p className="text-muted-foreground">
          Original page dimensions, boxes, rotations, text, vectors and images are copied without
          rasterization. This tool does not compress PDFs. Bookmarks, document metadata and
          accessibility tags are not preserved.
        </p>
        <p className="text-muted-foreground">
          Encrypted PDFs, interactive forms, annotations (including links), actions, digital
          signatures and attachments are not supported. Export a plain static PDF from an authorized
          editor first. This tool does not sanitize PDFs or guarantee safety outside this viewer.
        </p>
        <p className="text-muted-foreground">
          First-page previews are optional and may fail for unsupported visual features. Use smaller
          documents if you reach the displayed file, page or time limits. Cancel stops the active
          worker; Reset clears the selection and result.
        </p>
        <Link className="text-link" href="/tools/images-to-pdf">
          Turn images into a PDF
        </Link>
        <Link className="text-link" href="/categories/pdf">
          Explore PDF tools
        </Link>
      </section>
    </main>
  );
}
