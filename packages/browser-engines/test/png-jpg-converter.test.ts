import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inspectImage } from "@toolbox/core";
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertPngJpgFiles,
  inspectPngJpgConverterFile,
  type PngJpgConverterPreview,
  type PngJpgConverterRasterize,
  preparePngJpgConverterFiles,
  rasterizePngJpgConverterImage,
} from "../src/png-jpg-converter.js";

const fixtureBytes = (name: string) =>
  new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/images", name)));
const fixture = (name: string, type: string, fileName = name) =>
  new File([fixtureBytes(name)], fileName, { type });
const settings = { quality: 85, backgroundColor: "#ffffff" };

function largeValidPng(textBytes: number): Uint8Array {
  const png = fixtureBytes("landscape.png");
  const endChunkOffset = png.length - 12;
  const data = new Uint8Array(textBytes);
  data.fill(120);
  data[0] = 97;
  data[1] = 0;
  const chunk = new Uint8Array(data.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set([116, 69, 88, 116], 4); // tEXt
  chunk.set(data, 8);
  let crc = 0xffffffff;
  for (let index = 4; index < data.length + 8; index++) {
    crc ^= chunk[index] ?? 0;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  view.setUint32(data.length + 8, (crc ^ 0xffffffff) >>> 0);
  const output = new Uint8Array(png.length + chunk.length);
  output.set(png.subarray(0, endChunkOffset));
  output.set(chunk, endChunkOffset);
  output.set(png.subarray(endChunkOffset), endChunkOffset + chunk.length);
  return output;
}

const fakeRasterize: PngJpgConverterRasterize = async (_file, info, _settings, thumbnail) => {
  const name = thumbnail
    ? info.format === "png"
      ? "transparent.png"
      : "landscape.png"
    : info.format === "png"
      ? "portrait.jpg"
      : "landscape.png";
  const type = thumbnail || info.format === "jpeg" ? "image/png" : "image/jpeg";
  const blob = new Blob([fixtureBytes(name)], { type });
  const output = inspectImage(new Uint8Array(await blob.arrayBuffer()));
  return { blob, width: output.width, height: output.height };
};

const fakePreview: PngJpgConverterPreview = async (_blob, width) =>
  new Blob([fixtureBytes(width > 200 ? "landscape.png" : "transparent.png")], {
    type: "image/png",
  });

function stubImageDecode() {
  vi.stubGlobal("createImageBitmap", async (blob: Blob) => {
    const info = inspectImage(new Uint8Array(await blob.arrayBuffer()));
    return { width: info.width, height: info.height, close: vi.fn() };
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("PNG/JPG converter browser engine", () => {
  it("inspects real JPEG and PNG signatures, rejects MIME/extension mismatches and damaged files", async () => {
    expect(await inspectPngJpgConverterFile(fixture("landscape.jpg", "image/jpeg"))).toEqual({
      format: "jpeg",
      width: 240,
      height: 120,
    });
    expect(await inspectPngJpgConverterFile(fixture("transparent.png", "image/png"))).toEqual({
      format: "png",
      width: 120,
      height: 240,
    });
    await expect(
      inspectPngJpgConverterFile(fixture("landscape.jpg", "image/png")),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(
      inspectPngJpgConverterFile(fixture("transparent.png", "image/png", "renamed.jpg")),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(
      inspectPngJpgConverterFile(fixture("damaged.png", "image/png")),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(
      inspectPngJpgConverterFile(fixture("square.webp", "image/webp")),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(
      inspectPngJpgConverterFile(fixture("oversized.png", "image/png")),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });

  it("prepares actual source previews and converts both directions with verified filenames and MIME", async () => {
    stubImageDecode();
    const png = fixture("transparent.png", "image/png");
    const jpeg = fixture("landscape.jpg", "image/jpeg");
    const prepared = await preparePngJpgConverterFiles([png, jpeg], undefined, fakeRasterize);
    expect(
      prepared.items.map(({ format, width, height, preview }) => ({
        format,
        width,
        height,
        type: preview.type,
      })),
    ).toEqual([
      { format: "png", width: 120, height: 240, type: "image/png" },
      { format: "jpeg", width: 240, height: 120, type: "image/png" },
    ]);

    const pngToJpeg = await convertPngJpgFiles(
      [png],
      settings,
      undefined,
      fakeRasterize,
      fakePreview,
    );
    expect(pngToJpeg).toMatchObject({
      outputKind: "image",
      fileName: "transparent-converted.jpg",
      blob: { type: "image/jpeg" },
      items: [
        { format: "jpeg", width: 120, height: 240, outputBytes: pngToJpeg.items[0]?.outputBytes },
      ],
      preview: { type: "image/png" },
    });

    const jpegToPng = await convertPngJpgFiles(
      [jpeg],
      settings,
      undefined,
      fakeRasterize,
      fakePreview,
    );
    expect(jpegToPng).toMatchObject({
      outputKind: "image",
      fileName: "landscape-converted.png",
      blob: { type: "image/png" },
      items: [{ format: "png", width: 240, height: 120 }],
    });
  });

  it("keeps mixed batch order in a real ZIP and sanitizes duplicate entry names", async () => {
    stubImageDecode();
    const files = [
      fixture("transparent.png", "image/png", "../shared.png"),
      fixture("landscape.jpg", "image/jpeg", "shared.jpg"),
      fixture("transparent.png", "image/png", "shared.png"),
    ];
    const result = await convertPngJpgFiles(files, settings, undefined, fakeRasterize, fakePreview);
    expect(result.outputKind).toBe("zip");
    expect(result.outputBytes).toBe(result.blob.size);
    expect(result.items.map((item) => item.name)).toEqual([
      "shared-converted.jpg",
      "shared-converted.png",
      "shared-converted-2.jpg",
    ]);
    const entries = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    expect(Object.keys(entries)).toEqual(result.items.map((item) => item.name));
    for (const item of result.items) {
      const contents = entries[item.name];
      expect(contents).toBeDefined();
      const info = inspectImage(contents ?? new Uint8Array());
      expect(info.kind).toBe(item.format);
      expect(info.width).toBe(item.width);
      expect(info.height).toBe(item.height);
    }
    expect(result.uncompressedOutputBytes).toBe(
      result.items.reduce((total, item) => total + item.outputBytes, 0),
    );
  });

  it("rejects an output batch over its memory budget, cancels and allows a clean retry", async () => {
    stubImageDecode();
    vi.stubGlobal("createImageBitmap", async (blob: Blob) => {
      if (blob.size > 1_000_000) return { width: 240, height: 120, close: vi.fn() };
      const info = inspectImage(new Uint8Array(await blob.arrayBuffer()));
      return { width: info.width, height: info.height, close: vi.fn() };
    });
    const files = [
      fixture("landscape.jpg", "image/jpeg", "first.jpg"),
      fixture("landscape.jpg", "image/jpeg", "second.jpg"),
    ];
    const largeOutput = largeValidPng(17 * 1024 * 1024);
    const oversizedBatch: PngJpgConverterRasterize = async () => ({
      blob: new Blob([largeOutput], { type: "image/png" }),
      width: 240,
      height: 120,
    });
    await expect(
      convertPngJpgFiles(files, settings, undefined, oversizedBatch, fakePreview),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });

    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      convertPngJpgFiles(files, settings, cancelled.signal, fakeRasterize, fakePreview),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    const retry = await convertPngJpgFiles(files, settings, undefined, fakeRasterize, fakePreview);
    expect(retry.outputKind).toBe("zip");
    expect(retry.items).toHaveLength(2);
  });

  it("closes image bitmaps and resets canvases when encoding fails", async () => {
    const input = fixture("transparent.png", "image/png");
    const closed: ReturnType<typeof vi.fn>[] = [];
    const canvases: { width: number; height: number }[] = [];
    vi.stubGlobal("createImageBitmap", async () => {
      const close = vi.fn();
      closed.push(close);
      return { width: 120, height: 240, close };
    });
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
          throw new Error("synthetic encoder error");
        }
      },
    );
    await expect(
      rasterizePngJpgConverterImage(input, { format: "png", width: 120, height: 240 }, settings),
    ).rejects.toMatchObject({ code: "CONVERSION_FAILED" });
    expect(closed).toHaveLength(1);
    expect(closed[0]).toHaveBeenCalledOnce();
    expect(canvases[0]).toEqual({ width: 0, height: 0 });
  });
});
