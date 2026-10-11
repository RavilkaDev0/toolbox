"""Independent check of the synthetic ordered-merge download using pypdf/PDFium.

Manual verification utility; uses the bundled Python runtime, not web dependencies.
"""
from pathlib import Path
from contextlib import closing
import argparse
import hashlib
import json
import pypdfium2 as pdfium
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument("pdf", type=Path)
args = parser.parse_args()
project = Path(__file__).resolve().parents[4]
sources = [Path(__file__).parent / "pdfs" / name for name in ["rotated.pdf", "a4.pdf"]]
expected = [page for source in sources for page in PdfReader(source).pages]
actual = PdfReader(args.pdf)
assert len(actual.pages) == len(expected) == 3
evidence = project / "docs/evidence/tbx-005"
evidence.mkdir(exist_ok=True)
checks = []
for index, (page, original) in enumerate(zip(actual.pages, expected)):
    assert page.extract_text() == original.extract_text()
    assert list(page.mediabox) == list(original.mediabox)
    assert list(page.cropbox) == list(original.cropbox)
    assert page.rotation == original.rotation
    assert page.get_contents().get_data() == original.get_contents().get_data()
    checks.append({
        "page": index + 1,
        "text": page.extract_text().strip(),
        "mediaBox": [float(x) for x in page.mediabox],
        "cropBox": [float(x) for x in page.cropbox],
        "rotation": page.rotation,
    })
with closing(pdfium.PdfDocument(args.pdf)) as output:
    source_docs = [pdfium.PdfDocument(source) for source in sources]
    try:
        render_pages = [(source_docs[0], 0), (source_docs[1], 0), (source_docs[1], 1)]
        for index, (source, source_index) in enumerate(render_pages):
            with closing(output[index]) as page, closing(source[source_index]) as original:
                with closing(page.render(scale=1)) as bitmap, closing(original.render(scale=1)) as reference:
                    image, reference_image = bitmap.to_pil(), reference.to_pil()
                    assert image.size == reference_image.size
                    digest = hashlib.sha256(image.tobytes()).hexdigest()
                    assert digest == hashlib.sha256(reference_image.tobytes()).hexdigest()
                    checks[index]["pdfiumSize"] = list(page.get_size())
                    checks[index]["renderMatchesOriginal"] = True
                    checks[index]["bitmapSha256"] = digest
                    image.save(evidence / f"pdfium-page-{index + 1}.png")
    finally:
        for document in source_docs:
            document.close()
result = {
    "pdfBytes": args.pdf.stat().st_size,
    "pdfSha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(),
    "pages": checks,
    "renderer": "PDFium independent bitmap hashes match all original pages",
    "parser": "pypdf independent text/geometry/content checks",
}
(evidence / "independent-verification.json").write_text(
    json.dumps(result, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(result, indent=2))
