"""Independently verify browser-produced Rotate PDF files with pypdf and PDFium."""
from __future__ import annotations

from contextlib import closing
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import json
import sys

import pypdfium2 as pdfium
from pypdf import PdfReader

if len(sys.argv) != 5:
    raise SystemExit("usage: verify-rotate-pdf.py SELECTED-RIGHT.pdf SELECTED-LEFT.pdf ALL-180.pdf OUTPUT.json")

project = Path(__file__).resolve().parents[4]
fixture = Path(__file__).parent / "pdfs" / "split-pages.pdf"
right_path, left_path, all_path, output_path = map(Path, sys.argv[1:])
source = PdfReader(fixture, strict=True)
box_names = ("mediabox", "cropbox", "bleedbox", "trimbox", "artbox")


def page_delta(output_index: int, changes: dict[int, int]) -> int:
    return changes.get(output_index + 1, 0) % 360


def verify_file(path: Path, changes: dict[int, int]) -> dict[str, object]:
    output = PdfReader(BytesIO(path.read_bytes()), strict=True)
    assert len(output.pages) == len(source.pages), (path.name, "page count")
    pages: list[dict[str, object]] = []
    with closing(pdfium.PdfDocument(fixture)) as source_pdf, closing(
        pdfium.PdfDocument(path)
    ) as output_pdf:
        assert len(output_pdf) == len(source_pdf) == len(output.pages)
        for index, output_page in enumerate(output.pages):
            source_page = source.pages[index]
            expected_rotation = (int(source_page.rotation or 0) + page_delta(index, changes)) % 360
            assert int(output_page.rotation or 0) == expected_rotation, (path.name, index, "rotation")
            for box_name in box_names:
                assert list(getattr(output_page, box_name)) == list(getattr(source_page, box_name)), (
                    path.name,
                    index,
                    box_name,
                )
            assert output_page.extract_text() == source_page.extract_text(), (path.name, index, "text")
            assert output_page.get_contents().get_data() == source_page.get_contents().get_data(), (
                path.name,
                index,
                "content streams",
            )
            with closing(source_pdf[index]) as original, closing(output_pdf[index]) as rotated:
                delta = page_delta(index, changes)
                with closing(original.render(scale=1, rotation=delta)) as expected_bitmap, closing(
                    rotated.render(scale=1)
                ) as rotated_bitmap:
                    expected_image = expected_bitmap.to_pil().convert("RGB")
                    output_image = rotated_bitmap.to_pil().convert("RGB")
                    assert output_image.size == expected_image.size, (path.name, index, "raster size")
                    expected_hash = sha256(expected_image.tobytes()).hexdigest()
                    actual_hash = sha256(output_image.tobytes()).hexdigest()
                    assert actual_hash == expected_hash, (path.name, index, "rotated PDFium raster")
            pages.append(
                {
                    "page": index + 1,
                    "rotation": expected_rotation,
                    "delta": page_delta(index, changes),
                    "boxesMatch": True,
                    "textMatches": True,
                    "contentStreamsMatch": True,
                    "pdfiumRasterSha256": actual_hash,
                    "expectedRasterSha256": expected_hash,
                }
            )
    data = path.read_bytes()
    return {
        "file": path.name,
        "bytes": len(data),
        "sha256": sha256(data).hexdigest(),
        "pages": pages,
    }


result = {
    "fixture": fixture.name,
    "fixtureBytes": fixture.stat().st_size,
    "independentParser": "pypdf: strict parse, count, rotation, boxes, text and decoded content streams",
    "independentRenderer": "PDFium: source render with an additional quarter-turn exactly matches the output render",
    "outputs": {
        "selectedRight": verify_file(right_path, {2: 90, 4: 90}),
        "selectedLeft": verify_file(left_path, {2: -90, 4: -90}),
        "all180": verify_file(all_path, {1: 180, 2: 180, 3: 180, 4: 180, 5: 180}),
    },
}
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
