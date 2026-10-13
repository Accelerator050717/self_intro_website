"""Build a small, faithful 2D greeting rig from the supplied front WebP.

No model, image generation, network request, or external image service is used.
Run: .venv-assets/Scripts/python.exe scripts/process-avatar-rig.py
Dependencies: Pillow, numpy, scipy (already in the local asset environment).
All runtime layers use the original 720 x 960 registration canvas.
"""

from __future__ import annotations

import base64
import hashlib
import importlib.metadata
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt, label

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/images/avatar/front-960.webp"
OUT = ROOT / "public/images/avatar/rig"
REVIEW = ROOT / ".verification/avatar-rig"
SIZE = (720, 960)
SS = 4
JOINTS = {"shoulder": [447, 511], "elbow": [488, 584],
          "wrist": [507, 646], "neck": [369, 468]}
# Legacy asset-envelope audit only, not the runtime choreography. The current
# independent joint timings and easing live in src/lib/avatar-motion.ts.
# SVG screen coordinates: negative angles raise the viewer-right arm.
TIMELINE = [
    {"offset": 0, "shoulder": 0, "elbow": 0, "wrist": 0, "head": 0},
    {"offset": .10, "shoulder": -8, "elbow": -6, "wrist": 0, "head": -1},
    {"offset": .28, "shoulder": -68, "elbow": -64, "wrist": -8, "head": -2},
    {"offset": .39, "shoulder": -68, "elbow": -64, "wrist": 12, "head": -2},
    {"offset": .49, "shoulder": -68, "elbow": -64, "wrist": -12, "head": -2},
    {"offset": .59, "shoulder": -68, "elbow": -64, "wrist": 12, "head": -1.5},
    {"offset": .69, "shoulder": -68, "elbow": -64, "wrist": -8, "head": -1},
    {"offset": .88, "shoulder": -9, "elbow": -7, "wrist": 0, "head": -.5},
    {"offset": 1, "shoulder": 0, "elbow": 0, "wrist": 0, "head": 0},
]


def path_mask(commands: list[tuple]) -> Image.Image:
    """Rasterize hand-traced cubic paths at 4x for a soft subpixel boundary."""
    points = []
    cursor = (0, 0)
    for command in commands:
        if command[0] in ("M", "L"):
            cursor = command[1:3]
            points.append(cursor)
        elif command[0] == "C":
            a = np.array(cursor, dtype=float)
            b, c, d = (np.array(command[i:i + 2], dtype=float)
                       for i in (1, 3, 5))
            for t in np.linspace(0, 1, 40)[1:]:
                p = (1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d
                points.append(tuple(p))
            cursor = tuple(d)
        else:
            raise ValueError(command)
    image = Image.new("L", (SIZE[0] * SS, SIZE[1] * SS))
    ImageDraw.Draw(image).polygon([(round(x * SS), round(y * SS)) for x, y in points], fill=255)
    return image.resize(SIZE, Image.Resampling.LANCZOS)


def ellipse(box: tuple[float, float, float, float]) -> Image.Image:
    image = Image.new("L", (SIZE[0]*SS, SIZE[1]*SS))
    ImageDraw.Draw(image).ellipse(tuple(round(n*SS) for n in box), fill=255)
    return image.resize(SIZE, Image.Resampling.LANCZOS)


def cut(image: Image.Image, mask: Image.Image) -> Image.Image:
    result = image.copy()
    result.putalpha(ImageChops.multiply(result.getchannel("A"), mask))
    return result


def smooth_extend(image: Image.Image, new_mask: Image.Image) -> Image.Image:
    """Extend only a small hidden joint cap with nearest adjacent sleeve pixels.

    Interior pixels are unchanged. This is a texture edge extension, not an
    invented body part. The cap is rounded and hidden under the next segment.
    """
    pixels = np.asarray(image).copy()
    original_alpha = pixels[:, :, 3]
    desired = np.maximum(original_alpha, np.asarray(new_mask))
    empty = (original_alpha < 240) & (desired > original_alpha)
    _, indices = distance_transform_edt(original_alpha < 240, return_indices=True)
    nearest = pixels[indices[0], indices[1], :3]
    softened = np.asarray(Image.fromarray(nearest).filter(ImageFilter.GaussianBlur(1.3)))
    pixels[:, :, :3][empty] = softened[empty]
    pixels[:, :, 3] = desired
    return Image.fromarray(pixels)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def remove_specks(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image).copy()
    labels, count = label(pixels[:, :, 3] > 6)
    if count:
        areas = np.bincount(labels.ravel())
        keep = np.argmax(areas[1:]) + 1
        # The three limb assets have exactly one connected subject. Disconnected
        # numerical alpha in the original matte must not become flying fragments.
        pixels[:, :, 3][labels != keep] = 0
    return Image.fromarray(pixels)


def audit_motion(layers: dict[str, Image.Image]) -> dict:
    """Check a conservative transformed-bbox envelope, not just one screenshot."""
    def rotate(degrees, joint):
        x, y = joint
        angle = np.deg2rad(degrees)
        c, s = np.cos(angle), np.sin(angle)
        return np.array([[c, -s, x-c*x+s*y], [s, c, y-s*x-c*y], [0, 0, 1]])

    all_bounds = []
    for t in np.linspace(0, 1, 201):
        a, b = TIMELINE[0], TIMELINE[-1]
        for i in range(1, len(TIMELINE)):
            if t <= TIMELINE[i]["offset"]:
                a, b = TIMELINE[i - 1], TIMELINE[i]
                break
        u = np.clip((t-a["offset"])/(b["offset"]-a["offset"]), 0, 1)
        u = u*u*(3-2*u)
        p = {name: a[name]+(b[name]-a[name])*u
             for name in ("shoulder", "elbow", "wrist", "head")}
        shoulder = rotate(p["shoulder"], JOINTS["shoulder"])
        elbow = shoulder @ rotate(p["elbow"], JOINTS["elbow"])
        wrist = elbow @ rotate(p["wrist"], JOINTS["wrist"])
        matrices = {"body": np.eye(3), "upper-arm": shoulder,
                    "forearm": elbow, "hand": wrist,
                    "head": rotate(p["head"], JOINTS["neck"])}
        for name, image in layers.items():
            x0, y0, x1, y1 = image.getchannel("A").getbbox()
            points = matrices[name] @ np.array([[x0, x1, x0, x1], [y0, y0, y1, y1], [1, 1, 1, 1]])
            all_bounds.append([points[0].min(), points[1].min(), points[0].max(), points[1].max()])
    values = np.array(all_bounds)
    envelope = [float(values[:, 0].min()), float(values[:, 1].min()),
                float(values[:, 2].max()), float(values[:, 3].max())]
    inside = envelope[0] >= 0 and envelope[1] >= 0 and envelope[2] <= SIZE[0] and envelope[3] <= SIZE[1]
    # This is the original stationary hand area, now empty on the body layer.
    hand_removed = np.asarray(layers["body"].getchannel("A"))[655:692, 487:540].max() == 0
    assert inside, envelope
    assert hand_removed, "The body layer still contains the original hand"
    assert all(TIMELINE[-1][name] == 0 for name in ("shoulder", "elbow", "wrist", "head"))
    return {"samples": 201, "conservativeBboxEnvelope": [round(v, 2) for v in envelope],
            "allSamplesInsideCanvas": bool(inside), "stationaryHandRemovedFromBody": bool(hand_removed),
            "endAnglesExactlyZero": True, "feet": "Only the body layer contains feet and that layer has an identity transform."}


def create_prototype(layers: dict[str, Image.Image]) -> None:
    encoded = {}
    for name in layers:
        encoded[name] = "data:image/webp;base64," + base64.b64encode((OUT / f"{name}.webp").read_bytes()).decode()
    image = lambda name: f'<image href="{encoded[name]}" width="720" height="960"/>'
    svg = f'''<svg viewBox="0 0 720 960" xmlns="http://www.w3.org/2000/svg" aria-label="Local layered greeting prototype">
      {image('body')}
      <g id="shoulder">{image('upper-arm')}<g id="elbow"><g id="wrist">{image('hand')}</g>{image('forearm')}</g></g>
      <g id="head">{image('head')}</g>
    </svg>'''
    html = '''<!doctype html><html lang="en"><meta charset="utf-8"><title>Local avatar rig verification</title>
    <style>*{box-sizing:border-box}body{margin:0;background:#eff6fa;color:#17374b;font:15px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:24px;max-width:1300px;margin:auto}.stage{position:relative;background:linear-gradient(#f9fcfe,#dfedf6);border-radius:20px;min-width:0}.stage.dark{background:linear-gradient(#182e42,#102030)}svg{display:block;width:100%;height:auto}h1{font-size:18px;margin:0 0 16px}.label{position:absolute;bottom:8px;left:15px;color:#295068}.dark .label{color:#c3e5f7}button,input{font:inherit}button{padding:8px 16px;margin-right:12px}.controls{padding:16px 24px}code{font-size:12px}header{padding:18px 24px 0}</style>
    <header><h1>Original character · articulated viewer-right arm</h1><div id="readout"></div></header>
    <div class="controls"><button id="hello">Greeting</button><input id="time" type="range" min="0" max="1" step=".001" value="0"></div>
    <main><div class="stage">SVG_LIGHT<div class="label">Light background</div></div><div class="stage dark">SVG_DARK<div class="label">Dark background</div></div></main>
    <script>
    const timeline = TIMELINE, joints = JOINTS;
    const svgs = [...document.querySelectorAll('svg')];
    function pose(t) {
      let a=timeline[0],b=timeline[timeline.length-1];
      for(let i=1;i<timeline.length;i++)if(t<=timeline[i].offset){a=timeline[i-1];b=timeline[i];break;}
      const raw=Math.max(0,Math.min(1,(t-a.offset)/(b.offset-a.offset))); const u=raw*raw*(3-2*raw);
      const p={}; for(const name of ['shoulder','elbow','wrist','head'])p[name]=a[name]+(b[name]-a[name])*u;
      for(const svg of svgs)for(const name of ['shoulder','elbow','wrist','head']){const [x,y]=joints[name==='head'?'neck':name];svg.querySelector('#'+name).setAttribute('transform',`rotate(${p[name]} ${x} ${y})`);}
      document.querySelector('#readout').textContent=`${(t*2.6).toFixed(2)} s · shoulder ${p.shoulder.toFixed(1)}° · elbow ${p.elbow.toFixed(1)}° · wrist ${p.wrist.toFixed(1)}°`;
      document.querySelector('#time').value=t; return p;
    }
    window.setRigTime=pose;
    document.querySelector('#time').oninput=e=>pose(Number(e.target.value));
    let playing=false; document.querySelector('#hello').onclick=()=>{if(playing)return;playing=true;const started=performance.now();function frame(now){const t=Math.min(1,(now-started)/2600);pose(t);if(t<1)requestAnimationFrame(frame);else playing=false;}requestAnimationFrame(frame);};
    pose(0);
    </script></html>'''
    html = html.replace("SVG_LIGHT", svg).replace("SVG_DARK", svg)
    html = html.replace("TIMELINE", json.dumps(TIMELINE)).replace("JOINTS", json.dumps(JOINTS))
    (REVIEW / "prototype.html").write_text(html, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != SIZE:
        raise ValueError("The traced masks require the existing 720 x 960 front derivative")

    # Follow the lower face/hair, then the visible neck down into the hood's V.
    head_mask = path_mask([
        ("M", 0, 0), ("L", 720, 0), ("L", 720, 442), ("L", 441, 442),
        ("C", 427, 446, 413, 447, 397, 448), ("L", 396, 458),
        ("C", 388, 465, 379, 471, 370, 477), ("L", 348, 460),
        ("L", 348, 450), ("C", 326, 450, 307, 447, 291, 441),
        ("L", 0, 441),
    ])
    head = cut(source, head_mask)

    # One manually traced inside-sleeve boundary removes the original waving
    # arm, cuff and hand from the torso. The other arm and legs remain untouched.
    arm_mask = path_mask([
        ("M", 445, 491), ("L", 720, 491), ("L", 720, 700), ("L", 478, 700),
        ("L", 478, 651), ("C", 463, 650, 458, 641, 455, 630),
        ("C", 447, 610, 444, 595, 440, 579),
        ("C", 434, 557, 430, 540, 432, 526),
        ("C", 433, 511, 437, 498, 445, 491),
    ])
    arm = cut(source, arm_mask)
    body = cut(cut(source, ImageChops.invert(head_mask)), ImageChops.invert(arm_mask))

    # A collar backing uses the source's dark inside-hood texture. Only a small
    # region behind the moving neck is filled, never the face or hair.
    collar_shape = path_mask([
        ("M", 337, 444), ("C", 352, 442, 386, 441, 406, 445),
        ("L", 402, 467), ("L", 371, 480), ("L", 337, 465),
    ])
    collar = Image.new("RGBA", SIZE)
    texture = source.crop((326, 449, 345, 465)).resize((74, 38), Image.Resampling.BICUBIC)
    collar.paste(texture, (335, 442))
    collar = cut(collar, collar_shape)
    collar.alpha_composite(body)
    body = collar
    collar_overlap = path_mask([
        ("M", 292, 444), ("C", 327, 437, 406, 433, 438, 437),
        ("C", 445, 438, 446, 445, 448, 453), ("L", 398, 463),
        ("L", 339, 463), ("L", 292, 453),
    ])
    body = smooth_extend(body, collar_overlap)

    # Overlapping rounded joint caps retain the source garment's folds rather
    # than stretching a sleeve or adding a colored rectangle over a joint.
    upper_mask = path_mask([
        ("M", 429, 484), ("L", 457, 484),
        ("C", 473, 507, 491, 534, 508, 553),
        ("C", 525, 565, 531, 580, 521, 596),
        ("C", 510, 613, 485, 616, 460, 607),
        ("C", 446, 603, 438, 585, 438, 565),
        ("C", 432, 542, 429, 510, 429, 484),
    ])
    upper = cut(arm, upper_mask)
    shoulder_cap = ellipse((430, 495, 466, 530))
    # Avoid adding a bulky silhouette: this cap only closes the proximal end.
    upper = smooth_extend(upper, shoulder_cap)

    forearm_mask = path_mask([
        ("M", 451, 593), ("C", 451, 572, 467, 558, 488, 560),
        ("C", 512, 559, 537, 580, 539, 601),
        ("L", 550, 645), ("L", 542, 674), ("L", 472, 674),
        ("L", 451, 637), ("C", 448, 621, 450, 608, 451, 593),
    ])
    # Cuff-hand split follows the diagonal seam; the source hand is unchanged.
    hand_mask = path_mask([
        ("M", 493, 655), ("L", 525, 642), ("L", 560, 699), ("L", 477, 699),
    ])
    hand = cut(arm, hand_mask)
    forearm = cut(cut(arm, forearm_mask), ImageChops.invert(hand_mask))
    hand = smooth_extend(hand, ellipse((495, 637, 520, 663)))
    upper, forearm, hand = (remove_specks(part) for part in (upper, forearm, hand))

    # Restore the small original-fabric sliver at the armpit to the torso.
    # Rounded moving joint caps otherwise reveal 3-7 px of background at idle.
    armpit_backing = path_mask([
        ("M", 430, 536), ("C", 434, 565, 443, 588, 452, 604),
        ("C", 459, 616, 464, 632, 461, 642), ("L", 454, 650),
        ("L", 428, 608), ("L", 424, 549),
    ])
    body.alpha_composite(cut(source, armpit_backing))
    # The sleeve's last narrow fold is not part of the torso hem. Round this
    # 4 x 14 px remnant away so it cannot appear as a dangling black point.
    hem_outline = path_mask([
        ("M", 0, 0), ("L", 720, 0), ("L", 720, 610), ("L", 470, 610),
        ("C", 460, 615, 461, 626, 456, 633),
        ("C", 452, 638, 458, 643, 458, 649),
        ("C", 459, 654, 451, 659, 446, 660),
        ("L", 720, 660), ("L", 720, 960), ("L", 0, 960),
    ])
    body = cut(body, hem_outline)

    layers = {"body": body, "upper-arm": upper, "hand": hand,
              "forearm": forearm, "head": head}
    manifest = {
        "version": 1, "type": "registered-2d-image-rig", "width": SIZE[0], "height": SIZE[1],
        "source": "/images/avatar/front-960.webp", "sourceSha256": sha(SOURCE),
        "coordinates": "Original full-canvas image coordinates; x right, y down; SVG positive angle is clockwise.",
        "wavingSide": "viewer-right (character anatomical left)", "joints": JOINTS,
        "layerOrder": ["body", "upper-arm", "hand", "forearm", "head"],
        "occlusion": "Inside elbow group: wrist group with hand first, then forearm image. The cuff hides the extended proximal hand cap.",
        "hierarchy": {"body": None, "upper-arm": "shoulder", "forearm": "elbow", "hand": "wrist", "head": "neck"},
        "motionSource": "src/lib/avatar-motion.ts; independent native joint timelines, exact completion before unlock", "layers": {},
        "encoding": "WebP quality 95; exact alpha; RGB of fully transparent pixels cleared before encoding",
        "method": "Hand-traced subpixel masks on the supplied derivative; original RGBA interior; local collar texture backing and sleeve edge extension only.",
        "limitations": ["2D articulated photo layers, not a 3D model", "The supplied small hand remains in its original gently curled pose", "Use the checked angle range; unseen back surfaces are not synthesized"],
    }
    for name, layer in layers.items():
        path = OUT / f"{name}.webp"
        # Hidden RGB has no rendering role. Clear it to avoid storing the other
        # character parts in every tiny limb file; visible texture is unchanged.
        pixels = np.array(layer)
        pixels[pixels[:, :, 3] == 0, :3] = 0
        layer = Image.fromarray(pixels)
        layers[name] = layer
        layer.save(path, "WEBP", quality=95, method=6, exact=True)
        manifest["layers"][name] = {"src": f"/images/avatar/rig/{name}.webp", "width": SIZE[0], "height": SIZE[1], "alphaBbox": list(layer.getchannel("A").getbbox()), "bytes": path.stat().st_size, "sha256": sha(path)}
    (OUT / "rig.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    motion_audit = audit_motion(layers)
    (REVIEW / "asset-checks.json").write_text(json.dumps({"motion": motion_audit,
        "sourceUnchangedSha256": sha(SOURCE), "runtimeBytes": sum(item["bytes"] for item in manifest["layers"].values()),
        "packages": {name: importlib.metadata.version(name) for name in ("Pillow", "numpy", "scipy")}}, indent=2), encoding="utf-8")
    composite = Image.new("RGBA", SIZE)
    for layer in layers.values():
        composite.alpha_composite(layer)
    composite.save(REVIEW / "idle-composite.png")
    background = Image.new("RGBA", SIZE, "#eff6fa")
    background.alpha_composite(body)
    background.save(REVIEW / "body-with-original-arm-removed.png")
    create_prototype(layers)
    print(json.dumps({"layers": len(layers), "totalBytes": sum(item["bytes"] for item in manifest["layers"].values()), "joints": JOINTS, "prototype": str(REVIEW / "prototype.html")}, indent=2))


if __name__ == "__main__":
    main()
