import { assertImageDimensions, type ImageInfo, ImageInputError } from "./image-input.js";

export const imageProcessingLimits = {
  fileBytes: 16 * 1024 * 1024,
  side: 8192,
  pixels: 8_000_000,
  outputBytes: 24 * 1024 * 1024,
} as const;

export type ImageFormat = ImageInfo["kind"];

const mimeTypes: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function assertImageProcessingDimensions(width: number, height: number): void {
  assertImageDimensions(width, height);
  if (
    width > imageProcessingLimits.side ||
    height > imageProcessingLimits.side ||
    width * height > imageProcessingLimits.pixels
  )
    throw new ImageInputError("LIMIT_EXCEEDED");
}

export function imageFormatMimeType(format: ImageFormat): string {
  return mimeTypes[format];
}

export function imageFormatExtension(format: ImageFormat): string {
  return format === "jpeg" ? "jpg" : format;
}
