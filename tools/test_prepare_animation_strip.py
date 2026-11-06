"""Synthetic pipeline checks; these fixtures are not character animation artwork."""

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

SPEC = importlib.util.spec_from_file_location(
    "prepare_animation_strip", Path(__file__).with_name("prepare-animation-strip.py")
)
pipeline = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pipeline)


class PrepareStripTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "synthetic.png"
        self.output = self.root / "prepared"
        # Unequal marker positions deliberately test that motion is not re-centered.
        sheet = Image.new("RGBA", (96, 64))
        draw = ImageDraw.Draw(sheet)
        for i in range(6):
            x, y = (i % 3) * 32 + 5 + i, (i // 3) * 32 + 9
            draw.rectangle((x, y, x + 5, y + 10), fill=(200, 80, 20, 255))
        sheet.save(self.source)

    def prepare(self, **kwargs):
        options = dict(columns=3, rows=2, frame_size=(48, 48), scale=1, offset=(8, 8))
        options.update(kwargs)
        return pipeline.prepare_strip(self.source, self.output, **options)

    def assert_rejected(self, pattern, **kwargs):
        with self.assertRaisesRegex(ValueError, pattern):
            self.prepare(**kwargs)
        self.assertFalse(self.output.exists())

    def test_shared_transform_preserves_relative_motion_and_original(self):
        before = self.source.read_bytes()
        report = self.prepare()
        self.assertEqual(self.source.read_bytes(), before)
        self.assertEqual(report["frameCount"], 6)
        self.assertFalse(report["published"])
        self.assertTrue(report["reviewRequired"])
        self.assertEqual(report["sharedTransform"], {"scale": 1, "offset": [8, 8]})
        self.assertEqual(json.loads((self.output / "report.json").read_text()), report)
        with Image.open(self.output / "strip.webp") as strip:
            self.assertEqual(strip.size, (288, 48))
            for i in range(6):
                with Image.open(self.output / f"{i + 1:02}.png") as frame:
                    self.assertEqual(frame.getchannel("A").getbbox(), (13 + i, 17, 19 + i, 28))
                    self.assertEqual(strip.crop((i * 48, 0, (i + 1) * 48, 48)).tobytes(), frame.tobytes())
        self.assertTrue((self.output / "contact-sheet.png").exists())

    def test_uniform_scale_and_default_offset(self):
        report = self.prepare(scale=2, frame_size=(80, 80), offset=None)
        self.assertEqual(report["sharedTransform"], {"scale": 2, "offset": [8, 8]})
        bounds = [frame["outputBounds"] for frame in report["frames"]]
        self.assertEqual(bounds[5][0] - bounds[0][0], 10)
        self.assertEqual(bounds[5][1], bounds[0][1])
        self.assertEqual(bounds[5][2] - bounds[5][0], bounds[0][2] - bounds[0][0])

    def test_opaque_or_missing_alpha_is_rejected(self):
        Image.new("RGBA", (96, 64), "white").save(self.source)
        self.assert_rejected("transparent")
        Image.new("RGB", (96, 64), "white").save(self.source)
        self.assert_rejected("alpha")

    def test_empty_frame_is_rejected_before_writing(self):
        with Image.open(self.source) as image:
            sheet = image.copy()
        sheet.paste((0, 0, 0, 0), (0, 0, 32, 32))
        sheet.save(self.source)
        self.assert_rejected("Empty frame 1")

    def test_cross_slot_content_is_rejected(self):
        with Image.open(self.source) as image:
            sheet = image.copy()
        sheet.putpixel((31, 15), (255, 0, 0, 255))
        sheet.save(self.source)
        self.assert_rejected("Frame 1.*edge")

    def test_incompatible_grid_is_rejected(self):
        self.assert_rejected("divisible", columns=5)
        self.assert_rejected("positive", columns=0)

    def test_output_clipping_and_invalid_transform_are_rejected(self):
        self.assert_rejected("Frame 1.*output", offset=(-10, 8))
        self.assert_rejected("Frame 1.*output", scale=5)
        for value in [0, -1, float("nan"), float("inf")]:
            self.assert_rejected("scale", scale=value)
        self.assert_rejected("positive", frame_size=(0, 48))

    def test_last_frame_failure_leaves_no_partial_output(self):
        self.assert_rejected("Frame 6.*output", frame_size=(16, 48), offset=(0, 8))

    def test_existing_output_is_never_overwritten(self):
        self.output.mkdir()
        marker = self.output / "keep.txt"
        marker.write_text("keep")
        with self.assertRaisesRegex(ValueError, "already exists"):
            self.prepare()
        self.assertEqual(marker.read_text(), "keep")
        self.assertEqual(list(self.output.iterdir()), [marker])

    def test_cli_output_must_be_inside_artifacts(self):
        project = self.root / "project"
        artifacts = project / "artifacts"
        artifacts.mkdir(parents=True)
        self.assertEqual(pipeline.checked_output(artifacts / "boar", project), artifacts / "boar")
        for path in [artifacts, project / "public", artifacts / ".." / "public"]:
            with self.assertRaisesRegex(ValueError, "artifacts"):
                pipeline.checked_output(path, project)

    def test_actual_cli_exports_offline_only_and_refuses_second_run(self):
        artifacts = pipeline.ROOT / "artifacts"
        artifacts.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="synthetic-strip-test-", dir=artifacts) as task_dir:
            output = Path(task_dir) / "result"
            command = [
                sys.executable, "-B", str(Path(__file__).with_name("prepare-animation-strip.py")),
                "--sheet", str(self.source), "--out", str(output), "--columns", "3", "--rows", "2",
                "--frame-width", "48", "--frame-height", "48", "--scale", "1",
            ]
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["frameCount"], 6)
            before = (output / "strip.webp").read_bytes()
            again = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(again.returncode, 1)
            self.assertIn("already exists", again.stderr)
            self.assertEqual((output / "strip.webp").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
