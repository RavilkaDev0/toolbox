import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import WebpConverterWorkspace from "./webp-converter-workspace";

export function WebpConverterPage({ tool }: { tool: ToolDefinition }) {
  return (
    <div className="page-shell">
      <header className="section flex flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">Image tools · Browser-local</p>
        <h1 className="text-4xl font-semibold tracking-tight">{tool.title}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          Convert JPEG and PNG images to WebP in this browser. Compare the actual file sizes, keep
          transparent pixels, and download one image or a ZIP batch.
        </p>
      </header>
      <section className="section" aria-label="WebP converter workspace">
        <WebpConverterWorkspace />
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="webp-how">
        <h2 id="webp-how" className="text-2xl font-semibold">
          How to convert images to WebP
        </h2>
        <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
          <li>Add one or more static JPEG or PNG images with the picker or dropzone.</li>
          <li>
            Choose lossy WebP quality. The browser encoder does not expose a verified lossless mode.
          </li>
          <li>
            Convert, compare each result with its source, preview the real WebP output and download
            it.
          </li>
        </ol>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Files are processed on this device and are not uploaded. Limits are 10 files, 16 MiB each,
          32 MiB total, 8 megapixels and 8,192 pixels per side. A full 8 MP RGBA surface uses about
          32 MiB before browser codec copies; mobile browsers may need smaller images. WebP may be
          larger than the original. Animated images are not supported.
        </p>
        <nav className="flex flex-wrap gap-4" aria-label="Related image tools">
          <Link className="text-link" href="/tools/png-jpg-converter">
            Convert PNG and JPG
          </Link>
          <Link className="text-link" href="/tools/image-compressor">
            Compress an image
          </Link>
          <Link className="text-link" href="/tools/image-resizer">
            Resize an image
          </Link>
        </nav>
      </section>
    </div>
  );
}
