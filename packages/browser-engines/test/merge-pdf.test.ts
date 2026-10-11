import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream, rgb } from "pdf-lib";
import { expect, it } from "vitest";
import { inspectPdfs, mergePdfs } from "../src/merge-pdf.js";

const fixture = (name: string) =>
  new File([new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/pdfs", name)))], name, {
    type: "application/pdf",
  });
async function content(page: import("pdf-lib").PDFPage) {
  const raw = page.doc.context.lookup(page.node.Contents());
  const streams =
    raw instanceof PDFArray ? raw.asArray().map((ref) => page.doc.context.lookup(ref)) : [raw];
  return streams
    .map((stream) => {
      if (!(stream instanceof PDFRawStream)) throw Error("Invalid content");
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    })
    .join("\n");
}
it("merges real A4/Letter/rotation documents without changing content/boxes/image resources", async () => {
  const files = [fixture("rotated.pdf"), fixture("a4.pdf"), fixture("letter.pdf")];
  expect(await inspectPdfs(files)).toEqual([{ pages: 1 }, { pages: 2 }, { pages: 1 }]);
  const expected = [];
  for (const file of files) {
    const pdf = await PDFDocument.load(await file.arrayBuffer());
    for (const page of pdf.getPages())
      expected.push({
        size: page.getSize(),
        crop: page.getCropBox(),
        rotation: page.getRotation(),
        content: await content(page),
      });
  }
  for (let run = 0; run < 2; run++) {
    const result = await mergePdfs(files);
    const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(4);
    for (const [index, page] of pdf.getPages().entries()) {
      expect({
        size: page.getSize(),
        crop: page.getCropBox(),
        rotation: page.getRotation(),
        content: await content(page),
      }).toEqual(expected[index]);
      const resources = page.node.Resources();
      expect(resources?.has(PDFName.of("Font"))).toBe(true);
      expect(resources?.has(PDFName.of("XObject"))).toBe(true);
    }
  }
});
it("rejects corrupt, encrypted, active, empty and excessive-page PDFs safely", async () => {
  for (const [name, code] of [
    ["damaged.pdf", "INVALID_PDF"],
    ["encrypted.pdf", "DOCUMENT_PROTECTED"],
    ["empty-pages.pdf", "INVALID_PDF"],
    ["too-many-pages.pdf", "RESOURCE_LIMIT"],
    ["javascript.pdf", "UNSUPPORTED_FEATURE"],
    ["attachment.pdf", "UNSUPPORTED_FEATURE"],
    ["link.pdf", "UNSUPPORTED_FEATURE"],
    ["form.pdf", "UNSUPPORTED_FEATURE"],
    ["launch.pdf", "UNSUPPORTED_FEATURE"],
    ["layers.pdf", "UNSUPPORTED_FEATURE"],
  ]) {
    if (!name) throw Error("Missing fixture");
    await expect(inspectPdfs([fixture(name)])).rejects.toMatchObject({ code });
  }
});
it("checks cumulative pages, wrong MIME and cancellation during file reads", async () => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 100; i++) pdf.addPage([612, 792]);
  const file = new File([new Uint8Array(await pdf.save())], "synthetic.pdf", {
    type: "application/pdf",
  });
  await expect(inspectPdfs([file, file, file])).rejects.toMatchObject({ code: "RESOURCE_LIMIT" });
  const controller = new AbortController();
  const source = fixture("letter.pdf");
  const read = source.arrayBuffer.bind(source);
  source.arrayBuffer = async () => {
    controller.abort();
    return read();
  };
  await expect(mergePdfs([source, fixture("a4.pdf")], controller.signal)).rejects.toMatchObject({
    code: "CANCELLED",
  });
  await expect(
    inspectPdfs([new File([await file.arrayBuffer()], "synthetic.pdf", { type: "image/png" })]),
  ).rejects.toMatchObject({ code: "INVALID_PDF" });
});
it("rejects excessive page geometry before any preview", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([15000, 792]);
  page.drawRectangle({ x: 0, y: 0, width: 1, height: 1, color: rgb(1, 0, 0) });
  await expect(
    inspectPdfs([
      new File([new Uint8Array(await pdf.save())], "synthetic.pdf", { type: "application/pdf" }),
    ]),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT" });
});
it("rejects oversized image resources and external streams without fetching them", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const image = await pdf.embedJpg(
    new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/images/landscape.jpg"))),
  );
  page.drawImage(image, { x: 0, y: 0, width: 240, height: 120 });
  await pdf.flush();
  const raw = pdf.context.lookup(image.ref);
  if (!(raw instanceof PDFRawStream)) throw Error("Missing JPEG");
  raw.dict.set(PDFName.of("Width"), pdf.context.obj(12_000_001));
  await expect(
    inspectPdfs([
      new File([new Uint8Array(await pdf.save())], "synthetic.pdf", { type: "application/pdf" }),
    ]),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT" });
  raw.dict.set(PDFName.of("Width"), pdf.context.obj(240));
  raw.dict.set(PDFName.of("F"), pdf.context.obj("https://example.invalid/image"));
  await expect(
    inspectPdfs([
      new File([new Uint8Array(await pdf.save())], "synthetic.pdf", { type: "application/pdf" }),
    ]),
  ).rejects.toMatchObject({ code: "UNSUPPORTED_FEATURE" });
});
it("merges Toolbox image PDFs retaining PNG alpha and distinct image resources", async () => {
  const imagePdf = new File(
    [new Uint8Array(readFileSync(resolve("docs/evidence/tbx-004/chromium-mixed-auto.pdf")))],
    "synthetic.pdf",
    { type: "application/pdf" },
  );
  const result = await mergePdfs([imagePdf, fixture("letter.pdf")]);
  const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
  expect(pdf.getPageCount()).toBe(4);
  const images = pdf.getPage(2).node.Resources()?.lookup(PDFName.of("XObject"));
  if (!images || !("values" in images)) throw Error("Missing PNG");
  const image = pdf.context.lookup((images as import("pdf-lib").PDFDict).values()[0]);
  if (!(image instanceof PDFRawStream)) throw Error("Invalid image");
  const mask = pdf.context.lookup(image.dict.get(PDFName.of("SMask")));
  if (!(mask instanceof PDFRawStream)) throw Error("Missing alpha");
  const alpha = decodePDFRawStream(mask).decode();
  expect(alpha[0]).toBe(0);
  expect(alpha[120 * 100 + 50]).toBe(128);
});
