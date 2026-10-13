import type { ToolDefinition } from "@toolbox/core";
import { pngJpgConverterLimits } from "@toolbox/core";
import Link from "next/link";
import PngJpgConverterWorkspace from "./png-jpg-converter-workspace";

export function PngJpgConverterPage({ tool }: { tool: ToolDefinition }) {
  return (
    <main className="container-site page max-w-workspace flex-1" id="main-content" tabIndex={-1}>
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link className="text-link" href="/tools">
          Tools
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="text-link" href="/categories/image">
          Images
        </Link>
        <span aria-hidden="true">/</span>
        <span>{tool.title}</span>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">{tool.title}</h1>
      <p className="mt-3 text-muted-foreground">{tool.description}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        Images are processed locally in this browser tab. Nothing is uploaded and no account is
        required.
      </p>
      <noscript>
        <p className="mt-6">Enable JavaScript to convert images locally in your browser.</p>
      </noscript>
      <div className="mt-8">
        <PngJpgConverterWorkspace />
      </div>
      <section className="section flex flex-col gap-4" aria-labelledby="png-jpg-how">
        <h2 id="png-jpg-how" className="text-2xl font-semibold">
          Convert PNG and JPEG images
        </h2>
        <ol className="list-inside list-decimal">
          <li>Choose or drop PNG and JPEG images. The browser detects their actual file format.</li>
          <li>Review each image and add more files if needed; a batch is downloaded as a ZIP.</li>
          <li>For PNG input, set JPEG quality and the color used to fill transparent pixels.</li>
          <li>Convert, preview the checked output and download the image or archive.</li>
        </ol>
        <p className="text-muted-foreground">
          PNG to JPEG removes transparency by filling transparent pixels with the selected color;
          white is the default. JPEG uses lossy encoding, and the output may look different or be
          larger than the input. JPEG to PNG does not restore detail already lost by JPEG
          compression and may produce a larger file. Browser conversion removes metadata and may
          change color handling; it is not archival color conversion.
        </p>
        <p className="text-muted-foreground">
          Up to {pngJpgConverterLimits.files} files can be selected, with a{" "}
          {formatLimit(pngJpgConverterLimits.fileBytes)} per-file limit and{" "}
          {formatLimit(pngJpgConverterLimits.totalInputBytes)} total input. Each image is limited to
          8 megapixels and 8,192 pixels per side. Single output is capped at 24 MiB and ZIP batch
          output at 32 MiB. Images are decoded one at a time, but a decoded 8-megapixel image uses
          about 32 MiB for RGBA pixels before browser decoder, canvas and encoder memory. A
          low-memory mobile browser may still fail on the largest allowed image.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link className="text-link" href="/tools/image-compressor">
            Compress an image
          </Link>
          <Link className="text-link" href="/tools/image-resizer">
            Resize an image
          </Link>
          <Link className="text-link" href="/categories/image">
            Explore image tools
          </Link>
        </div>
      </section>
    </main>
  );
}

function formatLimit(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`;
}
