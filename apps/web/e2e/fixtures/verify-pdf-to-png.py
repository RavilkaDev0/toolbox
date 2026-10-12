"""Check browser PDF-to-PNG output against an independent PDFium renderer."""
from __future__ import annotations

from contextlib import closing
from io import BytesIO
from pathlib import Path
import json
import sys
import zipfile

from PIL import Image, ImageChops, ImageStat
import pypdfium2 as pdfium
from pypdf import PdfReader


if len(sys.argv) != 6:
    raise SystemExit("usage: verify-pdf-to-png.py SOURCE.pdf OUTPUT.png|zip DPI PAGES REPORT.json")

source_path, output_path = map(Path, sys.argv[1:3])
dpi = int(sys.argv[3])
selected = [int(value) for value in sys.argv[4].split(",")]
report_path = Path(sys.argv[5])
assert dpi in (96, 192)
assert selected and selected == sorted(set(selected))
reader = PdfReader(source_path, strict=True)
assert 1 <= min(selected) and max(selected) <= len(reader.pages)

if output_path.suffix.lower() == ".zip":
    with zipfile.ZipFile(output_path) as archive:
        expected_names = [f"page-{page:03}.png" for page in selected]
        assert archive.namelist() == expected_names
        png_bytes = [archive.read(name) for name in expected_names]
else:
    assert len(selected) == 1
    png_bytes = [output_path.read_bytes()]

pages: list[dict[str, object]] = []
with closing(pdfium.PdfDocument(source_path)) as document:
    assert len(document) == len(reader.pages)
    for page_number, data in zip(selected, png_bytes, strict=True):
        with Image.open(BytesIO(data)) as decoded:
            decoded.load()
            output = decoded.convert("RGBA")
        with closing(document[page_number - 1]) as source_page:
            bitmap = source_page.render(scale=dpi / 72)
            try:
                expected = bitmap.to_pil().convert("RGB")
            finally:
                bitmap.close()
        # PDF.js and PDFium can round edge pixels differently by one pixel.
        assert abs(output.width - expected.width) <= 1, (page_number, output.size, expected.size)
        assert abs(output.height - expected.height) <= 1, (page_number, output.size, expected.size)
        output_rgb = Image.alpha_composite(Image.new("RGBA", output.size, "white"), output).convert("RGB")
        if output_rgb.size != expected.size:
            output_rgb = output_rgb.resize(expected.size, Image.Resampling.BILINEAR)
        difference = ImageChops.difference(output_rgb, expected)
        mean_absolute_error = sum(ImageStat.Stat(difference).mean) / 3
        differing_pixels = sum(difference.convert("L").point(lambda value: 255 if value > 48 else 0).histogram()[1:])
        differing_ratio = differing_pixels / (expected.width * expected.height)
        assert mean_absolute_error <= 12, (page_number, "renderer mean absolute error", mean_absolute_error)
        assert differing_ratio <= 0.08, (page_number, "renderer pixel difference", differing_ratio)
        pages.append(
            {
                "page": page_number,
                "pngBytes": len(data),
                "pngPixels": list(output.size),
                "pdfiumPixels": list(expected.size),
                "meanAbsoluteError": round(mean_absolute_error, 4),
                "pixelsOver48DifferenceRatio": round(differing_ratio, 6),
            }
        )

report = {
    "sourceBytes": source_path.stat().st_size,
    "outputBytes": output_path.stat().st_size,
    "dpi": dpi,
    "selectedPages": selected,
    "independentRenderer": "PDFium via pypdfium2",
    "independentContainerParser": "Python zipfile" if output_path.suffix.lower() == ".zip" else "PNG decoder via Pillow",
    "pages": pages,
}
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
