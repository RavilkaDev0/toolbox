import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import ImageResizerWorkspace from "./image-resizer-workspace";

export function ImageResizerPage({ tool }: { tool: ToolDefinition }) {
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
        Your image stays in this browser tab. No upload, account or registration.
      </p>
      <noscript>
        <p className="mt-6">Enable JavaScript to resize images locally in your browser.</p>
      </noscript>
      <div className="mt-8">
        <ImageResizerWorkspace />
      </div>
      <section className="section flex flex-col gap-4" aria-labelledby="image-resizer-how">
        <h2 id="image-resizer-how" className="text-2xl font-semibold">
          How to resize an image
        </h2>
        <ol className="list-inside list-decimal">
          <li>Choose one static JPEG, PNG or WebP image and review the oriented local preview.</li>
          <li>
            Enter a pixel width and height with the ratio locked, or unlock it to intentionally
            stretch the image.
          </li>
          <li>Alternatively, resize by a whole percentage from 1 to 400.</li>
          <li>Choose an output format and lossy quality where applicable.</li>
          <li>Resize, review the decoded output and download the result.</li>
        </ol>
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="image-resizer-limits">
        <h2 id="image-resizer-limits" className="text-2xl font-semibold">
          Limits and image quality
        </h2>
        <p className="text-muted-foreground">
          One image up to 16 MiB, 8 megapixels and 8,192 pixels per side; encoded output up to 24
          MiB. The selected format is kept by default. JPEG and WebP use browser lossy encoding;
          JPEG fills transparent pixels with white, while PNG and WebP retain transparency. Browser
          decoding applies EXIF orientation and drops source metadata and color profiles.
        </p>
        <p className="text-muted-foreground">
          A decoded 8 megapixel image and same-size output canvas can use about 64 MiB of pixel
          memory before browser codecs and copies. Processing runs locally in a worker when
          supported, with a canvas fallback for browsers without worker canvas support. Very
          low-memory devices may not be able to resize the largest allowed image. Animated images
          are not supported.
        </p>
        <Link className="text-link" href="/tools/image-compressor">
          Compress an image
        </Link>
        <Link className="text-link" href="/tools/images-to-pdf">
          Create a PDF from images
        </Link>
        <Link className="text-link" href="/categories/image">
          Explore image tools
        </Link>
      </section>
    </main>
  );
}
