import type { Metadata } from "next";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function parseSiteUrl(
  value: string | undefined,
  environment = process.env.NODE_ENV,
): URL | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("SITE_URL must be an absolute HTTPS origin.");
  }

  const localDevelopment = environment !== "production" && loopbackHosts.has(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) ||
    (environment === "production" && loopbackHosts.has(url.hostname))
  )
    throw new Error("SITE_URL must be an HTTPS origin without credentials or a path.");

  return new URL(url.origin);
}

export function getSiteUrl(): URL | undefined {
  const siteUrl = parseSiteUrl(process.env.SITE_URL);
  if (process.env.NODE_ENV === "production" && !siteUrl)
    throw new Error("SITE_URL is required for production builds.");
  return siteUrl;
}

export function createPageMetadata(title: string, description: string, pathname: string): Metadata {
  const siteUrl = getSiteUrl();
  const canonical = siteUrl ? new URL(pathname, siteUrl) : undefined;
  const pageTitle = `${title} | Toolbox`;
  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      siteName: "Toolbox",
      title: pageTitle,
      description,
    },
    twitter: {
      card: "summary",
      title: pageTitle,
      description,
    },
  };
}
