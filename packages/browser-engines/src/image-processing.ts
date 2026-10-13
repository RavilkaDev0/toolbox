import { imageFileSchema } from "@toolbox/contracts";
import {
  assertImageFileMetadata,
  assertImageProcessingDimensions,
  type ImageFormat,
  type ImageInfo,
  ImageInputError,
  imageFormatMimeType,
  imageProcessingLimits,
  inspectImage,
} from "@toolbox/core";

export type ImageProcessingBounds = {
  side: number;
  pixels: number;
  outputBytes: number;
};
export type ImageBitmapEncodingOptions = {
  format: ImageFormat;
  quality: number;
  width: number;
  height: number;
  background?: string;
};
export type EncodedImageBitmap = { blob: Blob; width: number; height: number };

function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ImageInputError("CANCELLED");
}

function assertDimensions(width: number, height: number, bounds: ImageProcessingBounds): void {
  assertImageProcessingDimensions(width, height);
  if (width > bounds.side || height > bounds.side || width * height > bounds.pixels)
    throw new ImageInputError("LIMIT_EXCEEDED");
}

export async function inspectStaticImageFile(file: File, signal?: AbortSignal): Promise<ImageInfo> {
  checkCancelled(signal);
  assertImageFileMetadata(file, imageProcessingLimits.fileBytes);
  if (!imageFileSchema.safeParse({ name: file.name, size: file.size, type: file.type }).success)
    throw new ImageInputError("INVALID_IMAGE");

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new ImageInputError("INVALID_IMAGE");
  }
  let info: ImageInfo;
  try {
    info = inspectImage(bytes);
    assertDimensions(info.width, info.height, imageProcessingLimits);
  } finally {
    bytes.fill(0);
  }
  checkCancelled(signal);
  if (file.type && file.type !== imageFormatMimeType(info.kind))
    throw new ImageInputError("UNSUPPORTED_FORMAT");
  return info;
}

export async function decodeStaticImageBitmap(
  file: File,
  info: ImageInfo,
  signal?: AbortSignal,
  bounds: ImageProcessingBounds = imageProcessingLimits,
): Promise<ImageBitmap> {
  checkCancelled(signal);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageInputError("INVALID_IMAGE");
  }
  try {
    checkCancelled(signal);
    assertDimensions(bitmap.width, bitmap.height, bounds);
    if (bitmap.width * bitmap.height !== info.width * info.height)
      throw new ImageInputError("INVALID_IMAGE");
    return bitmap;
  } catch (error) {
    bitmap.close();
    throw error;
  }
}

export async function encodeImageBitmap(
  bitmap: ImageBitmap,
  options: ImageBitmapEncodingOptions,
  signal?: AbortSignal,
  bounds: ImageProcessingBounds = imageProcessingLimits,
): Promise<EncodedImageBitmap> {
  checkCancelled(signal);
  assertDimensions(options.width, options.height, bounds);
  const type = imageFormatMimeType(options.format);
  let canvas: OffscreenCanvas | HTMLCanvasElement | undefined;
  try {
    canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : undefined;
    if (!canvas && typeof document !== "undefined") canvas = document.createElement("canvas");
    if (!canvas) throw new ImageInputError("CONVERSION_FAILED");
    canvas.width = options.width;
    canvas.height = options.height;
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
      canvas.width = options.width;
      canvas.height = options.height;
      context = canvas.getContext("2d");
    }
    if (!context || !("drawImage" in context)) throw new ImageInputError("CONVERSION_FAILED");
    if (options.format === "jpeg") {
      context.fillStyle = options.background ?? "#ffffff";
      context.fillRect(0, 0, options.width, options.height);
    }
    context.drawImage(bitmap, 0, 0, options.width, options.height);
    const blob =
      "convertToBlob" in canvas
        ? await canvas.convertToBlob({
            type,
            ...(options.format === "png" ? {} : { quality: options.quality / 100 }),
          })
        : await new Promise<Blob>((resolve, reject) => {
            (canvas as HTMLCanvasElement).toBlob(
              (value) =>
                value ? resolve(value) : reject(new ImageInputError("CONVERSION_FAILED")),
              type,
              options.format === "png" ? undefined : options.quality / 100,
            );
          });
    checkCancelled(signal);
    if (blob.type !== type) throw new ImageInputError("CONVERSION_FAILED");
    if (blob.size > bounds.outputBytes) throw new ImageInputError("LIMIT_EXCEEDED");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let outputInfo: ImageInfo;
    try {
      outputInfo = inspectImage(bytes);
      assertDimensions(outputInfo.width, outputInfo.height, bounds);
    } finally {
      bytes.fill(0);
    }
    checkCancelled(signal);
    if (
      outputInfo.kind !== options.format ||
      outputInfo.width !== options.width ||
      outputInfo.height !== options.height
    )
      throw new ImageInputError("CONVERSION_FAILED");
    return { blob, width: outputInfo.width, height: outputInfo.height };
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    throw new ImageInputError("CONVERSION_FAILED");
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

export async function verifyDecodedImageBlob(
  blob: Blob,
  width: number,
  height: number,
  signal?: AbortSignal,
  bounds: ImageProcessingBounds = imageProcessingLimits,
): Promise<void> {
  checkCancelled(signal);
  if (blob.size < 1 || blob.size > bounds.outputBytes)
    throw new ImageInputError(blob.size ? "LIMIT_EXCEEDED" : "INVALID_IMAGE");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new ImageInputError("CONVERSION_FAILED");
  }
  try {
    checkCancelled(signal);
    assertDimensions(bitmap.width, bitmap.height, bounds);
    if (bitmap.width !== width || bitmap.height !== height)
      throw new ImageInputError("CONVERSION_FAILED");
  } finally {
    bitmap.close();
  }
}
