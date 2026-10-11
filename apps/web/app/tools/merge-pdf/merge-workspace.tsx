"use client";
import type { PdfMergeRequest, PdfMergeResponse, PdfMergeResult } from "@toolbox/browser-engines";
import { moveDocument, PdfMergeError, pdfMergeLimits } from "@toolbox/core";
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
import { useEffect, useRef, useState } from "react";
import { FileDropzone } from "../../_components/workspace/file-dropzone";
import { PdfPreview } from "../../_components/workspace/pdf-preview";
import {
  ProcessingStatus,
  type WorkspaceState,
} from "../../_components/workspace/processing-status";
import { ResultRegion, ToolWorkspace } from "../../_components/workspace/tool-workspace";

type SelectedPdf = { id: string; file: File; pages: number };
type Result = PdfMergeResult & { url: string };
export default function MergeWorkspace() {
  const [documents, setDocuments] = useState<SelectedPdf[]>([]);
  const [state, setState] = useState<WorkspaceState>("idle");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultUrl = useRef<string | null>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const dragged = useRef<number | null>(null);
  const busy = state === "validating" || state === "processing";
  const totalPages = documents.reduce((total, document) => total + document.pages, 0);
  const previewDocument = documents.find((document) => document.id === preview);

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
  function run(request: PdfMergeRequest, onSuccess: (response: PdfMergeResponse) => void) {
    stop();
    setPreview(null);
    const current = generation.current;
    setError("");
    setState(request.action === "inspect" ? "validating" : "processing");
    setAnnouncement("");
    function failed(code: PdfMergeError["code"]) {
      if (current !== generation.current) return;
      stop();
      setError(new PdfMergeError(code).message);
      setState("failed");
    }
    try {
      const active = new Worker(new URL("./merge.worker.ts", import.meta.url), { type: "module" });
      worker.current = active;
      timer.current = setTimeout(() => failed("RESOURCE_LIMIT"), pdfMergeLimits.jobMilliseconds);
      active.onmessage = (event: MessageEvent<PdfMergeResponse>) => {
        if (current !== generation.current) return;
        stop();
        if (event.data.type === "error") {
          setError(new PdfMergeError(event.data.code).message);
          setState("failed");
        } else onSuccess(event.data);
      };
      active.onerror = (event) => {
        event.preventDefault();
        failed("MERGE_FAILED");
      };
      active.postMessage(request);
    } catch {
      failed("MERGE_FAILED");
    }
  }
  function addFiles(files: File[]) {
    if (busy || !files.length) return;
    const selected = [...documents.map((document) => document.file), ...files];
    run({ action: "inspect", files: selected }, (response) => {
      if (response.type !== "inspected") return;
      const next = response.documents.map((info, index) => {
        const file = selected[index];
        if (!file) throw new PdfMergeError("INVALID_PDF");
        return { id: documents[index]?.id ?? crypto.randomUUID(), file, pages: info.pages };
      });
      clearResult();
      setDocuments(next);
      setState("ready");
      setAnnouncement(`${next.length} documents selected.`);
    });
  }
  function move(from: number, to: number) {
    if (busy || from === to || to < 0 || to >= documents.length) return;
    clearResult();
    setDocuments(moveDocument(documents, from, to));
    setState("ready");
    setAnnouncement(`Document moved to position ${to + 1} of ${documents.length}.`);
  }
  function reset() {
    stop();
    clearResult();
    setPreview(null);
    setDocuments([]);
    setError("");
    setState("idle");
    setAnnouncement("All documents and the PDF have been cleared.");
    resetButton.current?.focus();
  }
  function cancel() {
    stop();
    setState("cancelled");
    setError("");
    setAnnouncement("Operation cancelled.");
    resetButton.current?.focus();
  }
  function merge() {
    if (busy || documents.length < 2) return;
    clearResult();
    run({ action: "merge", files: documents.map((document) => document.file) }, (response) => {
      if (response.type !== "result") return;
      const url = URL.createObjectURL(response.result.blob);
      resultUrl.current = url;
      setResult({ ...response.result, url });
      setState("succeeded");
    });
  }
  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
        <FileDropzone
          onFiles={addFiles}
          accept="application/pdf,.pdf"
          inputLabel="Choose PDFs"
          disabled={busy}
          description="2–10 static PDFs; 8 MiB each; 24 MiB total. No uploads."
        />
        <p className="text-sm text-muted-foreground">
          Up to 100 pages per document and 200 total. Embedded images: 12 MP each, 24 MP per
          document. Output: up to 48 MiB. Processing stops after 45 seconds. For larger PDFs, split
          the batch.
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
        {documents.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Documents · {documents.length}</CardTitle>
              <CardDescription>
                {totalPages} pages total. All pages are merged in this document order. Drag a row or
                use Move up and Move down.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {documents.map((document, index) => (
                  <li
                    key={document.id}
                    draggable={!busy}
                    className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                    onDragStart={(event) => {
                      dragged.current = index;
                      event.dataTransfer.setData("text/plain", document.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      dragged.current = null;
                    }}
                    onDragOver={(event) => {
                      if (!busy && dragged.current !== null) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragged.current !== null) move(dragged.current, index);
                      dragged.current = null;
                    }}
                  >
                    <div className="min-w-0">
                      <p className="break-all font-medium">
                        {index + 1}. {document.file.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {document.pages} pages · {(document.file.size / 1024).toFixed(1)} KiB
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || index === 0}
                        aria-label={`Move document ${index + 1} up`}
                        onClick={() => move(index, index - 1)}
                      >
                        Move up
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || index === documents.length - 1}
                        aria-label={`Move document ${index + 1} down`}
                        onClick={() => move(index, index + 1)}
                      >
                        Move down
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        aria-label={`Preview document ${index + 1}`}
                        onClick={() => setPreview(preview === document.id ? null : document.id)}
                      >
                        Preview first page
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        aria-label={`Remove document ${index + 1}`}
                        onClick={() => {
                          clearResult();
                          setPreview(null);
                          setDocuments(documents.filter((_, position) => position !== index));
                          setState(documents.length > 1 ? "ready" : "idle");
                          setAnnouncement("Document removed.");
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No PDFs selected</EmptyTitle>
              <EmptyDescription>
                Choose at least two static PDF documents to get started.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
      {previewDocument ? (
        <div className="min-w-0 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Document preview</CardTitle>
              <CardDescription>First page only; merging keeps every original page.</CardDescription>
            </CardHeader>
            <CardContent>
              <PdfPreview
                key={previewDocument.id}
                blob={previewDocument.file}
                pages={previewDocument.pages}
                firstPageOnly
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 lg:col-span-3">
        <Button type="button" disabled={busy || documents.length < 2} onClick={merge}>
          Merge PDFs
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
                {result.pages} pages · {(result.blob.size / 1024).toFixed(1)} KiB · PDF verified
                locally.
              </p>
              <div className="flex flex-wrap gap-3">
                <a className={buttonVariants()} href={result.url} download="toolbox-merged.pdf">
                  Download PDF
                </a>
                <a
                  className={buttonVariants("outline")}
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open PDF
                </a>
              </div>
              <p className="text-sm text-muted-foreground">
                Review the actual merged PDF. Page dimensions, rotations and content streams were
                checked after saving.
              </p>
              <PdfPreview key={result.url} blob={result.blob} pages={result.pages} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Your merged PDF will appear here after processing.
            </p>
          )}
        </ResultRegion>
      </div>
    </ToolWorkspace>
  );
}
