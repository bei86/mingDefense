"""Export the shipped attack's first pose for the boar's remaining motions. No generation."""

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "docs/img/animations/boar"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    source = ROOT / "public/assets/animations/boar/attack.webp"
    report_path = DIRECTORY / "prepared/preparation.json"
    protected = [
        source,
        report_path,
        DIRECTORY / "attack-sheet-raw.png",
        DIRECTORY / "reference.png",
        DIRECTORY / "reference-canvas.png",
        DIRECTORY / "reference-info.json",
        ROOT / "public/assets/art/boar_idle.webp",
        ROOT / "docs/img/boar_idle.png",
    ]
    before = {path: digest(path) for path in protected}
    prepared = json.loads(report_path.read_text(encoding="utf-8"))
    if before[source] != prepared["outputSha256"]:
        raise ValueError("The shipped attack differs from the reviewed preparation report")
    if before[DIRECTORY / "attack-sheet-raw.png"] != prepared["sourceSha256"]:
        raise ValueError("The original attack sheet differs from its preparation report")
    with Image.open(source) as image:
        if image.size != (2304, 288) or image.mode != "RGBA":
            raise ValueError("Expected the reviewed six-frame 384x288 RGBA strip")
        seed = image.crop((0, 0, 384, 288))
    if seed.getchannel("A").getextrema()[0] != 0 or seed.getbbox() is None:
        raise ValueError("Reference must contain a visible character and real transparency")
    reference_path = DIRECTORY / "motion-reference.png"
    canvas_path = DIRECTORY / "motion-reference-canvas.png"
    seed.save(reference_path)
    canvas = Image.new("RGBA", (512, 512))
    offset = (64, 112)
    canvas.paste(seed, offset)
    canvas.save(canvas_path)
    with Image.open(reference_path) as check:
        if check.size != seed.size or check.tobytes() != seed.tobytes():
            raise ValueError("Reference PNG pixels differ from the shipped first pose")
    with Image.open(canvas_path) as check:
        region = (64, 112, 448, 400)
        if check.tobytes() != canvas.tobytes() or check.crop(region).tobytes() != seed.tobytes():
            raise ValueError("Padded reference changed the seed pixels")
        alpha = check.getchannel("A")
        outside = [
            (0, 0, 512, 112),
            (0, 400, 512, 512),
            (0, 112, 64, 400),
            (448, 112, 512, 400),
        ]
        if any(alpha.crop(region).getextrema()[1] != 0 for region in outside):
            raise ValueError("Reference padding must remain fully transparent")
    if any(digest(path) != value for path, value in before.items()):
        raise ValueError("An existing source asset changed during export")
    report = {
        "source": source.relative_to(ROOT).as_posix(),
        "sourceSha256": before[source],
        "sourceFrame": 0,
        "sourceRegion": [0, 0, 384, 288],
        "referenceSize": [384, 288],
        "referenceSha256": digest(reference_path),
        "canvasSize": [512, 512],
        "canvasOffset": list(offset),
        "canvasSha256": digest(canvas_path),
        "canvasFootY": prepared["targetFootY"] + offset[1],
        "derivedFromExistingAnimation": True,
        "newAnimationGenerated": False,
    }
    (DIRECTORY / "motion-reference-info.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
