"use client";

import type { PdfToPngInfo, PdfToPngProgress, PdfToPngResult } from "@toolbox/browser-engines";
import { pdfToPngSettingsSchema } from "@toolbox/contracts";
import type { PdfToPngDpi } from "@toolbox/core";
import { PdfProcessingError, parsePageRanges, pdfToPngLimits } from "@toolbox/core";
import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { Button, buttonVariants } from "@toolbox/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@toolbox/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@toolbox/ui/components/empty";
import { Field, FieldLabel } from "@toolbox/ui/components/field";
import { useEffect, useId, useRef, useState } from "react";
import { FileDropzone } from "../../_components/workspace/file-dropzone";
import { PdfPreview } from "../../_components/workspace/pdf-preview";
import {
  ProcessingStatus,
  type WorkspaceState,
} from "../../_components/workspace/processing-status";
import { ResultRegion, ToolWorkspace } from "../../_components/workspace/tool-workspace";

type SourcePdf = { file: File; info: PdfToPngInfo };
type WorkspaceResult = PdfToPngResult & { url: string; previewUrl: string };
type PageMode = "all" | "selected";
type PdfWorkerRun = {
  id: number;
  worker: Worker;
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
};

const pageSelectionMessages = {
  EMPTY: "Enter at least one page, a range, or choose All pages.",
  INVALID_SYNTAX: "Use page numbers and ascending ranges, for example 1-3,5,8.",
  OUT_OF_RANGE: "Choose pages from 1 to the document page count.",
  TOO_LONG: "This page selection is too long. Use a shorter list or range.",
} as const;

function processingError(error: unknown) {
  return error instanceof PdfProcessingError ? error : new PdfProcessingError("RENDER_FAILED");
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
    : `${(bytes / 1024).toFixed(1)} KiB`;
}

export default function PdfToPngWorkspace() {
  const [source, setSource] = useState<SourcePdf | null>(null);
  const [mode, setMode] = useState<PageMode>("all");
  const [rangeText, setRangeText] = useState("1");
  const [dpi, setDpi] = useState<PdfToPngDpi>(96);
  const [background, setBackground] = useState<"transparent" | "white">("transparent");
  const [state, setState] = useState<WorkspaceState>("idle");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [rendering, setRendering] = useState<PdfToPngProgress | null>(null);
  const [result, setResult] = useState<WorkspaceResult | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const currentRun = useRef<PdfWorkerRun | null>(null);
  const generation = useRef(0);
  const resultUrls = useRef<string[]>([]);
  const resetButton = useRef<HTMLButtonElement>(null);
  const rangeId = useId();
  const dpiId = useId();
  const backgroundId = useId();
  const busy = state === "validating" || state === "processing";
  const range = source ? parsePageRanges(rangeText, source.info.pages) : null;
  const selection = source && mode === "all" ? parsePageRanges("all", source.info.pages) : range;
  const selectedPages = selection?.ok ? selection.pages : [];
  const selectionError = mode === "selected" && selection && !selection.ok ? selection : null;

  function revokeResult() {
    for (const url of resultUrls.current) URL.revokeObjectURL(url);
    resultUrls.current = [];
    setResult(null);
  }

  function stopRun() {
    generation.current++;
    const active = currentRun.current;
    currentRun.current = null;
    if (active) {
      clearTimeout(active.timer);
      active.controller.abort(new PdfProcessingError("CANCELLED"));
      active.worker.terminate();
    }
  }

  function startRun(nextState: "validating" | "processing") {
    stopRun();
    const id = generation.current;
    const controller = new AbortController();
    const worker = new Worker(
      new URL("../../_components/workspace/pdf-preview.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    const timer = setTimeout(
      () => controller.abort(new PdfProcessingError("RESOURCE_LIMIT")),
      pdfToPngLimits.jobMilliseconds,
    );
    const run = { id, worker, controller, timer };
    currentRun.current = run;
    worker.onerror = (event) => {
      event.preventDefault();
      controller.abort(new PdfProcessingError("RENDER_FAILED"));
    };
    setState(nextState);
    setError("");
    setAnnouncement("");
    return run;
  }

  function finishRun(run: PdfWorkerRun) {
    clearTimeout(run.timer);
    run.worker.terminate();
    if (currentRun.current?.id === run.id) currentRun.current = null;
  }

  function reportError(run: PdfWorkerRun, caught: unknown) {
    if (run.id !== generation.current) return;
    const failure = processingError(caught);
    setError(
      failure.code === "RESOURCE_LIMIT"
        ? "This PDF exceeds a file, page, pixel, time, or output limit. Try fewer pages, 96 DPI, or a smaller PDF."
        : failure.message,
    );
    setState(failure.code === "CANCELLED" ? "cancelled" : "failed");
    setAnnouncement(
      failure.code === "CANCELLED" ? "PDF rendering cancelled." : "PDF rendering failed.",
    );
    setRendering(null);
  }

  async function chooseFile(files: File[]) {
    if (busy || files.length === 0) return;
    stopRun();
    revokeResult();
    setSource(null);
    setRendering(null);
    setMode("all");
    setRangeText("1");
    setDpi(96);
    setBackground("transparent");
    if (files.length !== 1 || !files[0]) {
      setError("Choose one PDF at a time.");
      setState("failed");
      return;
    }
    const file = files[0];
    let run: PdfWorkerRun | null = null;
    try {
      run = startRun("validating");
      const { inspectPdfToPng } = await import("@toolbox/browser-engines");
      const info = await inspectPdfToPng(file, run.worker, run.controller.signal);
      if (run.id !== generation.current) return;
      setSource({ file, info });
      setState("ready");
      setAnnouncement(`PDF ready. ${info.pages} ${info.pages === 1 ? "page" : "pages"} available.`);
    } catch (caught) {
      if (run)
        reportError(run, run.controller.signal.aborted ? run.controller.signal.reason : caught);
      else {
        setError(processingError(caught).message);
        setState("failed");
      }
    } finally {
      if (run) finishRun(run);
    }
  }

  async function render() {
    if (busy || !source || !selection?.ok || !canvas.current) return;
    const options = pdfToPngSettingsSchema.safeParse({
      mode,
      pages: mode === "all" ? [] : selectedPages,
      dpi,
      background,
    });
    if (!options.success) {
      setError("Review the page selection and PDF settings.");
      setState("failed");
      return;
    }
    revokeResult();
    setRendering(null);
    let run: PdfWorkerRun | null = null;
    const target = canvas.current;
    try {
      const activeRun = startRun("processing");
      run = activeRun;
      const { renderPdfToPng } = await import("@toolbox/browser-engines");
      const generated = await renderPdfToPng(
        source.file,
        options.data,
        target,
        activeRun.worker,
        activeRun.controller.signal,
        (progress) => {
          if (activeRun.id !== generation.current) return;
          setRendering(progress);
        },
      );
      if (activeRun.id !== generation.current) return;
      const url = URL.createObjectURL(generated.blob);
      const previewUrl =
        generated.preview === generated.blob ? url : URL.createObjectURL(generated.preview);
      resultUrls.current = previewUrl === url ? [url] : [url, previewUrl];
      setResult({ ...generated, url, previewUrl });
      setState("succeeded");
      setRendering(null);
      setAnnouncement(
        `${generated.images.length} PNG ${generated.images.length === 1 ? "image" : "images"} rendered and checked.`,
      );
    } catch (caught) {
      if (run)
        reportError(run, run.controller.signal.aborted ? run.controller.signal.reason : caught);
      else {
        setError(processingError(caught).message);
        setState("failed");
      }
    } finally {
      target.width = 0;
      target.height = 0;
      if (run) finishRun(run);
    }
  }

  function cancel() {
    stopRun();
    setRendering(null);
    setState("cancelled");
    setError("");
    setAnnouncement("Rendering cancelled. The PDF remains available for another attempt.");
    resetButton.current?.focus();
  }

  function reset() {
    stopRun();
    revokeResult();
    setSource(null);
    setMode("all");
    setRangeText("1");
    setDpi(96);
    setBackground("transparent");
    setRendering(null);
    setError("");
    setState("idle");
    setAnnouncement("PDF and output cleared.");
    resetButton.current?.focus();
  }

  function updateSetting(change: () => void) {
    revokeResult();
    change();
    setError("");
    setState(source ? "ready" : "idle");
    setRendering(null);
  }

  useEffect(
    () => () => {
      generation.current++;
      const active = currentRun.current;
      currentRun.current = null;
      if (active) {
        clearTimeout(active.timer);
        active.controller.abort(new PdfProcessingError("CANCELLED"));
        active.worker.terminate();
      }
      for (const url of resultUrls.current) URL.revokeObjectURL(url);
      resultUrls.current = [];
      if (canvas.current) {
        canvas.current.width = 0;
        canvas.current.height = 0;
      }
    },
    [],
  );

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-3">
        <FileDropzone
          onFiles={(files) => void chooseFile(files)}
          accept="application/pdf,.pdf"
          inputLabel="Choose a PDF"
          multiple={false}
          disabled={busy}
          description="One static PDF · up to 8 MiB and 100 pages · processed in this tab."
        />
        <p className="text-sm text-muted-foreground">
          Each output page is limited to 8 megapixels and 8,192 pixels per edge. An operation is
          limited to 120 megapixels, 45 seconds, 16 MiB per PNG, or 32 MiB for a ZIP. Page rendering
          runs one page at a time.
        </p>
        <ProcessingStatus state={state} />
        {state === "processing" && rendering ? (
          <p
            className="text-sm text-muted-foreground"
            aria-live="polite"
            data-testid="render-progress"
          >
            Rendered page {rendering.page} · {rendering.completed} of {rendering.total} complete.
          </p>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
        {error ? (
          <Alert>
            <AlertTitle>PDF could not be processed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="min-w-0 lg:col-span-3">
        {source ? (
          <Card>
            <CardHeader>
              <CardTitle>Source PDF</CardTitle>
              <CardDescription>
                {source.info.pages} pages · {formatBytes(source.file.size)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-5">
              <p className="break-all font-medium">{source.file.name}</p>
              <fieldset className="flex min-w-0 flex-col gap-2" disabled={busy}>
                <legend className="text-sm font-medium">Pages to render</legend>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={mode === "all" ? "primary" : "outline"}
                    aria-pressed={mode === "all"}
                    onClick={() => updateSetting(() => setMode("all"))}
                  >
                    All pages
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "selected" ? "primary" : "outline"}
                    aria-pressed={mode === "selected"}
                    onClick={() => updateSetting(() => setMode("selected"))}
                  >
                    Selected pages
                  </Button>
                </div>
              </fieldset>
              <Field>
                <FieldLabel htmlFor={rangeId}>Page numbers</FieldLabel>
                <input
                  id={rangeId}
                  className="input min-w-0"
                  value={rangeText}
                  inputMode="text"
                  autoComplete="off"
                  disabled={busy || mode === "all"}
                  aria-invalid={Boolean(selectionError)}
                  aria-describedby="pdf-to-png-range-help"
                  onChange={(event) => updateSetting(() => setRangeText(event.currentTarget.value))}
                />
                <p id="pdf-to-png-range-help" className="text-sm text-muted-foreground">
                  Use 1-3,5,8. Page numbers start at 1; duplicates are removed and output is in
                  source order.
                </p>
              </Field>
              {selectionError ? (
                <Alert>
                  <AlertTitle>Check the page selection</AlertTitle>
                  <AlertDescription>{pageSelectionMessages[selectionError.code]}</AlertDescription>
                </Alert>
              ) : null}
              {selection?.ok ? (
                <p className="text-sm" aria-live="polite">
                  {selection.pages.length} of {source.info.pages} pages selected.
                </p>
              ) : null}
              <Field>
                <FieldLabel htmlFor={dpiId}>Image resolution</FieldLabel>
                <select
                  id={dpiId}
                  className="input"
                  value={dpi}
                  disabled={busy}
                  onChange={(event) =>
                    updateSetting(() => setDpi(Number(event.currentTarget.value) as PdfToPngDpi))
                  }
                >
                  <option value={96}>96 DPI · screen</option>
                  <option value={192}>192 DPI · higher resolution</option>
                </select>
                <p className="text-sm text-muted-foreground">
                  Output pixels use the PDF page size × DPI ÷ 72 points per inch.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor={backgroundId}>PNG background</FieldLabel>
                <select
                  id={backgroundId}
                  className="input"
                  value={background}
                  disabled={busy}
                  onChange={(event) =>
                    updateSetting(() =>
                      setBackground(
                        event.currentTarget.value === "white" ? "white" : "transparent",
                      ),
                    )
                  }
                >
                  <option value="transparent">Transparent</option>
                  <option value="white">White</option>
                </select>
                <p className="text-sm text-muted-foreground">
                  Transparent keeps unpainted page areas clear. White fills the full page before
                  rendering.
                </p>
              </Field>
              <PdfPreview blob={source.file} pages={source.info.pages} firstPageOnly />
            </CardContent>
          </Card>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No PDF selected</EmptyTitle>
              <EmptyDescription>
                Choose a static PDF to inspect its pages and set rendering options.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      <canvas ref={canvas} className="hidden" />

      <div className="flex flex-wrap gap-3 lg:col-span-3">
        <Button
          type="button"
          disabled={busy || !source || !selection?.ok}
          onClick={() => void render()}
        >
          Render PNG{selectedPages.length === 1 ? "" : "s"}
        </Button>
        {busy ? (
          <Button type="button" variant="outline" onClick={cancel}>
            Cancel
          </Button>
        ) : null}
        <Button ref={resetButton} type="button" variant="outline" onClick={reset}>
          Reset
        </Button>
      </div>

      {result ? (
        <div className="lg:col-span-3">
          <ResultRegion>
            <div className="flex flex-col gap-4">
              <p>
                {result.images.length} page{result.images.length === 1 ? "" : "s"} rendered ·{" "}
                {result.format.toUpperCase()} · {formatBytes(result.blob.size)} ·{" "}
                {result.durationMs} ms
              </p>
              <p className="text-sm text-muted-foreground">
                Pages {result.pages.join(", ")} at {dpi} DPI with a {background} background.
              </p>
              <a
                className={buttonVariants()}
                href={result.url}
                download={
                  result.format === "png"
                    ? `toolbox-page-${String(result.pages[0]).padStart(3, "0")}.png`
                    : "toolbox-pages.zip"
                }
              >
                Download {result.format === "png" ? "PNG" : "ZIP"}
              </a>
              <figure className="flex min-w-0 flex-col gap-2">
                <figcaption className="text-sm font-medium">
                  Actual output preview · page {result.images[0]?.page ?? 1}
                </figcaption>
                {result.images[0] ? (
                  <div className="mx-auto max-w-full bg-muted p-2">
                    <img
                      src={result.previewUrl}
                      alt={`Rendered PDF page ${result.images[0].page}, ${result.images[0].width} by ${result.images[0].height} pixels`}
                      width={result.images[0].width}
                      height={result.images[0].height}
                      className="mx-auto h-auto max-w-full rounded-md border border-border"
                    />
                  </div>
                ) : null}
              </figure>
              <ul
                className="flex flex-col gap-1 text-sm text-muted-foreground"
                aria-label="Rendered image details"
              >
                {result.images.map((image) => (
                  <li key={image.page}>
                    Page {image.page}: {image.width} × {image.height} px ·{" "}
                    {formatBytes(image.bytes)}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                The result is rendered locally by PDF.js. Only image dimensions and download size
                are shown; file contents are not sent to Toolbox.
              </p>
            </div>
          </ResultRegion>
        </div>
      ) : null}
    </ToolWorkspace>
  );
}
