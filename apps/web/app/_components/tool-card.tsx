import type { ToolDefinition } from "@toolbox/core";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@toolbox/ui/components/card";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { categoryIcons } from "./category-grid";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  if (tool.status !== "published") return null;
  const Icon = categoryIcons[tool.category];
  return (
    <Link className="card-link" href={`/tools/${tool.slug}`}>
      <Card>
        <CardHeader>
          <span className="icon-tile">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <CardTitle>{tool.title}</CardTitle>
          <CardDescription>{tool.description}</CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto justify-between text-primary">
          <span>Open tool</span>
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </CardFooter>
      </Card>
    </Link>
  );
}
