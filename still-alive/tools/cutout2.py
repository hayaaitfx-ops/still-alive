"""
Recorta o fundo branco de uma arte de mangá sem apagar o branco interno.

Diferente de um threshold simples (que apagaria o cabelo branco do personagem),
este script faz um flood fill a partir das bordas: só o branco que está
conectado ao exterior vira transparência. O branco preso dentro do desenho
(cabelo, rosto, dentes) continua opaco.

Uso (na pasta still-alive):
    python tools/cutout2.py assets/ichigo-src.png assets/ichigo.png
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

WHITE = 238      # acima disso = branco
BG = 128         # marca do flood fill


def cut(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGB")
    w, h = im.size

    mask = im.convert("L").point(lambda v: 255 if v >= WHITE else 0)

    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    for seed in seeds:
        if mask.getpixel(seed) == 255:
            ImageDraw.floodfill(mask, seed, BG, thresh=0)

    alpha = mask.point(lambda v: 0 if v == BG else 255)

    out = im.convert("RGBA")
    out.putalpha(alpha)

    box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        out = out.crop(box)

    out.save(dst, optimize=True)

    total = w * h
    clear = sum(1 for v in alpha.getdata() if v == 0)
    print(f"{src.name} -> {dst.name}  {out.size[0]}x{out.size[1]}  fundo removido: {100*clear/total:.0f}%")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("uso: python tools/cutout2.py entrada.png saida.png")
        raise SystemExit(1)
    cut(Path(sys.argv[1]), Path(sys.argv[2]))