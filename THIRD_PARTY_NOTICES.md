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
