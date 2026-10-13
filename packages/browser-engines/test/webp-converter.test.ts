import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inspectImage } from "@toolbox/core";
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertWebpFiles,
  inspectWebpConverterFile,
  type WebpConverterRasterize,
  prepareWebpConverterFiles,
} from "../src/webp-converter.js";

const fixtureBytes = (name: string) =>
  new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/images", name)));
const fixture = (name: string, type: string, fileName = name) =>
  new File([fixtureBytes(name)], fileName, { type });

const fakeRasterize: WebpConverterRasterize = async (_file, info, _settings, thumbnail) => {
  const outputName = thumbnail ? "transparent.png" : "transparent.webp";
  const output = fixtureBytes(outputName);
  const parsed = inspectImage(output);
  return {
    blob: new Blob([output], { type: thumbnail ? "image/png" : "image/webp" }),
    width: thumbnail ? info.width : parsed.width,
    height: thumbnail ? info.height : parsed.height,
  };
};

function stubImageDecode() {
  vi.stubGlobal("createImageBitmap", async (blob: Blob) => {
    const info = inspectImage(new Uint8Array(await blob.arrayBuffer()));
    return { width: info.width, height: info.height, close: vi.fn() };
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("WebP converter browser engine", () => {
  it("checks real JPEG and PNG signatures and rejects mismatched, animated and damaged input", async () => {
    await expect(inspectWebpConverterFile(fixture("portrait.jpg", "image/jpeg"))).resolves.toEqual({
      format: "jpeg",
      width: 120,
      height: 240,
    });
    await expect(
      inspectWebpConverterFile(fixture("transparent.png", "image/png")),
    ).resolves.toEqual({
      format: "png",
      width: 120,
      height: 240,
    });
    await expect(
      inspectWebpConverterFile(fixture("portrait.jpg", "image/png")),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(
      inspectWebpConverterFile(fixture("transparent.png", "image/png", "renamed.jpg")),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(
      inspectWebpConverterFile(fixture("damaged.png", "image/png")),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(
      inspectWebpConverterFile(fixture("animated.webp", "image/webp")),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(
      inspectWebpConverterFile(fixture("oversized.png", "image/png")),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });

  it("prepares decoded previews and checks single and ordered batch WebP outputs", async () => {
    stubImageDecode();
    const png = fixture("transparent.png", "image/png");
    const jpeg = fixture("portrait.jpg", "image/jpeg");
    const prepared = await prepareWebpConverterFiles([png, jpeg], undefined, fakeRasterize);
    expect(
      prepared.items.map(({ format, width, height, preview }) => ({
        format,
        width,
        height,
        type: preview.type,
      })),
    ).toEqual([
      { format: "png", width: 120, height: 240, type: "image/png" },
      { format: "jpeg", width: 120, height: 240, type: "image/png" },
    ]);

    const single = await convertWebpFiles([png], { quality: 80 }, undefined, fakeRasterize);
    expect(single.outputKind).toBe("image");
    expect(single.fileName).toBe("transparent-converted.webp");
    expect(single.blob.type).toBe("image/webp");
    expect(inspectImage(new Uint8Array(await single.blob.arrayBuffer()))).toMatchObject({
      kind: "webp",
      width: 120,
      height: 240,
    });

    const batch = await convertWebpFiles([png, jpeg], { quality: 80 }, undefined, fakeRasterize);
    expect(batch.outputKind).toBe("zip");
    expect(batch.items.map((item) => item.name)).toEqual([
      "transparent-converted.webp",
      "portrait-converted.webp",
    ]);
    const entries = unzipSync(new Uint8Array(await batch.blob.arrayBuffer()));
    expect(Object.keys(entries)).toEqual(batch.items.map((item) => item.name));
    for (const item of Object.values(entries))
      expect(inspectImage(item)).toMatchObject({ kind: "webp", width: 120, height: 240 });
  });

  it("rejects invalid quality and a cancelled conversion without returning partial output", async () => {
    const png = fixture("transparent.png", "image/png");
    await expect(
      convertWebpFiles([png], { quality: 100 }, undefined, fakeRasterize),
    ).rejects.toMatchObject({
      code: "INVALID_SETTINGS",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      convertWebpFiles([png], { quality: 80 }, controller.signal, fakeRasterize),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });
});
