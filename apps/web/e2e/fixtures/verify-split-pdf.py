"""Independently parse and render real Split PDF browser downloads.

Requires pypdf and pypdfium2 in the bundled Python runtime. The ZIP container is
opened with Python's standard library; PDF output is checked independently from
the browser engine's pdf-lib verifier.
"""
from __future__ import annotations

from contextlib import closing
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import json
import sys

import pypdfium2 as pdfium
from pypdf import PdfReader

if len(sys.argv) != 4:
    raise SystemExit("usage: verify-split-pdf.py EXTRACTED.pdf SELECTED.zip ALL.zip")

project = Path(__file__).resolve().parents[4]
fixture = Path(__file__).parent / "pdfs" / "split-pages.pdf"
extract_path, selected_zip_path, all_zip_path = map(Path, sys.argv[1:])
evidence_dir = project / "docs/evidence/tbx-006"
evidence_dir.mkdir(parents=True, exist_ok=True)


def compare_pdf(data: bytes, source_page_numbers: list[int]) -> list[dict[str, object]]:
    result = PdfReader(BytesIO(data), strict=True)
    original = PdfReader(fixture, strict=True)
    assert len(result.pages) == len(source_page_numbers)
    observations: list[dict[str, object]] = []
    for index, source_number in enumerate(source_page_numbers):
        page = result.pages[index]
        reference = original.pages[source_number - 1]
        for box in ("mediabox", "cropbox", "bleedbox", "trimbox", "artbox"):
            assert list(getattr(page, box)) == list(getattr(reference, box)), (index, box)
        assert page.rotation == reference.rotation, (index, "rotation")
        assert page.extract_text() == reference.extract_text(), (index, "text")
        assert page.get_contents().get_data() == reference.get_contents().get_data(), (index, "content")
        observations.append(
            {
                "sourcePage": source_number,
                "mediaBox": [float(value) for value in page.mediabox],
                "cropBox": [float(value) for value in page.cropbox],
                "rotation": page.rotation,
                "textMatches": True,
                "contentStreamMatches": True,
            }
        )
    return observations


source_docs: list[pdfium.PdfDocument] = []
checks: dict[str, object] = {}
with closing(pdfium.PdfDocument(fixture)) as source_doc:
    source_docs.append(source_doc)
    extracted_bytes = extract_path.read_bytes()
    extracted_checks = compare_pdf(extracted_bytes, [1, 2, 4, 5])
    with closing(pdfium.PdfDocument(extracted_bytes)) as extracted:
        for index, source_number in enumerate([1, 2, 4, 5]):
            with closing(extracted[index]) as output_page, closing(source_doc[source_number - 1]) as source_page:
                with closing(output_page.render(scale=1)) as output_bitmap, closing(source_page.render(scale=1)) as source_bitmap:
                    output_image = output_bitmap.to_pil()
                    source_image = source_bitmap.to_pil()
                    assert output_image.size == source_image.size
                    digest = sha256(output_image.tobytes()).hexdigest()
                    assert digest == sha256(source_image.tobytes()).hexdigest(), (index, "render")
                    extracted_checks[index]["pdfiumBitmapSha256"] = digest
                    extracted_checks[index]["renderMatchesSource"] = True

    archive_checks: dict[str, object] = {}
    for archive_path, page_numbers in (
        (selected_zip_path, [1, 4]),
        (all_zip_path, [1, 2, 3, 4, 5]),
    ):
        with ZipFile(archive_path) as archive:
            expected_names = [f"page-{number:03}.pdf" for number in page_numbers]
            assert archive.namelist() == expected_names
            files = []
            for name, source_number in zip(expected_names, page_numbers):
                page_bytes = archive.read(name)
                page_checks = compare_pdf(page_bytes, [source_number])
                with closing(pdfium.PdfDocument(page_bytes)) as output:
                    with closing(output[0]) as output_page, closing(source_doc[source_number - 1]) as source_page:
                        with closing(output_page.render(scale=1)) as output_bitmap, closing(source_page.render(scale=1)) as source_bitmap:
                            output_image = output_bitmap.to_pil()
                            source_image = source_bitmap.to_pil()
                            assert output_image.size == source_image.size
                            digest = sha256(output_image.tobytes()).hexdigest()
                            assert digest == sha256(source_image.tobytes()).hexdigest(), (name, "render")
                files.append(
                    {
                        "name": name,
                        "bytes": len(page_bytes),
                        "sha256": sha256(page_bytes).hexdigest(),
                        "pages": page_checks,
                        "renderMatchesSource": True,
                    }
                )
            archive_checks[archive_path.name] = {
                "bytes": archive_path.stat().st_size,
                "sha256": sha256(archive_path.read_bytes()).hexdigest(),
                "files": files,
            }

    checks = {
        "fixture": fixture.name,
        "fixtureBytes": fixture.stat().st_size,
        "parser": "pypdf 6.10.0: text, content stream, page boxes, rotation and page counts match",
        "zipParser": "Python standard library zipfile: exact page-only entry names and count",
        "renderer": "pypdfium2 independent raster dimensions and SHA-256 match every source page",
        "extract": {
            "bytes": len(extracted_bytes),
            "sha256": sha256(extracted_bytes).hexdigest(),
            "pages": extracted_checks,
        },
        "archives": archive_checks,
    }

(evidence_dir / "independent-verification.json").write_text(
    json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(checks, ensure_ascii=False, indent=2))
