export const qrDesignerLimits = {
  payloadBytes: 2048,
  logoFileBytes: 1024 * 1024,
  logoSide: 512,
  logoPixels: 262_144,
  sizeMin: 256,
  sizeMax: 1024,
  quietZoneMin: 4,
  quietZoneMax: 12,
  logoPercentMin: 6,
  logoPercentMax: 16,
  pngBytes: 5 * 1024 * 1024,
  svgBytes: 4 * 1024 * 1024,
} as const;

export type QrErrorCorrection = "L" | "M" | "Q" | "H";
export type QrDotStyle = "square" | "rounded" | "dots" | "diamond";
export type QrEyeStyle = "square" | "rounded" | "circle";
export type QrLogoPosition =
  | "center"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
export type QrDesignerPreset = "classic" | "garden" | "studio";
export type QrDesignerMode = "text" | "url";

export type QrDesignerSettings = {
  size: number;
  quietZone: number;
  errorCorrection: QrErrorCorrection;
  foreground: string;
  background: string;
  dotStyle: QrDotStyle;
  eyeStyle: QrEyeStyle;
  gradient: boolean;
  gradientEnd: string;
  logoPercent: number;
  logoPosition: QrLogoPosition;
};

export type QrDesignerErrorCode =
  | "EMPTY_DATA"
  | "INVALID_TEXT"
  | "DATA_TOO_LARGE"
  | "INVALID_URL"
  | "INVALID_SETTINGS"
  | "LOW_CONTRAST"
  | "INVALID_LOGO"
  | "LOGO_LIMIT"
  | "ENCODE_FAILED"
  | "SCAN_FAILED"
  | "OUTPUT_LIMIT";

const messages: Record<QrDesignerErrorCode, string> = {
  EMPTY_DATA: "Enter text or a URL to create a QR code.",
  INVALID_TEXT: "This text contains invalid Unicode and cannot be encoded safely.",
  DATA_TOO_LARGE: "This content is too large for the selected QR error-correction level.",
  INVALID_URL: "Enter a complete http:// or https:// URL.",
  INVALID_SETTINGS: "One or more QR design settings are outside their supported limits.",
  LOW_CONTRAST: "Choose colors with at least 4.5:1 contrast for reliable scanning.",
  INVALID_LOGO: "Choose a valid PNG or JPEG logo image. SVG logos are not accepted.",
  LOGO_LIMIT: "Logo files are limited to 1 MiB, 512 px per side and 0.25 megapixels.",
  ENCODE_FAILED:
    "The browser could not render this QR design. Try a smaller size or simpler style.",
  SCAN_FAILED:
    "This design did not decode back to your text. Try a smaller logo, higher error correction or a simpler style.",
  OUTPUT_LIMIT: "The generated QR export is larger than the supported output limit.",
};

export class QrDesignerError extends Error {
  constructor(readonly code: QrDesignerErrorCode) {
    super(messages[code]);
    this.name = "QrDesignerError";
  }
}

export const qrDesignerPresets: Record<QrDesignerPreset, QrDesignerSettings> = {
  classic: {
    size: 512,
    quietZone: 6,
    errorCorrection: "M",
    foreground: "#111827",
    background: "#ffffff",
    dotStyle: "square",
    eyeStyle: "square",
    gradient: false,
    gradientEnd: "#2563eb",
    logoPercent: 10,
    logoPosition: "center",
  },
  garden: {
    size: 512,
    quietZone: 8,
    errorCorrection: "Q",
    foreground: "#14532d",
    background: "#f0fdf4",
    dotStyle: "dots",
    eyeStyle: "rounded",
    gradient: true,
    gradientEnd: "#0f766e",
    logoPercent: 10,
    logoPosition: "center",
  },
  studio: {
    size: 512,
    quietZone: 6,
    errorCorrection: "H",
    foreground: "#312e81",
    background: "#ffffff",
    dotStyle: "rounded",
    eyeStyle: "circle",
    gradient: true,
    gradientEnd: "#7c3aed",
    logoPercent: 8,
    logoPosition: "center",
  },
};

function validHexColor(value: string): boolean {
  return /^#[\da-f]{6}$/i.test(value);
}

function relativeLuminance(value: string): number {
  const channels = value.slice(1).match(/.{2}/g);
  if (!channels) throw new QrDesignerError("INVALID_SETTINGS");
  const [red, green, blue] = channels.map((part) => {
    const channel = Number.parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function linearChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function channelSlope(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045
    ? 1 / (12.92 * 255)
    : (2.4 * ((channel + 0.055) / 1.055) ** 1.4) / (1.055 * 255);
}

function gradientLuminanceBounds(start: string, end: string): readonly [number, number] {
  const channels = (color: string) =>
    color
      .slice(1)
      .match(/.{2}/g)
      ?.map((part) => Number.parseInt(part, 16));
  const startChannels = channels(start);
  const endChannels = channels(end);
  if (!startChannels || !endChannels) throw new QrDesignerError("INVALID_SETTINGS");
  const delta = startChannels.map((value, index) => (endChannels[index] ?? value) - value);
  const weights = [0.2126, 0.7152, 0.0722];
  const luminanceAt = (fraction: number) =>
    startChannels.reduce((total, value, index) => {
      const mixed = value + (delta[index] ?? 0) * fraction;
      return total + (weights[index] ?? 0) * linearChannel(mixed);
    }, 0);
  const slopeAt = (fraction: number) =>
    startChannels.reduce((total, value, index) => {
      const change = delta[index] ?? 0;
      return total + (weights[index] ?? 0) * channelSlope(value + change * fraction) * change;
    }, 0);
  let low = 0;
  let high = 1;
  if (slopeAt(0) < 0 && slopeAt(1) > 0) {
    for (let iteration = 0; iteration < 32; iteration++) {
      const middle = (low + high) / 2;
      if (slopeAt(middle) < 0) low = middle;
      else high = middle;
    }
  }
  const minimum =
    low === 0 && high === 1
      ? Math.min(luminanceAt(0), luminanceAt(1))
      : luminanceAt((low + high) / 2);
  return [minimum, Math.max(luminanceAt(0), luminanceAt(1))];
}

export function qrContrastRatio(foreground: string, background: string): number {
  if (!validHexColor(foreground) || !validHexColor(background))
    throw new QrDesignerError("INVALID_SETTINGS");
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

export function assertQrPayload(payload: string): number {
  if (!payload.length) throw new QrDesignerError("EMPTY_DATA");
  for (let index = 0; index < payload.length; index++) {
    const value = payload.charCodeAt(index);
    if (value >= 0xd800 && value <= 0xdbff) {
      const next = payload.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) throw new QrDesignerError("INVALID_TEXT");
      index++;
    } else if (value >= 0xdc00 && value <= 0xdfff) throw new QrDesignerError("INVALID_TEXT");
  }
  const byteLength = new TextEncoder().encode(payload).byteLength;
  if (byteLength > qrDesignerLimits.payloadBytes) throw new QrDesignerError("DATA_TOO_LARGE");
  return byteLength;
}

export function assertQrUrl(payload: string): void {
  let hasControlCharacter = false;
  for (let index = 0; index < payload.length; index++) {
    const code = payload.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      hasControlCharacter = true;
      break;
    }
  }
  if (payload !== payload.trim() || hasControlCharacter) throw new QrDesignerError("INVALID_URL");
  try {
    const url = new URL(payload);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname)
      throw new QrDesignerError("INVALID_URL");
  } catch (error) {
    if (error instanceof QrDesignerError) throw error;
    throw new QrDesignerError("INVALID_URL");
  }
}

export function assertQrDesignerSettings(settings: QrDesignerSettings): void {
  if (
    !Number.isInteger(settings.size) ||
    settings.size < qrDesignerLimits.sizeMin ||
    settings.size > qrDesignerLimits.sizeMax ||
    !Number.isInteger(settings.quietZone) ||
    settings.quietZone < qrDesignerLimits.quietZoneMin ||
    settings.quietZone > qrDesignerLimits.quietZoneMax ||
    !Number.isInteger(settings.logoPercent) ||
    settings.logoPercent < qrDesignerLimits.logoPercentMin ||
    settings.logoPercent > qrDesignerLimits.logoPercentMax ||
    !validHexColor(settings.foreground) ||
    !validHexColor(settings.background) ||
    !validHexColor(settings.gradientEnd) ||
    !(["L", "M", "Q", "H"] as const).includes(settings.errorCorrection) ||
    !(["square", "rounded", "dots", "diamond"] as const).includes(settings.dotStyle) ||
    !(["square", "rounded", "circle"] as const).includes(settings.eyeStyle) ||
    !(
      [
        "center",
        "top",
        "right",
        "bottom",
        "left",
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ] as const
    ).includes(settings.logoPosition) ||
    typeof settings.gradient !== "boolean"
  )
    throw new QrDesignerError("INVALID_SETTINGS");
  if (
    qrContrastRatio(settings.foreground, settings.background) < 4.5 ||
    (settings.gradient && qrContrastRatio(settings.gradientEnd, settings.background) < 4.5)
  )
    throw new QrDesignerError("LOW_CONTRAST");
  if (settings.gradient) {
    const [minimum, maximum] = gradientLuminanceBounds(settings.foreground, settings.gradientEnd);
    const background = relativeLuminance(settings.background);
    if (background >= minimum && background <= maximum) throw new QrDesignerError("LOW_CONTRAST");
    const closest = maximum < background ? maximum : minimum;
    const ratio = (Math.max(closest, background) + 0.05) / (Math.min(closest, background) + 0.05);
    if (ratio < 4.5) throw new QrDesignerError("LOW_CONTRAST");
  }
}

export function assertQrLogoMetadata(file: { name: string; size: number; type: string }): void {
  if (
    !file.name.length ||
    file.name.length > 255 ||
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    (file.type !== "image/png" && file.type !== "image/jpeg")
  )
    throw new QrDesignerError("INVALID_LOGO");
  if (file.size > qrDesignerLimits.logoFileBytes) throw new QrDesignerError("LOGO_LIMIT");
}
