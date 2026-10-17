import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { expect, it } from "vitest";
import { extractPdfPages, inspectPdf, splitPdfPages } from "../src/split-pdf.js";

const fixture = (name: string) =>
  new File([new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/pdfs", name)))], name, {
    type: "application/pdf",
  });
function content(page: import("pdf-lib").PDFPage) {
  const raw = page.doc.context.lookup(page.node.Contents());
  const streams =
    raw instanceof PDFArray ? raw.asArray().map((ref) => page.doc.context.lookup(ref)) : [raw];
  return streams
    .map((stream) => {
      if (!(stream instanceof PDFRawStream)) throw Error("Missing page content");
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    })
    .join("\n");
}

it("inspects and extracts one or selected rotated pages with geometry and text intact", async () => {
  const source = fixture("split-pages.pdf");
  expect(await inspectPdf(source)).toEqual({ pages: 5, bytes: source.size });
  const original = await PDFDocument.load(await source.arrayBuffer());
  for (const selected of [[4], [1, 4]]) {
    const result = await extractPdfPages(source, selected);
    expect(result).toMatchObject({ mode: "extract", pages: selected.length, files: 1 });
    expect(result.blob.type).toBe("application/pdf");
    expect(result.blob.size).toBeLessThanOrEqual(8 * 1024 * 1024);
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(output.getPageCount()).toBe(selected.length);
    for (const [index, sourceIndex] of selected.entries()) {
      const page = output.getPage(index);
      const sourcePage = original.getPage(sourceIndex - 1);
      expect(page.getMediaBox()).toEqual(sourcePage.getMediaBox());
      expect(page.getCropBox()).toEqual(sourcePage.getCropBox());
      expect(page.getRotation()).toEqual(sourcePage.getRotation());
    }
    expect(content(output.getPage(0))).toContain("SYNTHETIC");
  }
});

it("splits selected and all pages into integrity-checked safe ZIP entries", async () => {
  const source = new File(
    [new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/pdfs", "split-pages.pdf")))],
    "../../private-name.pdf",
    { type: "application/pdf" },
  );
  for (const selected of [
    [1, 4],
    [1, 2, 3, 4, 5],
  ]) {
    const result = await splitPdfPages(source, selected);
    expect(result).toMatchObject({ mode: "split", pages: selected.length, files: selected.length });
    expect(result.blob.type).toBe("application/zip");
    expect(result.blob.size).toBeLessThanOrEqual(8 * 1024 * 1024);
    const entries = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    expect(Object.keys(entries)).toEqual(
      selected.map((page) => `page-${String(page).padStart(3, "0")}.pdf`),
    );
    for (const pageNumber of selected) {
      const bytes = entries[`page-${String(pageNumber).padStart(3, "0")}.pdf`];
      if (!bytes) throw Error("Missing generated page");
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(1);
      const expected = await PDFDocument.load(await fixture("split-pages.pdf").arrayBuffer());
      expect(pdf.getPage(0).getMediaBox()).toEqual(expected.getPage(pageNumber - 1).getMediaBox());
      expect(pdf.getPage(0).getRotation()).toEqual(expected.getPage(pageNumber - 1).getRotation());
      expect(content(pdf.getPage(0))).toContain("SYNTHETIC");
    }
  }
});

it("stops before the verified ZIP exceeds its cumulative output limit", async () => {
  await expect(
    splitPdfPages(fixture("split-large-output.pdf"), [1, 2, 3, 4, 5]),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT" });
});

it("rejects unsupported, damaged and encrypted inputs and stale cancellation", async () => {
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
    await expect(extractPdfPages(fixture(name), [1])).rejects.toMatchObject({ code });
    await expect(splitPdfPages(fixture(name), [1])).rejects.toMatchObject({ code });
  }
  const source = fixture("split-pages.pdf");
  const controller = new AbortController();
  const read = source.arrayBuffer.bind(source);
  source.arrayBuffer = async () => {
    controller.abort();
    return read();
  };
  await expect(extractPdfPages(source, [1], controller.signal)).rejects.toMatchObject({
    code: "CANCELLED",
  });
});

it("repeats extraction and rejects empty, out-of-range, unordered and duplicate selections", async () => {
  const source = fixture("split-pages.pdf");
  const first = await extractPdfPages(source, [1, 4]);
  const second = await extractPdfPages(source, [1, 4]);
  expect(await first.blob.arrayBuffer()).toEqual(await second.blob.arrayBuffer());
  for (const pages of [[], [6], [4, 1], [1, 1], Array.from({ length: 101 }, (_, i) => i + 1)])
    await expect(extractPdfPages(source, pages)).rejects.toBeDefined();
});
