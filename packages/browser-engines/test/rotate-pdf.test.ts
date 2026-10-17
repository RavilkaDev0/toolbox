import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { expect, it } from "vitest";
import { inspectRotatePdf, rotatePdfPages } from "../src/rotate-pdf.js";

const fixture = (name: string) =>
  new File([new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/pdfs", name)))], name, {
    type: "application/pdf",
  });
function pageContent(page: import("pdf-lib").PDFPage) {
  const raw = page.doc.context.lookup(page.node.Contents());
  const streams =
    raw instanceof PDFArray ? raw.asArray().map((ref) => page.doc.context.lookup(ref)) : [raw];
  return streams
    .map((stream) => {
      if (!(stream instanceof PDFRawStream)) throw Error("Missing page content");
      return decodePDFRawStream(stream).decode();
    })
    .map((bytes) => new TextDecoder().decode(bytes))
    .join("\n");
}
const boxNames = ["getMediaBox", "getCropBox", "getBleedBox", "getTrimBox", "getArtBox"] as const;

it("rotates selected pages in place and preserves all source page geometry and content", async () => {
  const sourceFile = fixture("split-pages.pdf");
  const source = await PDFDocument.load(await sourceFile.arrayBuffer());
  expect(await inspectRotatePdf(sourceFile)).toEqual({
    pages: 5,
    bytes: sourceFile.size,
    rotations: [0, 90, 0, 270, 0],
  });
  const result = await rotatePdfPages(sourceFile, [2, 4], 90);
  const output = await PDFDocument.load(await result.blob.arrayBuffer());
  expect(result).toMatchObject({ pages: 5, rotatedPages: [2, 4] });
  expect(result.blob.type).toBe("application/pdf");
  expect(result.blob.size).toBeLessThanOrEqual(8 * 1024 * 1024);
  expect(output.getPages().map((page) => page.getRotation().angle)).toEqual([0, 180, 0, 0, 0]);
  for (const [index, original] of source.getPages().entries()) {
    const rotated = output.getPage(index);
    if (!rotated) throw Error("Missing result page");
    for (const box of boxNames) expect(rotated[box]()).toEqual(original[box]());
    expect(pageContent(rotated)).toEqual(pageContent(original));
  }
});

it("applies left, right, 180 and repeated turns relative to an existing rotation", async () => {
  const file = fixture("split-pages.pdf");
  const left = await rotatePdfPages(file, [2, 4], -90);
  const leftDocument = await PDFDocument.load(await left.blob.arrayBuffer());
  expect(leftDocument.getPages().map((page) => page.getRotation().angle)).toEqual([
    0, 0, 0, 180, 0,
  ]);
  const rightThenAgain = await rotatePdfPages(file, [2], 90);
  const rightAgain = await rotatePdfPages(
    new File([await rightThenAgain.blob.arrayBuffer()], "rotated.pdf", { type: "application/pdf" }),
    [2],
    90,
  );
  const repeated = await PDFDocument.load(await rightAgain.blob.arrayBuffer());
  expect(repeated.getPage(1)?.getRotation().angle).toBe(270);
  const around = await rotatePdfPages(file, [2, 4], 180);
  const turned = await PDFDocument.load(await around.blob.arrayBuffer());
  expect(turned.getPages().map((page) => page.getRotation().angle)).toEqual([0, 270, 0, 90, 0]);
});

it("keeps page count/order and produces repeatable static-PDF output", async () => {
  const file = fixture("split-pages.pdf");
  const first = await rotatePdfPages(file, [1, 3], -90);
  const repeated = await rotatePdfPages(file, [1, 3], -90);
  expect(new Uint8Array(await repeated.blob.arrayBuffer())).toEqual(
    new Uint8Array(await first.blob.arrayBuffer()),
  );
  const output = await PDFDocument.load(await first.blob.arrayBuffer());
  expect(output.getPages().map((page) => page.getRotation().angle)).toEqual([270, 90, 270, 270, 0]);
});

it("rejects damaged, encrypted, active and out-of-policy PDF inputs and selections", async () => {
  for (const [name, code] of [
    ["damaged.pdf", "INVALID_PDF"],
    ["encrypted.pdf", "DOCUMENT_PROTECTED"],
    ["javascript.pdf", "UNSUPPORTED_FEATURE"],
    ["attachment.pdf", "UNSUPPORTED_FEATURE"],
    ["link.pdf", "UNSUPPORTED_FEATURE"],
    ["form.pdf", "UNSUPPORTED_FEATURE"],
    ["launch.pdf", "UNSUPPORTED_FEATURE"],
    ["layers.pdf", "UNSUPPORTED_FEATURE"],
    ["empty-pages.pdf", "INVALID_PDF"],
    ["too-many-pages.pdf", "RESOURCE_LIMIT"],
  ] as const) {
    await expect(inspectRotatePdf(fixture(name))).rejects.toMatchObject({ code });
    await expect(rotatePdfPages(fixture(name), [1], 90)).rejects.toMatchObject({ code });
  }
  const source = fixture("split-pages.pdf");
  for (const pages of [[], [6], [2, 1], [1, 1], Array.from({ length: 101 }, (_, i) => i + 1)])
    await expect(rotatePdfPages(source, pages, 90)).rejects.toBeDefined();
  await expect(rotatePdfPages(source, [1], 45)).rejects.toBeDefined();
  await expect(
    rotatePdfPages(
      new File([new Uint8Array(8 * 1024 * 1024 + 1)], "oversized.pdf", {
        type: "application/pdf",
      }),
      [1],
      90,
    ),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT" });
});

it("cancels while reading and allows a clean retry", async () => {
  const source = fixture("split-pages.pdf");
  const controller = new AbortController();
  const read = source.arrayBuffer.bind(source);
  source.arrayBuffer = async () => {
    controller.abort();
    return read();
  };
  await expect(rotatePdfPages(source, [1], 90, controller.signal)).rejects.toMatchObject({
    code: "CANCELLED",
  });
  const retry = await rotatePdfPages(fixture("split-pages.pdf"), [1], 90);
  expect(await PDFDocument.load(await retry.blob.arrayBuffer())).toHaveProperty("getPageCount");
});
