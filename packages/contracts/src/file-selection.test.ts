import { describe, expect, it } from "vitest";
import { fileMetadataSchema, fileSelectionLimitsSchema } from "./file-selection.js";

describe("workspace metadata boundaries", () => {
  it("accepts safe metadata and explicit limits", () => {
    expect(fileMetadataSchema.safeParse({ name: "note.txt", size: 1 }).success).toBe(true);
    expect(
      fileSelectionLimitsSchema.safeParse({ maxFiles: 10, maxBytes: 1024 * 1024 }).success,
    ).toBe(true);
  });
  it("rejects empty, non-integer, unbounded and hostile metadata", () => {
    for (const size of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100 * 1024 * 1024 + 1]) {
      expect(fileMetadataSchema.safeParse({ name: "note.txt", size }).success).toBe(false);
    }
    for (const name of ["", "x".repeat(256)])
      expect(fileMetadataSchema.safeParse({ name, size: 1 }).success).toBe(false);
    expect(fileSelectionLimitsSchema.safeParse({ maxFiles: 101, maxBytes: 1 }).success).toBe(false);
  });
});
