"""Prepare the three reviewed boar motion sheets; inspect artifacts before --publish."""

import argparse
import base64
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/img/animations/boar"
PREVIEW = ROOT / "artifacts/boar-motions"
SIZE = (384, 288)
BODY = (308, 218)
ORIGIN = (193, 147)
FOOT_Y = 256
SHEETS = {
    "idle": {
        "size": (1254, 1254),
        "sha256": "d1a03d0e267b3110bc8521471f0a6e2b6c21159404025e2bd448eb3350d98822",
        "regions": [(0, 0, 627, 627), (627, 0, 1254, 627),
                    (0, 627, 627, 1254), (627, 627, 1254, 1254)],
        "duration": 200,
    },
    "hurt": {
        "size": (2138, 736),
        "sha256": "6650f43caea38f18706b37defc7d0a749205ab0d379940bbb37d129f8bda851e",
        "regions": [(0, 0, 713, 736), (713, 0, 1425, 736), (1425, 0, 2138, 736)],
        "duration": 60,
    },
    "fallen": {
        "size": (1774, 887),
        "sha256": "c1f7a74c48c95378e015ef6c2390b7606f21b52000cfcf854ac2db176646a20f",
        "regions": [(0, 0, 355, 887), (355, 0, 710, 887), (710, 0, 1064, 887),
                    (1064, 0, 1419, 887), (1419, 0, 1774, 887)],
        "duration": 80,
    },
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(image, threshold=8):
    return image.getchannel("A").point(lambda v: 255 if v > threshold else 0).getbbox()


def normalize(action, spec):
    path = SOURCE / f"{action}-sheet-raw.png"
    if digest(path) != spec["sha256"]:
        raise ValueError(f"Unreviewed source: {action}")
    with Image.open(path) as original:
        if original.mode != "RGBA" or original.size != spec["size"]:
            raise ValueError(f"Unexpected dimensions or alpha: {action}")
        slots = [original.crop(region) for region in spec["regions"]]
    first = bounds(slots[0], 95)
    scale = BODY[1] / (first[3] - first[1])
    # Fix horizontal registration using only pose 1. Never recenter the moving head/legs.
    offset_x = round(ORIGIN[0] - ((first[0] + first[2]) / 2) * scale)
    frames, records = [], []
    for i, slot in enumerate(slots):
        visible = bounds(slot)
        if not visible or slot.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Empty or opaque cell: {action}/{i + 1}")
        if visible[0] <= 0 or visible[1] <= 0 or visible[2] >= slot.width or visible[3] >= slot.height:
            raise ValueError(f"Content touches source cell edge: {action}/{i + 1}")
        resized = slot.resize((round(slot.width * scale), round(slot.height * scale)), Image.Resampling.LANCZOS)
        # One ground plane; folding the legs lowers the body, never rescales it.
        offset = (offset_x, FOOT_Y - bounds(resized, 95)[3])
        rb = bounds(resized)
        placed = (rb[0] + offset[0], rb[1] + offset[1], rb[2] + offset[0], rb[3] + offset[1])
        if placed[0] <= 0 or placed[1] <= 0 or placed[2] >= SIZE[0] or placed[3] >= SIZE[1]:
            raise ValueError(f"Output clipping: {action}/{i + 1}")
        frame = Image.new("RGBA", SIZE)
        frame.alpha_composite(resized, offset)
        if bounds(frame, 95)[3] != FOOT_Y:
            raise ValueError(f"Unstable ground contact: {action}/{i + 1}")
        frames.append(frame)
        records.append({"frame": i + 1, "sourceRegion": spec["regions"][i],
                        "sourceBounds": visible, "offset": offset, "outputBounds": bounds(frame),
                        "outputFootY": bounds(frame, 95)[3]})
    if digest(path) != spec["sha256"]:
        raise ValueError(f"Source modified: {action}")
    return frames, {"action": action, "sourceSha256": spec["sha256"], "sourceSize": spec["size"],
                    "sharedScale": scale, "sharedOffsetX": offset_x, "frameCount": len(frames),
                    "frameSize": SIZE, "referenceBodySize": BODY, "originPixels": ORIGIN,
                    "targetFootY": FOOT_Y, "frames": records}


def main(publish=False):
    # Check all inputs/frames before creating outputs.
    normalized = {action: normalize(action, spec) for action, spec in SHEETS.items()}
    PREVIEW.mkdir(parents=True, exist_ok=True)
    with Image.open(ROOT / "public/assets/animations/boar/attack.webp") as image:
        reference = image.crop((0, 0, *SIZE))
    contact = Image.new("RGBA", (SIZE[0] * 6, 368 * 3), "#17382f")
    draw = ImageDraw.Draw(contact)
    sections, reports = [], []
    for row, (action, (frames, report)) in enumerate(normalized.items()):
        folder = PREVIEW / action
        folder.mkdir(parents=True, exist_ok=True)
        strip = Image.new("RGBA", (SIZE[0] * len(frames), SIZE[1]))
        for i, frame in enumerate(frames):
            frame.save(folder / f"{i + 1:02}.png")
            strip.alpha_composite(frame, (i * SIZE[0], 0))
        output = folder / f"{action}.webp"
        strip.save(output, "WEBP", lossless=True, exact=True, method=6)
        with Image.open(output) as check:
            if check.convert("RGBA").tobytes() != strip.tobytes():
                raise ValueError(f"WebP pixels changed: {action}")
        report["outputSha256"] = digest(output)
        report["published"] = publish
        y = row * 368
        for col, frame in enumerate([reference, *frames]):
            x = col * SIZE[0]
            draw.line((x + 8, y + FOOT_Y, x + SIZE[0] - 8, y + FOOT_Y), fill="#638376")
            contact.alpha_composite(frame, (x, y))
            draw.text((x + 8, y + 291), "attack reference" if col == 0 else f"{action} {col:02}", fill="white")
            small = Image.new("RGBA", (104, 52), "#21473b")
            d = ImageDraw.Draw(small)
            d.rectangle((0, 0, 51, 51), outline="#638376")
            d.rectangle((52, 0, 103, 51), outline="#638376")
            ratio = 36 / BODY[1]
            small.alpha_composite(frame.resize((round(SIZE[0] * ratio), round(SIZE[1] * ratio)), Image.Resampling.LANCZOS),
                                  (round(52 - ORIGIN[0] * ratio), round(26 - ORIGIN[1] * ratio)))
            contact.alpha_composite(small, (x + 8, y + 311))
        previews = []
        for frame in frames:
            bg = Image.new("RGBA", SIZE, "#17382f")
            bg.alpha_composite(frame)
            previews.append(bg.convert("RGB"))
        durations = [SHEETS[action]["duration"]] * len(frames)
        if action == "fallen":
            durations[-1] += 1000
        previews[0].save(folder / "preview.gif", save_all=True, append_images=previews[1:], duration=durations, loop=0, disposal=2)
        payload = base64.b64encode(output.read_bytes()).decode("ascii")
        sections.append(f'<h2>{action}</h2><canvas width="384" height="288" data-count="{len(frames)}" data-duration="{SHEETS[action]["duration"]}" data-hold="{1000 if action == "fallen" else 0}" data-src="data:image/webp;base64,{payload}"></canvas>')
        reports.append(report)
    contact.convert("RGB").save(PREVIEW / "contact-sheet.png")
    html = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>岩甲豚动作预览</title>
<style>body{background:#17382f;color:#f3e7cb;margin:24px;font:16px/1.7 system-ui}canvas{max-width:100%;height:auto;border:1px solid #638376}button{font:inherit;min-height:44px;margin:8px}</style>
<h1>岩甲豚 · 三组动作预览</h1><p>独立素材循环，不代表游戏事件顺序；重伤在游戏中保持末帧。</p><button id="play">暂停</button><button id="slow">慢放</button>'''
    html += "".join(sections) + '''<script>let playing=true,speed=1,last,elapsed=0;const play=document.querySelector('#play'),slow=document.querySelector('#slow');play.onclick=()=>{playing=!playing;play.textContent=playing?'暂停':'播放'};slow.onclick=()=>{speed=speed===1?.35:1;slow.textContent=speed===1?'慢放':'正常速度'};const clips=[...document.querySelectorAll('canvas')].map(c=>{const img=new Image();img.src=c.dataset.src;return{c,img,count:Number(c.dataset.count),duration:Number(c.dataset.duration),hold:Number(c.dataset.hold)}});function tick(now){if(last!==undefined&&playing)elapsed+=Math.min(100,now-last)*speed;last=now;for(const{c,img,count,duration,hold}of clips){if(!img.complete||!img.naturalWidth)continue;const n=Math.min(count-1,Math.floor((elapsed%(count*duration+hold))/duration)),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,n*384,0,384,288,0,0,384,288)}requestAnimationFrame(tick)}requestAnimationFrame(tick);</script></html>'''
    (PREVIEW / "index.html").write_text(html, encoding="utf-8")
    (PREVIEW / "preparation.json").write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
    if publish:
        for report in reports:
            name = f'{report["action"]}.webp'
            data = (PREVIEW / report["action"] / name).read_bytes()
            for folder in [SOURCE / "prepared", ROOT / "public/assets/animations/boar"]:
                (folder / name).write_bytes(data)
        (SOURCE / "prepared/motions-preparation.json").write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(reports, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true", help="Install after reviewing the offline preview")
    main(parser.parse_args().publish)
