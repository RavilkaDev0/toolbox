import { webpConverterFilesSchema, webpConverterSettingsSchema } from "@toolbox/contracts";
import {
  assertWebpConverterDimensions,
  assertWebpConverterFileExtension,
  assertWebpConverterSelection,
  createWebpConverterOutputNames,
  defaultWebpConverterSettings,
  inspectImage,
  type WebpConverterErrorCode,
  WebpConverterError,
  type WebpConverterInfo,
  type WebpConverterSettings,
  webpConverterLimits,
} from "@toolbox/core";
import {
  decodeStaticImageBitmap,
  encodeImageBitmap,
  type ImageProcessingBounds,
  inspectStaticImageFile,
  verifyDecodedImageBlob,
} from "./image-processing.js";
import { createImageZipWriter, type ImageZipWriter } from "./image-archive.js";

export type WebpConverterPreparedImage = WebpConverterInfo & {
  inputBytes: number;
  preview: Blob;
};
export type WebpConverterItem = {
  name: string;
  width: number;
  height: number;
  inputBytes: number;
  outputBytes: number;
};
export type WebpConverterResult = {
  blob: Blob;
  fileName: string;
  outputKind: "image" | "zip";
  outputBytes: number;
  uncompressedOutputBytes: number;
  items: WebpConverterItem[];
  preview: Blob;
};
export type WebpConverterRasterized = { blob: Blob; width: number; height: number };
export type WebpConverterRasterize = (
  file: File,
  info: WebpConverterInfo,
  settings: WebpConverterSettings,
  thumbnail: boolean,
  signal?: AbortSignal,
) => Promise<WebpConverterRasterized>;
export type WebpConverterRequest =
  | { action: "prepare"; files: File[] }
  | { action: "convert"; files: File[]; settings: unknown };
export type WebpConverterResponse =
  | { type: "prepared"; items: WebpConverterPreparedImage[] }
  | { type: "progress"; completed: number; total: number }
  | { type: "result"; result: WebpConverterResult }
  | { type: "error"; code: WebpConverterErrorCode }
  | {
      type: "rasterize";
      file: File;
      info: WebpConverterInfo;
      settings: WebpConverterSettings;
      thumbnail: boolean;
    };
export type WebpConverterRasterizeReply =
  | { action: "rasterized"; image: WebpConverterRasterized }
  | { action: "rasterize-error"; code: WebpConverterErrorCode };

const bounds: ImageProcessingBounds = {
  side: webpConverterLimits.side,
  pixels: webpConverterLimits.pixels,
  outputBytes: webpConverterLimits.outputBytes,
};

function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new WebpConverterError("CANCELLED");
}

function mapError(error: unknown): WebpConverterError {
  if (error instanceof WebpConverterError) return error;
  if (error instanceof Error && "code" in error && typeof error.code === "string")
    return new WebpConverterError(error.code as WebpConverterErrorCode);
  return new WebpConverterError("CONVERSION_FAILED");
}

async function verifyWebpOutput(
  blob: Blob,
  info: WebpConverterInfo,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<void> {
  if (blob.type !== "image/webp") throw new WebpConverterError("CONVERSION_FAILED");
  if (blob.size < 1 || blob.size > webpConverterLimits.outputBytes)
    throw new WebpConverterError(blob.size ? "LIMIT_EXCEEDED" : "INVALID_IMAGE");
  if (width * height !== info.width * info.height)
    throw new WebpConverterError("CONVERSION_FAILED");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    const output = inspectImage(bytes);
    assertWebpConverterDimensions(output.width, output.height);
    if (
      output.kind !== "webp" ||
      output.width !== width ||
      output.height !== height ||
      output.width * output.height !== info.width * info.height
    )
      throw new WebpConverterError("CONVERSION_FAILED");
  } catch (error) {
    throw mapError(error);
  } finally {
    bytes.fill(0);
  }
  await verifyDecodedImageBlob(blob, width, height, signal, bounds);
  checkCancelled(signal);
}

export async function inspectWebpConverterFile(
  file: File,
  signal?: AbortSignal,
): Promise<WebpConverterInfo> {
  checkCancelled(signal);
  const selected = webpConverterFilesSchema.safeParse([
    { name: file.name, size: file.size, type: file.type },
  ]);
  if (!selected.success) {
    try {
      assertWebpConverterSelection([file]);
    } catch (error) {
      throw mapError(error);
    }
    throw new WebpConverterError("INVALID_IMAGE");
  }
  try {
    const info = await inspectStaticImageFile(file, signal);
    if (info.kind !== "jpeg" && info.kind !== "png")
      throw new WebpConverterError("UNSUPPORTED_FORMAT");
    assertWebpConverterFileExtension(file.name, info.kind);
    assertWebpConverterDimensions(info.width, info.height);
    return { format: info.kind, width: info.width, height: info.height };
  } catch (error) {
    throw mapError(error);
  }
}

export async function rasterizeWebpConverterImage(
  file: File,
  info: WebpConverterInfo,
  inputSettings: WebpConverterSettings,
  thumbnail = false,
  signal?: AbortSignal,
): Promise<WebpConverterRasterized> {
  checkCancelled(signal);
  const settings = webpConverterSettingsSchema.safeParse(inputSettings);
  if (!settings.success) throw new WebpConverterError("INVALID_SETTINGS");
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await decodeStaticImageBitmap(
      file,
      { kind: info.format, width: info.width, height: info.height },
      signal,
      bounds,
    );
    const width = bitmap.width;
    const height = bitmap.height;
    const scale = thumbnail
      ? Math.min(1, webpConverterLimits.previewSide / Math.max(width, height))
      : 1;
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    const encoded = await encodeImageBitmap(
      bitmap,
      {
        format: thumbnail ? "png" : "webp",
        width: outputWidth,
        height: outputHeight,
        quality: settings.data.quality,
      },
      signal,
      bounds,
    );
    bitmap.close();
    bitmap = undefined;
    if (!thumbnail)
      await verifyWebpOutput(encoded.blob, info, encoded.width, encoded.height, signal);
    else await verifyDecodedImageBlob(encoded.blob, encoded.width, encoded.height, signal, bounds);
    checkCancelled(signal);
    return {
      blob: encoded.blob,
      width: thumbnail ? width : encoded.width,
      height: thumbnail ? height : encoded.height,
    };
  } catch (error) {
    throw mapError(error);
  } finally {
    bitmap?.close();
  }
}

export async function prepareWebpConverterFiles(
  files: readonly File[],
  signal?: AbortSignal,
  rasterize: WebpConverterRasterize = rasterizeWebpConverterImage,
): Promise<{ items: WebpConverterPreparedImage[] }> {
  const selected = webpConverterFilesSchema.safeParse(
    files.map(({ name, size, type }) => ({ name, size, type })),
  );
  if (!selected.success) {
    try {
      assertWebpConverterSelection(files);
    } catch (error) {
      throw mapError(error);
    }
    throw new WebpConverterError("INVALID_IMAGE");
  }
  try {
    assertWebpConverterSelection(files);
    const items: WebpConverterPreparedImage[] = [];
    for (const file of files) {
      checkCancelled(signal);
      const info = await inspectWebpConverterFile(file, signal);
      const image = await rasterize(file, info, defaultWebpConverterSettings, true, signal);
      if (image.blob.type !== "image/png") throw new WebpConverterError("CONVERSION_FAILED");
      items.push({
        ...info,
        width: image.width,
        height: image.height,
        inputBytes: file.size,
        preview: image.blob,
      });
    }
    checkCancelled(signal);
    return { items };
  } catch (error) {
    throw mapError(error);
  }
}

export async function convertWebpFiles(
  files: readonly File[],
  inputSettings: unknown,
  signal?: AbortSignal,
  rasterize: WebpConverterRasterize = rasterizeWebpConverterImage,
  onProgress?: (completed: number, total: number) => void,
): Promise<WebpConverterResult> {
  checkCancelled(signal);
  const selected = webpConverterFilesSchema.safeParse(
    files.map(({ name, size, type }) => ({ name, size, type })),
  );
  const settings = webpConverterSettingsSchema.safeParse(inputSettings);
  if (!selected.success) {
    try {
      assertWebpConverterSelection(files);
    } catch (error) {
      throw mapError(error);
    }
    throw new WebpConverterError("INVALID_IMAGE");
  }
  if (!settings.success) throw new WebpConverterError("INVALID_SETTINGS");

  let zip: ImageZipWriter | undefined;
  try {
    assertWebpConverterSelection(files);
    const infos: WebpConverterInfo[] = [];
    for (const file of files) {
      checkCancelled(signal);
      infos.push(await inspectWebpConverterFile(file, signal));
    }
    const names = createWebpConverterOutputNames(files);
    const multiFile = files.length > 1;
    if (multiFile) zip = await createImageZipWriter(webpConverterLimits.archiveBytes);
    const items: WebpConverterItem[] = [];
    let preview: Blob | undefined;
    let singleBlob: Blob | undefined;
    let totalOutputBytes = 0;

    for (const [index, file] of files.entries()) {
      checkCancelled(signal);
      const info = infos[index];
      const name = names[index];
      if (!info || !name) throw new WebpConverterError("CONVERSION_FAILED");
      const encoded = await rasterize(file, info, settings.data, false, signal);
      await verifyWebpOutput(encoded.blob, info, encoded.width, encoded.height, signal);
      totalOutputBytes += encoded.blob.size;
      const outputLimit = multiFile
        ? webpConverterLimits.batchOutputBytes
        : webpConverterLimits.outputBytes;
      if (totalOutputBytes > outputLimit) throw new WebpConverterError("LIMIT_EXCEEDED");
      if (index === 0) preview = encoded.blob;
      if (zip) await zip.add(name, encoded.blob, signal);
      else singleBlob = encoded.blob;
      items.push({
        name,
        width: encoded.width,
        height: encoded.height,
        inputBytes: file.size,
        outputBytes: encoded.blob.size,
      });
      checkCancelled(signal);
      onProgress?.(index + 1, files.length);
    }
    if (!preview) throw new WebpConverterError("CONVERSION_FAILED");
    if (zip) {
      const blob = zip.finish(signal);
      zip.dispose();
      zip = undefined;
      return {
        blob,
        fileName: "toolbox-webp-images.zip",
        outputKind: "zip",
        outputBytes: blob.size,
        uncompressedOutputBytes: totalOutputBytes,
        items,
        preview,
      };
    }
    if (!singleBlob || !items[0]) throw new WebpConverterError("CONVERSION_FAILED");
    return {
      blob: singleBlob,
      fileName: items[0].name,
      outputKind: "image",
      outputBytes: singleBlob.size,
      uncompressedOutputBytes: totalOutputBytes,
      items,
      preview,
    };
  } catch (error) {
    zip?.dispose();
    throw mapError(error);
  }
}
