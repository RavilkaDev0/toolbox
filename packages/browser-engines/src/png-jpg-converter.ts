import { pngJpgConverterFilesSchema, pngJpgConverterSettingsSchema } from "@toolbox/contracts";
import {
  assertPngJpgConverterDimensions,
  assertPngJpgConverterSelection,
  assertPngJpgFileExtension,
  createPngJpgOutputNames,
  inspectImage,
  PngJpgConverterError,
  type PngJpgConverterInfo,
  type PngJpgConverterSettings,
  pngJpgConverterLimits,
  pngJpgFormatMimeType,
  pngJpgOutputFormat,
} from "@toolbox/core";
import {
  decodeStaticImageBitmap,
  encodeImageBitmap,
  type ImageProcessingBounds,
  inspectStaticImageFile,
  verifyDecodedImageBlob,
} from "./image-processing.js";

export type PngJpgConverterPreparedImage = PngJpgConverterInfo & {
  inputBytes: number;
  preview: Blob;
};
export type PngJpgConvertedImage = PngJpgConverterInfo & {
  name: string;
  inputBytes: number;
  outputBytes: number;
};
export type PngJpgConverterResult = {
  blob: Blob;
  fileName: string;
  outputKind: "image" | "zip";
  outputBytes: number;
  uncompressedOutputBytes: number;
  items: PngJpgConvertedImage[];
  preview: Blob;
};
export type PngJpgConverterRasterized = { blob: Blob; width: number; height: number };
export type PngJpgConverterRasterize = (
  file: File,
  info: PngJpgConverterInfo,
  settings: PngJpgConverterSettings,
  preview: boolean,
  signal?: AbortSignal,
) => Promise<PngJpgConverterRasterized>;
export type PngJpgConverterPreview = (
  blob: Blob,
  width: number,
  height: number,
  signal?: AbortSignal,
) => Promise<Blob>;
export type PngJpgConverterRequest =
  | { action: "prepare"; files: File[] }
  | { action: "convert"; files: File[]; settings: unknown };
export type PngJpgConverterResponse =
  | { type: "prepared"; items: PngJpgConverterPreparedImage[] }
  | { type: "progress"; completed: number; total: number }
  | { type: "result"; result: PngJpgConverterResult }
  | { type: "error"; code: PngJpgConverterError["code"] }
  | {
      type: "rasterize";
      file: File;
      info: PngJpgConverterInfo;
      settings: PngJpgConverterSettings;
      preview: boolean;
    }
  | { type: "preview-output"; blob: Blob; width: number; height: number };
export type PngJpgConverterRasterizeReply =
  | { action: "rasterized"; image: PngJpgConverterRasterized }
  | { action: "rasterize-error"; code: PngJpgConverterError["code"] }
  | { action: "output-preview"; blob: Blob }
  | { action: "output-preview-error"; code: PngJpgConverterError["code"] };

const bounds: ImageProcessingBounds = {
  side: pngJpgConverterLimits.side,
  pixels: pngJpgConverterLimits.pixels,
  outputBytes: pngJpgConverterLimits.outputBytes,
};

function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new PngJpgConverterError("CANCELLED");
}

function mapError(error: unknown): PngJpgConverterError {
  if (error instanceof PngJpgConverterError) return error;
  if (error instanceof Error && "code" in error && typeof error.code === "string")
    return new PngJpgConverterError(error.code as PngJpgConverterError["code"]);
  return new PngJpgConverterError("CONVERSION_FAILED");
}

async function verifyOutputImage(
  blob: Blob,
  outputFormat: PngJpgConverterInfo["format"],
  sourceInfo: PngJpgConverterInfo,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<void> {
  if (blob.type !== pngJpgFormatMimeType(outputFormat))
    throw new PngJpgConverterError("CONVERSION_FAILED");
  if (blob.size < 1 || blob.size > pngJpgConverterLimits.outputBytes)
    throw new PngJpgConverterError(blob.size ? "LIMIT_EXCEEDED" : "INVALID_IMAGE");
  if (width * height !== sourceInfo.width * sourceInfo.height)
    throw new PngJpgConverterError("CONVERSION_FAILED");
  {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    try {
      const info = inspectImage(bytes);
      assertPngJpgConverterDimensions(info.width, info.height);
      if (
        info.kind !== outputFormat ||
        info.width !== width ||
        info.height !== height ||
        info.width * info.height !== sourceInfo.width * sourceInfo.height
      )
        throw new PngJpgConverterError("CONVERSION_FAILED");
    } catch (error) {
      throw mapError(error);
    } finally {
      bytes.fill(0);
    }
  }
  await verifyDecodedImageBlob(blob, width, height, signal, bounds);
  checkCancelled(signal);
}

export async function inspectPngJpgConverterFile(
  file: File,
  signal?: AbortSignal,
): Promise<PngJpgConverterInfo> {
  checkCancelled(signal);
  const parsed = pngJpgConverterFilesSchema.safeParse([
    { name: file.name, size: file.size, type: file.type },
  ]);
  if (!parsed.success) {
    try {
      assertPngJpgConverterSelection([file]);
    } catch (error) {
      throw mapError(error);
    }
    throw new PngJpgConverterError("INVALID_IMAGE");
  }
  try {
    const info = await inspectStaticImageFile(file, signal);
    if (info.kind !== "png" && info.kind !== "jpeg")
      throw new PngJpgConverterError("UNSUPPORTED_FORMAT");
    assertPngJpgFileExtension(file.name, info.kind);
    assertPngJpgConverterDimensions(info.width, info.height);
    return { format: info.kind, width: info.width, height: info.height };
  } catch (error) {
    throw mapError(error);
  }
}

export async function rasterizePngJpgConverterImage(
  file: File,
  info: PngJpgConverterInfo,
  inputSettings: PngJpgConverterSettings,
  thumbnail = false,
  signal?: AbortSignal,
): Promise<PngJpgConverterRasterized> {
  checkCancelled(signal);
  const settings = pngJpgConverterSettingsSchema.safeParse(inputSettings);
  if (!settings.success) throw new PngJpgConverterError("INVALID_SETTINGS");
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await decodeStaticImageBitmap(
      file,
      { kind: info.format, width: info.width, height: info.height },
      signal,
      bounds,
    );
    const bitmapWidth = bitmap.width;
    const bitmapHeight = bitmap.height;
    const scale = thumbnail
      ? Math.min(1, pngJpgConverterLimits.previewSide / Math.max(bitmapWidth, bitmapHeight))
      : 1;
    const width = thumbnail ? Math.max(1, Math.round(bitmapWidth * scale)) : bitmapWidth;
    const height = thumbnail ? Math.max(1, Math.round(bitmapHeight * scale)) : bitmapHeight;
    const format = thumbnail ? "png" : pngJpgOutputFormat(info.format);
    const encoded = await encodeImageBitmap(
      bitmap,
      {
        format,
        width,
        height,
        quality: settings.data.quality,
        ...(format === "jpeg" ? { background: settings.data.backgroundColor } : {}),
      },
      signal,
      bounds,
    );
    bitmap.close();
    bitmap = undefined;
    await verifyDecodedImageBlob(encoded.blob, width, height, signal, bounds);
    checkCancelled(signal);
    return {
      blob: encoded.blob,
      width: thumbnail ? bitmapWidth : encoded.width,
      height: thumbnail ? bitmapHeight : encoded.height,
    };
  } catch (error) {
    throw mapError(error);
  } finally {
    bitmap?.close();
  }
}

export async function previewPngJpgConverterOutput(
  blob: Blob,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<Blob> {
  checkCancelled(signal);
  assertPngJpgConverterDimensions(width, height);
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new PngJpgConverterError("CONVERSION_FAILED");
  }
  try {
    checkCancelled(signal);
    if (bitmap.width !== width || bitmap.height !== height)
      throw new PngJpgConverterError("CONVERSION_FAILED");
    const scale = Math.min(1, pngJpgConverterLimits.previewSide / Math.max(width, height));
    const preview = await encodeImageBitmap(
      bitmap,
      {
        format: "png",
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        quality: 85,
      },
      signal,
      bounds,
    );
    bitmap.close();
    bitmap = undefined;
    await verifyDecodedImageBlob(preview.blob, preview.width, preview.height, signal, bounds);
    checkCancelled(signal);
    return preview.blob;
  } catch (error) {
    throw mapError(error);
  } finally {
    bitmap?.close();
  }
}

export async function preparePngJpgConverterFiles(
  files: readonly File[],
  signal?: AbortSignal,
  rasterize: PngJpgConverterRasterize = rasterizePngJpgConverterImage,
): Promise<{ items: PngJpgConverterPreparedImage[] }> {
  const parsed = pngJpgConverterFilesSchema.safeParse(
    files.map(({ name, size, type }) => ({ name, size, type })),
  );
  if (!parsed.success) {
    try {
      assertPngJpgConverterSelection(files);
    } catch (error) {
      throw mapError(error);
    }
    throw new PngJpgConverterError("INVALID_IMAGE");
  }
  try {
    assertPngJpgConverterSelection(files);
    const items: PngJpgConverterPreparedImage[] = [];
    for (const file of files) {
      checkCancelled(signal);
      const info = await inspectPngJpgConverterFile(file, signal);
      const preview = await rasterize(
        file,
        info,
        { quality: 85, backgroundColor: "#ffffff" },
        true,
        signal,
      );
      if (preview.blob.type !== "image/png") throw new PngJpgConverterError("CONVERSION_FAILED");
      items.push({
        ...info,
        width: preview.width,
        height: preview.height,
        inputBytes: file.size,
        preview: preview.blob,
      });
    }
    checkCancelled(signal);
    return { items };
  } catch (error) {
    throw mapError(error);
  }
}

export async function convertPngJpgFiles(
  files: readonly File[],
  inputSettings: unknown,
  signal?: AbortSignal,
  rasterize: PngJpgConverterRasterize = rasterizePngJpgConverterImage,
  createPreview: PngJpgConverterPreview = previewPngJpgConverterOutput,
  onProgress?: (completed: number, total: number) => void,
): Promise<PngJpgConverterResult> {
  checkCancelled(signal);
  const selected = pngJpgConverterFilesSchema.safeParse(
    files.map(({ name, size, type }) => ({ name, size, type })),
  );
  const settings = pngJpgConverterSettingsSchema.safeParse(inputSettings);
  if (!selected.success) {
    try {
      assertPngJpgConverterSelection(files);
    } catch (error) {
      throw mapError(error);
    }
    throw new PngJpgConverterError("INVALID_IMAGE");
  }
  if (!settings.success) throw new PngJpgConverterError("INVALID_SETTINGS");

  const archiveParts: Uint8Array[] = [];
  try {
    assertPngJpgConverterSelection(files);
    const infos: PngJpgConverterInfo[] = [];
    for (const file of files) {
      checkCancelled(signal);
      infos.push(await inspectPngJpgConverterFile(file, signal));
    }
    const formats = infos.map((info) => pngJpgOutputFormat(info.format));
    const names = createPngJpgOutputNames(files, formats);
    const multiFile = files.length > 1;
    let archiveBytes = 0;
    let archiveError = false;
    const zipApi = multiFile ? await import("fflate") : undefined;
    const zip = zipApi
      ? new zipApi.Zip((error, chunk) => {
          if (error || !chunk) {
            archiveError = true;
            return;
          }
          archiveBytes += chunk.byteLength;
          if (archiveBytes > pngJpgConverterLimits.archiveBytes) {
            archiveError = true;
            return;
          }
          archiveParts.push(chunk);
        })
      : undefined;
    const items: PngJpgConvertedImage[] = [];
    let preview: Blob | undefined;
    let singleBlob: Blob | undefined;
    let totalOutputBytes = 0;

    for (const [index, file] of files.entries()) {
      checkCancelled(signal);
      const info = infos[index];
      const name = names[index];
      if (!info || !name) throw new PngJpgConverterError("CONVERSION_FAILED");
      const format = formats[index];
      if (!format) throw new PngJpgConverterError("CONVERSION_FAILED");
      const encoded = await rasterize(file, info, settings.data, false, signal);
      await verifyOutputImage(encoded.blob, format, info, encoded.width, encoded.height, signal);
      totalOutputBytes += encoded.blob.size;
      const outputLimit = multiFile
        ? pngJpgConverterLimits.batchOutputBytes
        : pngJpgConverterLimits.outputBytes;
      if (totalOutputBytes > outputLimit) throw new PngJpgConverterError("LIMIT_EXCEEDED");
      if (index === 0) {
        preview = await createPreview(encoded.blob, encoded.width, encoded.height, signal);
        if (preview.type !== "image/png" || preview.size > pngJpgConverterLimits.outputBytes)
          throw new PngJpgConverterError("CONVERSION_FAILED");
      }
      if (zip) {
        const bytes = new Uint8Array(await encoded.blob.arrayBuffer());
        if (!zipApi) throw new PngJpgConverterError("CONVERSION_FAILED");
        const entry = new zipApi.ZipPassThrough(name);
        entry.mtime = new Date("2000-01-01T00:00:00.000Z");
        zip.add(entry);
        entry.push(bytes, true);
        if (archiveError) throw new PngJpgConverterError("CONVERSION_FAILED");
      } else singleBlob = encoded.blob;
      items.push({
        format,
        width: encoded.width,
        height: encoded.height,
        name,
        inputBytes: file.size,
        outputBytes: encoded.blob.size,
      });
      checkCancelled(signal);
      onProgress?.(index + 1, files.length);
    }

    checkCancelled(signal);
    if (!preview) throw new PngJpgConverterError("CONVERSION_FAILED");
    let blob: Blob;
    let fileName: string;
    let outputKind: "image" | "zip";
    if (zip) {
      zip.end();
      if (
        archiveError ||
        archiveParts.length === 0 ||
        archiveBytes > pngJpgConverterLimits.archiveBytes
      )
        throw new PngJpgConverterError("CONVERSION_FAILED");
      const blobParts: BlobPart[] = archiveParts.map((part) => {
        if (part.buffer instanceof ArrayBuffer)
          return new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
        const copy = new Uint8Array(part.byteLength);
        copy.set(part);
        return copy;
      });
      blob = new Blob(blobParts, { type: "application/zip" });
      for (const part of archiveParts) part.fill(0);
      fileName = "toolbox-converted-images.zip";
      outputKind = "zip";
      if (blob.size !== archiveBytes) throw new PngJpgConverterError("CONVERSION_FAILED");
      blobParts.length = 0;
      archiveParts.length = 0;
    } else {
      const onlyName = names[0];
      if (!singleBlob || !onlyName) throw new PngJpgConverterError("CONVERSION_FAILED");
      blob = singleBlob;
      fileName = onlyName;
      outputKind = "image";
    }
    checkCancelled(signal);
    return {
      blob,
      fileName,
      outputKind,
      outputBytes: blob.size,
      uncompressedOutputBytes: totalOutputBytes,
      items,
      preview,
    };
  } catch (error) {
    for (const part of archiveParts) part.fill(0);
    archiveParts.length = 0;
    throw mapError(error);
  }
}
