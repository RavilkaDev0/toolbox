import {
  assertQrDesignerSettings,
  assertQrLogoMetadata,
  assertQrPayload,
  assertQrUrl,
  QrDesignerError,
  type QrDesignerMode,
  type QrDesignerSettings,
  type QrErrorCorrection,
  qrDesignerLimits,
} from "@toolbox/core";
import jsQR from "jsqr";
import qrcodegen from "nayuki-qr-code-generator";

const errorCorrection: Record<QrErrorCorrection, qrcodegen.QrCode.Ecc> = {
  L: qrcodegen.QrCode.Ecc.LOW,
  M: qrcodegen.QrCode.Ecc.MEDIUM,
  Q: qrcodegen.QrCode.Ecc.QUARTILE,
  H: qrcodegen.QrCode.Ecc.HIGH,
};

export type SanitizedQrLogo = {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
};
export type QrDesignerResult = {
  readonly png: Blob;
  readonly svg: Blob;
  readonly version: number;
  readonly modules: number;
};
export type QrMatrix = { readonly size: number; getModule(x: number, y: number): boolean };

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException("QR generation was cancelled", "AbortError");
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function insideEye(x: number, y: number, size: number): boolean {
  const origins: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  return origins.some(
    ([left, top]) => x >= left - 1 && x <= left + 7 && y >= top - 1 && y <= top + 7,
  );
}

function drawEye(
  x: number,
  y: number,
  style: QrDesignerSettings["eyeStyle"],
  darkFill: string,
  background: string,
): string {
  const black = `<rect x="${x}" y="${y}" width="7" height="7" rx="${style === "rounded" ? 1 : 0}" fill="${darkFill}"/>`;
  const white = `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="${style === "rounded" ? 1 : 0}" fill="${background}"/>`;
  const center = `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${style === "rounded" ? 0.6 : 0}" fill="${darkFill}"/>`;
  if (style !== "circle") return `${black}${white}${center}`;
  return `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="3.5" fill="${darkFill}"/><circle cx="${x + 3.5}" cy="${y + 3.5}" r="2.45" fill="${background}"/><circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.4" fill="${darkFill}"/>`;
}

function logoCenter(
  position: QrDesignerSettings["logoPosition"],
  size: number,
): readonly [number, number] {
  const low = size * 0.43;
  const high = size * 0.57;
  const middle = size / 2;
  const positions: Record<QrDesignerSettings["logoPosition"], readonly [number, number]> = {
    center: [middle, middle],
    top: [middle, low],
    right: [high, middle],
    bottom: [middle, high],
    left: [low, middle],
    "top-left": [low, low],
    "top-right": [high, low],
    "bottom-left": [low, high],
    "bottom-right": [high, high],
  };
  return positions[position];
}

function logoMarkup(
  logo: SanitizedQrLogo | undefined,
  settings: QrDesignerSettings,
  quietZone: number,
  size: number,
): string {
  if (!logo) return "";
  const extent = size * (settings.logoPercent / 100);
  const [centerX, centerY] = logoCenter(settings.logoPosition, size);
  const left = quietZone + centerX - extent / 2;
  const top = quietZone + centerY - extent / 2;
  const inset = Math.min(0.35, extent * 0.18);
  const contentWidth = extent - inset * 2;
  const ratio = logo.width / logo.height;
  const imageWidth = ratio >= 1 ? contentWidth : contentWidth * ratio;
  const imageHeight = ratio >= 1 ? contentWidth / ratio : contentWidth;
  const imageX = left + (extent - imageWidth) / 2;
  const imageY = top + (extent - imageHeight) / 2;
  const dataUrl = escapeAttribute(logo.dataUrl);
  return `<rect x="${left - 0.08}" y="${top - 0.08}" width="${extent + 0.16}" height="${extent + 0.16}" rx="0.35" fill="${settings.background}"/><image href="${dataUrl}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet"/>`;
}

export function buildQrSvg(
  matrix: QrMatrix,
  settings: QrDesignerSettings,
  logo?: SanitizedQrLogo,
): string {
  assertQrDesignerSettings(settings);
  if (
    logo &&
    (!Number.isInteger(logo.width) ||
      !Number.isInteger(logo.height) ||
      logo.width < 1 ||
      logo.height < 1 ||
      logo.width > qrDesignerLimits.logoSide ||
      logo.height > qrDesignerLimits.logoSide ||
      logo.width * logo.height > qrDesignerLimits.logoPixels ||
      logo.dataUrl.length > 1_400_000 ||
      !/^data:image\/png;base64,[\da-z+/]+={0,2}$/i.test(logo.dataUrl))
  )
    throw new QrDesignerError("INVALID_LOGO");
  const size = matrix.size;
  const quietZone = settings.quietZone;
  const fullSize = size + quietZone * 2;
  const dark = settings.gradient ? "url(#qr-gradient)" : settings.foreground;
  const squares: string[] = [];
  const marks: string[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!matrix.getModule(x, y) || insideEye(x, y, size)) continue;
      const left = x + quietZone;
      const top = y + quietZone;
      if (settings.dotStyle === "square") {
        squares.push(`M${left} ${top}h1v1h-1z`);
      } else if (settings.dotStyle === "diamond") {
        marks.push(
          `<path d="M${left + 0.5} ${top}L${left + 1} ${top + 0.5}L${left + 0.5} ${top + 1}L${left} ${top + 0.5}Z"/>`,
        );
      } else {
        marks.push(
          settings.dotStyle === "dots"
            ? `<circle cx="${left + 0.5}" cy="${top + 0.5}" r="0.49"/>`
            : `<rect x="${left + 0.06}" y="${top + 0.06}" width="0.88" height="0.88" rx="0.24"/>`,
        );
      }
    }
  }

  const eyes = [
    [quietZone, quietZone],
    [quietZone + size - 7, quietZone],
    [quietZone, quietZone + size - 7],
  ] as const;
  const eyeMarkup = eyes
    .map(([x, y]) => drawEye(x, y, settings.eyeStyle, dark, settings.background))
    .join("");
  const gradient = settings.gradient
    ? `<defs><linearGradient id="qr-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${settings.foreground}"/><stop offset="1" stop-color="${settings.gradientEnd}"/></linearGradient></defs>`
    : "";
  const moduleMarks = squares.length ? `<path fill="${dark}" d="${squares.join("")}"/>` : "";
  const logoLayer = logoMarkup(logo, settings, quietZone, size);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.size}" height="${settings.size}" viewBox="0 0 ${fullSize} ${fullSize}" role="img"><title>QR code</title>${gradient}<rect width="${fullSize}" height="${fullSize}" fill="${settings.background}"/>${moduleMarks}<g fill="${dark}">${marks.join("")}</g>${eyeMarkup}${logoLayer}</svg>`;
  if (new Blob([svg], { type: "image/svg+xml" }).size > qrDesignerLimits.svgBytes)
    throw new QrDesignerError("OUTPUT_LIMIT");
  return svg;
}

function imageFromUrl(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      image.src = "";
      reject(new DOMException("QR generation was cancelled", "AbortError"));
    };
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new QrDesignerError("ENCODE_FAILED"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new QrDesignerError("ENCODE_FAILED"));
    }, "image/png");
  });
}

function scanCanvas(canvas: HTMLCanvasElement, expected: string): void {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new QrDesignerError("ENCODE_FAILED");
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
  if (decoded?.data !== expected) throw new QrDesignerError("SCAN_FAILED");
}

async function drawImageOnCanvas(
  blob: Blob,
  size: number,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  throwIfAborted(signal);
  const url = URL.createObjectURL(blob);
  const canvas = document.createElement("canvas");
  try {
    const image = await imageFromUrl(url, signal);
    throwIfAborted(signal);
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new QrDesignerError("ENCODE_FAILED");
    context.drawImage(image, 0, 0, size, size);
    return canvas;
  } catch (error) {
    canvas.width = 0;
    canvas.height = 0;
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function createQrDesignerResult(
  mode: QrDesignerMode,
  payload: string,
  settings: QrDesignerSettings,
  logo?: SanitizedQrLogo,
  signal?: AbortSignal,
): Promise<QrDesignerResult> {
  throwIfAborted(signal);
  const matrix = encodeQrMatrix(mode, payload, settings);
  throwIfAborted(signal);
  const svgText = buildQrSvg(matrix, settings, logo);
  const svg = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const canvas = await drawImageOnCanvas(svg, settings.size, signal);
  try {
    throwIfAborted(signal);
    scanCanvas(canvas, payload);
    const png = await canvasBlob(canvas);
    throwIfAborted(signal);
    if (png.size > qrDesignerLimits.pngBytes) throw new QrDesignerError("OUTPUT_LIMIT");
    const decodedPng = await drawImageOnCanvas(png, settings.size, signal);
    try {
      scanCanvas(decodedPng, payload);
    } finally {
      decodedPng.width = 0;
      decodedPng.height = 0;
    }
    return { png, svg, version: matrix.version, modules: matrix.size };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function encodeQrMatrix(
  mode: QrDesignerMode,
  payload: string,
  settings: QrDesignerSettings,
): qrcodegen.QrCode {
  assertQrDesignerSettings(settings);
  assertQrPayload(payload);
  if (mode === "url") assertQrUrl(payload);
  try {
    return qrcodegen.QrCode.encodeText(payload, errorCorrection[settings.errorCorrection]);
  } catch (error) {
    if (error instanceof RangeError) throw new QrDesignerError("DATA_TOO_LARGE");
    throw new QrDesignerError("ENCODE_FAILED");
  }
}

function pngDimensions(bytes: Uint8Array): readonly [number, number] | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  )
    return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function jpegDimensions(bytes: Uint8Array): readonly [number, number] | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  const frameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset];
    offset++;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) return null;
    if (frameMarkers.has(marker)) {
      const height = ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      return [width, height];
    }
    offset += length;
  }
  return null;
}

export async function sanitizeQrDesignerLogo(
  file: File,
  signal?: AbortSignal,
): Promise<SanitizedQrLogo> {
  assertQrLogoMetadata(file);
  const extension = file.name.toLowerCase().split(".").at(-1);
  if (
    (file.type === "image/png" && extension !== "png") ||
    (file.type === "image/jpeg" && extension !== "jpg" && extension !== "jpeg")
  )
    throw new QrDesignerError("INVALID_LOGO");
  throwIfAborted(signal);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let dimensions: readonly [number, number] | null;
  try {
    throwIfAborted(signal);
    dimensions = file.type === "image/png" ? pngDimensions(bytes) : jpegDimensions(bytes);
  } finally {
    bytes.fill(0);
  }
  if (!dimensions) throw new QrDesignerError("INVALID_LOGO");
  const [width, height] = dimensions;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > qrDesignerLimits.logoSide ||
    height > qrDesignerLimits.logoSide ||
    width * height > qrDesignerLimits.logoPixels
  )
    throw new QrDesignerError("LOGO_LIMIT");
  let bitmap: ImageBitmap | undefined;
  const canvas = document.createElement("canvas");
  try {
    bitmap = await createImageBitmap(file);
    throwIfAborted(signal);
    if (
      bitmap.width < 1 ||
      bitmap.height < 1 ||
      bitmap.width > qrDesignerLimits.logoSide ||
      bitmap.height > qrDesignerLimits.logoSide ||
      bitmap.width * bitmap.height > qrDesignerLimits.logoPixels
    )
      throw new QrDesignerError("LOGO_LIMIT");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new QrDesignerError("INVALID_LOGO");
    context.drawImage(bitmap, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), width: bitmap.width, height: bitmap.height };
  } catch (error) {
    if (
      error instanceof QrDesignerError ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw error;
    throw new QrDesignerError("INVALID_LOGO");
  } finally {
    bitmap?.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
