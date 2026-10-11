"use client";
import { Field, FieldLabel } from "@toolbox/ui/components/field";
import { useEffect, useRef, useState } from "react";

export function PdfPreview({ blob, pages }: { blob: Blob; pages: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("Rendering PDF preview…");
  const [error, setError] = useState(false);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const controller = new AbortController();
    let worker: Worker | undefined;
    setStatus("Rendering PDF preview…");
    setError(false);
    async function draw() {
      try {
        const { renderPdfPage } = await import("@toolbox/browser-engines");
        if (!target || controller.signal.aborted) return;
        worker = new Worker(new URL("./pdf-preview.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.onerror = (event) => {
          event.preventDefault();
          if (controller.signal.aborted) return;
          setError(true);
          setStatus("Preview could not be displayed. Open or download the PDF to view it.");
          controller.abort();
        };
        await renderPdfPage(blob, page, target, worker, controller.signal);
        if (!controller.signal.aborted) setStatus(`Showing PDF page ${page} of ${pages}.`);
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setStatus("Preview could not be displayed. Open or download the PDF to view it.");
        }
      } finally {
        worker?.terminate();
      }
    }
    void draw();
    return () => {
      controller.abort();
      target.width = 0;
      target.height = 0;
    };
  }, [blob, page, pages]);
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="pdf-preview-page">PDF preview page</FieldLabel>
        <select
          id="pdf-preview-page"
          className="input"
          value={page}
          onChange={(event) => setPage(Number(event.currentTarget.value))}
        >
          {Array.from({ length: pages }, (_, index) => (
            <option value={index + 1} key={index + 1}>
              Page {index + 1}
            </option>
          ))}
        </select>
      </Field>
      <p role="status" aria-live="polite">
        {status}
      </p>
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Generated PDF page ${page}`}
        hidden={error}
        className="mx-auto h-auto max-w-full rounded-md border border-border"
      >
        Visual preview of the generated PDF. Open PDF to view it in your preferred reader.
      </canvas>
    </div>
  );
}
