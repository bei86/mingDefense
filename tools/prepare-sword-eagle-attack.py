"""Normalize the reviewed eagle sheet offline; inspect previews before --publish.

Run: uv run --with pillow python -B tools/prepare-sword-eagle-attack.py
"""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/img/animations/sword_eagle/attack-sheet-raw.png"
SOURCE_HASH = "97d94e51145d9a62ad0f738a0e4dba9e4d7d448e92dbe2b26ef269413bb29cb2"
PREVIEW = ROOT / "artifacts/sword-eagle-attack"
SIZE = (448, 352)
SCALE = 0.625
ANCHOR = (240, 224)
ORIGIN = (240, 180)
# In each nominal 512px slot: reviewed breast centers, independent of moving wing tips.
BODY_POINTS = [(300, 312), (304, 313), (306, 313), (286, 309), (303, 309), (307, 309)]
# Fourth wing reaches x565; the next bird starts at x568. Never split that wing at x512.
REGIONS = [(0, 0, 512, 512), (512, 0, 1024, 512), (1024, 0, 1536, 512),
           (0, 512, 567, 1024), (567, 512, 1024, 1024), (1024, 512, 1536, 1024)]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(image, threshold=8):
    return image.getchannel("A").point(lambda value: 255 if value > threshold else 0).getbbox()


def prepare(publish=False):
    if digest(SOURCE) != SOURCE_HASH:
        raise ValueError("Source changed; review the sheet before using these cut lines and anchors")
    with Image.open(SOURCE) as original:
        if original.mode != "RGBA" or original.size != (1536, 1024):
            raise ValueError("Expected the reviewed 1536x1024 RGBA sheet")
        source = original.copy()
    # Remove only the near-transparent background residue; do not key by feather color.
    source.putalpha(source.getchannel("A").point(lambda value: 0 if value <= 8 else value))
    frames, records = [], []
    for i, (region, point) in enumerate(zip(REGIONS, BODY_POINTS)):
        piece = source.crop(region)
        visible = bounds(piece)
        if not visible or piece.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Frame {i + 1} is empty or lacks real transparency")
        if visible[0] <= 0 or visible[1] <= 0 or visible[2] >= piece.width or visible[3] >= piece.height:
            raise ValueError(f"Cut line clips frame {i + 1}")
        # Common virtual slot leaves room for the extended fourth wing. Never crop-to-fit.
        slot = Image.new("RGBA", (640, 512))
        nominal_x = (i % 3) * 512
        slot.alpha_composite(piece, (region[0] - nominal_x + 64, 0))
        resized = slot.resize((400, 320), Image.Resampling.LANCZOS)
        offset = (round(ANCHOR[0] - (point[0] + 64) * SCALE),
                  round(ANCHOR[1] - point[1] * SCALE))
        rb = bounds(resized)
        placed = (rb[0] + offset[0], rb[1] + offset[1], rb[2] + offset[0], rb[3] + offset[1])
        if placed[0] <= 0 or placed[1] <= 0 or placed[2] >= SIZE[0] or placed[3] >= SIZE[1]:
            raise ValueError(f"Normalized frame {i + 1} would be clipped")
        frame = Image.new("RGBA", SIZE)
        frame.alpha_composite(resized, offset)
        frames.append(frame)
        records.append({"frame": i + 1, "sourceRegion": region, "sourceBounds": visible,
                        "bodyPointInNominalSlot": point, "offset": offset,
                        "alignedBodyPoint": [(point[0] + 64) * SCALE + offset[0],
                                             point[1] * SCALE + offset[1]],
                        "outputBounds": bounds(frame)})
    union = (min(bounds(frame)[0] for frame in frames), min(bounds(frame)[1] for frame in frames),
             max(bounds(frame)[2] for frame in frames), max(bounds(frame)[3] for frame in frames))
    # Fit the whole motion around a fixed origin so crest/wing tips stay inside the 2x2 area.
    body_size = (2 * max(ORIGIN[0] - union[0], union[2] - ORIGIN[0]),
                 2 * max(ORIGIN[1] - union[1], union[3] - ORIGIN[1]))
    PREVIEW.mkdir(parents=True, exist_ok=True)
    strip = Image.new("RGBA", (SIZE[0] * 6, SIZE[1]))
    contact = Image.new("RGBA", (SIZE[0] * 3, (SIZE[1] + 124) * 2), "#e0dbc8")
    draw = ImageDraw.Draw(contact)
    playback = []
    for i, frame in enumerate(frames):
        frame.save(PREVIEW / f"{i + 1:02}.png")
        strip.alpha_composite(frame, (i * SIZE[0], 0))
        x, y = (i % 3) * SIZE[0], (i // 3) * (SIZE[1] + 124)
        contact.alpha_composite(frame, (x, y))
        draw.line((x + ANCHOR[0] - 8, y + ANCHOR[1], x + ANCHOR[0] + 8, y + ANCHOR[1]), fill="red")
        draw.text((x + 12, y + SIZE[1]), f"{i + 1:02} / 06 | fixed body center | 2x2 fit below", fill="#17382f")
        small = Image.new("RGBA", (104, 104), "#21473b")
        sd = ImageDraw.Draw(small)
        for pos in [0, 52, 103]:
            sd.line((pos, 0, pos, 103), fill="#638376")
            sd.line((0, pos, 103, pos), fill="#638376")
        scale = min(94 / body_size[0], 88 / body_size[1])
        miniature = frame.resize((round(SIZE[0] * scale), round(SIZE[1] * scale)), Image.Resampling.LANCZOS)
        small.alpha_composite(miniature, (round(52 - ORIGIN[0] * scale), round(52 - ORIGIN[1] * scale)))
        contact.alpha_composite(small, (x + 12, y + SIZE[1] + 18))
        background = Image.new("RGBA", SIZE, "#21473b")
        background.alpha_composite(frame)
        playback.append(background.convert("RGB"))
    contact.convert("RGB").save(PREVIEW / "contact-sheet.png")
    for name, duration in [("attack", 70), ("attack-slow", 220)]:
        playback[0].save(PREVIEW / f"{name}.gif", save_all=True, append_images=playback[1:],
                         duration=[duration] * 5 + [duration * 4], loop=0, disposal=2)
    output = PREVIEW / "attack.webp"
    strip.save(output, "WEBP", lossless=True, method=6, exact=True)
    with Image.open(output) as decoded:
        if decoded.convert("RGBA").tobytes() != strip.tobytes():
            raise ValueError("Lossless strip must round-trip exact RGBA pixels")
    report = {"sourceSha256": SOURCE_HASH, "sourceSize": source.size, "frameCount": 6,
              "frameSize": SIZE, "sharedScale": SCALE, "virtualSlotSize": [640, 512],
              "clearedAlphaMaximum": 8, "referenceBodySize": body_size,
              "originPixels": ORIGIN, "bodyAnchorPixels": ANCHOR,
              "motionBounds": union, "anchorKind": "reviewed-breast-center",
              "frames": records, "outputSha256": digest(output), "published": publish}
    if digest(SOURCE) != SOURCE_HASH:
        raise ValueError("Raw source changed")
    report_text = json.dumps(report, indent=2) + "\n"
    (PREVIEW / "preparation.json").write_text(report_text, encoding="utf-8")
    if publish:
        prepared = ROOT / "docs/img/animations/sword_eagle/prepared"
        runtime = ROOT / "public/assets/animations/sword_eagle"
        prepared.mkdir(parents=True, exist_ok=True)
        runtime.mkdir(parents=True, exist_ok=True)
        for path in [prepared / "attack.webp", runtime / "attack.webp"]:
            path.write_bytes(output.read_bytes())
        (prepared / "preparation.json").write_text(report_text, encoding="utf-8")
    print(report_text)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true", help="Publish only after preview review")
    prepare(parser.parse_args().publish)
