# Copyright 2026 Oleksandr Maslov
# SPDX-License-Identifier: Apache-2.0
"""Generate the social share cards and the touch/manifest icons.

This is a design tool, not part of `npm run build` — the outputs are committed
and only need regenerating when the mark or the wording changes. Keeping it in
the repo means the cards stay editable instead of being opaque binaries nobody
can reproduce.

    python scripts/generate-social-images.py

Requires Pillow and fontTools (the latter only to unpack the woff2 the app
already ships, so the cards use the same Inter as the product UI).
"""

from __future__ import annotations

import io
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
MASTER = ROOT / "src-tauri" / "icons" / "icon.png"

# Matches --surface-canvas in src/design-system/tokens.css, so a card dropped
# into a dark messenger sits on the same black the app itself uses.
CANVAS = (12, 13, 14)
TITLE_INK = (245, 247, 250)
BODY_INK = (138, 144, 153)

# Cards render at 2x and downsample, which is cheaper than fighting Pillow's
# aliasing on the rounded corners and the hairline border.
SS = 2

TITLE = "Wafer Studio"
TAGLINE = "Keymap editor for ZMK Studio keyboards"
DOWNLOAD_TAGLINE = "Desktop app for macOS, Windows and Linux"


def load_inter() -> io.BytesIO:
    """Unpack the shipped woff2 into a TTF buffer Pillow can open."""
    font = TTFont(PUBLIC / "Inter.woff2")
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    return buf


_INTER = load_inter()


def inter(size: int, weight: int) -> ImageFont.FreeTypeFont:
    _INTER.seek(0)
    font = ImageFont.truetype(_INTER, size)
    # Axis order follows the font's fvar table: opsz, then wght. Optical size
    # tracks the rendered size so large text does not inherit UI-size spacing.
    font.set_variation_by_axes([min(32.0, max(14.0, float(size))), float(weight)])
    return font


def radial_glow(size: tuple[int, int], peak: float, power: float = 2.4) -> Image.Image:
    """A soft falloff, used to lift the mark off a flat black field.

    Stretched to the full canvas rather than pasted as a smaller square: at
    these near-black levels a gradient that stops short leaves its bounding box
    visible as a hard one-level step, which is exactly the banding artefact
    flat dark backgrounds are prone to. The power curve pulls the light back
    into the centre so the reach costs no brightness at the edges.
    """
    grad = Image.radial_gradient("L").resize(size, Image.LANCZOS)
    return Image.eval(
        grad, lambda v: int((((255 - v) / 255.0) ** power) * peak * 255)
    )


def icon_tile(px: int) -> Image.Image:
    """The app icon with a hairline edge so it reads as a tile, not a smudge.

    The icon's own background is within a couple of levels of the card canvas,
    so without the border the rounded square dissolves and the mark looks like
    it is floating in the middle of nowhere.
    """
    tile = Image.open(MASTER).convert("RGBA").resize((px, px), Image.LANCZOS)
    edge = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(
        (0, 0, px - 1, px - 1),
        radius=int(px * 0.225),
        outline=(255, 255, 255, 20),
        width=max(1, px // 200),
    )
    return Image.alpha_composite(tile, edge)


def card(tagline: str, out: Path) -> None:
    """A 1200x630 share card.

    Everything sits in a centred column roughly 630px wide. Messengers do not
    agree on crop: Slack, Discord and X show the full 1.91:1, while WhatsApp
    and Telegram often square it off. A centred stack survives both, where a
    left-aligned banner loses its wordmark to the square crop.
    """
    w, h = 1200 * SS, 630 * SS
    img = Image.new("RGB", (w, h), CANVAS)

    glow = radial_glow((w, h), 0.20)
    img.paste(Image.new("RGB", (w, h), (150, 190, 255)), (0, 0), glow)

    tile_px = int(168 * SS)
    tile = icon_tile(tile_px)

    title_font = inter(int(62 * SS), 800)
    body_font = inter(int(25 * SS), 400)

    draw = ImageDraw.Draw(img)
    title_box = draw.textbbox((0, 0), TITLE, font=title_font)
    body_box = draw.textbbox((0, 0), tagline, font=body_font)
    title_h = title_box[3] - title_box[1]
    body_h = body_box[3] - body_box[1]

    gap_tile, gap_text = int(38 * SS), int(20 * SS)
    total = tile_px + gap_tile + title_h + gap_text + body_h
    y = (h - total) // 2

    img.paste(tile, ((w - tile_px) // 2, y), tile)
    y += tile_px + gap_tile

    draw.text(
        ((w - (title_box[2] - title_box[0])) // 2, y - title_box[1]),
        TITLE,
        font=title_font,
        fill=TITLE_INK,
    )
    y += title_h + gap_text

    draw.text(
        ((w - (body_box[2] - body_box[0])) // 2, y - body_box[1]),
        tagline,
        font=body_font,
        fill=BODY_INK,
    )

    img.resize((1200, 630), Image.LANCZOS).save(out, optimize=True)
    print(f"{out.relative_to(ROOT)}  1200x630  {out.stat().st_size // 1024} KB")


def touch_icon(out: Path, px: int = 180) -> None:
    """iOS ignores transparency and composites the home-screen icon on white,
    which would ring this dark mark in a bright halo. Flatten it onto the
    icon's own background first, and let iOS apply its own corner mask."""
    src = Image.open(MASTER).convert("RGBA")
    backdrop = src.getpixel((src.width // 2, 4))[:3]
    flat = Image.new("RGB", src.size, backdrop)
    flat.paste(src, (0, 0), src)
    flat.resize((px, px), Image.LANCZOS).save(out, optimize=True)
    print(f"{out.relative_to(ROOT)}  {px}x{px}  {out.stat().st_size // 1024} KB")


def manifest_icon(out: Path, px: int) -> None:
    src = Image.open(MASTER).convert("RGBA")
    src.resize((px, px), Image.LANCZOS).save(out, optimize=True)
    print(f"{out.relative_to(ROOT)}  {px}x{px}  {out.stat().st_size // 1024} KB")


def maskable_icon(out: Path, px: int = 512) -> None:
    """Android crops maskable icons to a launcher-chosen shape — circle,
    squircle, teardrop — so the artwork has to bleed to all four edges and keep
    anything meaningful inside the middle 80%. The standard tile fails both:
    its corners are transparent, which a square mask would render as a dark
    tile floating on nothing. Flatten it and inset the mark instead.
    """
    src = Image.open(MASTER).convert("RGBA")
    backdrop = src.getpixel((src.width // 2, 4))[:3]
    canvas = Image.new("RGB", (px, px), backdrop)
    inner = int(px * 0.80)
    tile = src.resize((inner, inner), Image.LANCZOS)
    off = (px - inner) // 2
    canvas.paste(tile, (off, off), tile)
    canvas.save(out, optimize=True)
    print(f"{out.relative_to(ROOT)}  {px}x{px} maskable  {out.stat().st_size // 1024} KB")


def favicon(out: Path) -> None:
    """A multi-resolution ICO, referenced explicitly by <link>.

    The usual argument for shipping one — that browsers probe /favicon.ico by
    convention — does not apply on project pages, where that probe lands on the
    origin root this project does not control. It earns its place instead by
    carrying hand-checked 16 and 32px bitmaps rather than leaving a 512px PNG
    to be downsampled by whichever tool happens to be asking.
    """
    src = Image.open(MASTER).convert("RGBA")
    src.save(out, sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"{out.relative_to(ROOT)}  16/32/48  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    card(TAGLINE, PUBLIC / "og-card.png")
    card(DOWNLOAD_TAGLINE, PUBLIC / "og-card-download.png")
    touch_icon(PUBLIC / "apple-touch-icon.png")
    manifest_icon(PUBLIC / "icon-192.png", 192)
    manifest_icon(PUBLIC / "icon-512.png", 512)
    maskable_icon(PUBLIC / "icon-maskable-512.png")
    favicon(PUBLIC / "favicon.ico")
