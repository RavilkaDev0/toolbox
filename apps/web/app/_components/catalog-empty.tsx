import { buttonVariants } from "@toolbox/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@toolbox/ui/components/empty";
import { FolderOpen } from "lucide-react";
import Link from "next/link";

export function CatalogEmpty({
  title = "No tools are published yet",
  filtered = false,
}: {
  title?: string;
  filtered?: boolean;
}) {
  return (
    <Empty aria-labelledby="empty-catalog-title">
      <EmptyHeader>
        <span className="icon-tile">
          <FolderOpen aria-hidden="true" className="size-5" />
        </span>
        <EmptyTitle id="empty-catalog-title">{title}</EmptyTitle>
        <EmptyDescription>
          {filtered
            ? "Try a different search or category. Only published tools appear in these results."
            : "Good tools take care. Planned tools stay out of the catalog until their processing, limits and error states are tested."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link className={buttonVariants("outline")} href={filtered ? "/tools" : "/#categories"}>
          {filtered ? "Clear filters" : "Explore categories"}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
