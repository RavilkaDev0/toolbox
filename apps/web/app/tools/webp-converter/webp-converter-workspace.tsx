"use client";

import type {
  WebpConverterRequest,
  WebpConverterResponse,
  WebpConverterResult,
} from "@toolbox/browser-engines/webp-converter";
import {
  assertWebpConverterSelection,
  defaultWebpConverterSettings,
  WebpConverterError,
  webpConverterLimits,
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
  format: "jpeg" | "png";
  width: number;
  height: number;
  previewUrl: string;
};
type DisplayResult = WebpConverterResult & { downloadUrl: string; previewUrl: string };
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

function sizeComparison(inputBytes: number, outputBytes: number) {
  if (inputBytes === outputBytes) return "same size";
  const percent = Math.round((Math.abs(inputBytes - outputBytes) / inputBytes) * 100);
  return outputBytes < inputBytes ? `${percent}% smaller` : `${percent}% larger`;
}

export default function WebpConverterWorkspace() {
  const [sources, setSources] = useState<SourceImage[]>([]);
  const [quality, setQuality] = useState(defaultWebpConverterSettings.quality);
  const [state, setState] = useState<WorkspaceState>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [result, setResult] = useState<DisplayResult | null>(null);
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
    if (!result) return;
    revoke(result.downloadUrl);
    revoke(result.previewUrl);
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

  function revokeSources(images: readonly SourceImage[]) {
    for (const image of images) revoke(image.previewUrl);
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
    request: WebpConverterRequest,
    onSuccess: (response: WebpConverterResponse) => void,
  ) {
    stopRun();
    const runId = generation.current;
    const controller = new AbortController();
    setError("");
    setProgress("");
    setAnnouncement("");
    setState(request.action === "prepare" ? "validating" : "processing");
    try {
      const worker = new Worker(new URL("./webp-converter.worker.ts", import.meta.url), {
        type: "module",
      });
      const timer = setTimeout(() => {
        if (runId !== generation.current) return;
        stopRun();
        setError("This image batch took too long. Try fewer or smaller images and run it again.");
        setState("failed");
      }, webpConverterLimits.operationMs);
      currentRun.current = { worker, timer, controller };
      worker.onmessage = async (event: MessageEvent<WebpConverterResponse>) => {
        if (runId !== generation.current) return;
        const message = event.data;
        if (message.type === "rasterize") {
          try {
            const { rasterizeWebpConverterImage } = await import(
              "@toolbox/browser-engines/webp-converter"
            );
            const image = await rasterizeWebpConverterImage(
              message.file,
              message.info,
              message.settings,
              message.thumbnail,
              controller.signal,
            );
            if (runId === generation.current) worker.postMessage({ action: "rasterized", image });
          } catch (caught) {
            if (runId === generation.current)
              worker.postMessage({
                action: "rasterize-error",
                code: caught instanceof WebpConverterError ? caught.code : "CONVERSION_FAILED",
              });
          }
          return;
        }
        if (message.type === "progress") {
          setProgress(`Converted and checked ${message.completed} of ${message.total} images.`);
          return;
        }
        clearTimeout(timer);
        currentRun.current = null;
        worker.terminate();
        if (message.type === "error") {
          setError(new WebpConverterError(message.code).message);
          setState("failed");
          return;
        }
        onSuccess(message);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        if (runId !== generation.current) return;
        clearTimeout(timer);
        currentRun.current = null;
        worker.terminate();
        setError(new WebpConverterError("CONVERSION_FAILED").message);
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

  function selectFiles(incoming: File[]) {
    if (busy || incoming.length === 0) return;
    const files = [...sources.map((source) => source.file), ...incoming];
    try {
      assertWebpConverterSelection(files);
    } catch (caught) {
      setError(
        caught instanceof WebpConverterError ? caught.message : "Choose JPEG or PNG images.",
      );
      setState("failed");
      return;
    }
    startRun({ action: "prepare", files }, (response) => {
      if (response.type !== "prepared") return;
      const nextSources = response.items.flatMap((image, index) => {
        const file = files[index];
        if (!file) return [];
        return [{ ...image, file, previewUrl: makeUrl(image.preview) }];
      });
      revokeSources(sources);
      clearResult();
      setSources(nextSources);
      setState("ready");
      setAnnouncement(`${nextSources.length} images checked and ready to convert.`);
    });
  }

  function removeImage(index: number) {
    if (busy) return;
    const image = sources[index];
    if (!image) return;
    const remaining = sources.filter((_, itemIndex) => itemIndex !== index);
    revoke(image.previewUrl);
    clearResult();
    setSources(remaining);
    setError("");
    setProgress("");
    setState(remaining.length ? "ready" : "idle");
    setAnnouncement(`${image.file.name || "Image"} removed.`);
  }

  function convert() {
    if (busy || sources.length === 0) return;
    startRun(
      { action: "convert", files: sources.map((source) => source.file), settings: { quality } },
      (response) => {
        if (response.type !== "result") return;
        setResult({
          ...response.result,
          downloadUrl: makeUrl(response.result.blob),
          previewUrl: makeUrl(response.result.preview),
        });
        setState("succeeded");
        setProgress("");
        setAnnouncement(`${response.result.items.length} WebP image(s) are ready to download.`);
      },
    );
  }

  function cancel() {
    if (!busy) return;
    stopRun();
    setProgress("");
    setState("cancelled");
    setAnnouncement("Conversion cancelled. The selected images are still available.");
    resetButton.current?.focus();
  }

  function reset() {
    stopRun();
    revokeSources(sources);
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    setSources([]);
    setResult(null);
    setQuality(defaultWebpConverterSettings.quality);
    setError("");
    setProgress("");
    setState("idle");
    setAnnouncement("Images and results cleared.");
    resetButton.current?.focus();
  }

  function updateQuality(value: number) {
    setQuality(value);
    clearResult();
    if (sources.length) setState("ready");
  }

  return (
    <ToolWorkspace>
      <div className="card flex min-w-0 flex-col gap-4">
        <h2 className="text-lg font-semibold">Images</h2>
        <FileDropzone
          onFiles={selectFiles}
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          inputLabel="Choose JPEG or PNG images"
          description="Add static JPEG or PNG images. Their content is checked and processed in this browser tab."
          disabled={busy}
          multiple
        />
        <p className="text-sm text-muted-foreground">
          Up to {webpConverterLimits.files} files · {formatBytes(webpConverterLimits.fileBytes)}{" "}
          each · {formatBytes(webpConverterLimits.totalInputBytes)} total · 8 MP and 8,192 px per
          side per image. Files stay on this device.
        </p>
        <ProcessingStatus state={state} />
        {progress ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {progress}
          </p>
        ) : null}
        {error ? (
          <Alert>
            <AlertTitle>Could not prepare or convert these images</AlertTitle>
            <AlertDescription>{error} Your current selection is still available.</AlertDescription>
          </Alert>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
        {sources.length ? (
          <ol className="grid gap-3 sm:grid-cols-2">
            {sources.map((source, index) => (
              <li
                className="min-w-0 rounded-xl border border-border p-3"
                key={`${index}-${source.file.name}-${source.file.size}`}
              >
                <div className="rounded-lg bg-muted p-2">
                  <img
                    src={source.previewUrl}
                    alt={`Preview of ${source.format.toUpperCase()} image, ${source.width} by ${source.height} pixels`}
                    className="mx-auto max-h-44 max-w-full object-contain"
                  />
                </div>
                <p className="mt-2 break-all text-sm font-medium">{source.file.name || "Image"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {source.format.toUpperCase()} · {source.width} × {source.height} px ·{" "}
                  {formatBytes(source.file.size)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => removeImage(index)}
                  disabled={busy}
                  aria-label={`Remove ${source.file.name || "image"}`}
                >
                  Remove image
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Select images to get started</EmptyTitle>
              <EmptyDescription>Convert one or more JPEG or PNG files to WebP.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <div className="flex flex-wrap gap-2">
          {busy ? (
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button type="button" onClick={convert} disabled={!sources.length}>
              Convert to WebP
            </Button>
          )}
          <Button type="button" variant="outline" onClick={reset} ref={resetButton}>
            Reset
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <OptionsPanel title="WebP settings">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="webp-quality">Lossy WebP quality · {quality}%</FieldLabel>
              <input
                id="webp-quality"
                aria-label="Lossy WebP quality"
                type="range"
                min={10}
                max={95}
                step={5}
                value={quality}
                onChange={(event) => updateQuality(Number(event.currentTarget.value))}
                disabled={busy || !sources.length}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                This browser encoder exposes lossy WebP quality only. Lossless mode is not offered.
                PNG transparency is retained; output may be larger than the source.
              </p>
            </Field>
          </FieldGroup>
        </OptionsPanel>
        <PreviewPane title="Converted preview">
          {result ? (
            <img
              src={result.previewUrl}
              alt={`Converted WebP preview, ${result.items[0]?.width ?? 0} by ${result.items[0]?.height ?? 0} pixels`}
              className="max-h-[28rem] max-w-full object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              The checked WebP result will appear here.
            </p>
          )}
        </PreviewPane>
        <ResultRegion title="Download WebP result" visible={Boolean(result)}>
          {result ? (
            <div className="flex min-w-0 flex-col gap-3">
              <p className="break-all text-sm text-muted-foreground">
                {result.outputKind === "zip" ? "ZIP archive" : "WebP image"} ·{" "}
                {formatBytes(result.outputBytes)}
              </p>
              <ul className="grid gap-2 text-sm">
                {result.items.map((item) => (
                  <li key={item.name} className="break-all rounded-lg border border-border p-3">
                    <span className="font-medium">{item.name}</span>
                    <span className="block text-muted-foreground">
                      {item.width} × {item.height} px · {formatBytes(item.inputBytes)} →{" "}
                      {formatBytes(item.outputBytes)} (
                      {sizeComparison(item.inputBytes, item.outputBytes)})
                    </span>
                  </li>
                ))}
              </ul>
              <a className={buttonVariants()} href={result.downloadUrl} download={result.fileName}>
                Download {result.outputKind === "zip" ? "ZIP" : "WebP"}
              </a>
            </div>
          ) : null}
        </ResultRegion>
        <OptionsPanel title="About WebP output">
          <p className="text-sm text-muted-foreground">
            WebP encoding is local. The browser verifies the output signature, dimensions and
            decode. Conversion does not guarantee a smaller file and does not add a lossless
            encoding mode.
          </p>
        </OptionsPanel>
      </div>
    </ToolWorkspace>
  );
}
