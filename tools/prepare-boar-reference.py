"""Export the shipped boar pixels as a transparent generation reference. No image generation."""

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    source = ROOT / "public/assets/art/boar_idle.webp"
    original = ROOT / "docs/img/boar_idle.png"
    sources = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in [source, original]}
    with Image.open(source) as image:
        seed = image.convert("RGBA")
    if seed.size != (384, 273) or seed.getchannel("A").getextrema()[0] != 0:
        raise ValueError("The shipped boar reference has changed; review its dimensions and alpha")
    destination = ROOT / "docs/img/animations/boar"
    destination.mkdir(parents=True, exist_ok=True)
    seed.save(destination / "reference.png")
    canvas = Image.new("RGBA", (768, 512))
    offset = ((canvas.width - seed.width) // 2, (canvas.height - seed.height) // 2)
    canvas.paste(seed, offset)
    canvas.save(destination / "reference-canvas.png")
    with Image.open(destination / "reference.png") as check:
        assert check.tobytes() == seed.tobytes(), "Reference pixels changed"
    with Image.open(destination / "reference-canvas.png") as check:
        region = (offset[0], offset[1], offset[0] + seed.width, offset[1] + seed.height)
        assert check.crop(region).tobytes() == seed.tobytes(), "Canvas reference pixels changed"
    assert all(hashlib.sha256(path.read_bytes()).hexdigest() == value for path, value in sources.items())
    report = {
        "source": source.relative_to(ROOT).as_posix(), "sourceSha256": sources[source],
        "referenceSize": list(seed.size), "canvasSize": list(canvas.size),
        "canvasOffset": list(offset), "generatedAnimation": False,
    }
    (destination / "reference-info.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
