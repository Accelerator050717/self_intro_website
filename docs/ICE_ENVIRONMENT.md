# Local ice studio environment

`public/images/ice/studio-cubeuv.bin.gz` is a lossless gzip of a Three.js
`RoomEnvironment` PMREM used by the ice scene. It moves environment generation
out of the visitor's first frame. The existing room, blur, and HDR format are
preserved; face resolution is explicitly reduced from 256 to 128 to lower the
download size. This is not a bit-identical replacement for the former 256 map.

## Source and reproduction

Run from this project, after installing the existing locked dependencies:

```powershell
node scripts/generate-ice-environment.mjs
```

The generator uses the installed local Chrome through `@playwright/test` and
the existing `esbuild` dependency. It bundles an in-memory browser module,
opens a temporary server on a random port bound only to `127.0.0.1`, and closes
both browser and server in `finally`. It does not start Astro or use port 4321.
The browser route permits only requests to that temporary local origin.

The upstream procedural scene is `three@0.186.0`'s
`three/addons/environments/RoomEnvironment.js`, whose source notes that it is
based on `model-viewer`'s `EnvironmentScene`. The call is exactly:

```js
const room = new RoomEnvironment();
const target = new PMREMGenerator(renderer).fromScene(room, 0.04, 0.1, 100, { size: 128 });
```

This sets `size=128` and preserves `near=0.1`, `far=100`, and camera position
`(0,0,0)`. No downloaded HDR, image service, paid API, original character image,
or outside network resource participates in generation. The texture is a local
render of that upstream procedural scene, not an independently authored HDR.

The script pins Three.js revision 186 and uses Chrome's SwiftShader path.
Repeated generation on the checked local environment produced the same raw
SHA-256. Reproducing the workflow on another Chrome/GPU implementation can
change floating-point rounding; after toolchain changes, regenerate and review
the scene before accepting a new digest.

## File contract

| Property | Value |
| --- | --- |
| Dimensions | 384 × 512 |
| Pixel format | RGBA16F; raw `Uint16Array` half-float bit patterns |
| Byte order | Little-endian |
| Row order | Bottom to top, matching GPU readback |
| Raw size | 1,572,864 bytes (1.5 MiB) |
| Gzip size | 341,829 bytes (about 334 KiB) |
| Raw SHA-256 | `939b4597f9e575809348035c12f1470988fcfe101baa686e39e943220ec46cbb` |
| Mapping | `CubeUVReflectionMapping` |
| Color space | `LinearSRGBColorSpace` |
| Filters | `LinearFilter` for minification and magnification |
| Orientation | `flipY = false` |
| Mipmaps | `generateMipmaps = false`; the PMREM atlas already contains its levels |

The adjacent `studio-cubeuv.json` carries the raw byte length and SHA-256,
compressed size, source, validation measurements, attribution, and full MIT
license. Validate the decompressed length before constructing a
`DataTexture(new Uint16Array(buffer), width, height, RGBAFormat, HalfFloatType)`.
Set the mapping, color space, filters, orientation, and mipmap flags above, then
set `needsUpdate = true`. Do not re-run `PMREMGenerator` on the atlas.

The `.bin.gz` is an actual gzip file fetched from the same origin. The loader
checks its gzip signature before using `DecompressionStream('gzip')`. If a host
sets `Content-Encoding: gzip` and the browser already decompresses the response,
the loader accepts the raw half-float bytes without decompressing them twice.

The measured 256-face bake was 1,193,140 compressed bytes. The chosen 128-face
bake is 341,829 bytes, a reduction of 851,311 bytes (about 71%). It keeps the
same scene and prefiltering algorithm at half the linear face resolution,
which reduces fine reflection detail. Scene appearance requires visual review;
the data checks below compare to a fresh bake at the same 128 resolution.

## Checked generation evidence

The generator rejects invalid dimensions, orientation, texture format, WebGL
errors, truncated readback, non-finite half floats, empty RGB values, a missing
HDR range, or any changed values during the GPU upload round trip. The gzip
output must also decompress to the exact original bytes.

| Measurement | Result |
| --- | --- |
| Non-finite half-float values | 0 |
| RGB minimum / maximum | 0 / 43 |
| RGB mean, including atlas padding | 0.6679675371463721 |
| Nonzero RGB values | 419,328 of 589,824 |
| RGB values above 1 | 41,760 |
| GPU reupload differing half words | 0 |
| Same-resolution light clear color `#f4f8fc`, differing half words | 0 |
| Same-resolution dark clear color `#101e2c`, differing half words | 0 |

Zero-valued padding is expected in the packed PMREM atlas. The nonzero count
and values above 1 demonstrate that the saved environment contains real scene
illumination and unclamped highlights. The clear-color comparisons confirm
that the enclosing room preserves the same light and dark scene environment.
The GPU round trip uses `texelFetch` at every texel, confirming both the raw
half-float payload and the `flipY=false` upload orientation without filtering
or color-conversion uncertainty.

`node --check scripts/generate-ice-environment.mjs` and the scoped ESLint check
passed. The asset was regenerated repeatedly with the same raw digest. These
are generation and GPU-data checks; browser scene appearance, startup timing,
and the integrated website's required checks are verified separately.

## Three.js license

The following upstream notice is also included in the public metadata file.

```text
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
