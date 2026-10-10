import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve("packages/ui/src/styles/globals.css"), "utf8");
function luminance(token: string) {
  const value = stylesheet.match(new RegExp(`--${token}: #(\\w{6});`))?.[1];
  if (!value) throw new Error(`Missing color token: ${token}`);
  const channels = [0, 2, 4].map((offset) => {
    const valueAtOffset = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return valueAtOffset <= 0.04045
      ? valueAtOffset / 12.92
      : ((valueAtOffset + 0.055) / 1.055) ** 2.4;
  });
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
}
function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe("design token contrast", () => {
  it("keeps text roles AA on their surfaces", () => {
    for (const surface of ["surface", "background", "muted"]) {
      for (const text of ["foreground", "muted-foreground", "primary"])
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast("primary", "primary-foreground")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("primary-hover", "primary-foreground")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("danger", "danger-surface")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("success", "success-surface")).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps essential boundaries and focus AA", () => {
    for (const surface of ["surface", "background", "muted"]) {
      expect(contrast("input", surface)).toBeGreaterThanOrEqual(3);
      expect(contrast("ring", surface)).toBeGreaterThanOrEqual(3);
    }
  });
});
