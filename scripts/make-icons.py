"""Generate the placeholder app icons in public/icons/.

Placeholder design: four rounded tiles (the app's modules) on an indigo square.
Replace this script's output with a real icon later; file names must stay the same.

Usage: python3 scripts/make-icons.py   (needs Pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw

BG = (79, 70, 229)  # indigo-600
TILE = (255, 255, 255)
ACCENT = (165, 180, 252)  # indigo-300
SCALE = 4  # draw large, then downsample for smooth edges

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"


def draw_icon(size: int, content_ratio: float) -> Image.Image:
    """Draw the icon; content_ratio is the share of the canvas the tile grid spans."""
    big = size * SCALE
    img = Image.new("RGB", (big, big), BG)
    d = ImageDraw.Draw(img)
    grid = big * content_ratio
    gap = grid * 0.12
    tile = (grid - gap) / 2
    radius = tile * 0.24
    x0 = (big - grid) / 2
    y0 = (big - grid) / 2
    for row in range(2):
        for col in range(2):
            x = x0 + col * (tile + gap)
            y = y0 + row * (tile + gap)
            fill = ACCENT if (row, col) == (0, 1) else TILE
            d.rounded_rectangle([x, y, x + tile, y + tile], radius=radius, fill=fill)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Regular icons: iOS and browsers apply their own rounded mask.
    for size in (192, 512):
        draw_icon(size, 0.56).save(OUT / f"icon-{size}.png", optimize=True)
    draw_icon(180, 0.56).save(OUT / "apple-touch-icon.png", optimize=True)
    # Maskable icon: keep the artwork inside the central 80% safe zone.
    draw_icon(512, 0.46).save(OUT / "icon-maskable-512.png", optimize=True)
    draw_icon(64, 0.62).save(OUT / "favicon-64.png", optimize=True)
    print(f"Icons written to {OUT}")


if __name__ == "__main__":
    main()
