import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const origin = new URL(process.env.TOOLBOX_SMOKE_URL ?? "http://127.0.0.1:3000");
const siteUrl = new URL(process.env.SITE_URL ?? "");
assert.equal(siteUrl.protocol, "https:", "SITE_URL must be HTTPS in the production image");
assert.equal(siteUrl.pathname, "/", "SITE_URL must contain only an origin");
assert(!["localhost", "127.0.0.1", "[::1]"].includes(siteUrl.hostname));

async function get(pathname) {
  return fetch(new URL(pathname, origin));
}

const health = await get("/healthz");
assert.equal(health.status, 200, "runtime health route must be available");
assert.deepEqual(await health.json(), { status: "ok" });

const robotsResponse = await get("/robots.txt");
assert.equal(robotsResponse.status, 200);
const robots = await robotsResponse.text();
assert(robots.includes(`Sitemap: ${new URL("/sitemap.xml", siteUrl).href}`));
assert(robots.includes("Disallow: /design-fixtures"));

const sitemapResponse = await get("/sitemap.xml");
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
  (match[1] ?? "").replaceAll("&amp;", "&"),
);
const sitePaths = locations.map((location) => {
  const url = new URL(location);
  assert.equal(url.origin, siteUrl.origin, "sitemap URLs must use SITE_URL");
  assert(!url.href.includes("localhost"));
  return url.pathname;
});
assert.equal(new Set(sitePaths).size, sitePaths.length, "sitemap URLs must be unique");
assert(sitePaths.includes("/"));
assert(sitePaths.includes("/tools"));

const toolsPage = await get("/tools");
assert.equal(toolsPage.status, 200);
const toolsHtml = await toolsPage.text();
const toolPaths = new Set(
  [...toolsHtml.matchAll(/<a\b[^>]*href="(\/tools\/[a-z0-9-]+)"/g)].map((match) => match[1]),
);
const sitemapToolPaths = new Set(
  sitePaths.filter((pathname) => /^\/tools\/[a-z0-9-]+$/.test(pathname)),
);
assert(toolPaths.size > 0, "tool catalog must render tool links");
assert.deepEqual([...sitemapToolPaths].sort(), [...toolPaths].sort());

const legalPaths = ["/privacy", "/terms", "/contact"];
const pagePaths = [...new Set([...sitePaths, ...legalPaths])];
const assetPaths = new Set();
const assetsByPage = new Map();
const pageTitles = new Set();
const descriptions = new Set();

for (const pathname of pagePaths) {
  const response = await get(pathname);
  assert.equal(response.status, 200, `${pathname} must be served by the standalone server`);
  const html = await response.text();
  const canonical = /<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i.exec(html)?.[1];
  assert(canonical, `${pathname} must have a canonical URL`);
  const canonicalUrl = new URL(canonical);
  assert.equal(
    canonicalUrl.href,
    new URL(pathname, siteUrl).href,
    `${pathname} canonical must be absolute`,
  );
  assert.equal(canonicalUrl.origin, siteUrl.origin);
  assert(!canonicalUrl.href.includes("localhost"));

  const title = /<title>(.*?)<\/title>/i.exec(html)?.[1];
  const description = /<meta\b[^>]*name="description"[^>]*content="([^"]+)"/i.exec(html)?.[1];
  assert(title, `${pathname} must have a title`);
  assert(description, `${pathname} must have a description`);
  assert(!pageTitles.has(title), `${pathname} must not duplicate a page title`);
  assert(!descriptions.has(description), `${pathname} must not duplicate a page description`);
  pageTitles.add(title);
  descriptions.add(description);
  assert(
    /<meta\b[^>]*property="og:title"/i.test(html),
    `${pathname} must have Open Graph metadata`,
  );
  assert(/<meta\b[^>]*name="twitter:card"/i.test(html), `${pathname} must have Twitter metadata`);

  if (legalPaths.includes(pathname))
    assert(/<meta\b[^>]*name="robots"[^>]*content="noindex, follow"/i.test(html));

  const pageAssets = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)) {
    const assetPath = (match[1] ?? "").replaceAll("&amp;", "&");
    pageAssets.add(assetPath);
    assetPaths.add(assetPath);
  }
  assetsByPage.set(pathname, pageAssets);
}

assert(assetPaths.size > 0, "standalone pages must reference static assets");
const assetSizes = new Map();
for (const assetPath of assetPaths) {
  const response = await get(assetPath);
  assert.equal(response.status, 200, `${assetPath} must be included in the image`);
  assetSizes.set(assetPath, (await response.arrayBuffer()).byteLength);
}

const homeResponse = await get("/");
assert.equal(homeResponse.headers.get("x-content-type-options"), "nosniff");
assert.equal(homeResponse.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
assert.equal(homeResponse.headers.get("x-frame-options"), "DENY");
assert.equal(homeResponse.headers.get("x-powered-by"), null);
const contentSecurityPolicy = homeResponse.headers.get("content-security-policy") ?? "";
for (const directive of [
  "object-src 'none'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
])
  assert(contentSecurityPolicy.includes(directive), `CSP must include ${directive}`);

const notFound = await get("/tools/__release-readiness-unknown__");
assert.equal(notFound.status, 404, "unknown tool routes must remain real 404 responses");

const staticRoot = path.join(process.cwd(), ".next", "static");
async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return files.flat();
}

const staticFiles = await listFiles(staticRoot);
const fonts = staticFiles.filter((file) => file.endsWith(".woff2"));
const chunks = staticFiles.filter(
  (file) => file.endsWith(".js") && file.includes(`${path.sep}chunks${path.sep}`),
);
const media = staticFiles.filter((file) => file.includes(`${path.sep}media${path.sep}`));
const runtimeAssets = [
  ...fonts,
  ...media.filter((file) =>
    ["pdf.worker.", "pdf-preview.worker."].some((prefix) => path.basename(file).startsWith(prefix)),
  ),
];
assert(
  runtimeAssets.some((file) => file.endsWith(".woff2")),
  "standalone image must contain local fonts",
);
assert(
  runtimeAssets.some((file) => path.basename(file).startsWith("pdf.worker.")),
  "standalone image must contain the PDF.js worker",
);
assert(
  runtimeAssets.some((file) => path.basename(file).startsWith("pdf-preview.worker.")),
  "standalone image must contain the PDF preview worker",
);
for (const file of runtimeAssets) {
  const assetPath = `/_next/static/${path.relative(staticRoot, file).split(path.sep).join("/")}`;
  const response = await get(assetPath);
  assert.equal(response.status, 200, `${assetPath} must be served by the standalone server`);
  assert((await response.arrayBuffer()).byteLength > 0, `${assetPath} must not be empty`);
}
const chunkSizes = await Promise.all(chunks.map(async (file) => (await readFile(file)).byteLength));
const totalChunkBytes = chunkSizes.reduce((total, bytes) => total + bytes, 0);
const largestChunkBytes = Math.max(...chunkSizes);
const homeJsBytes = [...(assetsByPage.get("/") ?? [])].reduce(
  (total, assetPath) =>
    assetPath.includes(".js") ? total + (assetSizes.get(assetPath) ?? 0) : total,
  0,
);
assert(chunks.length > 0, "standalone image must contain JavaScript chunks");
assert(
  (await Promise.all(chunks.map((file) => readFile(file, "utf8")))).some((chunk) =>
    chunk.includes("pdfjsVersion"),
  ),
  "standalone JavaScript chunks must include the PDF.js runtime",
);

console.log(
  `Standalone smoke passed: ${pagePaths.length} pages, ${sitemapToolPaths.size} tools, ${assetPaths.size} static assets, ${fonts.length} local fonts, ${chunks.length} JS chunks (${totalChunkBytes} bytes total; largest ${largestChunkBytes} bytes), ${homeJsBytes} bytes of homepage JS, and PDF.js workers.`,
);
