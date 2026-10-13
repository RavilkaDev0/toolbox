import { assertImageFileMetadata, ImageInputError } from "./image-input.js";
import { assertImageProcessingDimensions, imageProcessingLimits } from "./image-processing.js";

export const pngJpgConverterLimits = {
  files: 10,
  fileBytes: imageProcessingLimits.fileBytes,
  totalInputBytes: 32 * 1024 * 1024,
  side: imageProcessingLimits.side,
  pixels: imageProcessingLimits.pixels,
  outputBytes: imageProcessingLimits.outputBytes,
  batchOutputBytes: 32 * 1024 * 1024,
  archiveBytes: 33 * 1024 * 1024,
  previewSide: 360,
  operationMs: 60_000,
} as const;

export type PngJpgImageFormat = "jpeg" | "png";
export type PngJpgConverterSettings = { quality: number; backgroundColor: string };
export type PngJpgConverterInfo = {
  format: PngJpgImageFormat;
  width: number;
  height: number;
};
export type PngJpgConverterErrorCode =
  | "INVALID_IMAGE"
  | "UNSUPPORTED_FORMAT"
  | "LIMIT_EXCEEDED"
  | "CANCELLED"
  | "CONVERSION_FAILED"
  | "INVALID_SETTINGS";

const messages: Record<PngJpgConverterErrorCode, string> = {
  INVALID_IMAGE: "A file is empty or damaged. Choose a valid PNG or JPEG image.",
  UNSUPPORTED_FORMAT: "Choose PNG or JPEG images. The file type must match its actual content.",
  LIMIT_EXCEEDED:
    "Choose up to 10 images, 16 MiB each and 32 MiB total. Each image is limited to 8 megapixels, 8,192 px per side and 24 MiB output; a batch is limited to 32 MiB output.",
  CANCELLED: "Conversion cancelled. Your selected images are still available.",
  CONVERSION_FAILED: "The browser could not convert this image. Try a smaller image or run again.",
  INVALID_SETTINGS: "Choose JPEG quality from 10 to 95 and a six-digit background color.",
};

export class PngJpgConverterError extends Error {
  constructor(readonly code: PngJpgConverterErrorCode) {
    super(messages[code]);
    this.name = "PngJpgConverterError";
  }
}

export const defaultPngJpgConverterSettings: PngJpgConverterSettings = {
  quality: 85,
  backgroundColor: "#ffffff",
};

export function assertPngJpgConverterSelection(
  files: readonly { name: string; size: number; type: string }[],
): void {
  if (files.length === 0) throw new PngJpgConverterError("INVALID_IMAGE");
  if (files.length > pngJpgConverterLimits.files) throw new PngJpgConverterError("LIMIT_EXCEEDED");

  let totalBytes = 0;
  for (const file of files) {
    try {
      assertImageFileMetadata(file, pngJpgConverterLimits.fileBytes);
    } catch (error) {
      if (error instanceof ImageInputError) throw new PngJpgConverterError(error.code);
      throw error;
    }
    if (file.type && file.type !== "image/png" && file.type !== "image/jpeg")
      throw new PngJpgConverterError("UNSUPPORTED_FORMAT");
    totalBytes += file.size;
    if (totalBytes > pngJpgConverterLimits.totalInputBytes)
      throw new PngJpgConverterError("LIMIT_EXCEEDED");
  }
}

export function assertPngJpgConverterDimensions(width: number, height: number): void {
  try {
    assertImageProcessingDimensions(width, height);
  } catch (error) {
    if (error instanceof ImageInputError) throw new PngJpgConverterError(error.code);
    throw error;
  }
}

export function assertPngJpgFileExtension(name: string, format: PngJpgImageFormat): void {
  const pathSeparator = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const dot = name.lastIndexOf(".");
  if (dot <= pathSeparator) return;
  const extension = name.slice(dot + 1).toLowerCase();
  if (
    (format === "png" && extension !== "png") ||
    (format === "jpeg" && extension !== "jpg" && extension !== "jpeg")
  )
    throw new PngJpgConverterError("UNSUPPORTED_FORMAT");
}

export function pngJpgOutputFormat(format: PngJpgImageFormat): PngJpgImageFormat {
  return format === "png" ? "jpeg" : "png";
}

export function pngJpgFormatMimeType(format: PngJpgImageFormat): string {
  return format === "jpeg" ? "image/jpeg" : "image/png";
}

export function pngJpgFormatExtension(format: PngJpgImageFormat): string {
  return format === "jpeg" ? "jpg" : "png";
}

function safeImageStem(name: string, index: number): string {
  const leaf = name.slice(Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1);
  const dot = leaf.lastIndexOf(".");
  const stem = (dot > 0 ? leaf.slice(0, dot) : leaf)
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return '<>:"/\\|?*'.includes(character) || code < 32 || code === 127 ? "_" : character;
    })
    .join("")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 80);
  return stem || `image-${String(index + 1).padStart(2, "0")}`;
}

export function createPngJpgOutputNames(
  files: readonly { name: string }[],
  formats: readonly PngJpgImageFormat[],
): string[] {
  if (files.length !== formats.length) throw new PngJpgConverterError("INVALID_SETTINGS");
  const occupied = new Set<string>();
  return files.map((file, index) => {
    const extension = pngJpgFormatExtension(formats[index] ?? "png");
    const stem = safeImageStem(file.name, index);
    let suffix = 1;
    let candidate = `${stem}-converted.${extension}`;
    while (occupied.has(candidate.toLowerCase())) {
      suffix++;
      candidate = `${stem}-converted-${suffix}.${extension}`;
    }
    occupied.add(candidate.toLowerCase());
    return candidate;
  });
}
