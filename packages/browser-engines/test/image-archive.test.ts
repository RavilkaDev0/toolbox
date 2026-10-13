import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createImageZipWriter } from "../src/image-archive.js";

describe("streamed image ZIP writer", () => {
  it("keeps entry order and contents while bounding and clearing archive buffers", async () => {
    const writer = await createImageZipWriter(10_000);
    await writer.add("first.webp", new Blob(["first bytes"]));
    await writer.add("second.webp", new Blob(["second bytes"]));
    const archive = writer.finish();
    expect(archive.type).toBe("application/zip");
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));
    expect(Object.keys(entries)).toEqual(["first.webp", "second.webp"]);
    expect(new TextDecoder().decode(entries["first.webp"])).toBe("first bytes");
    expect(new TextDecoder().decode(entries["second.webp"])).toBe("second bytes");
    writer.dispose();
  });

  it("rejects unsafe entry names, oversized output and cancelled writes", async () => {
    const writer = await createImageZipWriter(10_000);
    await expect(writer.add("../unsafe.webp", new Blob(["x"]))).rejects.toMatchObject({
      code: "CONVERSION_FAILED",
    });
    writer.dispose();

    const tooSmall = await createImageZipWriter(1);
    await expect(tooSmall.add("image.webp", new Blob(["content"]))).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
    });
    tooSmall.dispose();

    const cancelled = await createImageZipWriter(10_000);
    const controller = new AbortController();
    controller.abort();
    await expect(
      cancelled.add("image.webp", new Blob(["x"]), controller.signal),
    ).rejects.toMatchObject({
      code: "CANCELLED",
    });
    cancelled.dispose();
  });
});
