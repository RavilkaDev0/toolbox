import type { MetadataRoute } from "next";
import { getSiteUrl } from "./_lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/design-fixtures" },
    ...(siteUrl ? { host: siteUrl.host, sitemap: new URL("/sitemap.xml", siteUrl).href } : {}),
  };
}
