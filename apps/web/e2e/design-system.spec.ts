import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const samplePath = resolve("e2e/fixtures/workspace-note.txt");

test("registered public pages exclude drafts and private fixtures", async ({ page }) => {
  for (const route of [
    "/",
    "/tools",
    "/categories/pdf",
    "/categories/pdf-render",
    "/categories/image",
    "/categories/qr",
    "/categories/utility",
  ]) {
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    const publishedLinksByRoute: Record<string, number> = {
      "/": 5,
      "/tools": 5,
      "/categories/pdf": 4,
      "/categories/pdf-render": 1,
    };
    await expect(page.locator('a[href^="/tools/"]')).toHaveCount(publishedLinksByRoute[route] ?? 0);
    await expect(
      page.locator(
        'a[href^="/tools/"]:not([href="/tools/images-to-pdf"]):not([href="/tools/merge-pdf"]):not([href="/tools/split-pdf"]):not([href="/tools/rotate-pdf"]):not([href="/tools/pdf-to-png"])',
      ),
    ).toHaveCount(0);
    await expect(page.locator('a[href="/design-fixtures"]')).toHaveCount(0);
  }
});

test("category navigation and empty state", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const categoryNavigation = page.waitForURL("**/categories/pdf");
  await page.getByRole("link", { name: /^PDF Tools/ }).click();
  await categoryNavigation;
  await expect(page).toHaveURL(/\/categories\/pdf$/);
  await expect(page.getByRole("heading", { name: "Images to PDF", exact: true })).toBeVisible();
  await page.goto("/categories/image");
  await expect(
    page.getByRole("heading", { name: "No tools are published in this category yet." }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Tools" })
    .click();
  await expect(page).toHaveURL(/\/tools$/);
});

test("draft tools and unknown categories return real 404s", async ({ page }) => {
  for (const route of ["/tools/password-generator", "/categories/unknown"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  }
});

test("catalog form preserves bounded search, category and reset in the URL", async ({ page }) => {
  await page.goto("/tools");
  await page.getByRole("searchbox", { name: "Search tools" }).fill("PDF");
  await page.getByLabel("Category", { exact: true }).selectOption("pdf");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=PDF&category=pdf$/);
  await expect(page.getByRole("searchbox")).toHaveValue("PDF");
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("pdf");
  await expect(page.getByRole("heading", { name: "Images to PDF", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/tools$/);
  for (const query of ["q=a&q=b", "category=unknown", `q=${"x".repeat(101)}`]) {
    await page.goto(`/tools?${query}`);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Check your search");
    await expect(page.locator('a[href="/tools/images-to-pdf"]')).toHaveCount(1);
    await expect(
      page.locator(
        'a[href^="/tools/"]:not([href="/tools/images-to-pdf"]):not([href="/tools/merge-pdf"]):not([href="/tools/split-pdf"]):not([href="/tools/rotate-pdf"]):not([href="/tools/pdf-to-png"])',
      ),
    ).toHaveCount(0);
  }
});

test("published fixtures exercise the same search and category rendering", async ({ page }) => {
  await page.goto("/design-fixtures");
  await expect(page.getByRole("heading", { name: "Document fixture" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Image fixture" })).toBeVisible();
  await expect(page.getByText("Hidden draft fixture")).toHaveCount(0);
  await page.getByRole("searchbox").fill("document");
  await page.getByLabel("Category", { exact: true }).selectOption("pdf");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Document fixture" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Image fixture" })).toHaveCount(0);
  await page.getByLabel("Category", { exact: true }).selectOption("image");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No tools match your search" })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(page.getByRole("heading", { name: "Image fixture" })).toBeVisible();
});

test("keyboard search, visible focus and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tools");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await expect(page.getByRole("link", { name: "Skip to main content" })).toHaveCSS(
    "outline-style",
    "solid",
  );
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  // Walk real document order: no scripted focus, including WebKit.
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press("Tab");
    if (await page.getByRole("searchbox").evaluate((node) => node === document.activeElement))
      break;
  }
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.type("image");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=image/);
  expect(
    await page
      .getByRole("button", { name: "Search", exact: true })
      .evaluate((node) => getComputedStyle(node).transitionDuration),
  ).toBe("0s");
});

test("file selection, bounds, removal, drag alternative and no upload", async ({ page }) => {
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") uploads.push(request.method());
  });
  await page.goto("/design-fixtures");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose files" }).click();
  await (await chooser).setFiles(samplePath);
  await expect(page.getByRole("button", { name: "Remove workspace-note.txt" })).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText("Files are ready");
  await page.getByRole("button", { name: "Remove workspace-note.txt" }).click();
  await expect(page.getByText("No files selected.")).toBeVisible();
  const input = page.getByLabel("Choose fixture files");
  for (const file of [
    { name: "empty.txt", mimeType: "text/plain", buffer: Buffer.alloc(0) },
    { name: "wrong.pdf", mimeType: "application/pdf", buffer: Buffer.from("fixture") },
    { name: "large.txt", mimeType: "text/plain", buffer: Buffer.alloc(1024 * 1024 + 1) },
  ]) {
    await input.setInputFiles(file);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Choose non-empty TXT");
  }
  await input.setInputFiles(
    Array.from({ length: 11 }, (_, index) => ({
      name: `file-${index}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("fixture"),
    })),
  );
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Choose at most 10 files");
  await page.getByRole("button", { name: "Reset workspace" }).click();
  await page.getByRole("region", { name: "File selection" }).evaluate((node) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["fixture"], "dropped.txt", { type: "text/plain" }));
    node.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
  });
  await expect(page.getByRole("button", { name: "Remove dropped.txt" })).toBeVisible();
  await input.setInputFiles(samplePath);
  await input.setInputFiles(samplePath);
  await expect(page.getByRole("button", { name: "Remove workspace-note.txt" })).toHaveCount(2);
  expect(uploads).toEqual([]);
});

test("workspace states, cancellation, reset and honest fixture download", async ({ page }) => {
  await page.goto("/design-fixtures");
  const state = page.getByLabel("Preview workspace state (UI only)");
  for (const value of [
    "validating",
    "ready",
    "processing",
    "succeeded",
    "failed",
    "cancelled",
    "idle",
  ]) {
    await state.selectOption(value);
    await expect(state).toHaveValue(value);
    await expect(page.getByRole("status").first()).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
  }
  await state.selectOption("failed");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("UI scenario");
  await state.selectOption("processing");
  await expect(page.getByRole("button", { name: "Choose files" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(state).toHaveValue("cancelled");
  await expect(page.getByRole("button", { name: "Reset workspace" })).toBeFocused();
  await state.selectOption("succeeded");
  await expect(page.getByRole("region", { name: "Preview" })).toContainText(
    "not converted file contents",
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download fixture" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("toolbox-ui-fixture.txt");
  const path = await download.path();
  expect(path).not.toBeNull();
  if (path) expect(await readFile(path, "utf8")).toContain("not a conversion result");
  await page.getByRole("button", { name: "Reset workspace" }).click();
  await expect(state).toHaveValue("idle");
  await expect(page.getByRole("button", { name: "Reset workspace" })).toBeFocused();
});

test.describe("progressive enhancement", () => {
  test.use({ javaScriptEnabled: false });
  test("catalog search and category navigation work without JavaScript", async ({ page }) => {
    await page.goto("/tools");
    await page.getByRole("searchbox").fill("text");
    await page.getByLabel("Category", { exact: true }).selectOption("utility");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=text&category=utility$/);
    await expect(page.getByRole("heading", { name: "No tools match your search" })).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).first().click();
    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.getByRole("heading", { name: "Images to PDF", exact: true })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Categories", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "A place for every task" })).toBeVisible();
  });
});

for (const width of [320, 390, 768, 1440]) {
  test(`responsive pages at ${width}px have no overflow or runtime warnings`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /hydrat/i.test(message.text())) errors.push(message.text());
    });
    for (const [name, route] of [
      ["home", "/"],
      ["catalog", "/tools"],
      ["category", "/categories/image"],
      ["workspace", "/design-fixtures"],
    ]) {
      await page.goto(route ?? "/");
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: testInfo.outputPath(`${name}-${width}.png`),
          fullPage: true,
          caret: "initial",
          style: "nextjs-portal { visibility: hidden; }",
        });
    }
    expect(errors).toEqual([]);
  });
}
