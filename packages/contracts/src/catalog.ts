import { z } from "zod";

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  category: z.enum(["all", "pdf", "pdf-render", "image", "qr", "utility"]).default("all"),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
