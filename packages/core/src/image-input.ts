export const imageInputLimits = { side: 8192, pixels: 12_000_000 } as const;
export const imageInputMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type ImageInfo = { kind: "jpeg" | "png" | "webp"; width: number; height: number };
export type ImageInputErrorCode =
  | "INVALID_IMAGE"
  | "UNSUPPORTED_FORMAT"
  | "LIMIT_EXCEEDED"
  | "CANCELLED"
  | "CONVERSION_FAILED";
const messages: Record<ImageInputErrorCode, string> = {
  INVALID_IMAGE: "An image is empty or damaged. Choose a valid JPEG, PNG or WebP file.",
  UNSUPPORTED_FORMAT: "Choose a static JPEG, PNG or WebP image. Animated images are not supported.",
  LIMIT_EXCEEDED: "The image exceeds the supported image size or pixel limits.",
  CANCELLED: "Image processing was cancelled.",
  CONVERSION_FAILED: "The browser could not process this image.",
};
export class ImageInputError extends Error {
  constructor(readonly code: ImageInputErrorCode) {
    super(messages[code]);
    this.name = "ImageInputError";
  }
}
export function assertImageFileMetadata(
  file: { name: string; size: number; type: string },
  maxBytes: number,
): void {
  if (
    !file.name.length ||
    file.name.length > 255 ||
    !Number.isSafeInteger(file.size) ||
    file.size < 1
  )
    throw new ImageInputError("INVALID_IMAGE");
  if (file.size > maxBytes) throw new ImageInputError("LIMIT_EXCEEDED");
  if (file.type && !imageInputMimeTypes.includes(file.type as (typeof imageInputMimeTypes)[number]))
    throw new ImageInputError("UNSUPPORTED_FORMAT");
}
export function assertImageDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new ImageInputError("INVALID_IMAGE");
  if (
    width > imageInputLimits.side ||
    height > imageInputLimits.side ||
    width * height > imageInputLimits.pixels
  )
    throw new ImageInputError("LIMIT_EXCEEDED");
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
      throw new ImageInputError("INVALID_IMAGE");
    info = { kind: "png", width: view.getUint32(16), height: view.getUint32(20) };
    assertImageDimensions(info.width, info.height);
    let end = false;
    for (let offset = 8; offset + 12 <= bytes.length; ) {
      const length = view.getUint32(offset);
      if (length > bytes.length - offset - 12) throw new ImageInputError("INVALID_IMAGE");
      const chunk = text(offset + 4, 4);
      if (
        (chunk === "IHDR" && offset !== 8) ||
        (chunk === "IEND" && length !== 0) ||
        pngCrc(bytes, offset + 4, offset + 8 + length) !== view.getUint32(offset + 8 + length)
      )
        throw new ImageInputError("INVALID_IMAGE");
      if (chunk === "acTL") throw new ImageInputError("UNSUPPORTED_FORMAT");
      offset += length + 12;
      if (chunk === "IEND") {
        end = true;
        break;
      }
    }
    if (!end) throw new ImageInputError("INVALID_IMAGE");
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    if (bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new ImageInputError("INVALID_IMAGE");
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) throw new ImageInputError("INVALID_IMAGE");
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker !== undefined && marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) throw new ImageInputError("INVALID_IMAGE");
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw new ImageInputError("INVALID_IMAGE");
      if (marker === 192 || marker === 193 || marker === 194) {
        if (length < 8 || info) throw new ImageInputError("INVALID_IMAGE");
        info = {
          kind: "jpeg",
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
        };
      }
      offset += length;
    }
  } else if (bytes.length >= 30 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    if (view.getUint32(4, true) + 8 !== bytes.length) throw new ImageInputError("INVALID_IMAGE");
    let canvasSize: ImageInfo | undefined;
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const chunk = text(offset, 4);
      const length = view.getUint32(offset + 4, true);
      const data = offset + 8;
      if (length > bytes.length - data) throw new ImageInputError("INVALID_IMAGE");
      if (chunk === "ANIM" || chunk === "ANMF") throw new ImageInputError("UNSUPPORTED_FORMAT");
      if (chunk === "VP8X") {
        if (length !== 10 || canvasSize) throw new ImageInputError("INVALID_IMAGE");
        if ((view.getUint8(data) & 2) !== 0) throw new ImageInputError("UNSUPPORTED_FORMAT");
        const uint24 = (o: number) =>
          view.getUint8(o) + view.getUint8(o + 1) * 256 + view.getUint8(o + 2) * 65536;
        canvasSize = { kind: "webp", width: uint24(data + 4) + 1, height: uint24(data + 7) + 1 };
        assertImageDimensions(canvasSize.width, canvasSize.height);
      } else if (chunk === "VP8 " || chunk === "VP8L") {
        if (info) throw new ImageInputError("INVALID_IMAGE");
        if (chunk === "VP8 " && length >= 10 && text(data + 3, 3) === "\x9d\x01\x2a") {
          info = {
            kind: "webp",
            width: view.getUint16(data + 6, true) & 16383,
            height: view.getUint16(data + 8, true) & 16383,
          };
        } else if (chunk === "VP8L" && length >= 5 && bytes[data] === 47) {
          const bits = view.getUint32(data + 1, true);
          info = { kind: "webp", width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 };
        } else throw new ImageInputError("INVALID_IMAGE");
        assertImageDimensions(info.width, info.height);
      }
      offset = data + length + (length % 2);
    }
    if (
      offset !== bytes.length ||
      (canvasSize && info && (canvasSize.width !== info.width || canvasSize.height !== info.height))
    )
      throw new ImageInputError("INVALID_IMAGE");
  } else {
    throw new ImageInputError("UNSUPPORTED_FORMAT");
  }
  if (!info) throw new ImageInputError("INVALID_IMAGE");
  assertImageDimensions(info.width, info.height);
  return info;
}
