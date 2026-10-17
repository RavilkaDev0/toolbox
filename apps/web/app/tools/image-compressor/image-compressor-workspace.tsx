"use client";

import type {
  ImageCompressionResult,
  ImageCompressorRequest,
  ImageCompressorResponse,
} from "@toolbox/browser-engines";
import {
  assertCompressorSelection,
  compressionExtension,
  defaultImageCompressionQuality,
  type ImageCompressionFormat,
  type ImageCompressionOptions,
  ImageCompressorError,
  imageCompressorLimits,
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
  PreviewPane,
  ResultRegion,
  ToolWorkspace,
} from "../../_components/workspace/tool-workspace";

type SourceImage = {
  file: File;
  format: ImageCompressionFormat;
  width: number;
  height: number;
  previewUrl: string;
};
type Result = ImageCompressionResult & { url: string };
type ActiveRun = {
  worker: Worker;
  timer: ReturnType<typeof setTimeout>;
  controller: AbortController;
};

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
    : `${(bytes / 1024).toFixed(1)} KiB`;
}

export default function ImageCompressorWorkspace() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [format, setFormat] = useState<ImageCompressionFormat>("jpeg");
  const [quality, setQuality] = useState(defaultImageCompressionQuality);
  const [state, setState] = useState<WorkspaceState>("idle");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const currentRun = useRef<ActiveRun | null>(null);
  const generation = useRef(0);
  const urls = useRef(new Set<string>());
  const resetButton = useRef<HTMLButtonElement>(null);
  const busy = state === "validating" || state === "processing";

  function makeUrl(blob: Blob) {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  }

  function revoke(url: string) {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }

  function clearResult() {
    if (result) revoke(result.url);
    setResult(null);
  }

  function stopRun() {
    generation.current++;
    const active = currentRun.current;
    currentRun.current = null;
    if (active) {
      clearTimeout(active.timer);
      active.controller.abort();
      active.worker.terminate();
    }
  }

  useEffect(
    () => () => {
      generation.current++;
      if (currentRun.current) {
        clearTimeout(currentRun.current.timer);
        currentRun.current.controller.abort();
        currentRun.current.worker.terminate();
      }
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    },
    [],
  );

  function startRun(
    request: ImageCompressorRequest,
    onSuccess: (response: ImageCompressorResponse) => void,
  ) {
    stopRun();
    const runId = generation.current;
    setError("");
    setAnnouncement("");
    setState(request.action === "prepare" ? "validating" : "processing");
    try {
      const worker = new Worker(new URL("./compress.worker.ts", import.meta.url), {
        type: "module",
      });
      const controller = new AbortController();
      const timer = setTimeout(() => {
        if (runId !== generation.current) return;
        stopRun();
        setError("This image took too long to process. Try a smaller image and run it again.");
        setState("failed");
      }, 30_000);
      currentRun.current = { worker, timer, controller };
      worker.onmessage = async (event: MessageEvent<ImageCompressorResponse>) => {
        if (runId !== generation.current) return;
        if (event.data.type === "rasterize") {
          try {
            const { rasterizeCompressorImage } = await import("@toolbox/browser-engines");
            const image = await rasterizeCompressorImage(
              event.data.file,
              event.data.info,
              event.data.format,
              event.data.quality,
              event.data.thumbnail,
              controller.signal,
            );
            if (runId === generation.current) worker.postMessage({ action: "rasterized", image });
          } catch (caught) {
            if (runId === generation.current)
              worker.postMessage({
                action: "rasterize-error",
                code: caught instanceof ImageCompressorError ? caught.code : "CONVERSION_FAILED",
              });
          }
          return;
        }
        clearTimeout(timer);
        currentRun.current = null;
        worker.terminate();
        if (event.data.type === "error") {
          setError(new ImageCompressorError(event.data.code).message);
          setState("failed");
          return;
        }
        onSuccess(event.data);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        if (runId !== generation.current) return;
        clearTimeout(timer);
        currentRun.current = null;
        worker.terminate();
        setError(new ImageCompressorError("CONVERSION_FAILED").message);
        setState("failed");
      };
      worker.postMessage(request);
    } catch {
      stopRun();
      setError(new ImageCompressorError("CONVERSION_FAILED").message);
      setState("failed");
    }
  }

  function selectFiles(files: File[]) {
    if (busy || !files.length) return;
    try {
      assertCompressorSelection(files);
    } catch (caught) {
      setError(caught instanceof ImageCompressorError ? caught.message : "Choose one image.");
      setState("failed");
      return;
    }
    const file = files[0];
    if (!file) return;
    clearResult();
    startRun({ action: "prepare", file }, (response) => {
      if (response.type !== "prepared") return;
      if (source) revoke(source.previewUrl);
      clearResult();
      const previewUrl = makeUrl(response.preview);
      setSource({
        file,
        format: response.info.format,
        width: response.info.width,
        height: response.info.height,
        previewUrl,
      });
      setFormat(response.info.format);
      setQuality(defaultImageCompressionQuality);
      setState("ready");
      setAnnouncement("Image checked and ready to compress.");
    });
  }

  function changeFormat(next: ImageCompressionFormat) {
    clearResult();
    setFormat(next);
    setState(source ? "ready" : "idle");
  }

  function changeQuality(next: number) {
    clearResult();
    setQuality(next);
    setState(source ? "ready" : "idle");
  }

  function compress() {
    if (!source || busy) return;
    clearResult();
    const options: ImageCompressionOptions = { format, quality };
    startRun({ action: "compress", file: source.file, options }, (response) => {
      if (response.type !== "result") return;
      setResult({ ...response.result, url: makeUrl(response.result.blob) });
      setState("succeeded");
      setAnnouncement("Compressed image is ready to preview and download.");
    });
  }

  function cancel() {
    stopRun();
    setState("cancelled");
    setError("");
    setAnnouncement("Operation cancelled. Your selected image is still available.");
    resetButton.current?.focus();
  }

  function reset() {
    stopRun();
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    setSource(null);
    setResult(null);
    setFormat("jpeg");
    setQuality(defaultImageCompressionQuality);
    setState("idle");
    setError("");
    setAnnouncement("Selected image and result cleared.");
    resetButton.current?.focus();
  }

  const sizeDelta = result ? result.inputBytes - result.outputBytes : null;
  const reduction = result
    ? Math.round((Math.abs(sizeDelta ?? 0) / result.inputBytes) * 100)
    : null;
  const qualityApplies = format !== "png";

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <FileDropzone
          onFiles={selectFiles}
          accept="image/jpeg,image/png,image/webp"
          inputLabel="Choose one image"
          multiple={imageCompressorLimits.files > 1}
          disabled={busy}
          description="One static JPEG, PNG or WebP image per run. A new selection replaces the current image."
        />
        <p className="text-sm text-muted-foreground">
          Up to {formatBytes(imageCompressorLimits.fileBytes)} input,{" "}
          {imageCompressorLimits.pixels / 1_000_000} MP and {imageCompressorLimits.side} px per
          side. Your image stays in this browser tab.
        </p>
        <ProcessingStatus state={state} />
        {error ? (
          <Alert>
            <AlertTitle>Could not process this image</AlertTitle>
            <AlertDescription>{error} Your earlier selection is still available.</AlertDescription>
          </Alert>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
        {source ? (
          <div className="rounded-xl border border-border p-4">
            <p className="break-all font-medium">{source.file.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {source.format.toUpperCase()} · {source.width} × {source.height} px ·{" "}
              {formatBytes(source.file.size)}
            </p>
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No image selected</EmptyTitle>
              <EmptyDescription>
                Choose a supported image to inspect and preview it.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <div className="flex flex-wrap gap-3">
          {source && !busy ? (
            <Button type="button" onClick={compress}>
              Compress image
            </Button>
          ) : null}
          {busy ? (
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
          ) : null}
          <Button ref={resetButton} type="button" variant="outline" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>
      <OptionsPanel>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="image-output-format">Output format</FieldLabel>
            <select
              id="image-output-format"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={format}
              disabled={!source || busy}
              onChange={(event) =>
                changeFormat(event.currentTarget.value as ImageCompressionFormat)
              }
            >
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="image-quality">
              Quality · {quality}% {qualityApplies ? "" : "(not used for PNG)"}
            </FieldLabel>
            <input
              id="image-quality"
              className="w-full accent-primary"
              type="range"
              min="10"
              max="95"
              step="5"
              value={quality}
              disabled={!source || busy || !qualityApplies}
              onChange={(event) => changeQuality(Number(event.currentTarget.value))}
              aria-valuetext={qualityApplies ? `${quality} percent` : "Not used for PNG"}
            />
            <p className="text-xs text-muted-foreground">
              JPEG and WebP use lossy quality. PNG is lossless; its output can be larger than the
              source.
            </p>
          </Field>
        </FieldGroup>
      </OptionsPanel>
      {source ? (
        <PreviewPane>
          <div className="mt-4 rounded-lg bg-muted p-3">
            <img
              src={source.previewUrl}
              alt={`Original: ${source.width} by ${source.height} pixels`}
              className="mx-auto max-h-80 max-w-full object-contain"
            />
          </div>
        </PreviewPane>
      ) : null}
      {result ? (
        <ResultRegion>
          <div className="mt-4 rounded-lg bg-muted p-3">
            <img
              src={result.url}
              alt={`Compressed ${result.format.toUpperCase()}: ${result.width} by ${result.height} pixels`}
              className="mx-auto max-h-80 max-w-full object-contain"
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Original</dt>
              <dd className="font-mono">{formatBytes(result.inputBytes)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Output</dt>
              <dd className="font-mono">{formatBytes(result.outputBytes)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm font-medium" role="status">
            {sizeDelta !== null && sizeDelta > 0
              ? `${reduction === 0 ? "Less than 1%" : `${reduction}%`} smaller`
              : sizeDelta === 0
                ? "Output is the same size"
                : `${reduction === 0 ? "Less than 1%" : `${reduction}%`} larger`}
          </p>
          <a
            className={`${buttonVariants()} mt-4`}
            href={result.url}
            download={`toolbox-image.${compressionExtension(result.format)}`}
          >
            Download image
          </a>
        </ResultRegion>
      ) : null}
    </ToolWorkspace>
  );
}
