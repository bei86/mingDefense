"""Prepare local art without editing originals. Run: uv run --with pillow python tools/prepare-game-assets.py"""

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/img"
DESTINATION = ROOT / "public/assets/art"
# These variants change identity or contain a painted checkerboard; keep originals for later review.
EXCLUDED = {
    "boss_05_phase2_variant": "painted checkerboard; different silhouette",
    "rock_armored_axe_warrior_variant": "painted checkerboard; unassigned character",
    "boss_25_phase2_variant": "human silhouette differs from base beast",
    "boss_05_phase2_variant_02": "staff and silhouette differ from base tree",
    "boss_10_phase2_variant": "human silhouette differs from base wolf",
    "boss_15_phase2_variant": "axe warrior differs from rhino stone-fist base",
    "boss_20_phase2_variant": "phase colors not distinct from base",
    "boss_30_phase2_variant": "human silhouette differs from new bird base",
    "boss_40_phase2_variant": "crown, silhouette and armor differ from base",
}


def prepare():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    manifest_path = ROOT / "src/render/art-manifest.json"
    previous = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest = {}
    report = []
    for path in sorted(SOURCE.glob("*.png")):
        original_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        entry = {"source": path.name, "sha256": original_hash}
        if path.stem in EXCLUDED:
            entry["excluded"] = EXCLUDED[path.stem]
            report.append(entry)
            continue
        with Image.open(path) as original:
            image = original.convert("RGBA")
        background = path.stem in {"battlefield_forest", "forest_page_bg"}
        if not background:
            alpha = image.getchannel("A").point(lambda value: 0 if value < 3 else value)
            image.putalpha(alpha)
            bounds = alpha.getbbox()
            if bounds is None:
                raise ValueError(f"Empty image: {path.name}")
            image = image.crop(bounds)
        longest = 384
        if background:
            longest = 1080
        elif path.stem.startswith("icon_"):
            longest = 112
        elif path.stem.startswith("fx_"):
            longest = 256
        elif path.stem.startswith("ui_"):
            longest = 640
        image.thumbnail((longest, longest), Image.Resampling.LANCZOS)
        filename = path.stem + ".webp"
        image.save(DESTINATION / filename, "WEBP", lossless=not background, quality=85, method=6)
        manifest[path.stem] = {
            "file": filename,
            "width": image.width,
            "height": image.height,
        }
        entry.update(manifest[path.stem])
        entry["bytes"] = (DESTINATION / filename).stat().st_size
        if hashlib.sha256(path.read_bytes()).hexdigest() != original_hash:
            raise ValueError(f"Original changed: {path.name}")
        report.append(entry)
    manifest_path.write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    # Remove only outputs previously recorded by this converter, never source art.
    for key in previous.keys() - manifest.keys():
        stale = (DESTINATION / previous[key]["file"]).resolve()
        if stale.parent != DESTINATION.resolve() or stale.suffix != ".webp":
            raise ValueError(f"Unexpected stale output: {stale}")
        stale.unlink(missing_ok=True)
    report_path = ROOT / "artifacts/art-preparation.json"
    report_path.parent.mkdir(exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(manifest)} assets; originals unchanged.")
    print(f"Total output bytes: {sum(item.get('bytes', 0) for item in report)}")


if __name__ == "__main__":
    prepare()
