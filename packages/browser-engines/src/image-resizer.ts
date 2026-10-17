import { imageFileSchema, imageResizeOptionsSchema } from "@toolbox/contracts";
import {
  calculateImageResizeDimensions,
  type ImageInfo,
  ImageInputError,
  type ImageResizeOptions,
  ImageResizerError,
  type ImageSize,
  imageFormatMimeType,
  imageResizerLimits,
  inspectImage,
} from "@toolbox/core";
import {
  decodeStaticImageBitmap,
  encodeImageBitmap,
  type ImageProcessingBounds,
  inspectStaticImageFile,
  verifyDecodedImageBlob,
} from "./image-processing.js";

export type ImageResizerInfo = { format: ImageInfo["kind"] } & ImageSize;
export type ImageResizerRasterized = { blob: Blob; width: number; height: number };
export type ImageResizerResult = ImageResizerRasterized & {
  format: ImageInfo["kind"];
  inputBytes: number;
  outputBytes: number;
};
export type ImageResizerRasterize = (
  file: File,
  info: ImageResizerInfo,
  options?: ImageResizeOptions,
  preview?: boolean,
  signal?: AbortSignal,
) => Promise<ImageResizerRasterized>;
export type ImageResizerRequest =
  | { action: "prepare"; file: File }
  | { action: "resize"; file: File; options: ImageResizeOptions };
export type ImageResizerResponse =
  | { type: "prepared"; info: ImageResizerInfo; preview: Blob }
  | { type: "result"; result: ImageResizerResult }
  | { type: "error"; code: ImageResizerError["code"] }
  | {
      type: "rasterize";
      file: File;
      info: ImageResizerInfo;
      options?: ImageResizeOptions;
      preview: boolean;
    };
export type ImageResizerRasterizeReply =
  | { action: "rasterized"; image: ImageResizerRasterized }
  | { action: "rasterize-error"; code: ImageResizerError["code"] };

const bounds: ImageProcessingBounds = {
  side: imageResizerLimits.side,
  pixels: imageResizerLimits.pixels,
  outputBytes: imageResizerLimits.outputBytes,
};

function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ImageResizerError("CANCELLED");
}

function mapError(error: unknown): ImageResizerError {
  if (error instanceof ImageResizerError) return error;
  if (error instanceof ImageInputError) return new ImageResizerError(error.code);
  return new ImageResizerError("CONVERSION_FAILED");
}

export async function inspectResizerFile(
  file: File,
  signal?: AbortSignal,
): Promise<ImageResizerInfo> {
  checkCancelled(signal);
  try {
    if (!imageFileSchema.safeParse({ name: file.name, size: file.size, type: file.type }).success)
      throw new ImageResizerError("INVALID_IMAGE");
    const info = await inspectStaticImageFile(file, signal);
    return { format: info.kind, width: info.width, height: info.height };
  } catch (error) {
    throw mapError(error);
  }
}

export async function rasterizeResizerImage(
  file: File,
  info: ImageResizerInfo,
  options?: ImageResizeOptions,
  preview = false,
  signal?: AbortSignal,
): Promise<ImageResizerRasterized> {
  checkCancelled(signal);
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await decodeStaticImageBitmap(
      file,
      { kind: info.format, width: info.width, height: info.height },
      signal,
      bounds,
    );
    const source = { width: bitmap.width, height: bitmap.height };
    let width: number;
    let height: number;
    const outputFormat = preview ? "png" : options?.format;
    if (!outputFormat) throw new ImageResizerError("INVALID_SETTINGS");
    if (preview) {
      const scale = Math.min(1, 360 / Math.max(source.width, source.height));
      width = Math.max(1, Math.round(source.width * scale));
      height = Math.max(1, Math.round(source.height * scale));
    } else {
      if (!options) throw new ImageResizerError("INVALID_SETTINGS");
      const parsed = imageResizeOptionsSchema.safeParse(options);
      if (!parsed.success) throw new ImageResizerError("INVALID_SETTINGS");
      ({ width, height } = calculateImageResizeDimensions(source, options));
    }
    const encoded = await encodeImageBitmap(
      bitmap,
      {
        format: outputFormat,
        width,
        height,
        quality: preview ? 80 : (options?.quality ?? 80),
        background: "#ffffff",
      },
      signal,
      bounds,
    );
    bitmap.close();
    bitmap = undefined;
    await verifyDecodedImageBlob(encoded.blob, encoded.width, encoded.height, signal, bounds);
    checkCancelled(signal);
    return preview ? { blob: encoded.blob, width: source.width, height: source.height } : encoded;
  } catch (error) {
    throw mapError(error);
  } finally {
    bitmap?.close();
  }
}

export async function prepareResizerImage(
  file: File,
  signal?: AbortSignal,
  rasterize: ImageResizerRasterize = rasterizeResizerImage,
): Promise<{ info: ImageResizerInfo; preview: Blob }> {
  const inspected = await inspectResizerFile(file, signal);
  const preview = await rasterize(file, inspected, undefined, true, signal);
  checkCancelled(signal);
  if (preview.blob.type !== imageFormatMimeType("png"))
    throw new ImageResizerError("CONVERSION_FAILED");
  return {
    info: { format: inspected.format, width: preview.width, height: preview.height },
    preview: preview.blob,
  };
}

export async function resizeImage(
  file: File,
  inputOptions: unknown,
  signal?: AbortSignal,
  rasterize: ImageResizerRasterize = rasterizeResizerImage,
): Promise<ImageResizerResult> {
  checkCancelled(signal);
  const parsed = imageResizeOptionsSchema.safeParse(inputOptions);
  if (!parsed.success) throw new ImageResizerError("INVALID_SETTINGS");
  const info = await inspectResizerFile(file, signal);
  const encoded = await rasterize(file, info, parsed.data, false, signal);
  checkCancelled(signal);
  if (encoded.blob.size > imageResizerLimits.outputBytes)
    throw new ImageResizerError("LIMIT_EXCEEDED");
  const bytes = new Uint8Array(await encoded.blob.arrayBuffer());
  let outputInfo: ImageInfo;
  try {
    outputInfo = inspectImage(bytes);
  } catch (error) {
    throw mapError(error);
  } finally {
    bytes.fill(0);
  }
  checkCancelled(signal);
  if (
    outputInfo.kind !== parsed.data.format ||
    outputInfo.width !== encoded.width ||
    outputInfo.height !== encoded.height
  )
    throw new ImageResizerError("CONVERSION_FAILED");
  return {
    ...encoded,
    format: outputInfo.kind,
    inputBytes: file.size,
    outputBytes: encoded.blob.size,
  };
}
