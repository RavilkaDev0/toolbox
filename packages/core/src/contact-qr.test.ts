import { describe, expect, it } from "vitest";
import {
  assertContactQrOptions,
  buildContactVCard,
  ContactQrError,
  type ContactQrOptions,
  contactQrLimits,
  normalizeContactQrOptions,
  parseContactVCard,
} from "./contact-qr.js";

const contact: ContactQrOptions = {
  fullName: "Ada Lovelace",
  organization: "Analytical Engines",
  jobTitle: "Mathematician",
  phone: "+44 20 7946 0958",
  email: "ada@example.org",
  website: "https://example.org/ada",
  address: "10 St James's Square\nLondon",
};

describe("Contact QR vCard rules", () => {
  it("builds a vCard 3.0 with required name fields and parses all supported properties back", () => {
    const vcard = buildContactVCard(contact);
    expect(
      vcard.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ada Lovelace\r\nN:Ada Lovelace;;;;\r\n"),
    ).toBe(true);
    expect(vcard).toContain("TEL;TYPE=VOICE,WORK:+44 20 7946 0958\r\n");
    expect(vcard).toContain("ADR;TYPE=WORK:;;10 St James's Square\\nLondon;;;;\r\n");
    expect(vcard.endsWith("END:VCARD\r\n")).toBe(true);
    expect(parseContactVCard(vcard)).toEqual(contact);
  });

  it("escapes vCard delimiters and line breaks so user text cannot inject properties", () => {
    const options = {
      ...contact,
      fullName: "Zoë, Lovelace; PhD\\nBEGIN:VCARD",
      organization: "Toolbox;\r\nFN:Injected",
      address: "1 Main St, Apt; 2\r\nEND:VCARD",
    };
    const vcard = buildContactVCard(options);
    const logicalLines = vcard.replace(/\r\n[ \t]/g, "").split("\r\n");
    expect(logicalLines.filter((line) => line.startsWith("FN:"))).toHaveLength(1);
    expect(logicalLines.filter((line) => line === "END:VCARD")).toHaveLength(1);
    expect(vcard).toContain("Zoë\\, Lovelace\\; PhD\\\\nBEGIN:VCARD");
    expect(parseContactVCard(vcard)).toEqual(normalizeContactQrOptions(options));
  });

  it("folds long Unicode lines on UTF-8 character boundaries and unfolds losslessly", () => {
    const options = { ...contact, fullName: "🧮".repeat(40) };
    const vcard = buildContactVCard(options);
    for (const line of vcard.slice(0, -2).split("\r\n"))
      expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(
        contactQrLimits.vcardLineBytes,
      );
    expect(parseContactVCard(vcard)).toEqual(options);
  });

  it("validates required name, field bounds and reasonable phone, email and website formats", () => {
    expect(() => assertContactQrOptions({ ...contact, fullName: "  \n" })).toThrowError(/name/i);
    expect(() => assertContactQrOptions({ ...contact, fullName: "x".repeat(161) })).toThrowError(
      ContactQrError,
    );
    expect(() => assertContactQrOptions({ ...contact, phone: "+123".repeat(5) })).toThrowError(
      /phone/i,
    );
    expect(() => assertContactQrOptions({ ...contact, email: "not-an-email" })).toThrowError(
      /email/i,
    );
    expect(() =>
      assertContactQrOptions({ ...contact, website: "javascript:alert(1)" }),
    ).toThrowError(/http/i);
    expect(() =>
      assertContactQrOptions({ ...contact, website: "https://user:pass@example.org" }),
    ).toThrowError(/username or password/i);
    expect(() =>
      assertContactQrOptions({ ...contact, organization: "Bad\u0000value" }),
    ).toThrowError(/control/i);
    expect(() =>
      assertContactQrOptions({ ...contact, website: "https://example.org/\ud800" }),
    ).toThrowError(ContactQrError);
  });

  it("rejects malformed card syntax, extra properties and non-CRLF card lines", () => {
    const valid = buildContactVCard({ ...contact, organization: "" });
    expect(() => parseContactVCard(valid.replace("VERSION:3.0", "VERSION:4.0"))).toThrowError(
      ContactQrError,
    );
    expect(() =>
      parseContactVCard(valid.replace("END:VCARD", "X-UNSAFE:1\r\nEND:VCARD")),
    ).toThrowError(ContactQrError);
    expect(() => parseContactVCard(valid.replaceAll("\r\n", "\n"))).toThrowError(ContactQrError);
    expect(() => parseContactVCard(valid.replace("FN:Ada", "FN:Ada\\q"))).toThrowError(
      ContactQrError,
    );
    expect(() => parseContactVCard("x".repeat(contactQrLimits.payloadBytes + 1))).toThrowError(
      ContactQrError,
    );
  });
});
