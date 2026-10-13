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

export function assertImageFileExtension(name: string, format: ImageFormat): void {
  const pathSeparator = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const dot = name.lastIndexOf(".");
  if (dot <= pathSeparator) return;
  const extension = name.slice(dot + 1).toLowerCase();
  const valid =
    (format === "jpeg" && (extension === "jpg" || extension === "jpeg")) || extension === format;
  if (!valid) throw new ImageInputError("UNSUPPORTED_FORMAT");
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

export function createImageConvertedNames(
  files: readonly { name: string }[],
  formats: readonly ImageFormat[],
): string[] {
  if (files.length !== formats.length) throw new ImageInputError("INVALID_IMAGE");
  const occupied = new Set<string>();
  return files.map((file, index) => {
    const format = formats[index];
    if (!format) throw new ImageInputError("INVALID_IMAGE");
    const extension = imageFormatExtension(format);
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
