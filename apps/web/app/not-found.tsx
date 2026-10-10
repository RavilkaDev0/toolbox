import { buttonVariants } from "@toolbox/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@toolbox/ui/components/empty";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-site page flex-1" id="main-content" tabIndex={-1}>
      <h1 className="mb-8 text-3xl font-semibold">Page not found</h1>
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This page is not available</EmptyTitle>
          <EmptyDescription>
            Tools appear only when they are published. Browse the catalog or return to the homepage.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link className={buttonVariants()} href="/tools">
            Browse tools
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}
