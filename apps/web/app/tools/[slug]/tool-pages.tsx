"use client";

import type { ToolDefinition } from "@toolbox/core";
import {
  type ComponentType,
  type LazyExoticComponent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";

type ToolPageProps = { tool: ToolDefinition };

type LazyToolPage = LazyExoticComponent<ComponentType<ToolPageProps>>;

function ReadyToolPage({
  Page,
  tool,
  onReady,
}: {
  Page: LazyToolPage;
  tool: ToolDefinition;
  onReady: (slug: string) => void;
}) {
  useEffect(() => onReady(tool.slug), [onReady, tool.slug]);
  return <Page tool={tool} />;
}

const toolPages: Record<string, LazyToolPage> = {
  "case-converter": lazy(() =>
    import("../case-converter/case-converter-page").then((module) => ({
      default: module.CaseConverterPage,
    })),
  ),
  "contact-qr": lazy(() =>
    import("../contact-qr/contact-qr-page").then((module) => ({ default: module.ContactQrPage })),
  ),
  "image-compressor": lazy(() =>
    import("../image-compressor/image-compressor-page").then((module) => ({
      default: module.ImageCompressorPage,
    })),
  ),
  "image-resizer": lazy(() =>
    import("../image-resizer/image-resizer-page").then((module) => ({
      default: module.ImageResizerPage,
    })),
  ),
  "images-to-pdf": lazy(() =>
    import("./images-to-pdf-page").then((module) => ({ default: module.ImagesToPdfPage })),
  ),
  "merge-pdf": lazy(() =>
    import("../merge-pdf/merge-page").then((module) => ({ default: module.MergePage })),
  ),
  "password-generator": lazy(() =>
    import("../password-generator/password-generator-page").then((module) => ({
      default: module.PasswordGeneratorPage,
    })),
  ),
  "pdf-to-png": lazy(() =>
    import("../pdf-to-png/pdf-to-png-page").then((module) => ({ default: module.PdfToPngPage })),
  ),
  "png-jpg-converter": lazy(() =>
    import("../png-jpg-converter/png-jpg-converter-page").then((module) => ({
      default: module.PngJpgConverterPage,
    })),
  ),
  "qr-designer": lazy(() =>
    import("../qr-designer/qr-designer-page").then((module) => ({
      default: module.QrDesignerPage,
    })),
  ),
  "rotate-pdf": lazy(() =>
    import("../rotate-pdf/rotate-page").then((module) => ({ default: module.RotatePage })),
  ),
  "split-pdf": lazy(() =>
    import("../split-pdf/split-page").then((module) => ({ default: module.SplitPage })),
  ),
  "webp-converter": lazy(() =>
    import("../webp-converter/webp-converter-page").then((module) => ({
      default: module.WebpConverterPage,
    })),
  ),
  "wifi-qr": lazy(() =>
    import("../wifi-qr/wifi-qr-page").then((module) => ({ default: module.WifiQrPage })),
  ),
  "word-counter": lazy(() =>
    import("../word-counter/word-counter-page").then((module) => ({
      default: module.WordCounterPage,
    })),
  ),
};

export function ToolPages({ tool }: ToolPageProps) {
  const [readySlug, setReadySlug] = useState<string | null>(null);
  const markReady = useCallback((slug: string) => setReadySlug(slug), []);
  const isReady = readySlug === tool.slug;
  const Page = toolPages[tool.slug];
  return Page ? (
    <>
      <p
        role="status"
        aria-live="polite"
        hidden={isReady}
        className="container-site py-3 text-sm text-muted-foreground"
      >
        Loading {tool.title}…
      </p>
      <div aria-busy={!isReady} data-tool-page-ready={isReady ? "true" : "false"} inert={!isReady}>
        <Suspense fallback={<div aria-hidden="true" className="min-h-48" />}>
          <ReadyToolPage Page={Page} tool={tool} onReady={markReady} />
        </Suspense>
      </div>
    </>
  ) : null;
}
