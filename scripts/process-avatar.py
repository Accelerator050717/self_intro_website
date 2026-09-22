"""Prepare the four supplied views locally; no image is sent to a remote service.

Run with .venv-assets/Scripts/python.exe scripts/process-avatar.py.
The first run downloads the public BiRefNet ONNX checkpoint into .venv-assets.
Use --refresh to recompute cached masks after changing the processing method.
"""

from __future__ import annotations

import argparse
import gc
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import time

ROOT = Path(__file__).resolve().parents[1]
# All downloads and cache files remain inside the non-public project workspace.
os.environ["REMBG_HOME"] = str(ROOT / ".venv-assets" / "rembg")
os.environ["U2NET_HOME"] = str(ROOT / ".venv-assets" / "rembg" / "models")
os.environ.setdefault("OMP_NUM_THREADS", "4")

from PIL import Image, ImageDraw  # noqa: E402
import numpy as np  # noqa: E402

VIEWS = ("front", "right", "back", "left")
MODEL = "birefnet-general"
CANVAS = (720, 960)
SUBJECT_HEIGHT = 892
BASELINE = 924
ORIGINALS = ROOT / "assets" / "originals"
CACHE = ORIGINALS / "_processing"
OUTPUT = ROOT / "public" / "images" / "avatar"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_webp(image: Image.Image, path: Path) -> dict:
    image.save(path, "WEBP", quality=91, method=6, exact=True)
    saved = Image.open(path)
    assert saved.mode == "RGBA", f"Missing transparency: {path.name}"
    alpha = np.asarray(saved.getchannel("A"))
    assert alpha.min() == 0 and alpha.max() == 255
    assert not np.any(alpha[[0, -1], :]) and not np.any(alpha[:, [0, -1]])
    return {"file": path.name, "width": image.width, "height": image.height,
            "bytes": path.stat().st_size, "sha256": digest(path),
            "alpha_bbox": list(saved.getchannel("A").getbbox())}


def review_board(images: dict[str, Image.Image]) -> None:
    width, height = 1440, 1020
    board = Image.new("RGB", (width, height), "#f4f8fc")
    draw = ImageDraw.Draw(board)
    for row, background in enumerate(("#f4f8fc", "#102638")):
        draw.rectangle((0, row * 510, width, (row + 1) * 510), fill=background)
        for col, (view, image) in enumerate(images.items()):
            thumb = image.resize((360, 480), Image.Resampling.LANCZOS)
            board.paste(thumb, (col * 360, row * 510 + 22), thumb)
            color = "#172c40" if row == 0 else "#d8e8f6"
            draw.text((col * 360 + 16, row * 510 + 8), view, fill=color)
            draw.line((col * 360 + 20, row * 510 + 484,
                       (col + 1) * 360 - 20, row * 510 + 484), fill="#477cac")
    board.save(CACHE / "avatar-review-light-dark.jpg", quality=94)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    normalized = {}
    manifest = {"model": MODEL, "inference": "local CPU",
                "canvas": list(CANVAS), "subject_height": SUBJECT_HEIGHT,
                "baseline": BASELINE,
                "packages": {name: importlib.metadata.version(name)
                             for name in ("rembg", "onnxruntime", "Pillow", "numpy")},
                "views": {}, "outputs": []}
    for view in VIEWS:
        started = time.monotonic()
        original = ORIGINALS / f"{view}.png"
        source_hash = digest(original)
        original_image = Image.open(original).convert("RGB")
        cache_file = CACHE / f"{view}-{MODEL}-rgba.png"
        cache_hash = CACHE / f"{view}-{MODEL}.sha256"
        mask_file = CACHE / f"{view}-{MODEL}-mask.png"
        mask_hash = CACHE / f"{view}-{MODEL}-mask.sha256"
        cached = (cache_file.exists() and cache_hash.exists()
                  and cache_hash.read_text().strip() == source_hash)
        if args.refresh or not cached:
            from rembg import new_session
            from rembg.bg import decontaminate_cutout
            import onnxruntime as ort
            mask_cached = (mask_file.exists() and mask_hash.exists()
                           and mask_hash.read_text().strip() == source_hash)
            if args.refresh or not mask_cached:
                print(f"Loading {MODEL}; any network request only downloads model weights.", flush=True)
                options = ort.SessionOptions()
                options.enable_cpu_mem_arena = False
                options.enable_mem_pattern = False
                session = new_session(MODEL, providers=["CPUExecutionProvider"], sess_opts=options)
                print(f"Segmenting {view} locally...", flush=True)
                mask = session.predict(original_image)[0]
                mask.save(mask_file)
                mask_hash.write_text(source_hash)
                # Free inference tensors before running the separate matting step.
                # This keeps the pipeline viable on the tested 16 GB machine.
                del session
                gc.collect()
            else:
                mask = Image.open(mask_file).convert("L")
            cutout = decontaminate_cutout(original_image, mask)
            cutout.save(cache_file)
            cache_hash.write_text(source_hash)
        else:
            cutout = Image.open(cache_file).convert("RGBA")

        # Preserve the supplied RGB exactly in opaque interiors. Only soft boundary
        # colors use the foreground estimate; the alpha coverage is unchanged.
        pixels = np.array(cutout)
        interior = pixels[:, :, 3] >= 250
        pixels[:, :, :3][interior] = np.asarray(original_image)[interior]
        cutout = Image.fromarray(pixels)

        # BiRefNet supplies a soft mask; no global white/gray keying or binary edge.
        # Ignore sub-1% numerical alpha when determining crop bounds only.
        alpha = cutout.getchannel("A")
        bbox = alpha.point(lambda value: 255 if value > 2 else 0).getbbox()
        if bbox is None:
            raise RuntimeError(f"Segmentation produced an empty mask for {view}")
        crop = cutout.crop(bbox)
        target_width = round(crop.width * SUBJECT_HEIGHT / crop.height)
        if target_width > CANVAS[0] - 48:
            raise RuntimeError(f"Unexpectedly wide view {view}; inspect source before cropping")
        subject = crop.resize((target_width, SUBJECT_HEIGHT), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", CANVAS)
        # Composite without a second alpha multiplication, preserving soft edges.
        canvas.alpha_composite(subject, ((CANVAS[0] - target_width) // 2,
                                         BASELINE - SUBJECT_HEIGHT))
        normalized[view] = canvas
        manifest["views"][view] = {
            "source_file": f"assets/originals/{view}.png",
            "source_file": original.name,
            "source_size": list(original_image.size),
            "source_sha256": source_hash,
            "source_bbox": list(bbox),
            "direction": "toward image right" if view == "right" else
                         "toward image left (two ear studs)" if view == "left" else view,
        }
        for height in (960, 480):
            derivative = canvas if height == 960 else canvas.resize((360, 480), Image.Resampling.LANCZOS)
            manifest["outputs"].append(save_webp(derivative, OUTPUT / f"{view}-{height}.webp"))
        print(f"Finished {view}: bbox={bbox}; {time.monotonic() - started:.1f}s", flush=True)

    # Square head crop from the actual front view; same unaltered identity.
    portrait = normalized["front"].crop((92, 4, 628, 540)).resize((128, 128), Image.Resampling.LANCZOS)
    # Keep margin at all edges so the portrait works without a background disk.
    portrait_canvas = Image.new("RGBA", (128, 128))
    portrait_canvas.alpha_composite(portrait.resize((116, 116), Image.Resampling.LANCZOS), (6, 6))
    manifest["outputs"].append(save_webp(portrait_canvas, OUTPUT / "avatar-128.webp"))
    review_board(normalized)
    (CACHE / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"output_count": len(manifest["outputs"]),
                      "total_webp_bytes": sum(item["bytes"] for item in manifest["outputs"]),
                      "review": str(CACHE / "avatar-review-light-dark.jpg")}), flush=True)


if __name__ == "__main__":
    main()
