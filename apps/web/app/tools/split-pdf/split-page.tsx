import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import SplitWorkspace from "./split-workspace";

export function SplitPage({ tool }: { tool: ToolDefinition }) {
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
        Your PDF stays in this browser tab. No upload, account or registration.
      </p>
      <noscript>
        <p className="mt-6">Enable JavaScript to split PDF pages locally in your browser.</p>
      </noscript>
      <div className="mt-8">
        <SplitWorkspace />
      </div>
      <section className="section flex flex-col gap-4" aria-labelledby="split-how">
        <h2 id="split-how" className="text-2xl font-semibold">
          How to split PDF pages
        </h2>
        <ol className="list-inside list-decimal">
          <li>Choose one static PDF and review its page preview.</li>
          <li>Enter pages such as 1, 1-3,5, or choose All pages.</li>
          <li>Extract selected pages into one PDF or make one PDF per page in a ZIP.</li>
          <li>Preview an extracted PDF or open the ZIP, then download the verified result.</li>
        </ol>
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="split-limits">
        <h2 id="split-limits" className="text-2xl font-semibold">
          Page preservation and limits
        </h2>
        <p className="text-muted-foreground">
          Pages are copied without rasterization, so text, vectors, images, original page sizes,
          boxes and rotations are retained. Each output is reopened and checked before download.
          This tool does not sanitize PDFs and cannot promise that files are safe in other readers.
        </p>
        <p className="text-muted-foreground">
          Input is limited to 8 MiB and 100 pages. A selected-page PDF or the complete ZIP is
          limited to 8 MiB, with up to 100 ZIP entries and a 45-second processing limit. Encrypted
          PDFs, forms, annotations, links, layers, actions, signatures and attachments are refused.
          Cancel terminates local processing; Reset clears the selection and result.
        </p>
        <Link className="text-link" href="/tools/merge-pdf">
          Combine PDF documents
        </Link>
        <Link className="text-link" href="/tools/images-to-pdf">
          Turn images into a PDF
        </Link>
        <Link className="text-link" href="/tools/rotate-pdf">
          Rotate PDF pages
        </Link>
        <Link className="text-link" href="/categories/pdf">
          Explore PDF tools
        </Link>
      </section>
    </main>
  );
}
