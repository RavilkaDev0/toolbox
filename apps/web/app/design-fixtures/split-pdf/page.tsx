import { notFound } from "next/navigation";
import SplitWorkspace from "../../tools/split-pdf/split-workspace";

export const metadata = {
  title: "Private Split PDF fixture",
  robots: { index: false, follow: false },
};

export default function SplitPdfFixturePage() {
  if (process.env.NODE_ENV === "production" || process.env.TOOLBOX_UI_FIXTURES !== "1") notFound();

  return (
    <main className="container-site page max-w-workspace flex-1" id="main-content" tabIndex={-1}>
      <h1 className="text-3xl font-bold tracking-tight">Private Split PDF fixture</h1>
      <p className="mt-3 text-muted-foreground">A test-only route, outside the catalog.</p>
      <div className="mt-8">
        <SplitWorkspace />
      </div>
    </main>
  );
}
