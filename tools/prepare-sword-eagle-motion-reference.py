"""Export the shipped attack's first eagle pose for remaining motions. No generation."""

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "docs/img/animations/sword_eagle"
ATTACK_HASH = "01c36818072c9df2e84096c0d7036b7e0403cc9246408f35c846f352bfbd631f"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    source = ROOT / "public/assets/animations/sword_eagle/attack.webp"
    preparation = DIRECTORY / "prepared/preparation.json"
    protected = [source, preparation, DIRECTORY / "prepared/attack.webp",
                 DIRECTORY / "attack-sheet-raw.png", DIRECTORY / "reference.png",
                 DIRECTORY / "reference-canvas.png", DIRECTORY / "reference-info.json",
                 ROOT / "public/assets/art/sword_eagle_idle.webp",
                 ROOT / "docs/img/sword_eagle_idle.png"]
    before = {path: digest(path) for path in protected}
    report = json.loads(preparation.read_text(encoding="utf-8"))
    if before[source] != ATTACK_HASH or before[source] != report["outputSha256"]:
        raise ValueError("Attack changed; review the new seed before exporting references")
    if before[DIRECTORY / "prepared/attack.webp"] != ATTACK_HASH:
        raise ValueError("Attack archive differs from the published strip")
    if before[DIRECTORY / "attack-sheet-raw.png"] != report["sourceSha256"]:
        raise ValueError("Original attack sheet differs from the reviewed preparation report")
    if report["bodyAnchorPixels"] != [240, 224] or report["originPixels"] != [240, 180]:
        raise ValueError("Reviewed anchor coordinates changed")
    with Image.open(source) as image:
        if image.mode != "RGBA" or image.size != (2688, 352):
            raise ValueError("Expected the reviewed six-frame 448x352 RGBA strip")
        seed = image.crop((0, 0, 448, 352))
    alpha = seed.getchannel("A")
    if alpha.getextrema()[0] != 0 or alpha.getbbox() is None:
        raise ValueError("Seed needs visible content and real transparency")
    reference_path = DIRECTORY / "motion-reference.png"
    canvas_path = DIRECTORY / "motion-reference-canvas.png"
    seed.save(reference_path)
    canvas = Image.new("RGBA", (512, 512))
    offset = (32, 80)
    canvas.paste(seed, offset)
    canvas.save(canvas_path)
    with Image.open(reference_path) as check:
        if check.mode != "RGBA" or check.size != seed.size or check.tobytes() != seed.tobytes():
            raise ValueError("Reference pixels differ from the shipped first frame")
    with Image.open(canvas_path) as check:
        if check.tobytes() != canvas.tobytes() or check.crop((32, 80, 480, 432)).tobytes() != seed.tobytes():
            raise ValueError("Reference canvas changed the seed pixels")
        outside = [(0, 0, 512, 80), (0, 432, 512, 512), (0, 80, 32, 432), (480, 80, 512, 432)]
        if any(check.getchannel("A").crop(region).getextrema()[1] != 0 for region in outside):
            raise ValueError("Canvas padding must be fully transparent")
    if any(digest(path) != value for path, value in before.items()):
        raise ValueError("An existing source file changed during export")
    info = {"source": source.relative_to(ROOT).as_posix(), "sourceSha256": before[source],
            "sourceFrame": 0, "sourceRegion": [0, 0, 448, 352], "referenceSize": list(seed.size),
            "referenceSha256": digest(reference_path), "canvasSize": list(canvas.size),
            "canvasOffset": list(offset), "canvasSha256": digest(canvas_path),
            "canvasBodyAnchor": [272, 304], "canvasRenderOrigin": [272, 260],
            "derivedFromExistingAnimation": True, "newAnimationGenerated": False}
    (DIRECTORY / "motion-reference-info.json").write_text(
        json.dumps(info, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(info, indent=2))


if __name__ == "__main__":
    main()
