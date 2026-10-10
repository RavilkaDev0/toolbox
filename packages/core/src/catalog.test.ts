import { describe, expect, it } from "vitest";
import { getPublishedTools, toolCatalog, validateToolCatalog } from "./catalog.js";

describe("tool catalog", () => {
  it("validates all seed metadata and keeps the planned tools unpublished", () => {
    expect(() => validateToolCatalog(toolCatalog)).not.toThrow();
    expect(toolCatalog).toHaveLength(15);
    expect(getPublishedTools()).toEqual([]);
  });

  it("rejects duplicate ids and slugs", () => {
    const tool = toolCatalog[0];
    expect(tool).toBeDefined();
    if (!tool) {
      return;
    }

    expect(() => validateToolCatalog([tool, tool])).toThrow("Duplicate tool id");

    const duplicateSlug = { ...tool, id: "different-id" };
    expect(() => validateToolCatalog([tool, duplicateSlug])).toThrow("Duplicate tool slug");
  });

  it("rejects categories that are not registered", () => {
    const tool = toolCatalog[0];
    expect(tool).toBeDefined();
    if (!tool) {
      return;
    }

    expect(() => validateToolCatalog([tool], ["image"])).toThrow("Unknown category");
  });

  it("rejects related slugs that do not identify a catalog tool", () => {
    const tool = toolCatalog[0];
    expect(tool).toBeDefined();
    if (!tool) {
      return;
    }

    const invalidRelation = { ...tool, relatedSlugs: ["missing-tool"] };
    expect(() => validateToolCatalog([invalidRelation])).toThrow("Unknown related tool");
  });
});
