"use client";

import type { ImagePdfRequest, ImagePdfResponse, ImagePdfResult } from "@toolbox/browser-engines";
import {
  defaultImagePdfOptions,
  ImagePdfError,
  type ImagePdfOptions,
  moveImage,
} from "@toolbox/core";
import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { Button, buttonVariants } from "@toolbox/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@toolbox/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@toolbox/ui/components/field";
import { useEffect, useRef, useState } from "react";
import { FileDropzone } from "../../_components/workspace/file-dropzone";
import {
  ProcessingStatus,
  type WorkspaceState,
} from "../../_components/workspace/processing-status";
import {
  OptionsPanel,
  ResultRegion,
  ToolWorkspace,
} from "../../_components/workspace/tool-workspace";
import { PdfPreview } from "./pdf-preview";

type SelectedImage = { id: string; file: File; url: string; width: number; height: number };
type Result = ImagePdfResult & { url: string };
export default function ImagesWorkspace() {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [options, setOptions] = useState<ImagePdfOptions>(defaultImagePdfOptions);
  const [state, setState] = useState<WorkspaceState>("idle");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const worker = useRef<Worker | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const urls = useRef(new Set<string>());
  const resetButton = useRef<HTMLButtonElement>(null);
  const dragged = useRef<number | null>(null);
  const busy = state === "validating" || state === "processing";

  function revoke(url: string) {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }
  function makeUrl(blob: Blob) {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  }
  function clearResult() {
    if (result) revoke(result.url);
    setResult(null);
  }
  function stop() {
    generation.current++;
    controller.current?.abort();
    worker.current?.terminate();
    worker.current = null;
  }
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
      worker.current?.terminate();
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    },
    [],
  );

  function run(request: ImagePdfRequest, onSuccess: (response: ImagePdfResponse) => void) {
    stop();
    const current = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    setState(request.action === "prepare" ? "validating" : "processing");
    try {
      const active = new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" });
      worker.current = active;
      active.onmessage = async (event: MessageEvent<ImagePdfResponse>) => {
        if (current !== generation.current) return;
        if (event.data.type === "rasterize") {
          try {
            const { rasterizeImage } = await import("@toolbox/browser-engines");
            const image = await rasterizeImage(
              event.data.file,
              event.data.info,
              event.data.thumbnail,
              abort.signal,
            );
            if (current === generation.current) active.postMessage({ action: "rasterized", image });
          } catch (error) {
            if (current === generation.current)
              active.postMessage({
                action: "rasterize-error",
                code: error instanceof ImagePdfError ? error.code : "CONVERSION_FAILED",
              });
          }
          return;
        }
        active.terminate();
        worker.current = null;
        if (event.data.type === "error") {
          setError(new ImagePdfError(event.data.code).message);
          setState("failed");
        } else onSuccess(event.data);
      };
      active.onerror = (event) => {
        event.preventDefault();
        if (current !== generation.current) return;
        active.terminate();
        worker.current = null;
        setError(new ImagePdfError("CONVERSION_FAILED").message);
        setState("failed");
      };
      active.postMessage(request);
    } catch {
      stop();
      setError(new ImagePdfError("CONVERSION_FAILED").message);
      setState("failed");
    }
  }
  function addFiles(files: File[]) {
    if (busy || !files.length) return;
    const selected = [...images.map((image) => image.file), ...files];
    run({ action: "prepare", files: selected, options }, (response) => {
      if (response.type !== "prepared") return;
      const next = response.images.map((image, index) => {
        const file = selected[index];
        if (!file) throw new ImagePdfError("INVALID_IMAGE");
        return {
          id: images[index]?.id ?? crypto.randomUUID(),
          file,
          width: image.width,
          height: image.height,
          url: makeUrl(image.thumbnail),
        };
      });
      for (const image of images) revoke(image.url);
      clearResult();
      setImages(next);
      setState("ready");
      setAnnouncement(`${next.length} images selected.`);
    });
  }
  function move(from: number, to: number) {
    if (busy || from === to || to < 0 || to >= images.length) return;
    clearResult();
    setImages(moveImage(images, from, to));
    setState("ready");
    setAnnouncement(`Image moved to position ${to + 1} of ${images.length}.`);
  }
  function changeOptions(next: ImagePdfOptions) {
    clearResult();
    setOptions(next);
    setState(images.length ? "ready" : "idle");
  }
  function cancel() {
    stop();
    setState("cancelled");
    setError("");
    setAnnouncement("Operation cancelled.");
    resetButton.current?.focus();
  }
  function reset() {
    stop();
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    setImages([]);
    setResult(null);
    setOptions(defaultImagePdfOptions);
    setState("idle");
    setError("");
    setAnnouncement("All images and the PDF have been cleared.");
    resetButton.current?.focus();
  }
  function convert() {
    if (busy || !images.length) return;
    clearResult();
    run({ action: "convert", files: images.map((image) => image.file), options }, (response) => {
      if (response.type !== "result") return;
      setResult({ ...response.result, url: makeUrl(response.result.blob) });
      setState("succeeded");
    });
  }

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
        <FileDropzone
          onFiles={addFiles}
          accept="image/jpeg,image/png,image/webp"
          inputLabel="Choose images"
          disabled={busy}
          description="JPEG, PNG or static WebP. Up to 10 images; 8 MiB each; 32 MiB total."
        />
        <p className="text-sm text-muted-foreground">
          Up to 12 megapixels per image, 24 megapixels total and 8192 px per side. Processing stays
          on your device. Larger selections must be split into batches.
        </p>
        <ProcessingStatus state={state} />
        {error ? (
          <Alert>
            <AlertTitle>Could not process these images</AlertTitle>
            <AlertDescription>{error} Earlier selections have been kept.</AlertDescription>
          </Alert>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
      <section className="card min-w-0 lg:col-span-2" aria-labelledby="selected-images-title">
        <h2 id="selected-images-title" className="text-lg font-semibold">
          Images · {images.length}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          One image per page, in this order. Drag a thumbnail or use Move up and Move down.
        </p>
        {images.length ? (
          <ol className="mt-4 flex flex-col gap-4">
            {images.map((image, index) => (
              <li
                key={image.id}
                className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row"
                onDragOver={(event) => {
                  if (!busy && dragged.current !== null) event.preventDefault();
                }}
                onDrop={(event) => {
                  if (dragged.current !== null) {
                    event.preventDefault();
                    event.stopPropagation();
                    move(dragged.current, index);
                    dragged.current = null;
                  }
                }}
              >
                <img
                  src={image.url}
                  alt={`Page ${index + 1}: ${image.file.name}`}
                  width={96}
                  height={96}
                  className="size-24 shrink-0 rounded-md bg-muted object-contain"
                  draggable={!busy}
                  onDragStart={(event) => {
                    dragged.current = index;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", image.id);
                  }}
                  onDragEnd={() => {
                    dragged.current = null;
                  }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="break-all font-medium">
                    {index + 1}. {image.file.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {image.width} × {image.height} px · {(image.file.size / 1024).toFixed(1)} KiB
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={`Move image ${index + 1} up`}
                    >
                      Move up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || index === images.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={`Move image ${index + 1} down`}
                    >
                      Move down
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      aria-label={`Remove image ${index + 1}`}
                      onClick={() => {
                        revoke(image.url);
                        const next = images.filter((item) => item.id !== image.id);
                        clearResult();
                        setImages(next);
                        setState(next.length ? "ready" : "idle");
                        setAnnouncement(`Image removed. ${next.length} images remain.`);
                        resetButton.current?.focus();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No images selected</EmptyTitle>
              <EmptyDescription>
                Choose images above to preview and arrange your pages.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
      <OptionsPanel>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pdf-page-size">Page size</FieldLabel>
            <select
              id="pdf-page-size"
              className="input"
              disabled={busy}
              value={options.pageSize}
              onChange={(event) =>
                changeOptions({
                  ...options,
                  pageSize: event.currentTarget.value as ImagePdfOptions["pageSize"],
                })
              }
            >
              <option value="auto">Auto · image size</option>
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="pdf-orientation">Orientation</FieldLabel>
            <select
              id="pdf-orientation"
              className="input"
              disabled={busy || options.pageSize === "auto"}
              value={options.orientation}
              onChange={(event) =>
                changeOptions({
                  ...options,
                  orientation: event.currentTarget.value as ImagePdfOptions["orientation"],
                })
              }
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="pdf-margin">Margins</FieldLabel>
            <select
              id="pdf-margin"
              className="input"
              disabled={busy || options.pageSize === "auto"}
              value={options.margin}
              onChange={(event) =>
                changeOptions({
                  ...options,
                  margin: Number(event.currentTarget.value) as ImagePdfOptions["margin"],
                })
              }
            >
              <option value="0">None</option>
              <option value="10">10 mm</option>
              <option value="20">20 mm</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="pdf-placement">Placement</FieldLabel>
            <select
              id="pdf-placement"
              className="input"
              disabled={busy || options.pageSize === "auto"}
              value={options.placement}
              onChange={(event) =>
                changeOptions({
                  ...options,
                  placement: event.currentTarget.value as ImagePdfOptions["placement"],
                })
              }
            >
              <option value="fit">Fit · whole image</option>
              <option value="fill">Fill · crop edges</option>
            </select>
          </Field>
        </FieldGroup>
        <p className="mt-4 text-sm text-muted-foreground">
          {options.pageSize === "auto"
            ? "Auto follows each image’s proportions at 96 px per inch, without margins or cropping."
            : "Fit keeps the whole image. Fill crops the edges to cover the area inside the margins. Neither stretches the image."}
        </p>
      </OptionsPanel>
      <div className="flex flex-wrap gap-3 lg:col-span-3">
        <Button type="button" disabled={busy || !images.length} onClick={convert}>
          Create PDF
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
                {result.pages} {result.pages === 1 ? "page" : "pages"} ·{" "}
                {(result.blob.size / 1024).toFixed(1)} KiB · PDF verified locally.
              </p>
              <div className="flex flex-wrap gap-3">
                <a className={buttonVariants()} href={result.url} download="toolbox-images.pdf">
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
                This preview is rendered from your generated PDF. Use the page selector to check
                every page before downloading.
              </p>
              <PdfPreview blob={result.blob} pages={result.pages} />
            </div>
          ) : (
            <p className="mt-3 text-muted-foreground">
              Your PDF will appear here after conversion. No files are uploaded.
            </p>
          )}
        </ResultRegion>
      </div>
    </ToolWorkspace>
  );
}
