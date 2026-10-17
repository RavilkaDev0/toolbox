import { describe, expect, it } from "vitest";
import { contactQrOptionsSchema } from "./contact-qr.js";

describe("Contact QR contract", () => {
  const valid = {
    fullName: "Ada Lovelace",
    organization: "",
    jobTitle: "",
    phone: "+44 20 7946 0958",
    email: "ada@example.org",
    website: "https://example.org/ada",
    address: "",
  };

  it("accepts bounded valid contact values and Unicode text", () => {
    expect(contactQrOptionsSchema.safeParse(valid).success).toBe(true);
    expect(contactQrOptionsSchema.safeParse({ ...valid, fullName: "Dr. 世界 👋" }).success).toBe(
      true,
    );
  });

  it("rejects empty names, malformed fields, excessive values and extra keys", () => {
    expect(contactQrOptionsSchema.safeParse({ ...valid, fullName: " " }).success).toBe(false);
    expect(contactQrOptionsSchema.safeParse({ ...valid, email: "invalid" }).success).toBe(false);
    expect(
      contactQrOptionsSchema.safeParse({ ...valid, website: "data:text/plain,x" }).success,
    ).toBe(false);
    expect(
      contactQrOptionsSchema.safeParse({ ...valid, phone: "+123456789012345678" }).success,
    ).toBe(false);
    expect(contactQrOptionsSchema.safeParse({ ...valid, fullName: "x".repeat(161) }).success).toBe(
      false,
    );
    expect(contactQrOptionsSchema.safeParse({ ...valid, privateNote: "secret" }).success).toBe(
      false,
    );
  });
});
