import { catalogQuerySchema } from "@toolbox/contracts";
import { getPublishedTools } from "@toolbox/core";
import { notFound } from "next/navigation";
import { CatalogResults } from "../_components/catalog-results";
import { ToolSearch } from "../_components/tool-search";
import { WorkspaceFixture } from "./workspace-fixture";

export const metadata = {
  title: "Private design fixtures",
  robots: { index: false, follow: false },
};

export default async function DesignFixtures({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.NODE_ENV === "production" || process.env.TOOLBOX_UI_FIXTURES !== "1") notFound();
  const parsed = catalogQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});
  // The fixture is separate from the real catalog: publication metadata never changes.
  const fixtures = [
    {
      id: "fixture-pdf",
      slug: "fixture-pdf",
      title: "Document fixture",
      description: "Private card example for documents.",
      category: "pdf" as const,
      engine: "pdf" as const,
      execution: "browser" as const,
      acceptedMimeTypes: [],
      relatedSlugs: [],
      status: "published" as const,
    },
    {
      id: "fixture-image",
      slug: "fixture-image",
      title: "Image fixture",
      description: "Private card example for images.",
      category: "image" as const,
      engine: "image" as const,
      execution: "browser" as const,
      acceptedMimeTypes: [],
      relatedSlugs: [],
      status: "published" as const,
    },
  ];
  const drafts = fixtures.slice(0, 1).map((tool) => ({
    ...tool,
    id: "fixture-draft",
    slug: "fixture-draft",
    title: "Hidden draft fixture",
    status: "draft" as const,
  }));
  return (
    <main className="container-site page flex-1" id="main-content" tabIndex={-1}>
      <header className="mb-10 max-w-copy">
        <p className="eyebrow mb-3">Private UI fixtures</p>
        <h1 className="text-3xl font-semibold">Workspace examples</h1>
        <p className="mt-4 text-muted-foreground">
          Development and tests only. No conversion, upload or publication. The public catalog still
          has {getPublishedTools().length} tools.
        </p>
      </header>
      <WorkspaceFixture />
      <section className="section" aria-labelledby="card-fixtures">
        <h2 id="card-fixtures" className="mb-6 text-2xl font-semibold">
          Tool card examples
        </h2>
        <ToolSearch action="/design-fixtures" query={query} showCategories />
        <CatalogResults source={[...fixtures, ...drafts]} query={query} />
      </section>
    </main>
  );
}
