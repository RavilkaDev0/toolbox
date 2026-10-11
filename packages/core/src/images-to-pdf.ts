export const imagePdfLimits = {
  files: 10,
  fileBytes: 8 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024,
  side: 8192,
  pixels: 12_000_000,
  totalPixels: 24_000_000,
  encodedBytes: 48 * 1024 * 1024,
  outputBytes: 64 * 1024 * 1024,
} as const;

export type ImagePdfOptions = {
  pageSize: "auto" | "a4" | "letter";
  orientation: "portrait" | "landscape";
  margin: 0 | 10 | 20;
  placement: "fit" | "fill";
};
export const defaultImagePdfOptions: ImagePdfOptions = {
  pageSize: "a4",
  orientation: "portrait",
  margin: 10,
  placement: "fit",
};
export type ImageInfo = { kind: "jpeg" | "png" | "webp"; width: number; height: number };
export type ImagePdfErrorCode =
  | "INVALID_IMAGE"
  | "UNSUPPORTED_FORMAT"
  | "LIMIT_EXCEEDED"
  | "CANCELLED"
  | "CONVERSION_FAILED";
const messages: Record<ImagePdfErrorCode, string> = {
  INVALID_IMAGE: "An image is empty or damaged. Choose a valid JPEG, PNG or WebP file.",
  UNSUPPORTED_FORMAT: "Choose a static JPEG, PNG or WebP image. Animated images are not supported.",
  LIMIT_EXCEEDED:
    "This selection exceeds the limits. Use smaller images or split the selection into batches.",
  CANCELLED: "Operation cancelled. Your selected images are still available.",
  CONVERSION_FAILED:
    "The browser could not create this PDF. Try fewer or smaller images, then retry.",
};
export class ImagePdfError extends Error {
  constructor(readonly code: ImagePdfErrorCode) {
    super(messages[code]);
    this.name = "ImagePdfError";
  }
}
export function assertImageDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new ImagePdfError("INVALID_IMAGE");
  if (
    width > imagePdfLimits.side ||
    height > imagePdfLimits.side ||
    width * height > imagePdfLimits.pixels
  )
    throw new ImagePdfError("LIMIT_EXCEEDED");
}
export function assertImageSelection(
  files: readonly { size: number; name: string; type: string }[],
) {
  if (!files.length) throw new ImagePdfError("INVALID_IMAGE");
  if (
    files.length > imagePdfLimits.files ||
    files.reduce((n, f) => n + f.size, 0) > imagePdfLimits.totalBytes
  )
    throw new ImagePdfError("LIMIT_EXCEEDED");
  for (const file of files) {
    if (
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      !file.name.length ||
      file.name.length > 255
    )
      throw new ImagePdfError("INVALID_IMAGE");
    if (file.size > imagePdfLimits.fileBytes) throw new ImagePdfError("LIMIT_EXCEEDED");
    if (file.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new ImagePdfError("UNSUPPORTED_FORMAT");
  }
}

// Some browser decoders accept damaged PNG pixels; enforce integrity consistently.
const pngCrcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function pngCrc(bytes: Uint8Array, start: number, end: number) {
  let crc = 0xffffffff;
  for (let offset = start; offset < end; offset++)
    crc = (pngCrcTable[(crc ^ (bytes[offset] ?? 0)) & 255] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Compressed byte limits alone do not bound memory: inspect every dimension before decode.
export function inspectImage(bytes: Uint8Array): ImageInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  let info: ImageInfo | undefined;
  if (bytes.length >= 33 && text(0, 8) === "\x89PNG\r\n\x1a\n") {
    if (view.getUint32(8) !== 13 || text(12, 4) !== "IHDR")
      throw new ImagePdfError("INVALID_IMAGE");
    info = { kind: "png", width: view.getUint32(16), height: view.getUint32(20) };
    assertImageDimensions(info.width, info.height);
    let end = false;
    for (let offset = 8; offset + 12 <= bytes.length; ) {
      const length = view.getUint32(offset);
      if (length > bytes.length - offset - 12) throw new ImagePdfError("INVALID_IMAGE");
      const chunk = text(offset + 4, 4);
      if (
        (chunk === "IHDR" && offset !== 8) ||
        (chunk === "IEND" && length !== 0) ||
        pngCrc(bytes, offset + 4, offset + 8 + length) !== view.getUint32(offset + 8 + length)
      )
        throw new ImagePdfError("INVALID_IMAGE");
      if (chunk === "acTL") throw new ImagePdfError("UNSUPPORTED_FORMAT");
      offset += length + 12;
      if (chunk === "IEND") {
        end = true;
        break;
      }
    }
    if (!end) throw new ImagePdfError("INVALID_IMAGE");
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    if (bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new ImagePdfError("INVALID_IMAGE");
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) throw new ImagePdfError("INVALID_IMAGE");
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker !== undefined && marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) throw new ImagePdfError("INVALID_IMAGE");
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw new ImagePdfError("INVALID_IMAGE");
      if (marker === 192 || marker === 193 || marker === 194) {
        if (length < 8 || info) throw new ImagePdfError("INVALID_IMAGE");
        info = {
          kind: "jpeg",
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
        };
      }
      offset += length;
    }
  } else if (bytes.length >= 30 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    if (view.getUint32(4, true) + 8 !== bytes.length) throw new ImagePdfError("INVALID_IMAGE");
    let canvasSize: ImageInfo | undefined;
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const chunk = text(offset, 4);
      const length = view.getUint32(offset + 4, true);
      const data = offset + 8;
      if (length > bytes.length - data) throw new ImagePdfError("INVALID_IMAGE");
      if (chunk === "ANIM" || chunk === "ANMF") throw new ImagePdfError("UNSUPPORTED_FORMAT");
      if (chunk === "VP8X") {
        if (length !== 10 || canvasSize) throw new ImagePdfError("INVALID_IMAGE");
        if ((view.getUint8(data) & 2) !== 0) throw new ImagePdfError("UNSUPPORTED_FORMAT");
        const uint24 = (o: number) =>
          view.getUint8(o) + view.getUint8(o + 1) * 256 + view.getUint8(o + 2) * 65536;
        canvasSize = { kind: "webp", width: uint24(data + 4) + 1, height: uint24(data + 7) + 1 };
        assertImageDimensions(canvasSize.width, canvasSize.height);
      } else if (chunk === "VP8 " || chunk === "VP8L") {
        if (info) throw new ImagePdfError("INVALID_IMAGE");
        if (chunk === "VP8 " && length >= 10 && text(data + 3, 3) === "\x9d\x01\x2a") {
          info = {
            kind: "webp",
            width: view.getUint16(data + 6, true) & 16383,
            height: view.getUint16(data + 8, true) & 16383,
          };
        } else if (chunk === "VP8L" && length >= 5 && bytes[data] === 47) {
          const bits = view.getUint32(data + 1, true);
          info = { kind: "webp", width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 };
        } else throw new ImagePdfError("INVALID_IMAGE");
        assertImageDimensions(info.width, info.height);
      }
      offset = data + length + (length % 2);
    }
    if (
      offset !== bytes.length ||
      (canvasSize && info && (canvasSize.width !== info.width || canvasSize.height !== info.height))
    )
      throw new ImagePdfError("INVALID_IMAGE");
  } else {
    throw new ImagePdfError("UNSUPPORTED_FORMAT");
  }
  if (!info) throw new ImagePdfError("INVALID_IMAGE");
  assertImageDimensions(info.width, info.height);
  return info;
}

export function imagePageLayout(width: number, height: number, options: ImagePdfOptions) {
  assertImageDimensions(width, height);
  const mm = 72 / 25.4;
  const margin = options.pageSize === "auto" ? 0 : options.margin * mm;
  let pageWidth: number;
  let pageHeight: number;
  if (options.pageSize === "auto") {
    pageWidth = width * 0.75;
    pageHeight = height * 0.75;
  } else {
    [pageWidth, pageHeight] = options.pageSize === "a4" ? [210 * mm, 297 * mm] : [612, 792];
    if (options.orientation === "landscape") [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }
  const contentWidth = pageWidth - 2 * margin;
  const contentHeight = pageHeight - 2 * margin;
  const scale = (options.placement === "fill" ? Math.max : Math.min)(
    contentWidth / width,
    contentHeight / height,
  );
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  return {
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    contentHeight,
    width: drawWidth,
    height: drawHeight,
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
  };
}

export { moveItem as moveImage } from "./ordering.js";
