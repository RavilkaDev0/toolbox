import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ImageCompressorError } from "@toolbox/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compressImage,
  type ImageCompressorRasterize,
  inspectCompressorFile,
  prepareCompressorImage,
  rasterizeCompressorImage,
} from "../src/image-compressor.js";

const fixture = (name: string, type: string) =>
  new File([new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/images", name)))], name, {
    type,
  });
const rasterizer: ImageCompressorRasterize = async (file, info, format, _quality, thumbnail) => {
  if (thumbnail)
    return {
      blob: fixture("transparent.png", "image/png"),
      width: info.width,
      height: info.height,
    };
  const output =
    format === "jpeg"
      ? fixture("landscape.jpg", "image/jpeg")
      : format === "png"
        ? fixture("transparent.png", "image/png")
        : fixture("square.webp", "image/webp");
  if (file.name === "landscape.jpg" && format !== "jpeg")
    throw new ImageCompressorError("CONVERSION_FAILED");
  return { blob: output, width: info.width, height: info.height };
};

afterEach(() => vi.unstubAllGlobals());

describe("image compressor browser engine", () => {
  it("inspects real JPEG, PNG and WebP files and rejects bad metadata/content", async () => {
    expect((await inspectCompressorFile(fixture("landscape.jpg", "image/jpeg"))).format).toBe(
      "jpeg",
    );
    expect((await inspectCompressorFile(fixture("transparent.png", "image/png"))).format).toBe(
      "png",
    );
    expect((await inspectCompressorFile(fixture("square.webp", "image/webp"))).format).toBe("webp");
    await expect(
      inspectCompressorFile(fixture("landscape.jpg", "image/png")),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_FORMAT",
    });
    await expect(inspectCompressorFile(fixture("damaged.png", "image/png"))).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
    await expect(
      inspectCompressorFile(fixture("oversized.png", "image/png")),
    ).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
    });
    await expect(inspectCompressorFile(fixture("animated.png", "image/png"))).rejects.toMatchObject(
      {
        code: "UNSUPPORTED_FORMAT",
      },
    );
  });

  it("prepares a real fixture, compresses a real file, and supports repeat runs", async () => {
    const input = fixture("landscape.jpg", "image/jpeg");
    const prepared = await prepareCompressorImage(input, undefined, rasterizer);
    expect(prepared.info).toMatchObject({ format: "jpeg", width: 240, height: 120 });
    expect(prepared.preview.type).toBe("image/png");

    const first = await compressImage(
      input,
      { format: "jpeg", quality: 75 },
      undefined,
      rasterizer,
    );
    const second = await compressImage(
      input,
      { format: "jpeg", quality: 45 },
      undefined,
      rasterizer,
    );
    expect(first).toMatchObject({
      format: "jpeg",
      width: 240,
      height: 120,
      inputBytes: input.size,
    });
    expect(first.outputBytes).toBe(first.blob.size);
    expect(second.outputBytes).toBe(first.outputBytes);
    expect(second.blob.type).toBe("image/jpeg");
  });

  it("checks encoded signatures, dimensions, and cancellation before returning output", async () => {
    const input = fixture("landscape.jpg", "image/jpeg");
    const wrongOutput: ImageCompressorRasterize = async () => ({
      blob: fixture("transparent.png", "image/png"),
      width: 240,
      height: 120,
    });
    await expect(
      compressImage(input, { format: "jpeg", quality: 80 }, undefined, wrongOutput),
    ).rejects.toMatchObject({ code: "CONVERSION_FAILED" });

    const controller = new AbortController();
    const cancelled: ImageCompressorRasterize = async () => {
      controller.abort();
      return { blob: fixture("landscape.jpg", "image/jpeg"), width: 240, height: 120 };
    };
    await expect(
      compressImage(input, { format: "jpeg", quality: 80 }, controller.signal, cancelled),
    ).rejects.toMatchObject({ code: "CANCELLED" });

    const oversizedOutput: ImageCompressorRasterize = async () => ({
      blob: new Blob([new Uint8Array(25 * 1024 * 1024)], { type: "image/jpeg" }),
      width: 240,
      height: 120,
    });
    await expect(
      compressImage(input, { format: "jpeg", quality: 80 }, undefined, oversizedOutput),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });

  it("closes decoded bitmaps and shrinks canvases after an encoder error or cancellation", async () => {
    const input = fixture("landscape.jpg", "image/jpeg");
    const close = vi.fn();
    let canvas: { width: number; height: number } | undefined;
    vi.stubGlobal("createImageBitmap", async () => ({ width: 240, height: 120, close }));
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(
          public width: number,
          public height: number,
        ) {
          canvas = this;
        }
        getContext() {
          return { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: "" };
        }
        async convertToBlob() {
          throw new Error("synthetic encoder failure");
        }
      },
    );
    const info = { format: "jpeg" as const, width: 240, height: 120 };
    await expect(rasterizeCompressorImage(input, info, "jpeg", 80, false)).rejects.toMatchObject({
      code: "CONVERSION_FAILED",
    });
    expect(close).toHaveBeenCalledOnce();
    expect(canvas).toMatchObject({ width: 0, height: 0 });

    const controller = new AbortController();
    const cancelClose = vi.fn();
    vi.stubGlobal("createImageBitmap", async () => {
      controller.abort();
      return { width: 240, height: 120, close: cancelClose };
    });
    await expect(
      rasterizeCompressorImage(input, info, "jpeg", 80, false, controller.signal),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(cancelClose).toHaveBeenCalledOnce();
  });

  it("overwrites temporary source and encoded byte copies after inspection", async () => {
    const inputBytes = new Uint8Array(
      readFileSync(resolve("apps/web/e2e/fixtures/images/landscape.jpg")),
    );
    const inputBuffer = new ArrayBuffer(inputBytes.byteLength);
    new Uint8Array(inputBuffer).set(inputBytes);
    const input = fixture("landscape.jpg", "image/jpeg");
    vi.spyOn(input, "arrayBuffer").mockResolvedValue(inputBuffer);
    await inspectCompressorFile(input);
    expect(new Uint8Array(inputBuffer).every((byte) => byte === 0)).toBe(true);

    const outputBuffer = new ArrayBuffer(inputBytes.byteLength);
    new Uint8Array(outputBuffer).set(inputBytes);
    const output = fixture("landscape.jpg", "image/jpeg");
    vi.spyOn(output, "arrayBuffer").mockResolvedValue(outputBuffer);
    vi.stubGlobal("createImageBitmap", async () => ({ width: 240, height: 120, close: vi.fn() }));
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: "" };
        }
        async convertToBlob() {
          return output;
        }
      },
    );
    await rasterizeCompressorImage(
      input,
      { format: "jpeg", width: 240, height: 120 },
      "jpeg",
      80,
      false,
    );
    expect(new Uint8Array(outputBuffer).every((byte) => byte === 0)).toBe(true);
  });
});
