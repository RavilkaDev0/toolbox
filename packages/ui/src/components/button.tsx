import type { ComponentProps } from "react";
import { cn } from "../lib/utils.js";

export type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "outline" };

export function buttonVariants(variant: "primary" | "outline" = "primary") {
  return cn("button", variant === "outline" ? "button-outline" : "button-primary");
}

export function Button({ className, type = "button", variant = "primary", ...props }: ButtonProps) {
  return <button className={cn(buttonVariants(variant), className)} type={type} {...props} />;
}
