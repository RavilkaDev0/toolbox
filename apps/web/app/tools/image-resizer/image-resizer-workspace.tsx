"use client";

import type {
  ImageResizerRequest,
  ImageResizerResponse,
  ImageResizerResult,
} from "@toolbox/browser-engines";
import {
  assertImageResizerSelection,
  calculateImageResizeDimensions,
  type ImageFormat,
  type ImageResizeGeometry,
  type ImageResizeOptions,
  ImageResizerError,
  type ImageSize,
  imageResizeExtension,
  imageResizerLimits,
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
  format: ImageFormat;
  width: number;
  height: number;
  previewUrl: string;
};
type Result = ImageResizerResult & { url: string };
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

export default function ImageResizerWorkspace() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [mode, setMode] = useState<"pixels" | "percentage">("pixels");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [percentage, setPercentage] = useState(100);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [editedDimension, setEditedDimension] = useState<"width" | "height">("width");
  const [format, setFormat] = useState<ImageFormat>("jpeg");
  const [quality, setQuality] = useState(80);
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
    request: ImageResizerRequest,
    onSuccess: (response: ImageResizerResponse) => void,
  ) {
    stopRun();
    const runId = generation.current;
    setError("");
    setAnnouncement("");
    setState(request.action === "prepare" ? "validating" : "processing");
    try {
      const worker = new Worker(new URL("./resize.worker.ts", import.meta.url), {
        type: "module",
      });
      const controller = new AbortController();
      const timer = setTimeout(() => {
        if (runId !== generation.current) return;
        stopRun();
        setError("This image took too long to process. Try a smaller image and run it again.");
        setState("failed");
      }, imageResizerLimits.operationMs);
      currentRun.current = { worker, timer, controller };
      worker.onmessage = async (event: MessageEvent<ImageResizerResponse>) => {
        if (runId !== generation.current) return;
        if (event.data.type === "rasterize") {
          try {
            const { rasterizeResizerImage } = await import("@toolbox/browser-engines");
            const image = await rasterizeResizerImage(
              event.data.file,
              event.data.info,
              event.data.options,
              event.data.preview,
              controller.signal,
            );
            if (runId === generation.current) worker.postMessage({ action: "rasterized", image });
          } catch (caught) {
            if (runId === generation.current)
              worker.postMessage({
                action: "rasterize-error",
                code: caught instanceof ImageResizerError ? caught.code : "CONVERSION_FAILED",
              });
          }
          return;
        }
        clearTimeout(timer);
        currentRun.current = null;
        worker.terminate();
        if (event.data.type === "error") {
          setError(new ImageResizerError(event.data.code).message);
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
        setError(new ImageResizerError("CONVERSION_FAILED").message);
        setState("failed");
      };
      worker.postMessage(request);
    } catch {
      stopRun();
      setError(
        "Background image processing is unavailable in this browser. Update your browser and try again.",
      );
      setState("failed");
    }
  }

  function selectFiles(files: File[]) {
    if (busy || !files.length) return;
    try {
      assertImageResizerSelection(files);
    } catch (caught) {
      setError(caught instanceof ImageResizerError ? caught.message : "Choose one image.");
      setState("failed");
      return;
    }
    const file = files[0];
    if (!file) return;
    clearResult();
    startRun({ action: "prepare", file }, (response) => {
      if (response.type !== "prepared") return;
      if (source) revoke(source.previewUrl);
      const previewUrl = makeUrl(response.preview);
      setSource({
        file,
        format: response.info.format,
        width: response.info.width,
        height: response.info.height,
        previewUrl,
      });
      setMode("pixels");
      setWidth(response.info.width);
      setHeight(response.info.height);
      setPercentage(100);
      setLockAspectRatio(true);
      setEditedDimension("width");
      setFormat(response.info.format);
      setQuality(80);
      setState("ready");
      setAnnouncement("Image checked, oriented and ready to resize.");
    });
  }

  function updateWidth(next: number) {
    setEditedDimension("width");
    setWidth(next);
    clearResult();
    setState(source ? "ready" : "idle");
  }

  function updateHeight(next: number) {
    setEditedDimension("height");
    setHeight(next);
    clearResult();
    setState(source ? "ready" : "idle");
  }

  function updateMode(next: "pixels" | "percentage") {
    setMode(next);
    clearResult();
    setState(source ? "ready" : "idle");
  }

  function updateGeometry(next: ImageResizeGeometry) {
    try {
      if (source) calculateImageResizeDimensions(source, next);
      return true;
    } catch {
      return false;
    }
  }

  function resize() {
    if (!source || busy) return;
    const geometry: ImageResizeGeometry =
      mode === "pixels"
        ? { mode, width, height, lockAspectRatio, editedDimension }
        : { mode, percentage };
    if (!updateGeometry(geometry)) {
      setError(
        "Enter whole pixel dimensions within the supported limits, or a percentage from 1 to 400.",
      );
      setState("failed");
      return;
    }
    clearResult();
    const options: ImageResizeOptions = { ...geometry, format, quality };
    startRun({ action: "resize", file: source.file, options }, (response) => {
      if (response.type !== "result") return;
      setResult({ ...response.result, url: makeUrl(response.result.blob) });
      setState("succeeded");
      setAnnouncement(
        "Resized image was decoded and checked. It is ready to preview and download.",
      );
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
    setMode("pixels");
    setWidth(0);
    setHeight(0);
    setPercentage(100);
    setLockAspectRatio(true);
    setEditedDimension("width");
    setFormat("jpeg");
    setQuality(80);
    setState("idle");
    setError("");
    setAnnouncement("Selected image and result cleared.");
    resetButton.current?.focus();
  }

  const geometry: ImageResizeGeometry =
    mode === "pixels"
      ? { mode, width, height, lockAspectRatio, editedDimension }
      : { mode, percentage };
  let targetSize: ImageSize | null = null;
  let settingsValid = false;
  if (source) {
    try {
      targetSize = calculateImageResizeDimensions(source, geometry);
      settingsValid = true;
    } catch {
      settingsValid = false;
    }
  }
  const displayedDimensions = targetSize ?? { width, height };
  const qualityApplies = format !== "png";

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <FileDropzone
          onFiles={selectFiles}
          accept="image/jpeg,image/png,image/webp"
          inputLabel="Choose one image"
          multiple={false}
          disabled={busy}
          description="One static JPEG, PNG or WebP image. A new selection replaces the current image."
        />
        <p className="text-sm text-muted-foreground">
          Up to {formatBytes(imageResizerLimits.fileBytes)} input,{" "}
          {imageResizerLimits.pixels / 1_000_000} MP and {imageResizerLimits.side} px per side;
          output up to {formatBytes(imageResizerLimits.outputBytes)}. Resizing stays in this browser
          tab.
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
            <Button type="button" onClick={resize} disabled={!settingsValid}>
              Resize image
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
            <FieldLabel htmlFor="image-resize-mode">Resize by</FieldLabel>
            <select
              id="image-resize-mode"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={mode}
              disabled={!source || busy}
              onChange={(event) => updateMode(event.currentTarget.value as "pixels" | "percentage")}
            >
              <option value="pixels">Width and height</option>
              <option value="percentage">Percentage</option>
            </select>
          </Field>
          {mode === "pixels" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="resize-width">Width (px)</FieldLabel>
                  <input
                    id="resize-width"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    type="number"
                    min="1"
                    max={imageResizerLimits.side}
                    step="1"
                    value={lockAspectRatio ? displayedDimensions.width : width}
                    disabled={!source || busy}
                    onChange={(event) => updateWidth(Number(event.currentTarget.value))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="resize-height">Height (px)</FieldLabel>
                  <input
                    id="resize-height"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    type="number"
                    min="1"
                    max={imageResizerLimits.side}
                    step="1"
                    value={lockAspectRatio ? displayedDimensions.height : height}
                    disabled={!source || busy}
                    onChange={(event) => updateHeight(Number(event.currentTarget.value))}
                  />
                </Field>
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={lockAspectRatio}
                  disabled={!source || busy}
                  onChange={(event) => {
                    if (event.currentTarget.checked && source && targetSize) {
                      setWidth(targetSize.width);
                      setHeight(targetSize.height);
                    }
                    setLockAspectRatio(event.currentTarget.checked);
                    clearResult();
                    setState(source ? "ready" : "idle");
                  }}
                />
                Keep aspect ratio
              </label>
              <p className="text-xs text-muted-foreground">
                {lockAspectRatio
                  ? `The other dimension follows ${editedDimension}. Rounded to the nearest pixel.`
                  : "Aspect ratio is unlocked. The image will be stretched if the dimensions differ from its original proportions."}
              </p>
            </>
          ) : (
            <Field>
              <FieldLabel htmlFor="resize-percentage">Scale · {percentage}%</FieldLabel>
              <input
                id="resize-percentage"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                type="number"
                min="1"
                max={imageResizerLimits.maxPercent}
                step="1"
                value={percentage}
                disabled={!source || busy}
                onChange={(event) => {
                  setPercentage(Number(event.currentTarget.value));
                  clearResult();
                  setState(source ? "ready" : "idle");
                }}
              />
              <p className="text-xs text-muted-foreground">
                Whole percentages from 1 to {imageResizerLimits.maxPercent}.
              </p>
            </Field>
          )}
          {targetSize ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Output dimensions: {targetSize.width} × {targetSize.height} px
            </p>
          ) : null}
          <Field>
            <FieldLabel htmlFor="image-resizer-format">Output format</FieldLabel>
            <select
              id="image-resizer-format"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={format}
              disabled={!source || busy}
              onChange={(event) => {
                setFormat(event.currentTarget.value as ImageFormat);
                clearResult();
                setState(source ? "ready" : "idle");
              }}
            >
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
            <p className="text-xs text-muted-foreground">
              The input format is selected by default.
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor="image-resizer-quality">
              Quality · {quality}% {qualityApplies ? "" : "(not used for PNG)"}
            </FieldLabel>
            <input
              id="image-resizer-quality"
              className="w-full accent-primary"
              type="range"
              min="10"
              max="95"
              step="5"
              value={quality}
              disabled={!source || busy || !qualityApplies}
              onChange={(event) => {
                setQuality(Number(event.currentTarget.value));
                clearResult();
                setState(source ? "ready" : "idle");
              }}
              aria-valuetext={qualityApplies ? `${quality} percent` : "Not used for PNG"}
            />
            <p className="text-xs text-muted-foreground">
              JPEG and WebP use lossy quality. PNG and WebP preserve transparency; JPEG uses a white
              background.
            </p>
          </Field>
        </FieldGroup>
      </OptionsPanel>
      {source ? (
        <PreviewPane>
          <p className="mt-3 text-sm text-muted-foreground">
            Original image · EXIF orientation applied
          </p>
          <div className="mt-2 rounded-lg bg-muted p-3">
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
              alt={`Resized ${result.format.toUpperCase()}: ${result.width} by ${result.height} pixels`}
              className="mx-auto max-h-80 max-w-full object-contain"
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Output dimensions</dt>
              <dd className="font-mono">
                {result.width} × {result.height} px
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Output size</dt>
              <dd className="font-mono">{formatBytes(result.outputBytes)}</dd>
            </div>
          </dl>
          <a
            className={`${buttonVariants()} mt-4`}
            href={result.url}
            download={`toolbox-resized-image.${imageResizeExtension(result.format)}`}
          >
            Download resized image
          </a>
        </ResultRegion>
      ) : null}
    </ToolWorkspace>
  );
}
