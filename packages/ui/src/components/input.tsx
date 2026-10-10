import type { ComponentProps } from "react";
import { cn } from "../lib/utils.js";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn("input", className)} {...props} />;
}
