# Third-party notices

Keep original dependency headers, notices, attribution and source provenance. Do not describe the entire repository as MIT-licensed. [LICENSE](LICENSE) remains the repository-wide licensing notice and does not grant a blanket first-party reuse license.

## motion-ball

- Upstream: https://github.com/Mamba-working/motion-ball
- Pinned source: 957cec0acf327ef5a79f754c94b70142792b0133
- Original source, assets, agent.md and all six child documents are preserved under modules/motion-ball; its source inventory is modules/motion-ball/SOURCE-PROVENANCE.json
- The module's original docs explain its models, asset configuration and source attribution in [models.md](modules/motion-ball/docs/models.md)
- Publication and exact-source preservation are not a new license grant. No blanket upstream open-source license is asserted here

Current asset attribution, as documented by the original module:

- Poly Haven: aerial_beach_01, brown_mud_03, snow_02, rock_face_03 and HDR environment assets; CC0. [Poly Haven license](https://polyhaven.com/license)
- AWS Open Data Terrain Tiles / Mapzen: terrain height/detail data, including underlying SRTM and other terrain sources. Preserve source attribution and review the underlying data terms before reuse
- NASA's Scientific Visualization Studio: LRO CGI Moon Kit, with LROC color and LOLA elevation data; the module identifies these as public-domain assets and credits NASA SVS. [Original asset page](https://svs.gsfc.nasa.gov/4720)

The host keeps these source credits visible. This summary does not replace source terms or resolve licensing for unrelated material.

## Three.js

- Current runtime dependency: exact Three.js 0.186.1; build/type dependencies are pinned by the original module lockfile
- The generated runtime retains the Three.js MIT license at apps/web/runtime/motion/vendor/three/LICENSE and original source headers
- npm run setup installs from official npm into an ignored build copy; npm run build:web includes the required core/module builds and addon closure
- MIT applies to this dependency, not automatically to PersonalOS, motion-ball or other assets

Historical alpha.3/alpha.4 candidates used Three.js 0.180.0 and four reconstructed runtime/fixture build copies. Their version, notices and source hashes belong to those historical candidates; they are not current alpha.8 build inputs.

## GSAP and Flip

- The canonical native shell retains imported GSAP 3.15.0/Flip files and their original license headers
- Component notice: [integrations/native-shell/chat/vendor/gsap/NOTICE.txt](integrations/native-shell/chat/vendor/gsap/NOTICE.txt)
- Runtime license: [Standard No Charge GSAP License](https://gsap.com/community/standard-license/)
- Runtime licensing is separate from MIT-licensed GSAP example/skill material

## Historical Emotion Ball / aora-bot

The old renderer and its Emotion Ball character are removed from the current source and serving tree. Their historical copies remain subject to the notices and restrictions under which they were imported:

- Upstream: https://github.com/sam70361/aora-bot
- Pinned source: e3b6148c818da4a8e1966f2bc89cdb3cee473b73
- The historical LICENSE distinguishes engine/expression data from character visuals. Non-commercial sharing requires attribution and retention of the full license/copyright/notice. Engine/data commercial use requires separate commercial authorization; the ball-character visuals prohibit commercial use
- Original notices are available in the [prior public source](https://github.com/Mamba-working/personalos/tree/64c36696dcc54ba2fa108437a3be49ac830100ef/apps/web/runtime/world/vendor/aora)

The unchanged root LICENSE retains this historical notice. Removing a component from today's runtime does not alter rights to prior copies.

## Other design references

The interface contains links to motion/design research. Those links are references, not permission to reuse third-party designs or an assertion of third-party acceptance. Keep author attribution and reference links accurate.
