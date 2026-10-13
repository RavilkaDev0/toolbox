/// <reference lib="webworker" />
import {
  prepareWebpConverterFiles,
  rasterizeWebpConverterImage,
  type WebpConverterRasterize,
  type WebpConverterRasterizeReply,
  type WebpConverterRasterized,
  type WebpConverterRequest,
  type WebpConverterResponse,
  convertWebpFiles,
} from "@toolbox/browser-engines/webp-converter";
import { WebpConverterError } from "@toolbox/core";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let pendingRaster: {
  resolve: (image: WebpConverterRasterized) => void;
  reject: (error: WebpConverterError) => void;
} | null = null;

async function hasWorkerWebpEncoder(): Promise<boolean> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function")
    return false;
  const canvas = new OffscreenCanvas(1, 1);
  try {
    if (canvas.getContext("2d") === null) return false;
    return (await canvas.convertToBlob({ type: "image/webp", quality: 0.8 })).type === "image/webp";
  } catch {
    return false;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

const mainThreadRasterize: WebpConverterRasterize = (file, info, settings, thumbnail) =>
  new Promise((resolve, reject) => {
    pendingRaster = { resolve, reject };
    worker.postMessage({ type: "rasterize", file, info, settings, thumbnail });
  });

worker.onmessage = async (
  event: MessageEvent<WebpConverterRequest | WebpConverterRasterizeReply>,
) => {
  if (event.data.action === "rasterized" || event.data.action === "rasterize-error") {
    const pending = pendingRaster;
    pendingRaster = null;
    if (event.data.action === "rasterized") pending?.resolve(event.data.image);
    else pending?.reject(new WebpConverterError(event.data.code));
    return;
  }
  try {
    const fallback = (await hasWorkerWebpEncoder()) ? undefined : mainThreadRasterize;
    const response: WebpConverterResponse =
      event.data.action === "prepare"
        ? {
            type: "prepared",
            ...(await prepareWebpConverterFiles(event.data.files, undefined, fallback)),
          }
        : {
            type: "result",
            result: await convertWebpFiles(
              event.data.files,
              event.data.settings,
              undefined,
              fallback,
              (completed, total) => worker.postMessage({ type: "progress", completed, total }),
            ),
          };
    worker.postMessage(response);
  } catch (error) {
    worker.postMessage({
      type: "error",
      code: error instanceof WebpConverterError ? error.code : "CONVERSION_FAILED",
    } satisfies WebpConverterResponse);
  }
};
