import type { ComponentProps } from "react";
import { cn } from "../lib/utils.js";

export function Empty({ className, ...props }: ComponentProps<"section">) {
  return <section data-slot="empty" className={cn("empty", className)} {...props} />;
}
export function EmptyHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-copy flex-col items-center gap-3", className)}
      {...props}
    />
  );
}
export function EmptyTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      data-slot="empty-title"
      className={cn("text-xl font-semibold tracking-tight", className)}
      {...props}
    />
  );
}
export function EmptyDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}
export function EmptyContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("flex flex-wrap justify-center gap-3", className)}
      {...props}
    />
  );
}
