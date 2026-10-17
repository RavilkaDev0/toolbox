/// <reference lib="webworker" />
import {
  convertPngJpgFiles,
  type PngJpgConverterPreview,
  type PngJpgConverterRasterize,
  type PngJpgConverterRasterized,
  type PngJpgConverterRasterizeReply,
  type PngJpgConverterRequest,
  type PngJpgConverterResponse,
  preparePngJpgConverterFiles,
  previewPngJpgConverterOutput,
} from "@toolbox/browser-engines/png-jpg-converter";
import { PngJpgConverterError } from "@toolbox/core";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let pendingRaster: {
  resolve: (image: PngJpgConverterRasterized) => void;
  reject: (error: PngJpgConverterError) => void;
} | null = null;
let pendingPreview: {
  resolve: (blob: Blob) => void;
  reject: (error: PngJpgConverterError) => void;
} | null = null;

function hasWorkerCanvas(): boolean {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function")
    return false;
  const canvas = new OffscreenCanvas(1, 1);
  try {
    return canvas.getContext("2d") !== null;
  } catch {
    return false;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

const mainThreadRasterize: PngJpgConverterRasterize = (file, info, settings, preview) =>
  new Promise((resolve, reject) => {
    pendingRaster = { resolve, reject };
    worker.postMessage({ type: "rasterize", file, info, settings, preview });
  });

const mainThreadPreview: PngJpgConverterPreview = (blob, width, height) =>
  new Promise((resolve, reject) => {
    pendingPreview = { resolve, reject };
    worker.postMessage({ type: "preview-output", blob, width, height });
  });

worker.onmessage = async (
  event: MessageEvent<PngJpgConverterRequest | PngJpgConverterRasterizeReply>,
) => {
  if (event.data.action === "rasterized" || event.data.action === "rasterize-error") {
    const pending = pendingRaster;
    pendingRaster = null;
    if (event.data.action === "rasterized") pending?.resolve(event.data.image);
    else pending?.reject(new PngJpgConverterError(event.data.code));
    return;
  }
  if (event.data.action === "output-preview" || event.data.action === "output-preview-error") {
    const pending = pendingPreview;
    pendingPreview = null;
    if (event.data.action === "output-preview") pending?.resolve(event.data.blob);
    else pending?.reject(new PngJpgConverterError(event.data.code));
    return;
  }
  try {
    const fallbackRasterize = hasWorkerCanvas() ? undefined : mainThreadRasterize;
    const fallbackPreview = hasWorkerCanvas() ? undefined : mainThreadPreview;
    const response: PngJpgConverterResponse =
      event.data.action === "prepare"
        ? {
            type: "prepared",
            ...(await preparePngJpgConverterFiles(event.data.files, undefined, fallbackRasterize)),
          }
        : {
            type: "result",
            result: await convertPngJpgFiles(
              event.data.files,
              event.data.settings,
              undefined,
              fallbackRasterize,
              fallbackPreview ?? previewPngJpgConverterOutput,
              (completed, total) => worker.postMessage({ type: "progress", completed, total }),
            ),
          };
    worker.postMessage(response);
  } catch (error) {
    const response: PngJpgConverterResponse = {
      type: "error",
      code: error instanceof PngJpgConverterError ? error.code : "CONVERSION_FAILED",
    };
    worker.postMessage(response);
  }
};
