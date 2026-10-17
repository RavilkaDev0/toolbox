import { categories, getToolsForCategory, type ToolCategoryId } from "@toolbox/core";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@toolbox/ui/components/card";
import { ArrowUpRight, FileImage, FileText, Image, QrCode, Type } from "lucide-react";
import Link from "next/link";

export const categoryIcons = {
  pdf: FileText,
  "pdf-render": FileImage,
  image: Image,
  qr: QrCode,
  utility: Type,
};

export function CategoryGrid({ exclude }: { exclude?: ToolCategoryId }) {
  return (
    <ul className="tool-grid">
      {categories
        .filter((category) => category.id !== exclude)
        .map((category) => {
          const Icon = categoryIcons[category.id];
          const count = getToolsForCategory(category.id).length;
          return (
            <li key={category.id}>
              <Link className="card-link" href={`/categories/${category.id}`}>
                <Card>
                  <CardHeader>
                    <span className="icon-tile">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <CardTitle>{category.title}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="mt-auto justify-between text-muted-foreground">
                    <span>
                      {count === 0
                        ? "No tools published yet"
                        : `${count} published ${count === 1 ? "tool" : "tools"}`}
                    </span>
                    <ArrowUpRight aria-hidden="true" className="size-4 text-primary" />
                  </CardFooter>
                </Card>
              </Link>
            </li>
          );
        })}
    </ul>
  );
}
