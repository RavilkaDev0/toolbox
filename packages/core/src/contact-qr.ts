import { assertQrPayload, qrDesignerLimits } from "./qr-designer.js";

export type ContactQrOptions = {
  readonly fullName: string;
  readonly organization: string;
  readonly jobTitle: string;
  readonly phone: string;
  readonly email: string;
  readonly website: string;
  readonly address: string;
};

export const contactQrLimits = {
  fullNameBytes: 160,
  organizationBytes: 120,
  jobTitleBytes: 120,
  phoneBytes: 32,
  emailBytes: 254,
  websiteBytes: 512,
  addressBytes: 200,
  payloadBytes: qrDesignerLimits.payloadBytes,
  vcardLineBytes: 75,
} as const;

const messages = {
  EMPTY_NAME: "Enter a contact name.",
  INVALID_TEXT: "Use valid Unicode text without unsupported control characters.",
  FIELD_TOO_LONG: "One or more contact fields exceed their supported byte limits.",
  INVALID_PHONE: "Enter an international phone number with 3 to 15 digits.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_WEBSITE: "Enter a complete HTTP or HTTPS website without a username or password.",
  INVALID_VCARD: "The contact card could not be parsed safely.",
  QR_TOO_LARGE: "These contact details exceed the supported QR code capacity.",
} as const;

export type ContactQrErrorCode = keyof typeof messages;

export class ContactQrError extends Error {
  constructor(readonly code: ContactQrErrorCode) {
    super(messages[code]);
    this.name = "ContactQrError";
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

function hasUnsupportedControl(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 && code !== 0x0a && code !== 0x0d) return true;
    if (code >= 0x7f && code <= 0x9f) return true;
  }
  return false;
}

export function normalizeContactQrOptions(options: ContactQrOptions): ContactQrOptions {
  return {
    fullName: normalizeText(options.fullName),
    organization: normalizeText(options.organization),
    jobTitle: normalizeText(options.jobTitle),
    phone: options.phone,
    email: options.email,
    website: options.website,
    address: normalizeText(options.address),
  };
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function assertText(value: string, maxBytes: number): void {
  if (value.length > maxBytes) throw new ContactQrError("FIELD_TOO_LONG");
  if (!isValidUnicode(value) || hasUnsupportedControl(value))
    throw new ContactQrError("INVALID_TEXT");
  if (utf8Length(value) > maxBytes) throw new ContactQrError("FIELD_TOO_LONG");
}

function assertPhone(phone: string): void {
  if (!phone) return;
  if (phone.length > contactQrLimits.phoneBytes) throw new ContactQrError("FIELD_TOO_LONG");
  if (!/^\+?[0-9(). -]+$/.test(phone)) throw new ContactQrError("INVALID_PHONE");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 15) throw new ContactQrError("INVALID_PHONE");
  if (utf8Length(phone) > contactQrLimits.phoneBytes) throw new ContactQrError("FIELD_TOO_LONG");
}

function assertEmail(email: string): void {
  if (!email) return;
  if (email.length > contactQrLimits.emailBytes) throw new ContactQrError("FIELD_TOO_LONG");
  if (utf8Length(email) > contactQrLimits.emailBytes) throw new ContactQrError("FIELD_TOO_LONG");
  const at = email.indexOf("@");
  if (
    at < 1 ||
    at !== email.lastIndexOf("@") ||
    at > 64 ||
    email !== email.trim() ||
    /[^\x21-\x7e]/.test(email)
  )
    throw new ContactQrError("INVALID_EMAIL");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const labels = domain.split(".");
  if (
    !/^[a-z\d!#$%&'*+/=?^_`{|}~.-]+$/i.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    labels.length < 2 ||
    labels.some(
      (label) => !label || label.length > 63 || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label),
    )
  )
    throw new ContactQrError("INVALID_EMAIL");
}

function assertWebsite(website: string): void {
  if (!website) return;
  if (website.length > contactQrLimits.websiteBytes) throw new ContactQrError("FIELD_TOO_LONG");
  if (!isValidUnicode(website)) throw new ContactQrError("INVALID_WEBSITE");
  if (utf8Length(website) > contactQrLimits.websiteBytes)
    throw new ContactQrError("FIELD_TOO_LONG");
  let hasControlOrSpace = false;
  for (const character of website) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f)) {
      hasControlOrSpace = true;
      break;
    }
  }
  if (
    website !== website.trim() ||
    !/^https?:\/\//i.test(website) ||
    website.includes("\\") ||
    hasControlOrSpace
  )
    throw new ContactQrError("INVALID_WEBSITE");
  try {
    const url = new URL(website);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      !url.hostname ||
      url.username ||
      url.password
    )
      throw new ContactQrError("INVALID_WEBSITE");
  } catch {
    throw new ContactQrError("INVALID_WEBSITE");
  }
}

export function assertContactQrOptions(options: ContactQrOptions): void {
  if (
    options.fullName.length > contactQrLimits.fullNameBytes ||
    options.organization.length > contactQrLimits.organizationBytes ||
    options.jobTitle.length > contactQrLimits.jobTitleBytes ||
    options.address.length > contactQrLimits.addressBytes
  )
    throw new ContactQrError("FIELD_TOO_LONG");
  if (
    options.phone.length > contactQrLimits.phoneBytes ||
    options.email.length > contactQrLimits.emailBytes ||
    options.website.length > contactQrLimits.websiteBytes
  )
    throw new ContactQrError("FIELD_TOO_LONG");
  const contact = normalizeContactQrOptions(options);
  if (!contact.fullName.trim()) throw new ContactQrError("EMPTY_NAME");
  assertText(contact.fullName, contactQrLimits.fullNameBytes);
  assertText(contact.organization, contactQrLimits.organizationBytes);
  assertText(contact.jobTitle, contactQrLimits.jobTitleBytes);
  assertText(contact.address, contactQrLimits.addressBytes);
  assertPhone(contact.phone);
  assertEmail(contact.email);
  assertWebsite(contact.website);
}

function escapeText(value: string): string {
  return normalizeText(value)
    .replaceAll("\\", "\\\\")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
    .replaceAll("\n", "\\n");
}

function foldLine(line: string): string {
  const folded: string[] = [];
  let current = "";
  let byteCount = 0;
  for (const character of line) {
    const characterBytes = utf8Length(character);
    if (byteCount + characterBytes > contactQrLimits.vcardLineBytes) {
      folded.push(current);
      current = ` ${character}`;
      byteCount = 1 + characterBytes;
    } else {
      current += character;
      byteCount += characterBytes;
    }
  }
  folded.push(current);
  return folded.join("\r\n");
}

export function buildContactVCard(options: ContactQrOptions): string {
  assertContactQrOptions(options);
  const contact = normalizeContactQrOptions(options);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeText(contact.fullName)}`,
    `N:${escapeText(contact.fullName)};;;;`,
  ];
  if (contact.organization) lines.push(`ORG:${escapeText(contact.organization)}`);
  if (contact.jobTitle) lines.push(`TITLE:${escapeText(contact.jobTitle)}`);
  if (contact.phone) lines.push(`TEL;TYPE=VOICE,WORK:${contact.phone}`);
  if (contact.email) lines.push(`EMAIL;TYPE=INTERNET:${contact.email}`);
  if (contact.website) lines.push(`URL:${contact.website}`);
  if (contact.address) lines.push(`ADR;TYPE=WORK:;;${escapeText(contact.address)};;;;`);
  lines.push("END:VCARD");
  const vcard = `${lines.map(foldLine).join("\r\n")}\r\n`;
  try {
    assertQrPayload(vcard);
  } catch {
    throw new ContactQrError("QR_TOO_LARGE");
  }
  return vcard;
}

function unfoldVCard(vcard: string): string[] {
  if (!vcard.endsWith("\r\n") || vcard.replaceAll("\r\n", "").match(/[\r\n]/))
    throw new ContactQrError("INVALID_VCARD");
  const physicalLines = vcard.slice(0, -2).split("\r\n");
  const lines: string[] = [];
  for (const line of physicalLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length === 0) throw new ContactQrError("INVALID_VCARD");
      lines[lines.length - 1] = `${lines.at(-1) ?? ""}${line.slice(1)}`;
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function splitEscaped(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      current += `\\${character}`;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === delimiter) {
      parts.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (escaped) throw new ContactQrError("INVALID_VCARD");
  parts.push(current);
  return parts;
}

function unescapeText(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character !== "\\") {
      result += character;
      continue;
    }
    const next = value[index + 1];
    if (!next || (!/[\\,;]/.test(next) && next.toLowerCase() !== "n"))
      throw new ContactQrError("INVALID_VCARD");
    result += next.toLowerCase() === "n" ? "\n" : next;
    index++;
  }
  return result;
}

export function parseContactVCard(vcard: string): ContactQrOptions {
  if (vcard.length > contactQrLimits.payloadBytes) throw new ContactQrError("INVALID_VCARD");
  try {
    assertQrPayload(vcard);
  } catch {
    throw new ContactQrError("INVALID_VCARD");
  }
  const lines = unfoldVCard(vcard);
  if (lines[0] !== "BEGIN:VCARD" || lines.at(-1) !== "END:VCARD")
    throw new ContactQrError("INVALID_VCARD");
  const fields = new Map<string, string>();
  for (const line of lines.slice(1, -1)) {
    const separator = line.indexOf(":");
    if (separator < 1) throw new ContactQrError("INVALID_VCARD");
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (fields.has(key)) throw new ContactQrError("INVALID_VCARD");
    fields.set(key, value);
  }
  if (fields.get("VERSION") !== "3.0") throw new ContactQrError("INVALID_VCARD");
  const fullNameValue = fields.get("FN");
  const structuredName = fields.get("N");
  if (fullNameValue === undefined || structuredName === undefined)
    throw new ContactQrError("INVALID_VCARD");
  const nameParts = splitEscaped(structuredName, ";");
  if (nameParts.length !== 5 || nameParts.slice(1).some(Boolean))
    throw new ContactQrError("INVALID_VCARD");
  const fullName = unescapeText(fullNameValue);
  if (unescapeText(nameParts[0] ?? "") !== fullName) throw new ContactQrError("INVALID_VCARD");

  const parseTextProperty = (key: string) => {
    const value = fields.get(key);
    return value === undefined ? "" : unescapeText(value);
  };
  const phone = fields.get("TEL;TYPE=VOICE,WORK") ?? "";
  const email = fields.get("EMAIL;TYPE=INTERNET") ?? "";
  const website = fields.get("URL") ?? "";
  let address = "";
  const addressValue = fields.get("ADR;TYPE=WORK");
  if (addressValue !== undefined) {
    const parts = splitEscaped(addressValue, ";");
    if (parts.length !== 7 || parts[0] || parts[1] || parts.slice(3).some(Boolean))
      throw new ContactQrError("INVALID_VCARD");
    address = unescapeText(parts[2] ?? "");
  }
  const allowedFields = new Set([
    "VERSION",
    "FN",
    "N",
    "ORG",
    "TITLE",
    "TEL;TYPE=VOICE,WORK",
    "EMAIL;TYPE=INTERNET",
    "URL",
    "ADR;TYPE=WORK",
  ]);
  if ([...fields.keys()].some((key) => !allowedFields.has(key)))
    throw new ContactQrError("INVALID_VCARD");
  const contact = {
    fullName,
    organization: parseTextProperty("ORG"),
    jobTitle: parseTextProperty("TITLE"),
    phone,
    email,
    website,
    address,
  };
  assertContactQrOptions(contact);
  return normalizeContactQrOptions(contact);
}
