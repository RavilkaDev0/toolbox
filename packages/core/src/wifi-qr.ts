import { assertQrPayload } from "./qr-designer.js";

export type WifiQrSecurity = "wpa" | "wpa3" | "wep" | "open";
export type WifiQrOptions = {
  readonly ssid: string;
  readonly security: WifiQrSecurity;
  readonly password: string;
  readonly hidden: boolean;
};

export const wifiQrLimits = {
  ssidBytes: 32,
  wpaPasswordMinBytes: 8,
  wpaPasswordMaxBytes: 63,
  wpaRawKeyHexLength: 64,
  wepAsciiLengths: [5, 13],
  wepHexLengths: [10, 26],
} as const;

const errors = {
  EMPTY_SSID: "Enter a network name (SSID).",
  INVALID_TEXT: "Use valid Unicode text without control characters.",
  SSID_TOO_LONG: "Network names are limited to 32 UTF-8 bytes.",
  PASSWORD_REQUIRED: "Enter a password that matches the selected security type.",
  PASSWORD_NOT_ALLOWED: "Open networks do not use a password.",
  INVALID_PASSWORD: "The password does not match the selected Wi-Fi security format.",
  INVALID_PAYLOAD: "This Wi-Fi QR payload is invalid or unsupported.",
  QR_TOO_LARGE: "This network name and password exceed QR code capacity.",
} as const;

export type WifiQrErrorCode = keyof typeof errors;

export class WifiQrError extends Error {
  constructor(readonly code: WifiQrErrorCode) {
    super(errors[code]);
    this.name = "WifiQrError";
  }
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isValidUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

function assertText(value: string): void {
  if (!isValidUnicode(value) || hasControlCharacters(value)) throw new WifiQrError("INVALID_TEXT");
}

function validWepPassword(password: string): boolean {
  const ascii = /^[\x20-\x7e]+$/.test(password);
  if (ascii && (wifiQrLimits.wepAsciiLengths as readonly number[]).includes(password.length))
    return true;
  return (
    /^[\da-f]+$/i.test(password) &&
    (wifiQrLimits.wepHexLengths as readonly number[]).includes(password.length)
  );
}

function assertPassword(security: WifiQrSecurity, password: string): void {
  if (security === "open") {
    if (password) throw new WifiQrError("PASSWORD_NOT_ALLOWED");
    return;
  }
  if (!password) throw new WifiQrError("PASSWORD_REQUIRED");
  assertText(password);
  if (security === "wep") {
    if (!validWepPassword(password)) throw new WifiQrError("INVALID_PASSWORD");
    return;
  }
  const bytes = utf8Length(password);
  const validWpaRawKey = security === "wpa" && /^[\da-f]{64}$/i.test(password);
  if (
    !validWpaRawKey &&
    (bytes < wifiQrLimits.wpaPasswordMinBytes || bytes > wifiQrLimits.wpaPasswordMaxBytes)
  )
    throw new WifiQrError("INVALID_PASSWORD");
}

export function assertWifiQrOptions(options: WifiQrOptions): void {
  if (options.ssid.length === 0) throw new WifiQrError("EMPTY_SSID");
  assertText(options.ssid);
  if (utf8Length(options.ssid) > wifiQrLimits.ssidBytes) throw new WifiQrError("SSID_TOO_LONG");
  if (!(["wpa", "wpa3", "wep", "open"] as const).includes(options.security))
    throw new WifiQrError("INVALID_PAYLOAD");
  assertPassword(options.security, options.password);
  if (typeof options.hidden !== "boolean") throw new WifiQrError("INVALID_PAYLOAD");
}

function escapeField(value: string): string {
  return value.replace(/[\\;,:"]/g, "\\$&");
}

export function buildWifiQrPayload(options: WifiQrOptions): string {
  assertWifiQrOptions(options);
  const auth = { wpa: "WPA", wpa3: "SAE", wep: "WEP", open: "nopass" }[options.security];
  const fields = [`T:${auth}`, `S:${escapeField(options.ssid)}`];
  if (options.password) fields.push(`P:${escapeField(options.password)}`);
  if (options.hidden) fields.push("H:true");
  const payload = `WIFI:${fields.join(";")};;`;
  try {
    assertQrPayload(payload);
  } catch {
    throw new WifiQrError("QR_TOO_LARGE");
  }
  return payload;
}

function splitFields(value: string): string[] {
  const fields: string[] = [];
  let current = "";
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      current += `\\${character}`;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === ";") {
      fields.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (escaped) throw new WifiQrError("INVALID_PAYLOAD");
  fields.push(current);
  if (fields.at(-1) === "") fields.pop();
  if (fields.some((field) => !field)) throw new WifiQrError("INVALID_PAYLOAD");
  return fields;
}

function unescapeField(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character !== "\\") {
      result += character;
      continue;
    }
    const next = value[index + 1];
    if (!next || !/[\\;,:"]/.test(next)) throw new WifiQrError("INVALID_PAYLOAD");
    result += next;
    index++;
  }
  return result;
}

export function parseWifiQrPayload(payload: string): WifiQrOptions {
  if (!payload.startsWith("WIFI:") || !payload.endsWith(";;") || payload.length > 2048)
    throw new WifiQrError("INVALID_PAYLOAD");
  const fields = splitFields(payload.slice(5, -2));
  const values = new Map<string, string>();
  for (const field of fields) {
    const divider = field.indexOf(":");
    if (divider < 1) throw new WifiQrError("INVALID_PAYLOAD");
    const key = field.slice(0, divider);
    if (!"T:S:P:H".split(":").includes(key) || values.has(key))
      throw new WifiQrError("INVALID_PAYLOAD");
    values.set(key, unescapeField(field.slice(divider + 1)));
  }

  const securityByAuth: Record<string, WifiQrSecurity> = {
    WPA: "wpa",
    SAE: "wpa3",
    WEP: "wep",
    nopass: "open",
  };
  const auth = values.get("T") ?? "";
  const security = Object.hasOwn(securityByAuth, auth) ? securityByAuth[auth] : undefined;
  const ssid = values.get("S");
  const password = values.get("P") ?? "";
  const hiddenValue = values.get("H");
  if (
    !security ||
    ssid === undefined ||
    (hiddenValue !== undefined && hiddenValue !== "true" && hiddenValue !== "false") ||
    (security === "open" && values.has("P")) ||
    (security !== "open" && !values.has("P"))
  )
    throw new WifiQrError("INVALID_PAYLOAD");

  const options: WifiQrOptions = {
    ssid,
    security,
    password,
    hidden: hiddenValue === "true",
  };
  assertWifiQrOptions(options);
  return options;
}
