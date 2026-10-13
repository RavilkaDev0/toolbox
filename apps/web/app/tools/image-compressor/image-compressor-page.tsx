import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import ImageCompressorWorkspace from "./image-compressor-workspace";

export function ImageCompressorPage({ tool }: { tool: ToolDefinition }) {
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
        <p className="mt-6">Enable JavaScript to compress images locally in your browser.</p>
      </noscript>
      <div className="mt-8">
        <ImageCompressorWorkspace />
      </div>
      <section className="section flex flex-col gap-4" aria-labelledby="image-compressor-how">
        <h2 id="image-compressor-how" className="text-2xl font-semibold">
          How to compress an image
        </h2>
        <ol className="list-inside list-decimal">
          <li>Choose one static JPEG, PNG or WebP image and review its local preview.</li>
          <li>
            Choose JPEG, PNG or WebP output. JPEG and WebP quality can be adjusted from 10 to 95.
          </li>
          <li>
            Compress, inspect the actual encoded output and compare its byte size with the source.
          </li>
          <li>
            Download the image. Choose a different output format if the first result is larger.
          </li>
        </ol>
        <p className="text-muted-foreground">
          The image is decoded and re-encoded in your browser. Pixel dimensions and orientation are
          retained. PNG uses lossless browser encoding and may grow; JPEG flattens transparent
          pixels against white; PNG and WebP retain transparency. Browser codecs may change color
          handling and remove EXIF/ICC metadata. This is not archival color conversion.
        </p>
        <p className="text-muted-foreground">
          Inputs are limited to 16 MiB, 8 megapixels and 8,192 pixels on an edge; output is limited
          to 24 MiB. A decoded 8-megapixel image uses about 32 MiB per RGBA pixel buffer, before
          canvas, encoder and output memory. Limits reduce memory use but cannot prevent every
          low-memory browser from closing a tab. Animated images and damaged files are not
          supported.
        </p>
        <Link className="text-link" href="/tools/images-to-pdf">
          Create a PDF from images
        </Link>
        <Link className="text-link" href="/tools/image-resizer">
          Resize an image
        </Link>
      </section>
    </main>
  );
}
