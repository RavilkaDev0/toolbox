import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { inspectImage } from "@toolbox/core";
import { unzipSync } from "fflate";

const toolUrl = "/tools/webp-converter";
const fixture = (name: string) => resolve("e2e/fixtures/images", name);
const fileInput = (page: Page) => page.getByLabel("Choose JPEG or PNG images", { exact: true });

async function chooseFiles(page: Page, files: string[]) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose files", exact: true }).click();
  await (await chooser).setFiles(files);
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
}

async function chooseInvalidFile(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose files", exact: true }).click();
  await (await chooser).setFiles(file);
}

async function downloadResult(page: Page, info: TestInfo, name: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: /^Download/ }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe(name);
  const path = info.outputPath(name);
  await download.saveAs(path);
  return new Uint8Array(await readFile(path));
}

async function assertTransparentPixel(page: Page, x: number, y: number, expectedAlpha: number) {
  const alpha = await page.getByRole("img", { name: /^Converted WebP preview/ }).evaluate(
    async (node, point) => {
      if (!(node instanceof HTMLImageElement)) throw new Error("WebP result preview is missing");
      await node.decode();
      const canvas = document.createElement("canvas");
      canvas.width = node.naturalWidth;
      canvas.height = node.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.drawImage(node, 0, 0);
      return context.getImageData(point.x, point.y, 1, 1).data[3];
    },
    { x, y },
  );
  expect(Math.abs(alpha - expectedAlpha)).toBeLessThan(8);
}

test("JPEG and transparent PNG convert to verified WebP, batch order and downloads stay local", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (!new Set(["GET", "HEAD"]).has(request.method())) uploads.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || /hydrat/i.test(message.text())) errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(toolUrl);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(/WebP converter/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/tools\/webp-converter$/,
  );

  await chooseFiles(page, [fixture("transparent.png")]);
  const quality = page.getByRole("slider", { name: "Lossy WebP quality" });
  await quality.focus();
  await page.keyboard.press("ArrowRight");
  await expect(quality).toHaveValue("85");
  await page.getByRole("button", { name: "Convert to WebP", exact: true }).click();
  await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Converted WebP preview/ })).toBeVisible();
  await assertTransparentPixel(page, 5, 5, 0);
  await assertTransparentPixel(page, 60, 120, 128);
  const pngOutput = await downloadResult(page, info, "transparent-converted.webp");
  expect(inspectImage(pngOutput)).toMatchObject({ kind: "webp", width: 120, height: 240 });
  expect(pngOutput.subarray(0, 4).toString()).toBe("RIFF");
  expect(pngOutput.subarray(8, 12).toString()).toBe("WEBP");
  if (info.project.name.startsWith("chromium")) {
    const evidence = resolve("../../docs/evidence/tbx-012");
    await mkdir(evidence, { recursive: true });
    await writeFile(resolve(evidence, "transparent-converted.webp"), pngOutput);
    await page.screenshot({
      path: resolve(evidence, "webp-converter-desktop.png"),
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await chooseFiles(page, [fixture("portrait.jpg"), fixture("landscape.jpg")]);
  await page.getByRole("button", { name: "Convert to WebP", exact: true }).click();
  await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible();
  await expect(page.getByText("ZIP archive", { exact: true })).toBeVisible();
  const archive = await downloadResult(page, info, "toolbox-webp-images.zip");
  const entries = unzipSync(archive);
  expect(Object.keys(entries)).toEqual(["portrait-converted.webp", "landscape-converted.webp"]);
  expect(inspectImage(entries["portrait-converted.webp"]!)).toMatchObject({
    kind: "webp",
    width: 120,
    height: 240,
  });
  expect(inspectImage(entries["landscape-converted.webp"]!)).toMatchObject({
    kind: "webp",
    width: 240,
    height: 120,
  });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await chooseFiles(page, [fixture("oriented.jpg")]);
  await page.getByRole("button", { name: "Convert to WebP", exact: true }).click();
  await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible();
  const oriented = await downloadResult(page, info, "oriented-converted.webp");
  expect(inspectImage(oriented)).toMatchObject({ kind: "webp", width: 40, height: 80 });
  if (info.project.name.startsWith("chromium"))
    await mkdir(resolve("../../docs/evidence/tbx-012"), { recursive: true });
  if (info.project.name.startsWith("chromium"))
    await writeFile(resolve("../../docs/evidence/tbx-012/mixed-conversion.zip"), archive);
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("rejects spoofed, animated, damaged and oversized input without disabling recovery", async ({
  page,
}) => {
  await page.goto(toolUrl);
  await page.waitForLoadState("networkidle");
  const input = fileInput(page);
  await chooseInvalidFile(page, fixture("damaged.png"));
  await expect(page.getByRole("alert")).toContainText("empty or damaged");
  await chooseInvalidFile(page, fixture("oversized.png"));
  await expect(page.getByRole("alert")).toContainText("8 megapixels");
  await chooseInvalidFile(page, fixture("animated.webp"));
  await expect(page.getByRole("alert")).toContainText("Choose JPEG or PNG");
  await chooseInvalidFile(page, {
    name: "spoof.jpg",
    mimeType: "image/jpeg",
    buffer: await readFile(fixture("transparent.png")),
  });
  await expect(page.getByRole("alert")).toContainText("type must match");
  await expect(input).toBeAttached();
});

test("cancels a mobile batch, then supports reset and a fresh keyboard-started conversion", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (!new Set(["GET", "HEAD"]).has(request.method())) uploads.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(toolUrl);
  await page.waitForLoadState("networkidle");
  const files = Array.from({ length: 10 }, () => fixture("noise-800.jpg"));
  await chooseFiles(page, files);
  const convert = page.getByRole("button", { name: "Convert to WebP", exact: true });
  await convert.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Conversion cancelled. The selected images are still available.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^Download/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Convert to WebP", exact: true }).click();
  await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("link", { name: "Download ZIP", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText("Select images to get started", { exact: true })).toBeVisible();

  await chooseFiles(page, [fixture("landscape.jpg")]);
  await page.getByRole("button", { name: "Convert to WebP", exact: true }).click();
  await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible();
  await downloadResult(page, info, "landscape-converted.webp");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (info.project.name.startsWith("chromium")) {
    await mkdir(resolve("../../docs/evidence/tbx-012"), { recursive: true });
    await page.screenshot({
      path: resolve("../../docs/evidence/tbx-012/webp-converter-mobile-390.png"),
      fullPage: true,
    });
  }
  expect(uploads).toEqual([]);
});

test("measures three real JPEG to WebP conversions", async ({ page }, info) => {
  await page.goto(toolUrl);
  await page.waitForLoadState("networkidle");
  const measurements: {
    file: string;
    inputBytes: number;
    outputBytes: number;
    durationMs: number;
  }[] = [];
  for (const name of ["landscape.jpg", "noise-800.jpg", "noise-2000.jpg"]) {
    await chooseFiles(page, [fixture(name)]);
    const inputBytes = (await readFile(fixture(name))).byteLength;
    const started = Date.now();
    await page.getByRole("button", { name: "Convert to WebP", exact: true }).click();
    await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible();
    const durationMs = Date.now() - started;
    await expect(page.getByText(/→ .*\((smaller|larger|same size)\)/).last()).toBeVisible();
    const output = await downloadResult(
      page,
      info,
      name.replace(/\.(jpg|jpeg)$/i, "-converted.webp"),
    );
    expect(inspectImage(output).kind).toBe("webp");
    measurements.push({ file: name, inputBytes, outputBytes: output.byteLength, durationMs });
    await page.getByRole("button", { name: "Reset", exact: true }).click();
  }
  if (info.project.name.startsWith("chromium")) {
    const evidence = resolve("../../docs/evidence/tbx-012");
    await mkdir(evidence, { recursive: true });
    await writeFile(
      resolve(evidence, "webp-converter-performance.json"),
      `${JSON.stringify({ browser: info.project.name, measurements }, null, 2)}\n`,
    );
  }
});
