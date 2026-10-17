import { categories, getPublishedTools } from "@toolbox/core";
import type { MetadataRoute } from "next";
import { getSiteUrl } from "./_lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  if (!siteUrl) return [];

  return [
    "/",
    "/tools",
    ...categories.map((category) => `/categories/${category.id}`),
    ...getPublishedTools().map((tool) => `/tools/${tool.slug}`),
  ].map((pathname) => ({ url: new URL(pathname, siteUrl).href }));
}
