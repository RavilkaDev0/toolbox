import { catalogQuerySchema } from "@toolbox/contracts";
import { getPublishedTools } from "@toolbox/core";
import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { CatalogResults } from "../_components/catalog-results";
import { ToolSearch } from "../_components/tool-search";
import { createPageMetadata } from "../_lib/site-url";

export const metadata = createPageMetadata(
  "Tools",
  "Search and explore Toolbox tools that are tested and ready to use.",
  "/tools",
);

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const parsed = catalogQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});
  const published = getPublishedTools();
  return (
    <main className="container-site page flex-1" id="main-content" tabIndex={-1}>
      <header className="max-w-copy">
        <p className="eyebrow mb-3">The tool catalog</p>
        <h1 className="text-hero font-semibold tracking-tight">Tools</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A little less effort for everyday tasks. This catalog only lists tools that are
          implemented and ready to use.
        </p>
      </header>
      <div className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <ToolSearch query={query} showCategories />
      </div>
      {!parsed.success ? (
        <Alert className="mt-6">
          <AlertTitle>Check your search</AlertTitle>
          <AlertDescription>
            Use one search term of up to 100 characters and a category from the list. Clear the URL
            filters or submit the form again.
          </AlertDescription>
        </Alert>
      ) : null}
      <CatalogResults source={published} query={query} />
    </main>
  );
}
