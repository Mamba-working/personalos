# Third-party notices

The original notice/license files are retained with the runtime and with vendor-bearing test fixtures. Do not remove those files or describe the entire repository as MIT-licensed.

## Emotion Ball / aora-bot

- Upstream: https://github.com/sam70361/aora-bot
- Pinned source: e3b6148c818da4a8e1966f2bc89cdb3cee473b73
- Files: apps/web/runtime/world/vendor/aora/LICENSE, NOTICE.md, ATTRIBUTION.txt and SOURCE-MANIFEST.json
- The retained license distinguishes code/expression data from character visuals. Non-commercial sharing requires attribution and retention of the full license/copyright/notice. Engine/data commercial use requires its separate commercial authorization. The ball-character visuals prohibit commercial use and do not offer commercial visual licensing
- Current interface describes this as personal non-commercial motion research

This is a summary of the retained component notices, not a new license or a legal conclusion about other material.

## Three.js

- MIT license is retained at apps/web/runtime/world/vendor/three/LICENSE
- Exact version 0.180.0 is pinned in the root package/lockfile. Four build copies are reconstructed by npm run setup:vendor and are not tracked; their original SHA-256 values are recorded in provenance/vendor-dependencies.json
- The source files retain original headers; MIT applies to this dependency, not automatically to the rest of the product

## GSAP and Flip

- The imported GSAP 3.15.0/Flip files retain original license headers
- Component notice: apps/web/runtime/chat/vendor/gsap/NOTICE.txt
- Standard No Charge GSAP License: https://gsap.com/community/standard-license/
- Runtime licensing is separate from MIT-licensed GSAP example/skill material

## Other design references

The interface contains links to motion/design research. Those links are references, not a grant to reuse third-party designs or an assertion of third-party acceptance. Author attribution and reference links should remain accurate.

## Motion public App Store mechanism reference

The split-card reader is an original native-DOM adaptation of the separate shell, cover and title projection pattern in Motion's public development fixture. No Motion+ source, paid asset, demo image, branding, or Motion runtime is included. The existing PersonalOS spring clock and content/history owner are retained.

- Public source: https://github.com/motiondivision/motion/blob/e6bf03ead39cae7a2c5f8fe902ce8a9c1a9a22e8/dev/html/public/animate-layout/app-store-layout.html
- Fixed commit: e6bf03ead39cae7a2c5f8fe902ce8a9c1a9a22e8
- Upstream copyright and MIT license retained below as a precaution for this adaptation

The MIT License (MIT)

Copyright (c) 2024 [Motion](https://motion.dev) B.V.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
