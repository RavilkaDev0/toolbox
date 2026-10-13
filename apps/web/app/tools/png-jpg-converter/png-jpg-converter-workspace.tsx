"use client";

import type {
  PngJpgConverterRequest,
  PngJpgConverterResponse,
  PngJpgConverterResult,
} from "@toolbox/browser-engines";
import {
  assertPngJpgConverterSelection,
  defaultPngJpgConverterSettings,
  PngJpgConverterError,
  pngJpgConverterLimits,
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
  format: "png" | "jpeg";
  width: number;
  height: number;
  previewUrl: string;
};
type DisplayResult = PngJpgConverterResult & { downloadUrl: string; previewUrl: string };
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

function formatName(file: File) {
  return file.name || "image";
}

export default function PngJpgConverterWorkspace() {
  const [sources, setSources] = useState<SourceImage[]>([]);
  const [quality, setQuality] = useState(defaultPngJpgConverterSettings.quality);
  const [backgroundColor, setBackgroundColor] = useState(
    defaultPngJpgConverterSettings.backgroundColor,
  );
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
  const jpegSettingsApply = sources.some((source) => source.format === "png");

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
    request: PngJpgConverterRequest,
    onSuccess: (response: PngJpgConverterResponse) => void,
  ) {
    stopRun();
    const runId = generation.current;
    const controller = new AbortController();
    setError("");
    setProgress("");
    setAnnouncement("");
    setState(request.action === "prepare" ? "validating" : "processing");
    try {
      const worker = new Worker(new URL("./png-jpg-converter.worker.ts", import.meta.url), {
        type: "module",
      });
      const timer = setTimeout(() => {
        if (runId !== generation.current) return;
        stopRun();
        setError(
          "This batch took too long to process. Try fewer or smaller images and run it again.",
        );
        setState("failed");
      }, pngJpgConverterLimits.operationMs);
      currentRun.current = { worker, timer, controller };
      worker.onmessage = async (event: MessageEvent<PngJpgConverterResponse>) => {
        if (runId !== generation.current) return;
        const message = event.data;
        if (message.type === "rasterize") {
          try {
            const { rasterizePngJpgConverterImage } = await import(
              "@toolbox/browser-engines/png-jpg-converter"
            );
            const image = await rasterizePngJpgConverterImage(
              message.file,
              message.info,
              message.settings,
              message.preview,
              controller.signal,
            );
            if (runId === generation.current) worker.postMessage({ action: "rasterized", image });
          } catch (caught) {
            if (runId === generation.current)
              worker.postMessage({
                action: "rasterize-error",
                code: caught instanceof PngJpgConverterError ? caught.code : "CONVERSION_FAILED",
              });
          }
          return;
        }
        if (message.type === "preview-output") {
          try {
            const { previewPngJpgConverterOutput } = await import(
              "@toolbox/browser-engines/png-jpg-converter"
            );
            const blob = await previewPngJpgConverterOutput(
              message.blob,
              message.width,
              message.height,
              controller.signal,
            );
            if (runId === generation.current)
              worker.postMessage({ action: "output-preview", blob });
          } catch (caught) {
            if (runId === generation.current)
              worker.postMessage({
                action: "output-preview-error",
                code: caught instanceof PngJpgConverterError ? caught.code : "CONVERSION_FAILED",
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
          setError(new PngJpgConverterError(message.code).message);
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
        setError(new PngJpgConverterError("CONVERSION_FAILED").message);
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
      assertPngJpgConverterSelection(files);
    } catch (caught) {
      setError(
        caught instanceof PngJpgConverterError ? caught.message : "Choose PNG or JPEG images.",
      );
      setState("failed");
      return;
    }
    startRun({ action: "prepare", files }, (response) => {
      if (response.type !== "prepared") return;
      const nextSources = response.items.flatMap((image, index) => {
        const file = files[index];
        if (!file) return [];
        return [
          {
            file,
            format: image.format,
            width: image.width,
            height: image.height,
            previewUrl: makeUrl(image.preview),
          },
        ];
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
    setAnnouncement(`${formatName(image.file)} removed.`);
  }

  function convert() {
    if (busy || sources.length === 0) return;
    startRun(
      {
        action: "convert",
        files: sources.map((source) => source.file),
        settings: { quality, backgroundColor },
      },
      (response) => {
        if (response.type !== "result") return;
        const downloadUrl = makeUrl(response.result.blob);
        const previewUrl = makeUrl(response.result.preview);
        setResult({ ...response.result, downloadUrl, previewUrl });
        setState("succeeded");
        setProgress("");
        setAnnouncement(
          `${response.result.items.length} converted ${response.result.items.length === 1 ? "image is" : "images are"} ready to download.`,
        );
      },
    );
  }

  function cancel() {
    if (!busy) return;
    stopRun();
    setProgress("");
    setState("cancelled");
    setAnnouncement("Conversion cancelled. The selected images are still available.");
  }

  function reset() {
    stopRun();
    revokeSources(sources);
    clearResult();
    setSources([]);
    setQuality(defaultPngJpgConverterSettings.quality);
    setBackgroundColor(defaultPngJpgConverterSettings.backgroundColor);
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

  function updateBackgroundColor(value: string) {
    setBackgroundColor(value);
    clearResult();
    if (sources.length) setState("ready");
  }

  return (
    <ToolWorkspace>
      <div className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Images</h2>
        <FileDropzone
          onFiles={selectFiles}
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          inputLabel="Choose PNG or JPEG images"
          description="Add PNG or JPEG images. Each file is checked from its content and decoded locally."
          disabled={busy}
          multiple
        />
        <p className="text-sm text-muted-foreground">
          Up to {pngJpgConverterLimits.files} files · {formatBytes(pngJpgConverterLimits.fileBytes)}
          each · {formatBytes(pngJpgConverterLimits.totalInputBytes)} total · 8 MP and 8,192 px per
          side per image. Files stay in this browser tab.
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
                <p className="mt-2 break-all text-sm font-medium">{source.file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {source.format.toUpperCase()} · {source.width} × {source.height} px ·{" "}
                  {formatBytes(source.file.size)}
                </p>
                <Button
                  className="mt-3 min-h-11"
                  type="button"
                  variant="outline"
                  disabled={busy}
                  aria-label={`Remove image ${index + 1}: ${source.file.name}`}
                  onClick={() => removeImage(index)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No images selected</EmptyTitle>
              <EmptyDescription>
                Add one PNG or JPEG, or a batch of up to {pngJpgConverterLimits.files} images.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <div className="flex flex-wrap gap-3">
          {sources.length && !busy ? (
            <Button type="button" onClick={convert}>
              Convert {sources.length === 1 ? "image" : `${sources.length} images`}
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
          <p className="text-sm text-muted-foreground">
            The actual file content selects the direction: PNG becomes JPEG and JPEG becomes PNG.
          </p>
          <Field>
            <FieldLabel htmlFor="png-jpg-quality">
              JPEG quality · {quality}% {jpegSettingsApply ? "" : "(only used for PNG images)"}
            </FieldLabel>
            <input
              id="png-jpg-quality"
              className="w-full accent-primary"
              type="range"
              min="10"
              max="95"
              step="5"
              value={quality}
              disabled={!jpegSettingsApply || busy}
              onChange={(event) => updateQuality(Number(event.currentTarget.value))}
              aria-valuetext={`${quality} percent`}
            />
            <p className="text-xs text-muted-foreground">
              JPEG is lossy. The setting does not affect JPEG-to-PNG conversions.
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor="png-jpg-background">
              JPEG background for transparent pixels
            </FieldLabel>
            <div className="flex min-h-11 items-center gap-3">
              <input
                id="png-jpg-background"
                className="size-11 rounded-md border border-input bg-background p-1"
                type="color"
                value={backgroundColor}
                disabled={!jpegSettingsApply || busy}
                onChange={(event) => updateBackgroundColor(event.currentTarget.value)}
              />
              <span className="font-mono text-sm uppercase">{backgroundColor}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              White is the default. JPEG has no transparency; transparent PNG pixels are filled with
              this color before encoding.
            </p>
          </Field>
        </FieldGroup>
      </OptionsPanel>

      {sources.length ? (
        <PreviewPane>
          <p className="mt-3 text-sm text-muted-foreground">
            {result
              ? "Verified conversion preview · first output image"
              : "Selected image preview · first file"}
          </p>
          <div className="mt-2 rounded-lg bg-muted p-3">
            <img
              src={result?.previewUrl ?? sources[0]?.previewUrl}
              alt={
                result
                  ? `Converted preview: ${result.items[0]?.format.toUpperCase() ?? "image"}`
                  : `Original preview: ${sources[0]?.width ?? 0} by ${sources[0]?.height ?? 0} pixels`
              }
              className="mx-auto max-h-80 max-w-full object-contain"
            />
          </div>
          {sources.length > 1 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              A batch preview shows the first selected image. All converted files are listed in the
              ZIP result.
            </p>
          ) : null}
        </PreviewPane>
      ) : null}

      {result ? (
        <ResultRegion>
          <p className="mt-3 text-sm font-medium">
            {result.outputKind === "zip"
              ? `${result.items.length} images converted and checked`
              : "Image converted and checked"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Output format</dt>
              <dd>
                {result.outputKind === "zip"
                  ? "ZIP archive"
                  : result.items[0]?.format.toUpperCase()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Download size</dt>
              <dd className="font-mono">{formatBytes(result.outputBytes)}</dd>
            </div>
            {result.outputKind === "zip" ? (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Converted files</dt>
                <dd className="mt-1 space-y-1">
                  {result.items.map((item) => (
                    <div className="break-all" key={item.name}>
                      {item.name} · {item.format.toUpperCase()} · {item.width} × {item.height} px ·{" "}
                      {formatBytes(item.outputBytes)}
                    </div>
                  ))}
                </dd>
              </div>
            ) : (
              <>
                <div>
                  <dt className="text-muted-foreground">Dimensions</dt>
                  <dd className="font-mono">
                    {result.items[0]?.width} × {result.items[0]?.height} px
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Output file</dt>
                  <dd className="break-all">{result.fileName}</dd>
                </div>
              </>
            )}
          </dl>
          <a
            className={`${buttonVariants()} mt-4 min-h-11`}
            href={result.downloadUrl}
            download={result.fileName}
          >
            Download {result.outputKind === "zip" ? "ZIP" : result.items[0]?.format.toUpperCase()}
          </a>
        </ResultRegion>
      ) : null}
    </ToolWorkspace>
  );
}
