import { expect, test } from "@playwright/test";

const siteUrl = process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined;

test("uses domain-safe metadata and discovers every published tool", async ({ page, request }) => {
  await page.goto("/");
  const homeCanonical = page.locator('link[rel="canonical"]');
  if (siteUrl) await expect(homeCanonical).toHaveAttribute("href", new URL("/", siteUrl).href);
  else await expect(homeCanonical).toHaveCount(0);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");

  await page.goto("/tools");
  const catalogSlugs = await page
    .locator('a[href^="/tools/"]')
    .evaluateAll((links) =>
      [...new Set(links.map((link) => new URL((link as HTMLAnchorElement).href).pathname))].sort(),
    );
  expect(catalogSlugs.length).toBeGreaterThan(0);

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapUrls = [...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => match[1] ?? "",
  );
  const sitemapToolPaths = sitemapUrls
    .map((value) => new URL(value).pathname)
    .filter((pathname) => /^\/tools\/[a-z0-9-]+$/.test(pathname))
    .sort();

  if (siteUrl) {
    expect(sitemapUrls.length).toBeGreaterThan(catalogSlugs.length);
    expect(sitemapToolPaths).toEqual(catalogSlugs);
    expect(sitemapUrls.every((value) => new URL(value).origin === siteUrl.origin)).toBe(true);
    expect(sitemapUrls.some((value) => value.includes("localhost"))).toBe(false);
  } else {
    expect(sitemapUrls).toHaveLength(0);
  }

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).not.toContain("localhost");
});

test("serves owner-review legal pages with an explicit release draft notice", async ({ page }) => {
  for (const route of ["/privacy", "/terms", "/contact"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.getByText("Release draft — owner details are required")).toBeVisible();
  }
});

test("keeps the compact homepage and all tools reachable on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Browse available tools" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto("/tools");
  const toolLinks = page.locator('a[href^="/tools/"]');
  await expect(toolLinks).toHaveCount(15);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
