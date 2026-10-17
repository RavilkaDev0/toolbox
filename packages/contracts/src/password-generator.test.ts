import { describe, expect, it } from "vitest";
import { passwordGeneratorOptionsSchema } from "./password-generator.js";

describe("password generator contract", () => {
  const valid = {
    length: 24,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    avoidAmbiguous: true,
  };

  it("accepts supported options and rejects invalid or extra input", () => {
    expect(passwordGeneratorOptionsSchema.safeParse(valid).success).toBe(true);
    expect(passwordGeneratorOptionsSchema.safeParse({ ...valid, length: 7 }).success).toBe(false);
    expect(passwordGeneratorOptionsSchema.safeParse({ ...valid, length: 129 }).success).toBe(false);
    expect(
      passwordGeneratorOptionsSchema.safeParse({
        ...valid,
        uppercase: false,
        lowercase: false,
        digits: false,
        symbols: false,
      }).success,
    ).toBe(false);
    expect(passwordGeneratorOptionsSchema.safeParse({ ...valid, password: "secret" }).success).toBe(
      false,
    );
  });
});
