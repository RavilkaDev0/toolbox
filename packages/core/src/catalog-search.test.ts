import { describe, expect, it } from "vitest";
import { toolCatalog } from "./catalog.js";
import { filterPublishedTools } from "./catalog-search.js";

describe("published search", () => {
  const fixtures = toolCatalog.slice(0, 6).map((tool, index) => ({
    ...tool,
    status: index === 0 ? ("draft" as const) : ("published" as const),
  }));
  it("excludes drafts before filtering", () => {
    expect(
      filterPublishedTools(toolCatalog, { q: "", category: "all" }).map((tool) => tool.slug),
    ).toEqual([
      "images-to-pdf",
      "merge-pdf",
      "split-pdf",
      "rotate-pdf",
      "pdf-to-png",
      "image-compressor",
      "image-resizer",
    ]);
    expect(filterPublishedTools(fixtures, { q: "", category: "all" })).toHaveLength(5);
  });
  it("matches title and description without case sensitivity", () => {
    expect(
      filterPublishedTools(fixtures, { q: " MERGE ", category: "all" }).map((t) => t.slug),
    ).toEqual(["merge-pdf"]);
    expect(filterPublishedTools(fixtures, { q: "zz-no-match", category: "all" })).toEqual([]);
  });
  it("combines category and query and leaves its source unchanged", () => {
    expect(
      filterPublishedTools(fixtures, { q: "", category: "pdf-render" }).map((t) => t.slug),
    ).toEqual(["pdf-to-png"]);
    expect(filterPublishedTools(fixtures, { q: "merge", category: "image" })).toEqual([]);
    expect(toolCatalog.filter((tool) => tool.status === "draft")).toHaveLength(8);
  });
});
