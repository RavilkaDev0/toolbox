import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ImageResizeOptions } from "@toolbox/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ImageResizerRasterize,
  inspectResizerFile,
  prepareResizerImage,
  rasterizeResizerImage,
  resizeImage,
} from "../src/image-resizer.js";

const fixture = (name: string, type: string) =>
  new File([new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/images", name)))], name, {
    type,
  });
const outputFixture = (format: "jpeg" | "png" | "webp") =>
  format === "jpeg"
    ? fixture("landscape.jpg", "image/jpeg")
    : format === "png"
      ? fixture("transparent.png", "image/png")
      : fixture("square.webp", "image/webp");

const injectedRasterizer: ImageResizerRasterize = async (_file, info, options, preview) => ({
  blob: preview
    ? fixture("transparent.png", "image/png")
    : outputFixture(options?.format ?? info.format),
  width: info.width,
  height: info.height,
});

afterEach(() => vi.unstubAllGlobals());

describe("image resizer browser engine", () => {
  it("inspects real JPEG, PNG and WebP inputs and refuses mismatched, damaged and animated data", async () => {
    expect(await inspectResizerFile(fixture("landscape.jpg", "image/jpeg"))).toMatchObject({
      format: "jpeg",
      width: 240,
      height: 120,
    });
    expect(await inspectResizerFile(fixture("transparent.png", "image/png"))).toMatchObject({
      format: "png",
      width: 120,
      height: 240,
    });
    expect(await inspectResizerFile(fixture("square.webp", "image/webp"))).toMatchObject({
      format: "webp",
      width: 160,
      height: 160,
    });
    await expect(inspectResizerFile(fixture("landscape.jpg", "image/png"))).rejects.toMatchObject({
      code: "UNSUPPORTED_FORMAT",
    });
    await expect(inspectResizerFile(fixture("damaged.png", "image/png"))).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
    await expect(inspectResizerFile(fixture("animated.webp", "image/webp"))).rejects.toMatchObject({
      code: "UNSUPPORTED_FORMAT",
    });
    await expect(inspectResizerFile(fixture("oversized.png", "image/png"))).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
    });
  });

  it("prepares a real input, verifies actual output and allows deterministic repeat runs", async () => {
    const input = fixture("landscape.jpg", "image/jpeg");
    const prepared = await prepareResizerImage(input, undefined, injectedRasterizer);
    expect(prepared.info).toMatchObject({ format: "jpeg", width: 240, height: 120 });
    expect(prepared.preview.type).toBe("image/png");

    const settings: ImageResizeOptions = {
      mode: "pixels",
      width: 240,
      height: 120,
      lockAspectRatio: true,
      editedDimension: "width",
      format: "jpeg",
      quality: 80,
    };
    const first = await resizeImage(input, settings, undefined, injectedRasterizer);
    const second = await resizeImage(input, settings, undefined, injectedRasterizer);
    expect(first).toMatchObject({
      format: "jpeg",
      width: 240,
      height: 120,
      inputBytes: input.size,
      outputBytes: first.blob.size,
    });
    expect(second.blob.size).toBe(first.blob.size);
    expect(second.blob.type).toBe("image/jpeg");
  });

  it("rejects invalid settings, output mismatches, large outputs and cancellation", async () => {
    const input = fixture("landscape.jpg", "image/jpeg");
    await expect(resizeImage(input, { mode: "pixels", width: 0 })).rejects.toMatchObject({
      code: "INVALID_SETTINGS",
    });
    const wrongOutput: ImageResizerRasterize = async () => ({
      blob: fixture("transparent.png", "image/png"),
      width: 240,
      height: 120,
    });
    await expect(
      resizeImage(
        input,
        {
          mode: "pixels",
          width: 240,
          height: 120,
          lockAspectRatio: true,
          editedDimension: "width",
          format: "jpeg",
          quality: 80,
        },
        undefined,
        wrongOutput,
      ),
    ).rejects.toMatchObject({ code: "CONVERSION_FAILED" });
    const tooLarge: ImageResizerRasterize = async () => ({
      blob: new Blob([new Uint8Array(25 * 1024 * 1024)], { type: "image/jpeg" }),
      width: 240,
      height: 120,
    });
    await expect(
      resizeImage(
        input,
        {
          mode: "pixels",
          width: 240,
          height: 120,
          lockAspectRatio: true,
          editedDimension: "width",
          format: "jpeg",
          quality: 80,
        },
        undefined,
        tooLarge,
      ),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });

    const controller = new AbortController();
    const cancelled: ImageResizerRasterize = async () => {
      controller.abort();
      return { blob: fixture("landscape.jpg", "image/jpeg"), width: 240, height: 120 };
    };
    await expect(
      resizeImage(
        input,
        {
          mode: "pixels",
          width: 240,
          height: 120,
          lockAspectRatio: true,
          editedDimension: "width",
          format: "jpeg",
          quality: 80,
        },
        controller.signal,
        cancelled,
      ),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("closes decoded images and releases canvases on encode failure and output decode cancellation", async () => {
    const input = fixture("landscape.jpg", "image/jpeg");
    const sourceClose = vi.fn();
    const outputClose = vi.fn();
    const canvases: { width: number; height: number }[] = [];
    let decodeCall = 0;
    vi.stubGlobal("createImageBitmap", async () => {
      decodeCall++;
      return {
        width: 240,
        height: 120,
        close: decodeCall === 1 ? sourceClose : outputClose,
      };
    });
    let failEncode = true;
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
          return { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: "" };
        }
        async convertToBlob() {
          if (failEncode) throw new Error("synthetic encoder failure");
          return fixture("landscape.jpg", "image/jpeg");
        }
      },
    );
    const info = { format: "jpeg" as const, width: 240, height: 120 };
    const settings: ImageResizeOptions = {
      mode: "pixels",
      width: 240,
      height: 120,
      lockAspectRatio: true,
      editedDimension: "width",
      format: "jpeg",
      quality: 80,
    };
    await expect(rasterizeResizerImage(input, info, settings)).rejects.toMatchObject({
      code: "CONVERSION_FAILED",
    });
    expect(sourceClose).toHaveBeenCalledOnce();
    expect(canvases[0]).toEqual({ width: 0, height: 0 });

    failEncode = false;
    const controller = new AbortController();
    decodeCall = 0;
    vi.stubGlobal("createImageBitmap", async () => {
      decodeCall++;
      if (decodeCall === 2) controller.abort();
      return {
        width: 240,
        height: 120,
        close: decodeCall === 1 ? sourceClose : outputClose,
      };
    });
    await expect(
      rasterizeResizerImage(input, info, settings, false, controller.signal),
    ).rejects.toMatchObject({
      code: "CANCELLED",
    });
    expect(sourceClose).toHaveBeenCalledTimes(2);
    expect(outputClose).toHaveBeenCalledOnce();
    expect(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
  });
});
