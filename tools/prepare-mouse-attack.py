"""Prepare the approved six-pose mouse sheet, preserving the source and shared scale.

Run: uv run --with pillow python tools/prepare-mouse-attack.py
"""

import hashlib
import json
import base64
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/img/animations/ember_mouse/attack-sheet-raw.png"
OUTPUT = ROOT / "docs/img/animations/ember_mouse/prepared"
PREVIEW = ROOT / "artifacts/mouse-attack"
# This generated sheet is not a strict grid: frame 4's hand crosses x=418.
REGIONS = [
    (0, 0, 418, 627),
    (418, 0, 836, 627),
    (836, 0, 1254, 627),
    (0, 627, 440, 1254),
    (440, 627, 840, 1254),
    (840, 627, 1254, 1254),
]
SIZE = 256
SCALE = 0.48


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare():
    before = digest(SOURCE)
    source = Image.open(SOURCE)
    if source.mode != "RGBA" or source.size != (1254, 1254):
        raise ValueError("Expected the reviewed 1254x1254 RGBA sheet")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    frames = []
    records = []
    sheet = Image.new("RGBA", (SIZE * 6, SIZE))
    for index, region in enumerate(REGIONS):
        slot = source.crop(region)
        mask = slot.getchannel("A").point(lambda v: 255 if v >= 96 else 0)
        bounds = mask.getbbox()
        if not bounds:
            raise ValueError(f"Empty frame {index + 1}")
        # The lower foot is a stable contact point. Do not center by the moving hands/tail.
        foot = mask.crop((0, bounds[3] - 10, slot.width, bounds[3])).getbbox()
        anchor_x = (foot[0] + foot[2]) / 2
        anchor_y = bounds[3]
        target = (96, 238)
        offset = (round(target[0] - anchor_x * SCALE), round(target[1] - anchor_y * SCALE))
        image = slot.resize((round(slot.width * SCALE), round(slot.height * SCALE)), Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (SIZE, SIZE))
        frame.alpha_composite(image, offset)
        # Any visible boundary pixel would mean the fixed canvas cut off content.
        alpha = frame.getchannel("A")
        if any(alpha.crop(edge).getextrema()[1] > 8 for edge in [(0, 0, SIZE, 1), (0, SIZE - 1, SIZE, SIZE), (0, 0, 1, SIZE), (SIZE - 1, 0, SIZE, SIZE)]):
            raise ValueError(f"Frame {index + 1} reaches the output edge")
        frame.save(PREVIEW / f"{index + 1:02d}.png")
        frames.append(frame)
        sheet.alpha_composite(frame, (index * SIZE, 0))
        records.append({"frame": index + 1, "sourceRegion": region, "footAnchor": [anchor_x, anchor_y], "offset": offset})
    sheet.save(OUTPUT / "attack.webp", "WEBP", lossless=True, method=6)
    runtime = ROOT / "public/assets/animations/ember_mouse"
    runtime.mkdir(parents=True, exist_ok=True)
    (runtime / "attack.webp").write_bytes((OUTPUT / "attack.webp").read_bytes())
    # Both an action cycle and a slowed inspection cycle; no artificial extra poses.
    for label, duration in [("attack", 80), ("attack-slow", 200)]:
        previews = []
        for frame in frames:
            bg = Image.new("RGBA", frame.size, "#17382f")
            bg.alpha_composite(frame)
            previews.append(bg.convert("RGB"))
        previews[0].save(PREVIEW / f"{label}.gif", save_all=True, append_images=previews[1:], duration=[duration] * 5 + [duration * 4], loop=0, disposal=2)
    preview = Image.new("RGBA", (SIZE * 3, (SIZE + 24) * 2), "#17382f")
    draw = ImageDraw.Draw(preview)
    for i, frame in enumerate(frames):
        x, y = (i % 3) * SIZE, (i // 3) * (SIZE + 24)
        preview.alpha_composite(frame, (x, y))
        draw.text((x + 12, y + SIZE + 4), f"{i + 1:02d}", fill="white")
    preview.convert("RGB").save(PREVIEW / "contact-sheet.png")
    if digest(SOURCE) != before:
        raise ValueError("Source modified")
    report = {"sourceSha256": before, "size": source.size, "frameSize": SIZE, "sharedScale": SCALE, "frames": records, "outputSha256": digest(OUTPUT / "attack.webp")}
    (PREVIEW / "preparation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    image_data = base64.b64encode((OUTPUT / "attack.webp").read_bytes()).decode("ascii")
    html = '''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>烬灵鼠攻击动作预览</title>
<style>
body{margin:0;background:#102c25;color:#f5ead0;font:16px/1.7 system-ui,sans-serif}main{max-width:860px;margin:auto;padding:24px}
h1{font-size:25px}p{color:#c4cbbb}.stage{display:flex;gap:28px;align-items:end;flex-wrap:wrap;border:1px solid #567467;border-radius:16px;padding:20px;background:#17382f}
canvas{display:block;max-width:100%;height:auto}label{display:inline-block;margin:12px 12px 12px 0}button,select,input{font:inherit;min-height:44px}button,select{border:1px solid #718f76;background:#e2d4ab;color:#16382b;border-radius:8px;padding:4px 14px}input{vertical-align:middle}output{font-variant-numeric:tabular-nums}
</style><main><h1>烬灵鼠 · 六帧攻击样板</h1>
<p>按上排到下排播放；统一缩放、脚底对齐。此页面仅预览素材，尚未接入游戏。</p>
<div class="stage"><div><canvas id="large" width="256" height="256"></canvas><span>放大观察</span></div><div><canvas id="small" width="52" height="52"></canvas><span>小尺寸观察（52像素）</span></div></div>
<label><button id="toggle">暂停</button></label><label>速度 <select id="speed"><option value="1">正常</option><option value="0.4">慢放</option></select></label>
<label>帧 <input id="frame" type="range" min="0" max="5" value="0" step="1"><output id="number">1 / 6</output></label>
<p>帧1–3：捧火与蓄力；帧4–5：前推与收手；帧6：回到捧火姿态。每帧80毫秒，末帧额外停留240毫秒方便观察。游戏内时序需与现有真实攻击事件单独对齐。</p>
<script>
const image=new Image();image.src='data:image/webp;base64,IMAGE_DATA';
const large=document.querySelector('#large'),small=document.querySelector('#small');
const slider=document.querySelector('#frame'),number=document.querySelector('#number'),button=document.querySelector('#toggle'),speed=document.querySelector('#speed');
let playing=true,elapsed=0,last;
function draw(frame){for(const canvas of [large,small]){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,frame*256,0,256,256,0,0,canvas.width,canvas.height)}slider.value=frame;number.textContent=(frame+1)+' / 6'}
button.onclick=()=>{playing=!playing;button.textContent=playing?'暂停':'播放'};
slider.oninput=()=>{playing=false;button.textContent='播放';elapsed=Number(slider.value)*80;draw(Number(slider.value))};
function tick(now){if(last!==undefined&&playing)elapsed=(elapsed+Math.min(now-last,100)*Number(speed.value))%720;last=now;if(image.complete&&image.naturalWidth)draw(Math.min(5,Math.floor(elapsed/80)));requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></main></html>'''
    (PREVIEW / "index.html").write_text(html.replace("IMAGE_DATA", image_data), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    prepare()
