"use client";

import { Button } from "@toolbox/ui/components/button";
import { FieldGroup } from "@toolbox/ui/components/field";
import { Search } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

export function SearchForm({
  action,
  children,
}: {
  action: "/tools" | "/design-fixtures";
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const restore = () => setPending(false);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  return (
    <form action={action} method="get" aria-busy={pending} onSubmit={() => setPending(true)}>
      <FieldGroup className="sm:flex-row sm:items-end">
        {children}
        <Button type="submit" className="min-w-36" disabled={pending}>
          <Search aria-hidden="true" className="size-4" />
          {pending ? "Searching…" : "Search"}
        </Button>
      </FieldGroup>
      <p className="mt-3 min-h-5 text-sm text-muted-foreground" role="status">
        {pending ? "Loading published tools…" : "Search published tool names and descriptions."}
      </p>
    </form>
  );
}
