"""Inspect a regular animation grid offline; never installs textures into the game.

Run with `uv run --with pillow python tools/prepare-animation-strip.py --help`.
All poses use one scale and offset. Misaligned or irregular input needs art review.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def visible_bounds(image):
    return image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()


def checked_output(output, root=ROOT):
    output = Path(output).resolve()
    artifacts = (root / "artifacts").resolve()
    if output == artifacts or not output.is_relative_to(artifacts):
        raise ValueError("Output must be a new directory inside this repository's artifacts folder")
    return output


def prepare_strip(source, output, *, columns, rows, frame_size, scale, offset=None):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output.exists():
        raise ValueError(f"Output already exists; choose a new directory: {output}")
    if columns < 1 or rows < 1 or min(frame_size) < 1:
        raise ValueError("Grid and output dimensions must be positive")
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError("Shared scale must be finite and positive")
    before = digest(source)
    with Image.open(source) as image:
        if "A" not in image.getbands():
            raise ValueError("Source must have a real alpha channel")
        sheet = image.convert("RGBA")
    if sheet.width % columns or sheet.height % rows:
        raise ValueError("Source dimensions must be divisible by the grid; review irregular sheets manually")
    if sheet.getchannel("A").getextrema()[0] != 0:
        raise ValueError("Source must contain fully transparent pixels")
    cell_width, cell_height = sheet.width // columns, sheet.height // rows
    scaled = (max(1, round(cell_width * scale)), max(1, round(cell_height * scale)))
    if offset is None:
        offset = ((frame_size[0] - scaled[0]) // 2, (frame_size[1] - scaled[1]) // 2)
    frames, records = [], []
    for i in range(columns * rows):
        x, y = (i % columns) * cell_width, (i // columns) * cell_height
        region = (x, y, x + cell_width, y + cell_height)
        slot = sheet.crop(region)
        bounds = visible_bounds(slot)
        if bounds is None:
            raise ValueError(f"Empty frame {i + 1}")
        if slot.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Frame {i + 1} is not transparent")
        if bounds[0] == 0 or bounds[1] == 0 or bounds[2] == cell_width or bounds[3] == cell_height:
            raise ValueError(f"Frame {i + 1} touches its cell edge; review for clipping or cross-slot content")
        resized = slot.resize(scaled, Image.Resampling.LANCZOS)
        resized_bounds = visible_bounds(resized)
        if resized_bounds is None:
            raise ValueError(f"Frame {i + 1} disappears at the requested scale")
        placed = (
            resized_bounds[0] + offset[0], resized_bounds[1] + offset[1],
            resized_bounds[2] + offset[0], resized_bounds[3] + offset[1],
        )
        if placed[0] <= 0 or placed[1] <= 0 or placed[2] >= frame_size[0] or placed[3] >= frame_size[1]:
            raise ValueError(f"Frame {i + 1} reaches the output edge; choose a smaller shared scale or larger canvas")
        frame = Image.new("RGBA", frame_size)
        frame.alpha_composite(resized, offset)
        frames.append(frame)
        records.append({
            "frame": i + 1, "sourceRegion": list(region),
            "sourceBounds": list(bounds), "outputBounds": list(visible_bounds(frame)),
        })
    if digest(source) != before:
        raise ValueError("Source changed during processing; review before retrying")

    # No writes until every frame has passed validation. Existing results are never replaced.
    output.mkdir(parents=True)
    strip = Image.new("RGBA", (frame_size[0] * len(frames), frame_size[1]))
    contact = Image.new("RGBA", (frame_size[0] * columns, (frame_size[1] + 24) * rows), "#17382f")
    labels = ImageDraw.Draw(contact)
    for i, frame in enumerate(frames):
        frame.save(output / f"{i + 1:02}.png")
        strip.alpha_composite(frame, (i * frame_size[0], 0))
        x, y = (i % columns) * frame_size[0], (i // columns) * (frame_size[1] + 24)
        contact.alpha_composite(frame, (x, y))
        labels.text((x + 8, y + frame_size[1] + 4), f"{i + 1:02}", fill="white")
    strip.save(output / "strip.webp", "WEBP", lossless=True, method=6, exact=True)
    contact.convert("RGB").save(output / "contact-sheet.png")
    report = {
        "sourceSha256": before, "sourceSize": list(sheet.size),
        "grid": [columns, rows], "frameCount": len(frames), "frameSize": list(frame_size),
        "sharedTransform": {"scale": scale, "offset": list(offset)},
        "visibleAlphaThreshold": 8,
        "frames": records, "outputSha256": digest(output / "strip.webp"),
        "reviewRequired": True, "published": False,
    }
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sheet", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path, help="New directory below repository artifacts")
    parser.add_argument("--columns", required=True, type=int)
    parser.add_argument("--rows", required=True, type=int)
    parser.add_argument("--frame-width", required=True, type=int)
    parser.add_argument("--frame-height", required=True, type=int)
    parser.add_argument("--scale", required=True, type=float, help="One shared scale for the entire sheet")
    parser.add_argument("--offset-x", type=int)
    parser.add_argument("--offset-y", type=int)
    args = parser.parse_args()
    if (args.offset_x is None) != (args.offset_y is None):
        parser.error("Provide both --offset-x and --offset-y, or neither to center the entire grid cell")
    offset = None if args.offset_x is None else (args.offset_x, args.offset_y)
    try:
        report = prepare_strip(
            args.sheet, checked_output(args.out), columns=args.columns, rows=args.rows,
            frame_size=(args.frame_width, args.frame_height), scale=args.scale, offset=offset,
        )
    except (ValueError, OSError) as error:
        parser.exit(1, f"Animation preparation failed: {error}\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
