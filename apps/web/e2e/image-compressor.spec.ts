import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { waitForToolPageReady } from "./tool-readiness";

const fixture = (name: string) => resolve("e2e/fixtures/images", name);
const toolUrl = "/tools/image-compressor";
const imageInput = (page: Page) => page.getByLabel("Choose one image", { exact: true });

async function selectImage(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await imageInput(page).setInputFiles(fixture(name));
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /^Original:/ })).toBeVisible();
}

async function dropImages(page: Page, names: string[]) {
  const files = await Promise.all(
    names.map(async (name) => ({
      name,
      type: name.endsWith(".jpg")
        ? "image/jpeg"
        : name.endsWith(".png")
          ? "image/png"
          : "image/webp",
      base64: (await readFile(fixture(name))).toString("base64"),
    })),
  );
  await page.evaluate((entries) => {
    const transfer = new DataTransfer();
    for (const entry of entries) {
      const bytes = Uint8Array.from(atob(entry.base64), (character) => character.charCodeAt(0));
      transfer.items.add(new File([bytes], entry.name, { type: entry.type }));
    }
    const dropzone = document.querySelector('[aria-label="File selection"]');
    if (!dropzone) throw new Error("Image dropzone is missing");
    dropzone.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  }, files);
}

async function saveOutput(page: Page, info: TestInfo, name: string, extension: string) {
  await page.getByRole("button", { name: "Compress image", exact: true }).click();
  const resultImage = page.getByRole("img", { name: /^Compressed / });
  await expect(resultImage).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download image", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`toolbox-image.${extension}`);
  const outputPath = info.outputPath(name);
  await download.saveAs(outputPath);
  const bytes = await readFile(outputPath);
  await info.attach(name, {
    path: outputPath,
    contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
  });
  return bytes;
}

async function pixel(page: Page, x: number, y: number) {
  return page.getByRole("img", { name: /^Compressed / }).evaluate(
    (node, point) => {
      if (!(node instanceof HTMLImageElement))
        throw new Error("Expected the encoded output preview");
      const canvas = document.createElement("canvas");
      canvas.width = node.naturalWidth;
      canvas.height = node.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available");
      context.drawImage(node, 0, 0);
      return Array.from(context.getImageData(point.x, point.y, 1, 1).data);
    },
    { x, y },
  );
}

test("real JPEG, PNG and WebP inputs produce verified local downloads", async ({ page }, info) => {
  const uploads: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") uploads.push(request.method());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await expect(page).toHaveTitle(/Image compressor/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/tools\/image-compressor$/,
  );

  for (const [source, extension, expectedDimensions] of [
    ["landscape.jpg", "jpg", [240, 120]],
    ["transparent.png", "png", [120, 240]],
    ["square.webp", "webp", [160, 160]],
    ["oriented.jpg", "jpg", [40, 80]],
  ] as const) {
    await selectImage(page, source);
    const bytes = await saveOutput(page, info, `output-${extension}.${extension}`, extension);
    if (extension === "jpg") expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    if (extension === "png") expect(bytes.subarray(0, 8).toString()).toContain("PNG");
    if (extension === "webp") {
      expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
    }
    const dimensions = await page.getByRole("img", { name: /^Compressed / }).evaluate((node) => {
      if (!(node instanceof HTMLImageElement)) throw new Error("Expected image output");
      return [node.naturalWidth, node.naturalHeight];
    });
    expect(dimensions).toEqual(expectedDimensions);
    if (source === "transparent.png") expect((await pixel(page, 2, 2))[3]).toBe(0);
    if (source !== "oriented.jpg") {
      await page.getByRole("button", { name: "Reset", exact: true }).click();
    } else {
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({
        path: info.outputPath("image-compressor-desktop.png"),
        fullPage: true,
      });
    }
  }
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("preserves alpha in PNG and WebP and uses white when exporting JPEG", async ({
  page,
}, info) => {
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await selectImage(page, "transparent.png");
  await expect(page.getByLabel(/^Quality/)).toBeDisabled();
  await page.getByLabel("Output format", { exact: true }).selectOption("webp");
  let bytes = await saveOutput(page, info, "transparent-output.webp", "webp");
  expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
  let color = await pixel(page, 2, 2);
  expect(color[3]).toBe(0);
  color = await pixel(page, 60, 120);
  expect(color[3]).toBeGreaterThan(100);
  expect(color[3]).toBeLessThan(160);

  await page.getByLabel("Output format", { exact: true }).selectOption("jpeg");
  bytes = await saveOutput(page, info, "transparent-output.jpg", "jpg");
  expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  color = await pixel(page, 2, 2);
  expect(color[0]).toBeGreaterThan(240);
  expect(color[1]).toBeGreaterThan(240);
  expect(color[2]).toBeGreaterThan(240);

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await dropImages(page, ["landscape.jpg"]);
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("landscape.jpg", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
});

test("rejects spoofed, damaged, animated and oversized inputs while preserving the last valid image", async ({
  page,
}) => {
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await selectImage(page, "landscape.jpg");
  await dropImages(page, ["landscape.jpg", "transparent.png"]);
  await expect(page.locator('[data-slot="alert"]')).toContainText("Choose one image");
  await expect(page.getByText("landscape.jpg", { exact: true })).toBeVisible();
  const spoofedBytes = await readFile(fixture("landscape.jpg"));
  await imageInput(page).setInputFiles({
    name: "spoof.png",
    mimeType: "image/png",
    buffer: spoofedBytes,
  });
  await expect(page.locator('[data-slot="alert"]')).toContainText("does not match");
  await expect(page.getByText("landscape.jpg", { exact: true })).toBeVisible();

  await imageInput(page).setInputFiles(fixture("damaged.png"));
  await expect(page.locator('[data-slot="alert"]')).toContainText("empty or damaged");
  await imageInput(page).setInputFiles(fixture("animated.webp"));
  await expect(page.locator('[data-slot="alert"]')).toContainText("static JPEG, PNG or WebP");
  await imageInput(page).setInputFiles(fixture("oversized.png"));
  await expect(page.locator('[data-slot="alert"]')).toContainText("8 megapixels");
  await expect(page.getByRole("button", { name: "Compress image", exact: true })).toBeVisible();
});

test("keyboard controls, cancellation, retry, reset and mobile layout", async ({ page }) => {
  await page.addInitScript(`
    window.holdImageCompression = false;
    window.compressorWorkerTerminations = 0;
    const liveBlobUrls = new Set();
    const createObjectURL = URL.createObjectURL.bind(URL);
    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = createObjectURL(blob);
      liveBlobUrls.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      liveBlobUrls.delete(url);
      revokeObjectURL(url);
    };
    Object.defineProperty(window, "compressorLiveBlobUrls", { get: () => liveBlobUrls.size });
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, transfer) {
        if (window.holdImageCompression && message && message.action === "compress") return;
        return super.postMessage(message, transfer);
      }
      terminate() {
        window.compressorWorkerTerminations += 1;
        return super.terminate();
      }
    };
  `);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await selectImage(page, "noise-800.jpg");
  const quality = page.getByLabel(/^Quality/);
  await quality.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(quality).toHaveValue("15");

  await page.evaluate(() => {
    (window as Window & { holdImageCompression?: boolean }).holdImageCompression = true;
  });
  await page.getByRole("button", { name: "Compress image", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Operation cancelled. You can try again or reset.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /^Compressed / })).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { compressorWorkerTerminations?: number }).compressorWorkerTerminations,
    ),
  ).toBeGreaterThan(0);

  await page.evaluate(() => {
    (window as Window & { holdImageCompression?: boolean }).holdImageCompression = false;
  });
  await page.getByRole("button", { name: "Compress image", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Download image", exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "compressorLiveBlobUrls"))).toBe(2);
  expect(await page.locator("html").evaluate((node) => node.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const actionBox = await page.getByRole("button", { name: "Reset", exact: true }).boundingBox();
  expect(actionBox?.height).toBeGreaterThanOrEqual(40);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: "test-results/image-compressor-mobile-390.png", fullPage: true });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No image selected" })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "compressorLiveBlobUrls"))).toBe(0);
});

test("measures real image compression at three bounded input sizes", async ({ page }, info) => {
  const measurements: {
    input: string;
    inputBytes: number;
    outputBytes: number;
    elapsedMs: number;
  }[] = [];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  for (const name of ["landscape.jpg", "noise-800.jpg", "noise-2000.jpg"]) {
    await selectImage(page, name);
    const quality = page.getByLabel(/^Quality/);
    await quality.focus();
    await page.keyboard.press("Home");
    for (let step = 0; step < 8; step++) await page.keyboard.press("ArrowRight");
    const inputBytes = (await readFile(fixture(name))).byteLength;
    const started = Date.now();
    const output = await saveOutput(page, info, `perf-${name}`, "jpg");
    const elapsedMs = Date.now() - started;
    expect(output.length).toBeLessThan(inputBytes);
    measurements.push({ input: name, inputBytes, outputBytes: output.length, elapsedMs });
    await page.getByRole("button", { name: "Reset", exact: true }).click();
  }
  const measurementPath = info.outputPath("image-compressor-performance.json");
  await writeFile(measurementPath, JSON.stringify(measurements, null, 2));
  await info.attach("image-compressor-performance.json", {
    path: measurementPath,
    contentType: "application/json",
  });
});
