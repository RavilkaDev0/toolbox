/// <reference lib="webworker" />
import {
  type ImageResizerInfo,
  type ImageResizerRasterized,
  type ImageResizerRasterizeReply,
  type ImageResizerRequest,
  type ImageResizerResponse,
  prepareResizerImage,
  resizeImage,
} from "@toolbox/browser-engines";
import { ImageResizerError } from "@toolbox/core";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let pendingRaster: {
  resolve: (image: ImageResizerRasterized) => void;
  reject: (error: ImageResizerError) => void;
} | null = null;

function hasOffscreenCanvas2d() {
  if (typeof OffscreenCanvas !== "function") return false;
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

function mainThreadRasterize(
  file: File,
  info: ImageResizerInfo,
  options: import("@toolbox/core").ImageResizeOptions | undefined,
  preview = false,
) {
  return new Promise<ImageResizerRasterized>((resolve, reject) => {
    pendingRaster = { resolve, reject };
    const response: ImageResizerResponse = {
      type: "rasterize",
      file,
      info,
      ...(options ? { options } : {}),
      preview,
    };
    worker.postMessage(response);
  });
}

worker.onmessage = async (
  event: MessageEvent<ImageResizerRequest | ImageResizerRasterizeReply>,
) => {
  if (event.data.action === "rasterized" || event.data.action === "rasterize-error") {
    const pending = pendingRaster;
    pendingRaster = null;
    if (event.data.action === "rasterized") pending?.resolve(event.data.image);
    else pending?.reject(new ImageResizerError(event.data.code));
    return;
  }
  try {
    const rasterize = hasOffscreenCanvas2d() ? undefined : mainThreadRasterize;
    const response: ImageResizerResponse =
      event.data.action === "prepare"
        ? {
            type: "prepared",
            ...(await prepareResizerImage(event.data.file, undefined, rasterize)),
          }
        : {
            type: "result",
            result: await resizeImage(event.data.file, event.data.options, undefined, rasterize),
          };
    worker.postMessage(response);
  } catch (error) {
    const response: ImageResizerResponse = {
      type: "error",
      code: error instanceof ImageResizerError ? error.code : "CONVERSION_FAILED",
    };
    worker.postMessage(response);
  }
};
