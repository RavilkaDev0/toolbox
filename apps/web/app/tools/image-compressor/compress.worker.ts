/// <reference lib="webworker" />
import {
  compressImage,
  type EncodedImage,
  type ImageCompressorInfo,
  type ImageCompressorRasterizeReply,
  type ImageCompressorRequest,
  type ImageCompressorResponse,
  prepareCompressorImage,
} from "@toolbox/browser-engines";
import { ImageCompressorError } from "@toolbox/core";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let pendingRaster: {
  resolve: (image: EncodedImage) => void;
  reject: (error: ImageCompressorError) => void;
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
  info: ImageCompressorInfo,
  format: import("@toolbox/core").ImageCompressionFormat,
  quality: number,
  thumbnail: boolean,
) {
  return new Promise<EncodedImage>((resolve, reject) => {
    pendingRaster = { resolve, reject };
    const response: ImageCompressorResponse = {
      type: "rasterize",
      file,
      info,
      format,
      quality,
      thumbnail,
    };
    worker.postMessage(response);
  });
}

worker.onmessage = async (
  event: MessageEvent<ImageCompressorRequest | ImageCompressorRasterizeReply>,
) => {
  if (event.data.action === "rasterized" || event.data.action === "rasterize-error") {
    const pending = pendingRaster;
    pendingRaster = null;
    if (event.data.action === "rasterized") pending?.resolve(event.data.image);
    else pending?.reject(new ImageCompressorError(event.data.code));
    return;
  }
  try {
    const rasterize = hasOffscreenCanvas2d() ? undefined : mainThreadRasterize;
    const response: ImageCompressorResponse =
      event.data.action === "prepare"
        ? {
            type: "prepared",
            ...(await prepareCompressorImage(event.data.file, undefined, rasterize)),
          }
        : {
            type: "result",
            result: await compressImage(event.data.file, event.data.options, undefined, rasterize),
          };
    worker.postMessage(response);
  } catch (error) {
    const response: ImageCompressorResponse = {
      type: "error",
      code: error instanceof ImageCompressorError ? error.code : "CONVERSION_FAILED",
    };
    worker.postMessage(response);
  }
};
