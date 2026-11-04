"""Normalize the supplied whole motion sheets without changing their source files.

Run: uv run --with pillow python tools/prepare-mouse-motions.py
"""

import base64
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/img/animations/ember_mouse"
PREVIEW = ROOT / "artifacts/mouse-motions"
SIZE = 256
SHEETS = {
    "idle": {
        "size": (1254, 1254),
        "hash": "afb72cbd2ad6ad4ca6eec2f039f5b150d4971cb2ee72969dd9fcf1ac8fb27f3c",
        "regions": [(0, 0, 627, 627), (627, 0, 1254, 627),
                    (0, 627, 627, 1254), (627, 627, 1254, 1254)],
        "duration": 200,
    },
    "hurt": {
        "size": (2138, 736),
        "hash": "8b2897f69ccd1fb46ba98d38f6550bda98c942f68f74996a2fcad4741744cd35",
        "regions": [(0, 0, 713, 736), (713, 0, 1425, 736), (1425, 0, 2138, 736)],
        "duration": 60,
    },
    "fallen": {
        "size": (1774, 887),
        "hash": "57cd971ee77413903956d4b784e32e45b06149833746f74cef5d5b5b09af4f79",
        # Use transparent gaps, not equal fifths which include adjacent tails.
        "regions": [(0, 0, 320, 887), (320, 0, 660, 887), (660, 0, 1015, 887),
                    (1015, 0, 1382, 887), (1382, 0, 1774, 887)],
        "duration": 80,
    },
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(action, spec):
    # Wider left-side tail during collapse; shift canvas AND render origin together.
    target = (136 if action == "fallen" else 96, 238)
    source_path = SOURCE / f"{action}-sheet-raw.png"
    before = digest(source_path)
    if before != spec["hash"]:
        raise ValueError(f"Unexpected source content: {action}")
    original = Image.open(source_path)
    if original.size != spec["size"] or original.mode != "RGBA":
        raise ValueError(f"Unexpected source size/mode: {action}")
    slots = []
    for region in spec["regions"]:
        slot = original.crop(region)
        # Remove only near-invisible alpha noise; never paint or reconstruct the character.
        slot.putalpha(slot.getchannel("A").point(lambda value: 0 if value <= 4 else value))
        mask = slot.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
        bounds = mask.getbbox()
        if not bounds:
            raise ValueError(f"Empty pose: {action}")
        foot = mask.crop((0, bounds[3] - 10, slot.width, bounds[3])).getbbox()
        anchor = ((foot[0] + foot[2]) / 2, bounds[3])
        slots.append((slot, bounds, anchor))
    # Match the standing reference's 216px body height, with ONE scale per action.
    scale = 216 / (slots[0][1][3] - slots[0][1][1])
    for _, bounds, anchor in slots:
        left, top, right, bottom = bounds
        scale = min(scale, (target[1] - 8) / (anchor[1] - top))
        if anchor[0] > left:
            scale = min(scale, (target[0] - 8) / (anchor[0] - left))
        if right > anchor[0]:
            scale = min(scale, (SIZE - 8 - target[0]) / (right - anchor[0]))
    folder = PREVIEW / action
    folder.mkdir(parents=True, exist_ok=True)
    frames = []
    records = []
    for index, (slot, bounds, anchor) in enumerate(slots):
        offset = (round(target[0] - anchor[0] * scale), round(target[1] - anchor[1] * scale))
        resized = slot.resize((round(slot.width * scale), round(slot.height * scale)), Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (SIZE, SIZE))
        frame.alpha_composite(resized, offset)
        alpha = frame.getchannel("A")
        for edge in [(0, 0, SIZE, 1), (0, SIZE - 1, SIZE, SIZE),
                     (0, 0, 1, SIZE), (SIZE - 1, 0, SIZE, SIZE)]:
            if alpha.crop(edge).getextrema()[1] > 8:
                raise ValueError(f"Visible content reaches frame edge: {action}/{index + 1}")
        frame.save(folder / f"{index + 1:02d}.png")
        frames.append(frame)
        records.append({"sourceRegion": spec["regions"][index], "bounds": bounds,
                        "anchor": anchor, "offset": offset})
    strip = Image.new("RGBA", (SIZE * len(frames), SIZE))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * SIZE, 0))
    output = SOURCE / "prepared" / f"{action}.webp"
    strip.save(output, "WEBP", lossless=True, method=6)
    runtime = ROOT / "public/assets/animations/ember_mouse" / output.name
    runtime.write_bytes(output.read_bytes())
    previews = []
    for frame in frames:
        canvas = Image.new("RGBA", frame.size, "#17382f")
        canvas.alpha_composite(frame)
        previews.append(canvas.convert("RGB"))
    durations = [spec["duration"]] * len(frames)
    if action == "fallen":
        durations[-1] += 1000  # inspection replay; game holds this pose until reset
    previews[0].save(folder / "preview.gif", save_all=True, append_images=previews[1:],
                     duration=durations, loop=0, disposal=2)
    if digest(source_path) != before or digest(output) != digest(runtime):
        raise ValueError("Source or published bytes differ")
    return {"action": action, "sourceSha256": before, "outputSha256": digest(output),
            "sharedScale": scale, "frameSize": SIZE, "target": target, "frames": records,
            "data": base64.b64encode(output.read_bytes()).decode("ascii")}, frames


def main():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    # Match engine origins in comparison cells, not just the raw canvas left edge.
    cell_width = 352
    contact = Image.new("RGBA", (cell_width * 6, (SIZE + 25) * 3), "#17382f")
    draw = ImageDraw.Draw(contact)
    reference = Image.open(ROOT / "public/assets/animations/ember_mouse/attack.webp").crop((0, 0, SIZE, SIZE))
    reports = []
    for row, (action, spec) in enumerate(SHEETS.items()):
        report, frames = prepare(action, spec)
        y = row * (SIZE + 25)
        contact.alpha_composite(reference, (48, y))
        draw.text((8, y + SIZE + 4), "attack reference", fill="white")
        for index, frame in enumerate(frames):
            x = (index + 1) * cell_width
            origin_offset = 40 if action == "fallen" else 0
            contact.alpha_composite(frame, (x + 48 - origin_offset, y))
            draw.text((x + 8, y + SIZE + 4), f"{action} {index + 1}", fill="white")
        reports.append(report)
    contact.convert("RGB").save(PREVIEW / "contact-sheet.png")
    sections = []
    for report in reports:
        count = len(report["frames"])
        sections.append(f'<h2>{report["action"]}</h2><div class="sprite" style="--count:{count};--duration:{count * SHEETS[report["action"]]["duration"]}ms;background-image:url(data:image/webp;base64,{report["data"]})"></div>')
    html = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>烬灵鼠动作预览</title>
<style>body{background:#17382f;color:#fff;font:16px sans-serif;margin:24px}.sprite{width:256px;height:256px;animation:run var(--duration) steps(var(--count)) infinite}@keyframes run{to{background-position-x:calc(-256px * var(--count))}}.paused .sprite{animation-play-state:paused}</style>
<h1>烬灵鼠素材预览</h1><p>离线循环检查，不代表游戏实际事件顺序；重伤游戏内会保持末帧。</p>
<button onclick="document.body.classList.toggle('paused')">暂停 / 继续</button>'''
    (PREVIEW / "index.html").write_text(html + "".join(sections) + "</html>", encoding="utf-8")
    for report in reports:
        del report["data"]
    (PREVIEW / "preparation.json").write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(reports, indent=2))


if __name__ == "__main__":
    main()
