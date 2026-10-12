import { imageCompressionOptionsSchema, imageCompressorFileSchema } from "@toolbox/contracts";
import {
  assertCompressorDimensions,
  assertCompressorFile,
  compressionMimeType,
  type ImageCompressionFormat,
  type ImageCompressionOptions,
  ImageCompressorError,
  imageCompressorLimits,
  inspectCompressorImage,
} from "@toolbox/core";

export type ImageCompressorInfo = {
  format: ImageCompressionFormat;
  width: number;
  height: number;
};
export type EncodedImage = { blob: Blob; width: number; height: number };
export type ImageCompressionResult = {
  blob: Blob;
  format: ImageCompressionFormat;
  width: number;
  height: number;
  inputBytes: number;
  outputBytes: number;
};
export type ImageCompressorRasterize = (
  file: File,
  info: ImageCompressorInfo,
  format: ImageCompressionFormat,
  quality: number,
  thumbnail: boolean,
  signal?: AbortSignal,
) => Promise<EncodedImage>;

export type ImageCompressorRequest =
  | { action: "prepare"; file: File }
  | { action: "compress"; file: File; options: ImageCompressionOptions };
export type ImageCompressorResponse =
  | { type: "prepared"; info: ImageCompressorInfo; preview: Blob }
  | { type: "result"; result: ImageCompressionResult }
  | { type: "error"; code: ImageCompressorError["code"] }
  | {
      type: "rasterize";
      file: File;
      info: ImageCompressorInfo;
      format: ImageCompressionFormat;
      quality: number;
      thumbnail: boolean;
    };
export type ImageCompressorRasterizeReply =
  | { action: "rasterized"; image: EncodedImage }
  | { action: "rasterize-error"; code: ImageCompressorError["code"] };

function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ImageCompressorError("CANCELLED");
}

export async function inspectCompressorFile(file: File, signal?: AbortSignal) {
  checkCancelled(signal);
  try {
    assertCompressorFile({ name: file.name, size: file.size, type: file.type });
    if (
      !imageCompressorFileSchema.safeParse({ name: file.name, size: file.size, type: file.type })
        .success
    )
      throw new ImageCompressorError("INVALID_IMAGE");
    const inputBytes = new Uint8Array(await file.arrayBuffer());
    let inspected: ReturnType<typeof inspectCompressorImage>;
    try {
      inspected = inspectCompressorImage(inputBytes);
    } finally {
      inputBytes.fill(0);
    }
    checkCancelled(signal);
    const info = { format: inspected.kind, width: inspected.width, height: inspected.height };
    const mime = compressionMimeType(info.format);
    if (file.type && file.type !== mime) throw new ImageCompressorError("UNSUPPORTED_FORMAT");
    return info;
  } catch (error) {
    if (error instanceof ImageCompressorError) throw error;
    throw new ImageCompressorError("INVALID_IMAGE");
  }
}

export async function rasterizeCompressorImage(
  file: File,
  info: ImageCompressorInfo,
  format: ImageCompressionFormat,
  quality: number,
  thumbnail: boolean,
  signal?: AbortSignal,
): Promise<EncodedImage> {
  checkCancelled(signal);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageCompressorError("INVALID_IMAGE");
  }
  let canvas: OffscreenCanvas | HTMLCanvasElement | undefined;
  try {
    checkCancelled(signal);
    assertCompressorDimensions(bitmap.width, bitmap.height);
    if (bitmap.width * bitmap.height !== info.width * info.height)
      throw new ImageCompressorError("INVALID_IMAGE");
    const scale = thumbnail ? Math.min(1, 320 / Math.max(bitmap.width, bitmap.height)) : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(width, height) : undefined;
    if (!canvas && typeof document !== "undefined") canvas = document.createElement("canvas");
    if (!canvas) throw new ImageCompressorError("CONVERSION_FAILED");
    canvas.width = width;
    canvas.height = height;
    let context = canvas.getContext("2d");
    if (
      !context &&
      typeof document !== "undefined" &&
      typeof OffscreenCanvas === "function" &&
      canvas instanceof OffscreenCanvas
    ) {
      canvas.width = 0;
      canvas.height = 0;
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      context = canvas.getContext("2d");
    }
    if (!context || !("drawImage" in context)) throw new ImageCompressorError("CONVERSION_FAILED");
    if (format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const outputFormat = thumbnail ? "png" : format;
    const type = compressionMimeType(outputFormat);
    const blob =
      "convertToBlob" in canvas
        ? await canvas.convertToBlob({
            type,
            ...(outputFormat === "png" ? {} : { quality: quality / 100 }),
          })
        : await new Promise<Blob>((resolve, reject) => {
            (canvas as HTMLCanvasElement).toBlob(
              (value) =>
                value ? resolve(value) : reject(new ImageCompressorError("CONVERSION_FAILED")),
              type,
              outputFormat === "png" ? undefined : quality / 100,
            );
          });
    checkCancelled(signal);
    if (blob.type !== type) throw new ImageCompressorError("CONVERSION_FAILED");
    if (!thumbnail && blob.size > imageCompressorLimits.outputBytes)
      throw new ImageCompressorError("LIMIT_EXCEEDED");
    const outputBytes = new Uint8Array(await blob.arrayBuffer());
    let outputInfo: ReturnType<typeof inspectCompressorImage>;
    try {
      outputInfo = inspectCompressorImage(outputBytes);
    } finally {
      outputBytes.fill(0);
    }
    checkCancelled(signal);
    if (
      outputInfo.kind !== outputFormat ||
      outputInfo.width !== width ||
      outputInfo.height !== height
    )
      throw new ImageCompressorError("CONVERSION_FAILED");
    return { blob, width: bitmap.width, height: bitmap.height };
  } catch (error) {
    if (error instanceof ImageCompressorError) throw error;
    throw new ImageCompressorError("CONVERSION_FAILED");
  } finally {
    bitmap.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

export async function prepareCompressorImage(
  file: File,
  signal?: AbortSignal,
  rasterize: ImageCompressorRasterize = rasterizeCompressorImage,
) {
  const info = await inspectCompressorFile(file, signal);
  const preview = await rasterize(file, info, "png", 80, true, signal);
  checkCancelled(signal);
  return { info: { ...info, width: preview.width, height: preview.height }, preview: preview.blob };
}

export async function compressImage(
  file: File,
  inputOptions: unknown,
  signal?: AbortSignal,
  rasterize: ImageCompressorRasterize = rasterizeCompressorImage,
): Promise<ImageCompressionResult> {
  const parsed = imageCompressionOptionsSchema.safeParse(inputOptions);
  if (!parsed.success) throw new ImageCompressorError("CONVERSION_FAILED");
  const info = await inspectCompressorFile(file, signal);
  const encoded = await rasterize(
    file,
    info,
    parsed.data.format,
    parsed.data.quality,
    false,
    signal,
  );
  checkCancelled(signal);
  if (encoded.blob.size > imageCompressorLimits.outputBytes)
    throw new ImageCompressorError("LIMIT_EXCEEDED");
  const outputBytes = new Uint8Array(await encoded.blob.arrayBuffer());
  let outputInfo: ReturnType<typeof inspectCompressorImage>;
  try {
    outputInfo = inspectCompressorImage(outputBytes);
  } finally {
    outputBytes.fill(0);
  }
  checkCancelled(signal);
  if (
    outputInfo.kind !== parsed.data.format ||
    outputInfo.width !== encoded.width ||
    outputInfo.height !== encoded.height ||
    outputInfo.width * outputInfo.height !== info.width * info.height
  )
    throw new ImageCompressorError("CONVERSION_FAILED");
  return {
    blob: encoded.blob,
    format: outputInfo.kind,
    width: outputInfo.width,
    height: outputInfo.height,
    inputBytes: file.size,
    outputBytes: encoded.blob.size,
  };
}
