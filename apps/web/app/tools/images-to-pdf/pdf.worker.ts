/// <reference lib="webworker" />
import {
  type ImagePdfRequest,
  type ImagePdfResponse,
  type ImageRasterizer,
  imagesToPdf,
  prepareImages,
  type RasterizeReply,
} from "@toolbox/browser-engines";
import { ImagePdfError } from "@toolbox/core";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let pendingRaster: {
  resolve: (image: import("@toolbox/browser-engines").PreparedImage) => void;
  reject: (error: ImagePdfError) => void;
} | null = null;
const mainThreadRasterize: ImageRasterizer = (file, info, thumbnail) =>
  new Promise((resolve, reject) => {
    pendingRaster = { resolve, reject };
    const response: ImagePdfResponse = { type: "rasterize", file, info, thumbnail };
    worker.postMessage(response);
  });
worker.onmessage = async (event: MessageEvent<ImagePdfRequest | RasterizeReply>) => {
  if (event.data.action === "rasterized" || event.data.action === "rasterize-error") {
    const pending = pendingRaster;
    pendingRaster = null;
    if (event.data.action === "rasterized") pending?.resolve(event.data.image);
    else pending?.reject(new ImagePdfError(event.data.code));
    return;
  }
  try {
    const rasterize = typeof OffscreenCanvas === "function" ? undefined : mainThreadRasterize;
    const response: ImagePdfResponse =
      event.data.action === "prepare"
        ? { type: "prepared", images: await prepareImages(event.data.files, undefined, rasterize) }
        : {
            type: "result",
            result: await imagesToPdf(event.data.files, event.data.options, undefined, rasterize),
          };
    worker.postMessage(response);
  } catch (error) {
    const response: ImagePdfResponse = {
      type: "error",
      code: error instanceof ImagePdfError ? error.code : "CONVERSION_FAILED",
    };
    worker.postMessage(response);
  }
};
