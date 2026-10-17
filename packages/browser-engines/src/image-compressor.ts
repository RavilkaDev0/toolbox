import { imageCompressionOptionsSchema, imageCompressorFileSchema } from "@toolbox/contracts";
import {
  assertCompressorDimensions,
  assertCompressorFile,
  type ImageCompressionFormat,
  type ImageCompressionOptions,
  ImageCompressorError,
  imageCompressorLimits,
  inspectCompressorImage,
} from "@toolbox/core";
import {
  decodeStaticImageBitmap,
  encodeImageBitmap,
  type ImageProcessingBounds,
  inspectStaticImageFile,
  verifyDecodedImageBlob,
} from "./image-processing.js";

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
    const inspected = await inspectStaticImageFile(file, signal);
    assertCompressorDimensions(inspected.width, inspected.height);
    return { format: inspected.kind, width: inspected.width, height: inspected.height };
  } catch (error) {
    if (error instanceof ImageCompressorError) throw error;
    if (error instanceof Error && "code" in error && typeof error.code === "string")
      throw new ImageCompressorError(error.code as ImageCompressorError["code"]);
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
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await decodeStaticImageBitmap(
      file,
      { kind: info.format, width: info.width, height: info.height },
      signal,
      imageCompressorLimits,
    );
    if (bitmap.width * bitmap.height !== info.width * info.height)
      throw new ImageCompressorError("INVALID_IMAGE");
    const scale = thumbnail ? Math.min(1, 320 / Math.max(bitmap.width, bitmap.height)) : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const outputFormat = thumbnail ? "png" : format;
    const encoded = await encodeImageBitmap(
      bitmap,
      { format: outputFormat, width, height, quality },
      signal,
      imageCompressorLimits as ImageProcessingBounds,
    );
    bitmap.close();
    bitmap = undefined;
    await verifyDecodedImageBlob(encoded.blob, encoded.width, encoded.height, signal, {
      side: imageCompressorLimits.side,
      pixels: imageCompressorLimits.pixels,
      outputBytes: imageCompressorLimits.outputBytes,
    });
    checkCancelled(signal);
    if (!thumbnail && encoded.blob.size > imageCompressorLimits.outputBytes)
      throw new ImageCompressorError("LIMIT_EXCEEDED");
    return {
      blob: encoded.blob,
      width: thumbnail ? sourceWidth : encoded.width,
      height: thumbnail ? sourceHeight : encoded.height,
    };
  } catch (error) {
    if (error instanceof ImageCompressorError) throw error;
    if (error instanceof Error && "code" in error && typeof error.code === "string")
      throw new ImageCompressorError(error.code as ImageCompressorError["code"]);
    throw new ImageCompressorError("CONVERSION_FAILED");
  } finally {
    bitmap?.close();
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
