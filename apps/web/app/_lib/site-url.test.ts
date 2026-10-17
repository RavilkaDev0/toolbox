import { afterEach, describe, expect, it, vi } from "vitest";
import { createPageMetadata, getSiteUrl, parseSiteUrl } from "./site-url.js";

describe("SITE_URL metadata configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("omits absolute URL metadata until a site origin is configured", () => {
    vi.stubEnv("SITE_URL", "");
    expect(getSiteUrl()).toBeUndefined();
    expect(
      createPageMetadata("Merge PDF", "Merge documents locally.", "/tools/merge-pdf"),
    ).not.toHaveProperty("alternates");
  });

  it("fails a production build when SITE_URL is missing", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSiteUrl()).toThrow("SITE_URL is required for production builds.");
  });

  it("normalizes a configured HTTPS origin and generates an absolute canonical", () => {
    vi.stubEnv("SITE_URL", "https://toolbox.example/");
    expect(getSiteUrl()?.href).toBe("https://toolbox.example/");
    expect(
      createPageMetadata("Merge PDF", "Merge documents locally.", "/tools/merge-pdf").alternates
        ?.canonical,
    ).toEqual(new URL("https://toolbox.example/tools/merge-pdf"));
  });

  it("allows loopback HTTP only outside production", () => {
    expect(parseSiteUrl("http://localhost:3100", "development")?.origin).toBe(
      "http://localhost:3100",
    );
    expect(() => parseSiteUrl("http://localhost:3100", "production")).toThrow(/SITE_URL/);
    expect(() => parseSiteUrl("http://toolbox.example", "production")).toThrow(/SITE_URL/);
  });

  it.each([
    "not a URL",
    "https://toolbox.example/tools",
    "https://user:pass@toolbox.example",
    "https://toolbox.example/?preview=1",
    "https://toolbox.example/#home",
  ])("rejects an invalid site origin: %s", (value) => {
    expect(() => parseSiteUrl(value, "production")).toThrow(/SITE_URL/);
  });
});
