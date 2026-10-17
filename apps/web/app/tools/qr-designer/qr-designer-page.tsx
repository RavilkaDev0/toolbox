import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import QrDesignerWorkspace from "./qr-designer-workspace";

export function QrDesignerPage({ tool }: { tool: ToolDefinition }) {
  return (
    <main className="container-site page max-w-workspace flex-1" id="main-content" tabIndex={-1}>
      <header className="section flex flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">QR tools · Browser-local</p>
        <h1 className="text-4xl font-semibold tracking-tight">{tool.title}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          Create an accessible QR code from plain text or an HTTP(S) URL. Adjust the look, add a
          small logo, and download a PNG or vector SVG after a local scan check.
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Your text and logo stay in this browser tab. The QR is decoded locally before download;
          different cameras and scanning apps can still vary.
        </p>
      </header>
      <section className="section" aria-label="QR designer workspace">
        <QrDesignerWorkspace />
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="qr-how">
        <h2 id="qr-how" className="text-2xl font-semibold">
          How to make a QR code
        </h2>
        <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
          <li>Enter a complete HTTP or HTTPS URL, or switch to plain text.</li>
          <li>Choose a preset, size, quiet zone, contrast-safe colors and error correction.</li>
          <li>
            Optionally add a small PNG or JPEG logo. The tool normalizes it to a safe raster image.
          </li>
          <li>
            Wait for the PNG and vector SVG to decode back to the exact content, then download
            either format.
          </li>
        </ol>
        <p className="max-w-3xl text-sm text-muted-foreground">
          QR data is encoded with Reed–Solomon error correction. Logos and decorative module styles
          can reduce scan reliability; this tool blocks downloads when its independent browser
          scanner cannot read the exact content. It does not guarantee that every camera will scan
          every design. Payloads are limited to 2 KiB before the QR version and error-correction
          capacity are considered. Logo files must be PNG or JPEG, at most 1 MiB, 512 pixels per
          side and 0.25 megapixels. Animated or vector logos are not accepted.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Related tools">
          <Link className="text-link" href="/categories/qr">
            Explore QR tools
          </Link>
          <Link className="text-link" href="/categories/image">
            Explore image tools
          </Link>
          <Link className="text-link" href="/tools">
            Browse all published tools
          </Link>
        </nav>
      </section>
    </main>
  );
}
