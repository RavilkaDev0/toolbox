import type { ComponentProps } from "react";
import { cn } from "../lib/utils.js";

export function Alert({ className, ...props }: ComponentProps<"div">) {
  return <div role="alert" data-slot="alert" className={cn("alert", className)} {...props} />;
}
export function AlertTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("font-semibold", className)} {...props} />;
}
export function AlertDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-2 text-sm", className)} {...props} />;
}
