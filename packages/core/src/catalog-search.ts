import type { ToolCategoryId, ToolDefinition } from "./catalog.js";

export function filterPublishedTools(
  tools: readonly ToolDefinition[],
  query: { readonly q: string; readonly category: ToolCategoryId | "all" },
): readonly ToolDefinition[] {
  const term = query.q.trim().toLowerCase();
  return tools.filter(
    (tool) =>
      tool.status === "published" &&
      (query.category === "all" || tool.category === query.category) &&
      `${tool.title} ${tool.description}`.toLowerCase().includes(term),
  );
}
