import type { ComponentProps } from "react";
import { cn } from "../lib/utils.js";

export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="field-group" className={cn("flex flex-col gap-5", className)} {...props} />
  );
}
export function Field({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="field" className={cn("flex min-w-0 flex-col gap-2", className)} {...props} />
  );
}
export function FieldLabel({
  className,
  htmlFor,
  children,
  ...props
}: ComponentProps<"label"> & { htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      data-slot="field-label"
      className={cn("text-sm font-medium", className)}
      {...props}
    >
      {children}
    </label>
  );
}
