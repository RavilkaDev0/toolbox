import { describe, expect, it } from "vitest";
import { wordCounterTextSchema } from "./word-counter.js";

describe("word counter contract", () => {
  it("accepts bounded Unicode text and rejects non-text or oversized input", () => {
    expect(wordCounterTextSchema.safeParse("Привет 🌍").success).toBe(true);
    expect(wordCounterTextSchema.safeParse(42).success).toBe(false);
    expect(wordCounterTextSchema.safeParse("x".repeat(100_001)).success).toBe(false);
  });
});
