"""Normalize reviewed eagle motion sheets; inspect artifacts before --publish."""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/img/animations/sword_eagle"
PREVIEW = ROOT / "artifacts/sword-eagle-motions"
SIZE = (448, 352)
BODY = (348, 258)
ORIGIN = (240, 180)
ANCHOR = (240, 224)
ATTACK_HASH = "01c36818072c9df2e84096c0d7036b7e0403cc9246408f35c846f352bfbd631f"
SHEETS = {
    "idle": {
        "size": (1254, 1254),
        "sha256": "b0e3ee55b061d0a2422083adfeeabc8b32b9c7216506303052ffade94a04765d",
        "regions": [(0, 0, 627, 627), (627, 0, 1254, 627),
                    (0, 627, 627, 1254), (627, 627, 1254, 1254)],
        "bodyPoints": [(382, 366), (1010, 366), (381, 993), (1013, 993)],
        "duration": 200,
    },
    "hurt": {
        "size": (2138, 736),
        "sha256": "83537d2e099e11cb24e7ac7d3fcde55f2cac6178dc61d599636785ae59a6c687",
        "regions": [(0, 0, 713, 736), (713, 0, 1425, 736), (1425, 0, 2138, 736)],
        "bodyPoints": [(434, 436), (1136, 439), (1839, 437)],
        "duration": 60,
    },
    "fallen": {
        "size": (1774, 887),
        "sha256": "958d8f74ca60d25071a3a67774fc23257b30b5a0efa8efd503f820751a6676c6",
        # First two wings cross nominal 355/710 cuts. Cut through the actual clear gaps.
        "regions": [(0, 0, 432, 887), (432, 0, 775, 887), (775, 0, 1064, 887),
                    (1064, 0, 1419, 887), (1419, 0, 1774, 887)],
        "bodyPoints": [(263, 505), (619, 553), (977, 579), (1289, 612), (1637, 620)],
        "duration": 80,
    },
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(image):
    return image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()


def normalize(action, spec):
    path = SOURCE / f"{action}-sheet-raw.png"
    if digest(path) != spec["sha256"]:
        raise ValueError(f"Unreviewed source: {action}")
    with Image.open(path) as original:
        if original.mode != "RGBA" or original.size != spec["size"]:
            raise ValueError(f"Unexpected dimensions or alpha: {action}")
        source = original.copy()
    source.putalpha(source.getchannel("A").point(lambda value: 0 if value <= 8 else value))
    slots = [source.crop(region) for region in spec["regions"]]
    first = bounds(slots[0])
    if not first:
        raise ValueError(f"Empty reference pose: {action}")
    # Limit the whole group by its widest wing as well as pose-1 height; reserve 1px for resampling.
    reach = max(max(point[0] - region[0] - bounds(slot)[0],
                    bounds(slot)[2] - (point[0] - region[0]))
                for slot, region, point in zip(slots, spec["regions"], spec["bodyPoints"]))
    scale = min(256 / (first[3] - first[1]), (BODY[0] / 2 - 1) / reach)
    first_body_y = spec["bodyPoints"][0][1] - spec["regions"][0][1]
    fallen_y_offset = round(ANCHOR[1] - first_body_y * scale)
    frames, records = [], []
    for i, (slot, region, point) in enumerate(zip(slots, spec["regions"], spec["bodyPoints"])):
        visible = bounds(slot)
        if not visible or slot.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Empty or opaque frame: {action}/{i + 1}")
        if visible[0] <= 0 or visible[1] <= 0 or visible[2] >= slot.width or visible[3] >= slot.height:
            raise ValueError(f"Source cut clips feathers: {action}/{i + 1}")
        resized = slot.resize((round(slot.width * scale), round(slot.height * scale)), Image.Resampling.LANCZOS)
        # Use body landmarks, never wing-tip bounding boxes; fallen y must keep its descent.
        local = (point[0] - region[0], point[1] - region[1])
        offset = (round(ANCHOR[0] - local[0] * scale),
                  fallen_y_offset if action == "fallen" else round(ANCHOR[1] - local[1] * scale))
        rb = bounds(resized)
        placed = (rb[0] + offset[0], rb[1] + offset[1], rb[2] + offset[0], rb[3] + offset[1])
        if placed[0] <= 0 or placed[1] <= 0 or placed[2] >= SIZE[0] or placed[3] >= SIZE[1]:
            raise ValueError(f"Output clipping: {action}/{i + 1}")
        frame = Image.new("RGBA", SIZE)
        frame.alpha_composite(resized, offset)
        frames.append(frame)
        records.append({"frame": i + 1, "sourceRegion": region, "sourceBounds": visible,
                        "sourceBodyPoint": point, "offset": offset,
                        "outputBodyPoint": [local[0] * scale + offset[0], local[1] * scale + offset[1]],
                        "outputBounds": bounds(frame)})
    if digest(path) != spec["sha256"]:
        raise ValueError(f"Source modified: {action}")
    return frames, {"action": action, "sourceSha256": spec["sha256"], "sourceSize": spec["size"],
                    "sharedScale": scale, "clearedAlphaMaximum": 8, "frameSize": SIZE,
                    "frameCount": len(frames), "referenceBodySize": BODY, "originPixels": ORIGIN,
                    "bodyAnchorPixels": ANCHOR, "verticalMode": "preserve-descent" if action == "fallen" else "fixed-hover",
                    "frames": records}


def main(publish=False):
    attack = ROOT / "public/assets/animations/sword_eagle/attack.webp"
    if digest(attack) != ATTACK_HASH:
        raise ValueError("Reviewed attack reference changed")
    normalized = {action: normalize(action, spec) for action, spec in SHEETS.items()}
    PREVIEW.mkdir(parents=True, exist_ok=True)
    with Image.open(attack) as image:
        reference = image.crop((0, 0, *SIZE))
    row_height = SIZE[1] + 128
    contact = Image.new("RGBA", (SIZE[0] * 6, row_height * 3), "#ded9c6")
    draw = ImageDraw.Draw(contact)
    reports = []
    for row, (action, (frames, report)) in enumerate(normalized.items()):
        folder = PREVIEW / action
        folder.mkdir(parents=True, exist_ok=True)
        strip = Image.new("RGBA", (SIZE[0] * len(frames), SIZE[1]))
        playback = []
        for i, frame in enumerate(frames):
            frame.save(folder / f"{i + 1:02}.png")
            strip.alpha_composite(frame, (SIZE[0] * i, 0))
            bg = Image.new("RGBA", SIZE, "#21473b")
            bg.alpha_composite(frame)
            playback.append(bg.convert("RGB"))
        durations = [SHEETS[action]["duration"]] * len(frames)
        if action == "fallen":
            durations[-1] += 1000
        playback[0].save(folder / "preview.gif", save_all=True, append_images=playback[1:],
                         duration=durations, loop=0, disposal=2)
        output = folder / f"{action}.webp"
        strip.save(output, "WEBP", lossless=True, exact=True, method=6)
        with Image.open(output) as check:
            if check.convert("RGBA").tobytes() != strip.tobytes():
                raise ValueError(f"WebP round-trip changed pixels: {action}")
        report["outputSha256"], report["published"] = digest(output), publish
        reports.append(report)
        for col, frame in enumerate([reference, *frames]):
            x, y = col * SIZE[0], row * row_height
            contact.alpha_composite(frame, (x, y))
            draw.line((x + 8, y + ANCHOR[1], x + SIZE[0] - 8, y + ANCHOR[1]), fill="#a9b1a1")
            draw.text((x + 8, y + SIZE[1]), "attack reference" if col == 0 else f"{action} {col:02}", fill="#17382f")
            small = Image.new("RGBA", (104, 104), "#21473b")
            sd = ImageDraw.Draw(small)
            for pos in [0, 52, 103]:
                sd.line((pos, 0, pos, 103), fill="#638376")
                sd.line((0, pos, 103, pos), fill="#638376")
            ratio = min(94 / BODY[0], 88 / BODY[1])
            thumb = frame.resize((round(SIZE[0] * ratio), round(SIZE[1] * ratio)), Image.Resampling.LANCZOS)
            small.alpha_composite(thumb, (round(52 - ORIGIN[0] * ratio), round(52 - ORIGIN[1] * ratio)))
            contact.alpha_composite(small, (x + 8, y + SIZE[1] + 18))
    contact.convert("RGB").save(PREVIEW / "contact-sheet.png")
    report_text = json.dumps(reports, indent=2) + "\n"
    (PREVIEW / "preparation.json").write_text(report_text, encoding="utf-8")
    if publish:
        for folder in [SOURCE / "prepared", ROOT / "public/assets/animations/sword_eagle"]:
            folder.mkdir(parents=True, exist_ok=True)
            for report in reports:
                name = f'{report["action"]}.webp'
                (folder / name).write_bytes((PREVIEW / report["action"] / name).read_bytes())
        (SOURCE / "prepared/motions-preparation.json").write_text(report_text, encoding="utf-8")
    print(report_text)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true", help="Install after reviewing offline previews")
    main(parser.parse_args().publish)
