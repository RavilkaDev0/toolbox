"""Deterministic, synthetic fixtures. No user images or metadata."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).parent / "images"
root.mkdir(exist_ok=True)
image = Image.new("RGB", (240, 120), "#dc2626")
draw = ImageDraw.Draw(image)
draw.rectangle((0, 0, 39, 119), fill="#172554")
draw.text((70, 45), "JPEG 240x120", fill="white")
image.save(root / "landscape.jpg", quality=95)
image.save(root / "landscape.png")
portrait = Image.new("RGB", (120, 240), "#2563eb")
ImageDraw.Draw(portrait).rectangle((30, 30, 89, 209), fill="#22c55e")
portrait.save(root / "portrait.jpg", quality=95)
image = Image.new("RGBA", (120, 240), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rectangle((30, 30, 89, 209), fill=(22, 163, 74, 128))
image.save(root / "transparent.png")
image.save(root / "transparent.webp", quality=80)
image.save(root / "animated.png", save_all=True, append_images=[Image.new("RGBA", (120, 240), "blue")], duration=100, loop=0)
corrupt = bytearray((root / "transparent.png").read_bytes())
corrupt[corrupt.index(b"IDAT") + 4] = 0
(root / "corrupt-pixels.png").write_bytes(corrupt)
image = Image.new("RGB", (160, 160), "#2563eb")
ImageDraw.Draw(image).text((35, 70), "WEBP", fill="white")
image.save(root / "square.webp", lossless=True)
image.save(root / "lossy.webp", quality=80)
oriented = Image.new("RGB", (80, 40), "#f59e0b")
ImageDraw.Draw(oriented).rectangle((0, 0, 19, 39), fill="#172554")
exif = Image.Exif()
exif[274] = 6
oriented.save(root / "oriented.jpg", exif=exif)
(root / "damaged.png").write_bytes((root / "transparent.png").read_bytes()[:40])
# Valid header/chunks but impossible dimensions: refused before decoder allocation.
oversized = bytearray((root / "transparent.png").read_bytes())
oversized[16:20] = (8193).to_bytes(4, "big")
(root / "oversized.png").write_bytes(oversized)
image = Image.new("RGB", (64, 64), "red")
image.save(root / "animated.webp", save_all=True, append_images=[Image.new("RGB", (64, 64), "blue")], duration=100, loop=0)
# Performance samples retain photographic-like entropy without personal content.
for width, height in [(800, 600), (2000, 1500), (4000, 3000)]:
    import random
    rng = random.Random(42)
    sample = Image.frombytes("RGB", (width, height), rng.randbytes(width * height * 3))
    sample.save(root / f"noise-{width}.jpg", quality=75)
    if width < 4000:
        sample.save(root / f"noise-{width}.png", optimize=True)
