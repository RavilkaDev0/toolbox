"use client";
import type {
  PdfRotateInfo,
  PdfRotateRequest,
  PdfRotateResponse,
  PdfRotateResult,
} from "@toolbox/browser-engines";
import {
  normalizePdfRotation,
  PdfProcessingError,
  parsePageRanges,
  pdfRotateLimits,
} from "@toolbox/core";
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

type SourcePdf = { file: File; info: PdfRotateInfo };
type RotateResult = PdfRotateResult & { url: string };
type PageMode = "all" | "selected";
const selectionMessages = {
  EMPTY: "Enter at least one page, a range, or choose All pages.",
  INVALID_SYNTAX: "Use page numbers and ascending ranges, for example 1-3,5,8.",
  OUT_OF_RANGE: "Choose pages from 1 to the document page count.",
  TOO_LONG: "This page selection is too long. Use a shorter list or range.",
} as const;
const rotationChoices = [
  { delta: -90, label: "Rotate left 90°" },
  { delta: 90, label: "Rotate right 90°" },
  { delta: 180, label: "Rotate 180°" },
] as const;

function rotationPreview(rotations: readonly number[], pages: readonly number[], delta: number) {
  const shown = pages.slice(0, 4).map((pageNumber) => {
    const current = rotations[pageNumber - 1] ?? 0;
    return `Page ${pageNumber}: ${current}° → ${normalizePdfRotation(current, delta)}°`;
  });
  const remainder = pages.length - shown.length;
  return `${shown.join("; ")}${remainder ? `; and ${remainder} more page${remainder === 1 ? "" : "s"}` : ""}`;
}

export default function RotateWorkspace() {
  const [source, setSource] = useState<SourcePdf | null>(null);
  const [rangeText, setRangeText] = useState("1");
  const [pageMode, setPageMode] = useState<PageMode>("all");
  const [delta, setDelta] = useState<-90 | 90 | 180>(90);
  const [state, setState] = useState<WorkspaceState>("idle");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [result, setResult] = useState<RotateResult | null>(null);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultUrl = useRef<string | null>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const rangeId = useId();
  const busy = state === "validating" || state === "processing";
  const range = source ? parsePageRanges(rangeText, source.info.pages) : null;
  const selection =
    source && pageMode === "all" ? parsePageRanges("all", source.info.pages) : range;
  const selectedPages = selection?.ok ? selection.pages : [];
  const selectionError = pageMode === "selected" && selection && !selection.ok ? selection : null;

  function stop() {
    generation.current++;
    worker.current?.terminate();
    worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function clearResult() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setResult(null);
  }
  useEffect(
    () => () => {
      generation.current++;
      worker.current?.terminate();
      if (timer.current) clearTimeout(timer.current);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    },
    [],
  );
  function run(request: PdfRotateRequest, onSuccess: (response: PdfRotateResponse) => void) {
    stop();
    const current = generation.current;
    setError("");
    setAnnouncement("");
    setState(request.action === "inspect" ? "validating" : "processing");
    function failed(code: PdfProcessingError["code"]) {
      if (current !== generation.current) return;
      stop();
      setError(new PdfProcessingError(code).message);
      setState("failed");
      setAnnouncement("PDF processing failed.");
    }
    try {
      const active = new Worker(new URL("./rotate.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = active;
      timer.current = setTimeout(() => failed("RESOURCE_LIMIT"), pdfRotateLimits.jobMilliseconds);
      active.onmessage = (event: MessageEvent<PdfRotateResponse>) => {
        if (current !== generation.current) return;
        stop();
        if (event.data.type === "error") {
          setError(new PdfProcessingError(event.data.code).message);
          setState("failed");
          setAnnouncement("PDF processing failed.");
        } else onSuccess(event.data);
      };
      active.onerror = (event) => {
        event.preventDefault();
        failed("ROTATE_FAILED");
      };
      active.postMessage(request);
    } catch {
      failed("ROTATE_FAILED");
    }
  }
  function chooseFiles(files: File[]) {
    if (busy || !files.length) return;
    if (files.length !== 1) {
      clearResult();
      setError("Choose one PDF at a time.");
      setState("failed");
      return;
    }
    const file = files[0];
    if (!file) return;
    clearResult();
    setSource(null);
    if (file.size > pdfRotateLimits.fileBytes) {
      setError("This PDF is larger than 8 MiB. Choose a smaller document.");
      setState("failed");
      return;
    }
    run({ action: "inspect", file }, (response) => {
      if (response.type !== "inspected") return;
      setSource({ file, info: response.info });
      setRangeText("1");
      setPageMode("all");
      setDelta(90);
      setError("");
      setState("ready");
      setAnnouncement(`PDF ready. ${response.info.pages} pages available.`);
    });
  }
  function process() {
    if (busy || !source || !selection?.ok) return;
    clearResult();
    const chosenPages = [...selection.pages];
    const chosenDelta = delta;
    run(
      { action: "rotate", file: source.file, pages: chosenPages, delta: chosenDelta },
      (response) => {
        if (response.type !== "result") return;
        const url = URL.createObjectURL(response.result.blob);
        resultUrl.current = url;
        setResult({ ...response.result, url });
        setState("succeeded");
        setAnnouncement(
          `${response.result.rotatedPages.length} pages rotated. The PDF was verified.`,
        );
      },
    );
  }
  function cancel() {
    stop();
    setState("cancelled");
    setError("");
    setAnnouncement("Operation cancelled. Your PDF remains selected for retry.");
    resetButton.current?.focus();
  }
  function reset() {
    stop();
    clearResult();
    setSource(null);
    setRangeText("1");
    setPageMode("all");
    setDelta(90);
    setError("");
    setState("idle");
    setAnnouncement("PDF and output cleared.");
    resetButton.current?.focus();
  }

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
        <FileDropzone
          onFiles={chooseFiles}
          accept="application/pdf,.pdf"
          inputLabel="Choose a PDF"
          multiple={false}
          disabled={busy}
          description="One static PDF; up to 8 MiB and 100 pages. Processed in this tab."
        />
        <p className="text-sm text-muted-foreground">
          Input and output are limited to 8 MiB. Files must have no more than 100 pages and finish
          within 45 seconds. Unsupported interactive PDF features are refused.
        </p>
        <ProcessingStatus state={state} />
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
                {source.info.pages} pages · {(source.file.size / 1024).toFixed(1)} KiB
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-5">
              <p className="break-all font-medium">{source.file.name}</p>
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="text-sm font-medium">Pages to rotate</legend>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={pageMode === "all" ? "primary" : "outline"}
                    aria-pressed={pageMode === "all"}
                    disabled={busy}
                    onClick={() => {
                      setPageMode("all");
                      clearResult();
                      setState("ready");
                      setError("");
                    }}
                  >
                    All pages
                  </Button>
                  <Button
                    type="button"
                    variant={pageMode === "selected" ? "primary" : "outline"}
                    aria-pressed={pageMode === "selected"}
                    disabled={busy}
                    onClick={() => {
                      setPageMode("selected");
                      clearResult();
                      setState("ready");
                      setError("");
                    }}
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
                  disabled={busy || pageMode === "all"}
                  aria-invalid={Boolean(selectionError)}
                  aria-describedby="rotate-page-help"
                  onChange={(event) => {
                    setRangeText(event.currentTarget.value);
                    clearResult();
                    setState("ready");
                    setError("");
                  }}
                />
                <p id="rotate-page-help" className="text-sm text-muted-foreground">
                  Use 1, 1-3,5,8 or 1-3,5,8-10. Page numbers start at 1; duplicates are removed.
                </p>
              </Field>
              {selectionError ? (
                <Alert>
                  <AlertTitle>Check the page selection</AlertTitle>
                  <AlertDescription>{selectionMessages[selectionError.code]}</AlertDescription>
                </Alert>
              ) : null}
              {selection?.ok ? (
                <p className="text-sm" aria-live="polite">
                  {selection.pages.length} of {source.info.pages} pages selected.
                </p>
              ) : null}
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="text-sm font-medium">Rotation</legend>
                <div className="flex flex-wrap gap-2">
                  {rotationChoices.map((choice) => (
                    <Button
                      key={choice.delta}
                      type="button"
                      variant={delta === choice.delta ? "primary" : "outline"}
                      aria-pressed={delta === choice.delta}
                      disabled={busy}
                      onClick={() => {
                        setDelta(choice.delta);
                        clearResult();
                        setState("ready");
                        setError("");
                      }}
                    >
                      {choice.label}
                    </Button>
                  ))}
                </div>
              </fieldset>
              {selection?.ok ? (
                <p className="break-words text-sm text-muted-foreground" aria-live="polite">
                  Rotation preview: {rotationPreview(source.info.rotations, selectedPages, delta)}.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No PDF selected</EmptyTitle>
              <EmptyDescription>
                Choose one static PDF to preview its pages and set the rotation.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
      <div className="flex flex-wrap gap-3 lg:col-span-3">
        <Button type="button" disabled={busy || !source || !selection?.ok} onClick={process}>
          Apply rotation
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
      <div className="min-w-0 lg:col-span-3">
        <ResultRegion>
          {result ? (
            <div className="mt-4 flex flex-col gap-4">
              <p>
                {result.rotatedPages.length} pages rotated · {result.pages} pages ·{" "}
                {(result.blob.size / 1024).toFixed(1)} KiB · reopened and verified in this browser.
              </p>
              <a className={buttonVariants()} href={result.url} download="toolbox-rotated.pdf">
                Download PDF
              </a>
              <p className="text-sm text-muted-foreground">Preview of the rotated PDF output.</p>
              <PdfPreview key={result.url} blob={result.blob} pages={result.pages} />
            </div>
          ) : source ? (
            <div className="mt-4 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Preview of the source PDF.</p>
              <PdfPreview blob={source.file} pages={source.info.pages} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              The rotated PDF will appear here after processing.
            </p>
          )}
        </ResultRegion>
      </div>
    </ToolWorkspace>
  );
}
