"""Export the shipped sword eagle as an exact transparent reference. No generation."""

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASH = "35da08851433af27a26e3159f7776cc2d5326bfa925fcf055a39dac07a1979a0"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    source = ROOT / "public/assets/art/sword_eagle_idle.webp"
    original = ROOT / "docs/img/sword_eagle_idle.png"
    before = {path: digest(path) for path in [source, original]}
    if before[source] != SOURCE_HASH:
        raise ValueError("The shipped eagle changed; review the seed before exporting")
    with Image.open(source) as image:
        if image.mode != "RGBA" or image.size != (384, 317):
            raise ValueError("Expected the reviewed 384x317 RGBA seed")
        seed = image.copy()
    if seed.getchannel("A").getextrema()[0] != 0 or seed.getbbox() is None:
        raise ValueError("Seed must have visible content and real transparency")
    directory = ROOT / "docs/img/animations/sword_eagle"
    directory.mkdir(parents=True, exist_ok=True)
    reference_path = directory / "reference.png"
    canvas_path = directory / "reference-canvas.png"
    seed.save(reference_path)
    canvas = Image.new("RGBA", (512, 512))
    offset = (64, 97)
    # paste preserves RGBA even below transparent pixels; never resample the approved seed.
    canvas.paste(seed, offset)
    canvas.save(canvas_path)
    with Image.open(reference_path) as check:
        if check.size != seed.size or check.tobytes() != seed.tobytes():
            raise ValueError("Reference pixels changed")
    with Image.open(canvas_path) as check:
        if check.tobytes() != canvas.tobytes() or check.crop((64, 97, 448, 414)).tobytes() != seed.tobytes():
            raise ValueError("Padded seed pixels changed")
        alpha = check.getchannel("A")
        outside = [(0, 0, 512, 97), (0, 414, 512, 512), (0, 97, 64, 414), (448, 97, 512, 414)]
        if any(alpha.crop(region).getextrema()[1] != 0 for region in outside):
            raise ValueError("Reference padding must be transparent")
    if any(digest(path) != value for path, value in before.items()):
        raise ValueError("An existing source asset changed")
    report = {
        "source": source.relative_to(ROOT).as_posix(),
        "sourceSha256": before[source],
        "original": original.relative_to(ROOT).as_posix(),
        "originalSha256": before[original],
        "referenceSize": list(seed.size),
        "referenceSha256": digest(reference_path),
        "canvasSize": list(canvas.size),
        "canvasOffset": list(offset),
        "canvasSha256": digest(canvas_path),
        "generatedAnimation": False,
    }
    (directory / "reference-info.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
