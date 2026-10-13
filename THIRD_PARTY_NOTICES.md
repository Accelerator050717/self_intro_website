# Third-party notices

This file preserves the notice for the React Bits SpotlightCard and GradientWaves material selected for adaptation into this website, and for the OGL dependency used by GradientWaves. Existing installed packages retain their own licenses; this notice is not an exhaustive replacement for the dependency licenses. Asset origins and existing font/icon licenses are recorded in [docs/ASSETS.md](docs/ASSETS.md).

## React Bits — SpotlightCard, TypeScript + CSS

- Upstream: https://github.com/DavidHDev/react-bits
- Source version: `c5df8610c0b47d7cd805cda480baba402f7267c1`
- Source files: `src/ts-default/Components/SpotlightCard/SpotlightCard.tsx` and `SpotlightCard.css`
- Adapted files: `src/scripts/visual-effects.ts`, `src/styles/spectrum.css`
- Changes: site-specific Astro/DOM enhancement, frame-coalesced pointer updates, glacial colors, input and motion preference handling; no copied React wrapper or standalone component distribution.
- The full upstream license below is preserved verbatim. It is **MIT + Commons Clause**, not unrestricted MIT.

### Additional React Bits scope — GradientWaves, JavaScript + CSS

- Upstream: https://github.com/DavidHDev/react-bits
- Source version: `c5df8610c0b47d7cd805cda480baba402f7267c1`
- Source files: `src/content/Backgrounds/GradientWaves/GradientWaves.jsx` and `GradientWaves.css`.
- Adapted files: `src/components/waves/GradientWaves.tsx`, `gradient-waves-shaders.ts`, and `GradientWaves.css`; site parameters are supplied by `SiteWaves.tsx` in the same directory.
- Selected explicitly for this site's background using OGL. The wave/raymarch shader comes from this component; site-specific lifecycle handling covers initial uniform assignment, pause and elapsed time, visibility, motion preferences, input, resize, fallback, and cleanup.
- This is an embedded website adaptation, not a standalone component or component-library distribution. The complete React Bits license below applies to both listed components and is unchanged from the fixed upstream source.

```text
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The other researched candidates were not copied into this product: React Bits Tilted Card and Fade Content informed behavior implemented with native browser APIs; Aurora, Paper Mesh Gradient, Magic Card, and Aceternity Spotlight were evaluated as visual references; Motion supplied public performance guidance only. See [docs/VISUAL-SOURCES.md](docs/VISUAL-SOURCES.md) for exact source URLs and decisions. No official demo imagery is redistributed as a website asset.

## OGL 1.0.11 — Unlicense

- Upstream: https://github.com/oframe/ogl
- npm package: `ogl@1.0.11`; package git head: `b9e653ccac8e08211ce0678695d0a01f722e1fc2`.
- Used as the GradientWaves WebGL runtime through its existing Renderer, Program, Mesh, and Triangle APIs; the package source is not modified.
- License declaration: the fixed-version `package.json`; full text: the fixed-version `README.md`, “Unlicense” section, reproduced below.

```text
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>
```

## October 2026 character interaction revision

The new independent Web Animations timelines, state machine, garment seam SVGs,
layout continuity and reading feedback are authored for this site. GSAP Timeline /
Flip, Rive runtime / state-machine documentation, Motion layout guidance and
Codrops demonstrations were studied; their runtimes, demo assets and source code
were not incorporated in this revision. Existing React Bits / OGL notices here
continue to apply. The ten user-linked pose PNG originals are private verification
references and are not distributed with this repository. Research scope and URLs
are recorded in `docs/VISUAL-SOURCES.md`.
