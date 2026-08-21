#!/usr/bin/env python3
"""Generate PWA icons (cat-ear shopping bag mark) from code.

Run: python3 scripts/generate_icons.py
Outputs into public/icons/.
"""
import os
from PIL import Image, ImageDraw

BRAND = (0, 72, 180, 255)
WHITE = (255, 255, 255, 255)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")


def draw_mark(size, padding_ratio, rounded):
    """Draw the logo mark on a brand-blue canvas."""
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BRAND)
    else:
        d.rectangle([0, 0, s - 1, s - 1], fill=BRAND)

    # Safe area for maskable icons.
    pad = int(s * padding_ratio)
    inner = s - pad * 2

    bag_w = int(inner * 0.62)
    bag_h = int(inner * 0.52)
    bag_x = pad + (inner - bag_w) // 2
    bag_y = pad + int(inner * 0.40)

    # Bag body.
    d.rounded_rectangle(
        [bag_x, bag_y, bag_x + bag_w, bag_y + bag_h],
        radius=int(bag_w * 0.16),
        fill=WHITE,
    )

    # Handle: an arc above the bag.
    handle_w = int(bag_w * 0.52)
    handle_h = int(bag_h * 0.62)
    hx = bag_x + (bag_w - handle_w) // 2
    hy = bag_y - handle_h // 2
    d.arc(
        [hx, hy, hx + handle_w, hy + handle_h],
        start=180, end=360,
        fill=WHITE, width=max(2, int(s * 0.028)),
    )

    # Cat ears on the bag's top corners.
    ear = int(bag_w * 0.26)
    d.polygon(
        [(bag_x + int(bag_w * 0.04), bag_y + int(ear * 0.35)),
         (bag_x + int(bag_w * 0.06), bag_y - ear),
         (bag_x + int(bag_w * 0.34), bag_y + int(ear * 0.30))],
        fill=WHITE,
    )
    d.polygon(
        [(bag_x + bag_w - int(bag_w * 0.04), bag_y + int(ear * 0.35)),
         (bag_x + bag_w - int(bag_w * 0.06), bag_y - ear),
         (bag_x + bag_w - int(bag_w * 0.34), bag_y + int(ear * 0.30))],
        fill=WHITE,
    )

    # Face: two eyes and a nose, punched out in brand blue.
    eye_r = int(bag_w * 0.055)
    eye_y = bag_y + int(bag_h * 0.42)
    for dx in (-int(bag_w * 0.17), int(bag_w * 0.17)):
        cx = bag_x + bag_w // 2 + dx
        d.ellipse([cx - eye_r, eye_y - eye_r, cx + eye_r, eye_y + eye_r], fill=BRAND)
    nose = int(bag_w * 0.05)
    nx = bag_x + bag_w // 2
    ny = eye_y + int(bag_h * 0.18)
    d.polygon([(nx - nose, ny - nose), (nx + nose, ny - nose), (nx, ny + nose)], fill=BRAND)

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    targets = [
        ("icon-192.png", 192, 0.10, False),
        ("icon-512.png", 512, 0.10, False),
        ("icon-maskable-192.png", 192, 0.20, False),
        ("icon-maskable-512.png", 512, 0.20, False),
        ("apple-touch-icon.png", 180, 0.10, False),
    ]
    for name, size, pad, rounded in targets:
        draw_mark(size, pad, rounded).save(os.path.join(OUT, name))
        print("wrote", name)


if __name__ == "__main__":
    main()
