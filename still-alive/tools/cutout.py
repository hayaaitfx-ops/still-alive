"""
Turn a black-ink-on-white image into a transparent PNG for the HOLLOW world.

Usage (from the still-alive folder):
    python tools/cutout.py assets/mask-src.png assets/mask.png
    python tools/cutout.py assets/blade-src.png assets/blade.png

With no arguments it looks for assets/{mask,blade}-src.{png,jpg,jpeg,webp}
and writes assets/{mask,blade}.png. White becomes transparent, so the art
sits on any light background without a box around it.
"""

import sys
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "assets"
PAIRS = {"mask": ("mask-src", "mask"), "blade": ("blade-src", "blade")}


def cutout(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    gray = im.convert("L")

    # Dark pixels become opaque, white becomes transparent.
    alpha = gray.point(lambda v: max(0, min(255, int((255 - v - 10) * 1.12))))

    # Flatten the colour to pure ink: the fills are white inside the art.
    ink = Image.new("RGBA", im.size, (10, 10, 10, 255))
    ink.putalpha(alpha)

    box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        ink = ink.crop(box)

    ink.save(dst, optimize=True)
    print(f"{src.name} -> {dst.name}  {ink.size[0]}x{ink.size[1]}")


def main() -> int:
    if len(sys.argv) == 3:
        cutout(Path(sys.argv[1]), Path(sys.argv[2]))
        return 0

    found = 0
    for stem, out in PAIRS.values():
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            src = ASSETS / f"{stem}{ext}"
            if src.exists():
                cutout(src, ASSETS / f"{out}.png")
                found += 1
                break
    if not found:
        print("No source images found. Drop them in assets/ as mask-src.png / blade-src.png.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
