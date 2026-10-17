"use client";
import type {
  PdfSplitInfo,
  PdfSplitRequest,
  PdfSplitResponse,
  PdfSplitResult,
} from "@toolbox/browser-engines";
import { PdfProcessingError, parsePageRanges, pdfSplitLimits } from "@toolbox/core";
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

type SourcePdf = { file: File; info: PdfSplitInfo };
type SplitResult = PdfSplitResult & { url: string };
const selectionMessages = {
  EMPTY: "Enter at least one page, a range, or choose All pages.",
  INVALID_SYNTAX: "Use page numbers and ascending ranges, for example 1-3,5,8.",
  OUT_OF_RANGE: "Choose pages from 1 to the document page count.",
  TOO_LONG: "This page selection is too long. Use a shorter list or range.",
} as const;

export default function SplitWorkspace() {
  const [source, setSource] = useState<SourcePdf | null>(null);
  const [rangeText, setRangeText] = useState("all");
  const [mode, setMode] = useState<"extract" | "split">("extract");
  const [state, setState] = useState<WorkspaceState>("idle");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [result, setResult] = useState<SplitResult | null>(null);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultUrl = useRef<string | null>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const rangeId = useId();
  const modeId = useId();
  const busy = state === "validating" || state === "processing";
  const selection = source ? parsePageRanges(rangeText, source.info.pages) : null;
  const selectedPages = selection?.ok ? selection.pages : [];
  const estimate = mode === "extract" ? 1 : selectedPages.length;

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
  function run(request: PdfSplitRequest, onSuccess: (response: PdfSplitResponse) => void) {
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
      const active = new Worker(new URL("./split.worker.ts", import.meta.url), { type: "module" });
      worker.current = active;
      timer.current = setTimeout(() => failed("RESOURCE_LIMIT"), pdfSplitLimits.jobMilliseconds);
      active.onmessage = (event: MessageEvent<PdfSplitResponse>) => {
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
        failed("SPLIT_FAILED");
      };
      active.postMessage(request);
    } catch {
      failed("SPLIT_FAILED");
    }
  }
  function chooseFiles(files: File[]) {
    if (busy || !files.length) return;
    if (files.length !== 1) {
      setError("Choose one PDF at a time.");
      setState("failed");
      return;
    }
    const file = files[0];
    if (!file) return;
    clearResult();
    setSource(null);
    if (file.size > pdfSplitLimits.fileBytes) {
      setError("This PDF is larger than 8 MiB. Choose a smaller document.");
      setState("failed");
      return;
    }
    run({ action: "inspect", file }, (response) => {
      if (response.type !== "inspected") return;
      setSource({ file, info: response.info });
      setRangeText("all");
      setError("");
      setState("ready");
      setAnnouncement(`PDF ready. ${response.info.pages} pages available.`);
    });
  }
  function process() {
    if (busy || !source || !selection?.ok) return;
    clearResult();
    const action = mode;
    run({ action, mode: action, file: source.file, pages: selection.pages }, (response) => {
      if (response.type !== "result") return;
      const url = URL.createObjectURL(response.result.blob);
      resultUrl.current = url;
      setResult({ ...response.result, url });
      setState("succeeded");
      setAnnouncement(
        action === "extract"
          ? `${response.result.pages} pages extracted.`
          : `${response.result.files} separate PDFs packed into a ZIP.`,
      );
    });
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
    setRangeText("all");
    setMode("extract");
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
          Extract or split output is limited to 8 MiB and processing stops after 45 seconds.
          Unsupported active PDF features are refused.
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
              <Field>
                <FieldLabel htmlFor={modeId}>Output mode</FieldLabel>
                <select
                  id={modeId}
                  className="input"
                  value={mode}
                  disabled={busy}
                  onChange={(event) => {
                    setMode(event.currentTarget.value === "split" ? "split" : "extract");
                    clearResult();
                    setError("");
                  }}
                >
                  <option value="extract">Extract selected pages into one PDF</option>
                  <option value="split">Split into one PDF per page (ZIP)</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor={rangeId}>Pages</FieldLabel>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <input
                    id={rangeId}
                    className="input min-w-0 flex-1"
                    value={rangeText}
                    inputMode="text"
                    autoComplete="off"
                    disabled={busy}
                    aria-invalid={Boolean(selection && !selection.ok)}
                    aria-describedby="page-selection-help"
                    onChange={(event) => {
                      setRangeText(event.currentTarget.value);
                      clearResult();
                      setState("ready");
                      setError("");
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setRangeText("all");
                      clearResult();
                      setError("");
                      setState("ready");
                    }}
                  >
                    All pages
                  </Button>
                </div>
                <p id="page-selection-help" className="text-sm text-muted-foreground">
                  Use 1-3,5,8. Page numbers start at 1; duplicates are removed and output is in
                  source order.
                </p>
              </Field>
              {selection && !selection.ok ? (
                <Alert>
                  <AlertTitle>Check the page selection</AlertTitle>
                  <AlertDescription>{selectionMessages[selection.code]}</AlertDescription>
                </Alert>
              ) : null}
              {selection?.ok ? (
                <p aria-live="polite" className="text-sm">
                  {selection.pages.length} of {source.info.pages} pages selected · estimated output:{" "}
                  {estimate} {mode === "extract" ? "PDF" : "PDF files"}
                </p>
              ) : null}
              <PdfPreview blob={source.file} pages={source.info.pages} />
            </CardContent>
          </Card>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No PDF selected</EmptyTitle>
              <EmptyDescription>
                Choose a static PDF to preview pages and select what to extract.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
      <div className="flex flex-wrap gap-3 lg:col-span-3">
        <Button type="button" disabled={busy || !source || !selection?.ok} onClick={process}>
          {mode === "extract" ? "Extract pages" : "Split PDF"}
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
                {result.files} output {result.files === 1 ? "file" : "files"} · {result.pages} pages
                · {(result.blob.size / 1024).toFixed(1)} KiB · verified in this browser.
              </p>
              <a
                className={buttonVariants()}
                href={result.url}
                download={result.mode === "extract" ? "toolbox-extracted.pdf" : "toolbox-pages.zip"}
              >
                {result.mode === "extract" ? "Download PDF" : "Download ZIP"}
              </a>
              {result.mode === "extract" ? (
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Preview of the extracted PDF.
                  </p>
                  <PdfPreview key={result.url} blob={result.blob} pages={result.pages} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  ZIP entries use safe page-number filenames. Every PDF was reopened and checked
                  before it was added.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              The extracted PDF or ZIP will appear here after processing.
            </p>
          )}
        </ResultRegion>
      </div>
    </ToolWorkspace>
  );
}
