import type { CatalogQuery } from "@toolbox/contracts";
import { categories } from "@toolbox/core";
import { Field, FieldLabel } from "@toolbox/ui/components/field";
import { Input } from "@toolbox/ui/components/input";
import Link from "next/link";
import { SearchForm } from "./search-form";

export function ToolSearch({
  query = { q: "", category: "all" },
  showCategories = false,
  action = "/tools",
}: {
  query?: CatalogQuery;
  showCategories?: boolean;
  action?: "/tools" | "/design-fixtures";
}) {
  return (
    <search aria-label="Tool search">
      <SearchForm action={action}>
        <Field className="flex-1">
          <FieldLabel htmlFor="tool-query">Search tools</FieldLabel>
          <Input
            id="tool-query"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={query.q}
            placeholder="Try PDF, images or text…"
            autoComplete="off"
          />
        </Field>
        {showCategories ? (
          <Field>
            <FieldLabel htmlFor="tool-category">Category</FieldLabel>
            <select
              className="input"
              id="tool-category"
              name="category"
              defaultValue={query.category}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {query.q || query.category !== "all" ? (
          <Link className="text-link text-sm" href={action}>
            Clear filters
          </Link>
        ) : null}
      </SearchForm>
    </search>
  );
}
