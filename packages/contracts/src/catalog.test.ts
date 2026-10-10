import { describe, expect, it } from "vitest";
import { catalogQuerySchema } from "./catalog.js";

describe("catalog query", () => {
  it("defaults and trims a bounded query", () => {
    expect(catalogQuerySchema.parse({})).toEqual({ q: "", category: "all" });
    expect(catalogQuerySchema.parse({ q: " PDF " }).q).toBe("PDF");
  });
  it("rejects oversized, repeated and unknown parameters", () => {
    for (const input of [{ q: "x".repeat(101) }, { q: ["a", "b"] }, { category: "unknown" }]) {
      expect(catalogQuerySchema.safeParse(input).success).toBe(false);
    }
  });
});
