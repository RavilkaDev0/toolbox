import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { inspectImage } from "@toolbox/core";
import { unzipSync } from "fflate";

const toolUrl = "/tools/png-jpg-converter";
const fixture = (name: string) => resolve("e2e/fixtures/images", name);
const fileInput = (page: Page) => page.getByLabel("Choose PNG or JPEG images", { exact: true });

async function chooseFiles(page: Page, files: string[]) {
  await chooseFilesRaw(page, files);
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
}

async function chooseFilesRaw(page: Page, files: string[]) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose files", exact: true }).click();
  await (await chooser).setFiles(files);
}

async function dropFile(page: Page, name: string, type: string) {
  const base64 = (await readFile(fixture(name))).toString("base64");
  await page.evaluate(
    ({ name, type, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type }));
      const dropzone = document.querySelector('[aria-label="File selection"]');
      if (!dropzone) throw new Error("Image dropzone is missing");
      dropzone.dispatchEvent(
        new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
      dropzone.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
    },
    { name, type, base64 },
  );
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
}

async function saveDownload(
  page: Page,
  info: TestInfo,
  expectedName: string,
  evidenceName: string,
) {
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: /^Download / }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(expectedName);
  const outputPath = info.outputPath(evidenceName);
  await download.saveAs(outputPath);
  const bytes = await readFile(outputPath);
  await info.attach(evidenceName, {
    path: outputPath,
    contentType: expectedName.endsWith(".zip")
      ? "application/zip"
      : `image/${expectedName.endsWith(".jpg") ? "jpeg" : "png"}`,
  });
  return { outputPath, bytes: new Uint8Array(bytes) };
}

async function assertPreviewPixel(page: Page, x: number, y: number, expected: number[]) {
  const pixel = await page.getByRole("img", { name: /^Converted preview/ }).evaluate(
    async (node, point) => {
      if (!(node instanceof HTMLImageElement))
        throw new Error("Converted output preview is missing");
      await node.decode();
      const canvas = document.createElement("canvas");
      canvas.width = node.naturalWidth;
      canvas.height = node.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.drawImage(node, 0, 0);
      return Array.from(context.getImageData(point.x, point.y, 1, 1).data);
    },
    { x, y },
  );
  for (let channel = 0; channel < 3; channel++)
    expect(Math.abs((pixel[channel] ?? 0) - (expected[channel] ?? 0))).toBeLessThan(12);
}

test("PNG to JPEG applies the selected alpha background and downloads verified JPEG bytes without uploads", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  const consoleErrors: string[] = [];
  page.on("request", (request) => {
    if (!new Set(["GET", "HEAD"]).has(request.method())) uploads.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(toolUrl);
  await page.waitForLoadState("networkidle");
  await chooseFiles(page, [fixture("transparent.png")]);
  await expect(page.getByText("PNG · 120 × 240 px · 0.5 KiB", { exact: true })).toBeVisible();
  await page.getByLabel("JPEG background for transparent pixels").fill("#ff0000");
  const quality = page.getByRole("slider", { name: /JPEG quality/ });
  await quality.focus();
  await page.keyboard.press("ArrowRight");
  await expect(quality).toHaveValue("90");
  await page.getByRole("button", { name: "Convert image", exact: true }).click();
  await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible();
  await assertPreviewPixel(page, 5, 5, [255, 0, 0]);
  const { outputPath, bytes } = await saveDownload(
    page,
    info,
    "transparent-converted.jpg",
    "png-to-jpeg.jpg",
  );
  expect(inspectImage(bytes)).toMatchObject({ kind: "jpeg", width: 120, height: 240 });
  expect(bytes[0]).toBe(255);
  expect(bytes[1]).toBe(216);
  if (info.project.name.startsWith("chromium")) {
    const evidence = resolve("../../docs/evidence/tbx-011");
    await mkdir(evidence, { recursive: true });
    await writeFile(resolve(evidence, "png-to-jpeg.jpg"), await readFile(outputPath));
    await page.screenshot({
      path: resolve(evidence, "png-jpg-converter-desktop.png"),
      fullPage: true,
    });
  }
  expect(uploads).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("JPEG to PNG and a mixed batch produce independently parsed images in selected order", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (!new Set(["GET", "HEAD"]).has(request.method())) uploads.push(request.url());
  });
  await page.goto(toolUrl);
  await page.waitForLoadState("networkidle");
  await chooseFiles(page, [fixture("landscape.jpg")]);
  await expect(page.getByText("JPEG · 240 × 120 px · 2.6 KiB", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Convert image", exact: true }).click();
  await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible();
  const single = await saveDownload(page, info, "landscape-converted.png", "jpeg-to-png.png");
  expect(inspectImage(single.bytes)).toMatchObject({ kind: "png", width: 240, height: 120 });

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText("Select files to get started.", { exact: true })).toBeVisible();
  await chooseFiles(page, [fixture("transparent.png")]);
  await dropFile(page, "landscape.jpg", "image/jpeg");
  await dropFile(page, "transparent.png", "image/png");
  await expect(page.getByText("3 images checked and ready to convert.")).toBeVisible();
  await page.getByRole("button", { name: "Convert 3 images", exact: true }).click();
  await expect(page.getByText("3 images converted and checked", { exact: true })).toBeVisible();
  await expect(page.getByText("transparent-converted-2.jpg", { exact: false })).toBeVisible();
  if (info.project.name.startsWith("chromium"))
    await page.screenshot({ path: info.outputPath("png-jpg-converter-batch.png"), fullPage: true });
  const archive = await saveDownload(
    page,
    info,
    "toolbox-converted-images.zip",
    "mixed-conversion.zip",
  );
  const entries = unzipSync(archive.bytes);
  expect(Object.keys(entries)).toEqual([
    "transparent-converted.jpg",
    "landscape-converted.png",
    "transparent-converted-2.jpg",
  ]);
  expect(inspectImage(entries["transparent-converted.jpg"] ?? new Uint8Array())).toMatchObject({
    kind: "jpeg",
    width: 120,
    height: 240,
  });
  expect(inspectImage(entries["landscape-converted.png"] ?? new Uint8Array())).toMatchObject({
    kind: "png",
    width: 240,
    height: 120,
  });
  expect(inspectImage(entries["transparent-converted-2.jpg"] ?? new Uint8Array())).toMatchObject({
    kind: "jpeg",
    width: 120,
    height: 240,
  });
  const archivePath = resolve("../../docs/evidence/tbx-011/mixed-conversion.zip");
  if (info.project.name.startsWith("chromium")) {
    await mkdir(resolve("../../docs/evidence/tbx-011"), { recursive: true });
    await writeFile(archivePath, await readFile(archive.outputPath));
  }
  expect(uploads).toEqual([]);
});

test("damaged and unsupported input fails safely while cancel, retry, reset and keyboard work on mobile", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (!new Set(["GET", "HEAD"]).has(request.method())) uploads.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(toolUrl);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText("Images and results cleared.", { exact: true })).toBeVisible();

  const chooseButton = page.getByRole("button", { name: "Choose files", exact: true });
  await chooseButton.focus();
  await expect(chooseButton).toBeFocused();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles(fixture("noise-800.jpg"));
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
  const convert = page.getByRole("button", { name: "Convert image", exact: true });
  await convert.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Operation cancelled. You can try again or reset.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Convert image", exact: true }).click();
  await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (info.project.name.startsWith("chromium")) {
    const evidence = resolve("../../docs/evidence/tbx-011");
    await mkdir(evidence, { recursive: true });
    await page.screenshot({
      path: resolve(evidence, "png-jpg-converter-mobile-390.png"),
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText("Select files to get started.", { exact: true })).toBeVisible();

  await chooseFilesRaw(page, [fixture("damaged.png")]);
  await expect(
    page.getByRole("main").getByRole("alert").filter({ hasText: "empty or damaged" }),
  ).toBeVisible();
  await chooseFilesRaw(page, [fixture("square.webp")]);
  await expect(
    page.getByRole("main").getByRole("alert").filter({ hasText: "Choose PNG or JPEG" }),
  ).toBeVisible();
  await expect(fileInput(page)).toBeAttached();
  expect(uploads).toEqual([]);
});

test("measures three real JPEG to PNG conversions", async ({ page }, info) => {
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
    const start = Date.now();
    await page.getByRole("button", { name: "Convert image", exact: true }).click();
    await expect(page.getByText("Image converted and checked", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const { bytes } = await saveDownload(
      page,
      info,
      name.replace(/\.jpg$/i, "-converted.png"),
      `${name.replace(/\.jpg$/i, "")}-converted.png`,
    );
    const decoded = inspectImage(bytes);
    expect(decoded.kind).toBe("png");
    measurements.push({
      file: name,
      inputBytes,
      outputBytes: bytes.byteLength,
      durationMs: Date.now() - start,
    });
    await page.getByRole("button", { name: "Reset", exact: true }).click();
  }
  await info.attach("png-jpg-converter-performance.json", {
    body: JSON.stringify({ browser: info.project.name, measurements }, null, 2),
    contentType: "application/json",
  });
  const evidence = resolve("../../docs/evidence/tbx-011/png-jpg-converter-performance.json");
  await mkdir(resolve("../../docs/evidence/tbx-011"), { recursive: true });
  await writeFile(evidence, JSON.stringify({ browser: info.project.name, measurements }, null, 2));
});
