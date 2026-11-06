"""Normalize the reviewed 3x2 boar sheet offline; --publish explicitly installs it.

Run: uv run --with pillow python -B tools/prepare-boar-attack.py
"""

import argparse
import base64
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/img/animations/boar/attack-sheet-raw.png"
PREVIEW = ROOT / "artifacts/boar-attack"
SOURCE_HASH = "b27fc0ec5945a89f9524f82b2d25ea8717e4050c254788a7a91be54548c8960e"
SIZE = (384, 288)
SCALE = 0.625
FOOT_Y = 256


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(image, threshold=8):
    return image.getchannel("A").point(lambda v: 255 if v > threshold else 0).getbbox()


def prepare(publish=False):
    if digest(SOURCE) != SOURCE_HASH:
        raise ValueError("Source differs from the reviewed sheet; review before changing the processor")
    with Image.open(SOURCE) as original:
        if original.mode != "RGBA" or original.size != (1536, 1024):
            raise ValueError("Expected the reviewed 1536x1024 RGBA grid")
        source = original.copy()
    frames, records = [], []
    for i in range(6):
        x, y = (i % 3) * 512, (i // 3) * 512
        region = (x, y, x + 512, y + 512)
        slot = source.crop(region)
        visible, solid = bounds(slot), bounds(slot, 95)
        if not visible or not solid or slot.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Frame {i + 1} is empty or not transparent")
        if visible[0] <= 0 or visible[1] <= 0 or visible[2] >= 512 or visible[3] >= 512:
            raise ValueError(f"Frame {i + 1} crosses its grid cell")
        # Only vertical correction: preserve the head's horizontal thrust and all pose proportions.
        resized = slot.resize((320, 320), Image.Resampling.LANCZOS)
        offset = (32, FOOT_Y - bounds(resized, 95)[3])
        rb = bounds(resized)
        placed = (rb[0] + offset[0], rb[1] + offset[1], rb[2] + offset[0], rb[3] + offset[1])
        if placed[0] <= 0 or placed[1] <= 0 or placed[2] >= SIZE[0] or placed[3] >= SIZE[1]:
            raise ValueError(f"Frame {i + 1} would be clipped")
        frame = Image.new("RGBA", SIZE)
        frame.alpha_composite(resized, offset)
        if bounds(frame, 95)[3] != FOOT_Y:
            raise ValueError(f"Frame {i + 1} has an unstable foot anchor")
        frames.append(frame)
        records.append({"frame": i + 1, "sourceRegion": region, "sourceBounds": visible,
                        "sourceFootY": solid[3], "offset": offset, "outputBounds": bounds(frame),
                        "outputFootY": bounds(frame, 95)[3]})

    first = records[0]["outputBounds"]
    body = (first[2] - first[0], FOOT_Y - first[1])
    anchor = ((first[0] + first[2]) / 2, FOOT_Y - body[1] / 2)
    strip = Image.new("RGBA", (SIZE[0] * 6, SIZE[1]))
    contact = Image.new("RGBA", (SIZE[0] * 3, (SIZE[1] + 80) * 2), "#17382f")
    draw = ImageDraw.Draw(contact)
    for i, frame in enumerate(frames):
        strip.alpha_composite(frame, (i * SIZE[0], 0))
        x, y = (i % 3) * SIZE[0], (i // 3) * (SIZE[1] + 80)
        draw.line((x + 10, y + FOOT_Y, x + SIZE[0] - 10, y + FOOT_Y), fill="#638376")
        contact.alpha_composite(frame, (x, y))
        draw.text((x + 10, y + SIZE[1] + 5), f"{i + 1:02} / 06    body at 94x36 fit:", fill="white")
        small = Image.new("RGBA", (104, 52), "#21473b")
        small_draw = ImageDraw.Draw(small)
        small_draw.rectangle((0, 0, 51, 51), outline="#638376")
        small_draw.rectangle((52, 0, 103, 51), outline="#638376")
        scale = min(94 / body[0], 36 / body[1])
        preview = frame.resize((round(SIZE[0] * scale), round(SIZE[1] * scale)), Image.Resampling.LANCZOS)
        small.alpha_composite(preview, (round(52 - anchor[0] * scale), round(26 - anchor[1] * scale)))
        contact.alpha_composite(small, (x + 10, y + SIZE[1] + 22))

    PREVIEW.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(frames):
        frame.save(PREVIEW / f"{i + 1:02}.png")
    output = PREVIEW / "attack.webp"
    strip.save(output, "WEBP", lossless=True, method=6, exact=True)
    with Image.open(output) as decoded:
        if decoded.convert("RGBA").tobytes() != strip.tobytes():
            raise ValueError("Published strip must round-trip exact RGBA pixels")
    contact.convert("RGB").save(PREVIEW / "contact-sheet.png")
    previews = []
    for frame in frames:
        bg = Image.new("RGBA", SIZE, "#17382f")
        bg.alpha_composite(frame)
        previews.append(bg.convert("RGB"))
    for name, duration in [("attack", 70), ("attack-slow", 200)]:
        previews[0].save(PREVIEW / f"{name}.gif", save_all=True, append_images=previews[1:],
                         duration=[duration] * 5 + [duration * 4], loop=0, disposal=2)
    report = {"sourceSha256": SOURCE_HASH, "sourceSize": source.size, "grid": [3, 2],
              "frameCount": 6, "frameSize": SIZE, "sharedScale": SCALE, "sharedOffsetX": 32,
              "targetFootY": FOOT_Y, "referenceBodySize": body, "originPixels": anchor,
              "visibleAlphaThreshold": 8, "footAlphaThreshold": 96, "frames": records,
              "outputSha256": digest(output), "published": publish}
    if digest(SOURCE) != SOURCE_HASH:
        raise ValueError("Raw sheet changed during processing")
    (PREVIEW / "preparation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    data = base64.b64encode(output.read_bytes()).decode("ascii")
    html = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>岩甲豚攻击预览</title>
<style>body{margin:24px;background:#17382f;color:#f3e7cb;font:16px/1.7 system-ui}canvas{max-width:100%;height:auto;border:1px solid #638376}button,input{min-height:44px;font:inherit;margin:8px}</style>
<h1>岩甲豚 · 六帧攻击</h1><p>放大与两格实际尺寸。此页独立循环播放素材，游戏由真实攻击驱动。</p>
<canvas id="large" width="384" height="288"></canvas> <canvas id="small" width="104" height="52"></canvas>
<p><button id="play">暂停</button><button id="slow">慢放</button><input id="frame" type="range" min="0" max="5" step="1" value="0"><output id="count">1 / 6</output></p>
<script>const img=new Image();img.src='data:image/webp;base64,DATA';
const slider=document.querySelector('#frame'),play=document.querySelector('#play'),slow=document.querySelector('#slow');
let playing=true,speed=1,elapsed=0,last;
function draw(n){for(const id of ['large','small']){const c=document.getElementById(id),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);const s=id==='large'?1:36/BODY_H;const x=id==='large'?0:52-ANCHOR_X*s,y=id==='large'?0:26-ANCHOR_Y*s;ctx.drawImage(img,n*384,0,384,288,x,y,384*s,288*s)}slider.value=n;document.querySelector('#count').textContent=(n+1)+' / 6'}
play.onclick=()=>{playing=!playing;play.textContent=playing?'暂停':'播放'};
slow.onclick=()=>{speed=speed===1?.35:1;slow.textContent=speed===1?'慢放':'正常速度'};
slider.oninput=()=>{playing=false;play.textContent='播放';elapsed=Number(slider.value)*70;draw(Number(slider.value))};
function tick(now){if(last!==undefined&&playing)elapsed=(elapsed+Math.min(100,now-last)*speed)%630;last=now;if(img.complete&&img.naturalWidth)draw(Math.min(5,Math.floor(elapsed/70)));requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></html>'''
    html = html.replace("DATA", data).replace("BODY_H", str(body[1])).replace("ANCHOR_X", str(anchor[0])).replace("ANCHOR_Y", str(anchor[1]))
    (PREVIEW / "index.html").write_text(html, encoding="utf-8")
    if publish:
        prepared = ROOT / "docs/img/animations/boar/prepared"
        runtime = ROOT / "public/assets/animations/boar"
        prepared.mkdir(parents=True, exist_ok=True)
        runtime.mkdir(parents=True, exist_ok=True)
        for path in [prepared / "attack.webp", runtime / "attack.webp"]:
            path.write_bytes(output.read_bytes())
        (prepared / "preparation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true", help="Install only after reviewing artifacts/boar-attack")
    prepare(parser.parse_args().publish)
