import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultImagePdfOptions, imagePdfLimits } from "@toolbox/core";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { imagesToPdf, inspectFiles, prepareImages } from "../src/images-to-pdf.js";

const fixture = (name: string, type: string) =>
  new File([new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/images", name)))], name, {
    type,
  });
afterEach(() => vi.unstubAllGlobals());
describe("browser engine lifecycle", () => {
  it("validates real headers, MIME mismatch and cumulative decoded pixels", async () => {
    expect(
      await inspectFiles([
        fixture("landscape.jpg", "image/jpeg"),
        fixture("transparent.png", "image/png"),
        fixture("square.webp", "image/webp"),
      ]),
    ).toHaveLength(3);
    await expect(inspectFiles([fixture("landscape.jpg", "image/png")])).rejects.toMatchObject({
      code: "UNSUPPORTED_FORMAT",
    });
    await expect(inspectFiles([fixture("damaged.png", "image/png")])).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
    const big = fixture("noise-4000.jpg", "image/jpeg");
    await expect(inspectFiles([big, big, big])).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
    expect((await inspectFiles([big, big])).reduce((n, i) => n + i.width * i.height, 0)).toBe(
      imagePdfLimits.totalPixels,
    );
  });
  it("does not decode an oversized image or a cancelled selection", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    await expect(prepareImages([fixture("oversized.png", "image/png")])).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareImages([fixture("landscape.jpg", "image/jpeg")], controller.signal),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(decode).not.toHaveBeenCalled();
  });
  it("closes a decoded bitmap when cancellation arrives during decode", async () => {
    const controller = new AbortController();
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", async () => {
      controller.abort();
      return { width: 240, height: 120, close };
    });
    await expect(
      prepareImages([fixture("landscape.jpg", "image/jpeg")], controller.signal),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(close).toHaveBeenCalledOnce();
  });
  it("releases bitmaps and canvases on encode failure and permits repeat conversion", async () => {
    const close = vi.fn();
    const canvases: { width: number; height: number }[] = [];
    vi.stubGlobal("createImageBitmap", async () => ({ width: 240, height: 120, close }));
    let fail = true;
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(
          public width: number,
          public height: number,
        ) {
          canvases.push(this);
        }
        getContext() {
          return { drawImage: vi.fn() };
        }
        async convertToBlob() {
          if (fail) throw new Error("Synthetic encoder failure");
          return fixture("landscape.jpg", "image/jpeg");
        }
      },
    );
    await expect(
      imagesToPdf([fixture("landscape.jpg", "image/jpeg")], defaultImagePdfOptions),
    ).rejects.toThrow("Synthetic encoder failure");
    expect(close).toHaveBeenCalledOnce();
    expect(canvases[0]).toEqual({ width: 0, height: 0 });
    fail = false;
    for (let i = 0; i < 2; i++) {
      const result = await imagesToPdf(
        [fixture("landscape.jpg", "image/jpeg")],
        defaultImagePdfOptions,
      );
      expect((await PDFDocument.load(await result.blob.arrayBuffer())).getPageCount()).toBe(1);
    }
    expect(close).toHaveBeenCalledTimes(3);
    expect(canvases.every((c) => c.width === 0 && c.height === 0)).toBe(true);
  });
});
