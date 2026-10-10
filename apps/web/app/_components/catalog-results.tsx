import type { CatalogQuery } from "@toolbox/contracts";
import { filterPublishedTools, type ToolDefinition } from "@toolbox/core";
import { CatalogEmpty } from "./catalog-empty";
import { ToolCard } from "./tool-card";

export function CatalogResults({
  source,
  query,
}: {
  source: readonly ToolDefinition[];
  query: CatalogQuery;
}) {
  const tools = filterPublishedTools(source, query);
  const hasPublished = source.some((tool) => tool.status === "published");
  return (
    <section className="mt-8" aria-labelledby="results-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold" id="results-title">
          Published tools
        </h2>
        <p className="font-mono text-sm text-muted-foreground" role="status">
          {tools.length} {tools.length === 1 ? "tool" : "tools"} available
        </p>
      </div>
      {tools.length ? (
        <ul className="tool-grid">
          {tools.map((tool) => (
            <li key={tool.id}>
              <ToolCard tool={tool} />
            </li>
          ))}
        </ul>
      ) : (
        <CatalogEmpty
          filtered={hasPublished}
          title={hasPublished ? "No tools match your search" : "No tools are published yet"}
        />
      )}
    </section>
  );
}
