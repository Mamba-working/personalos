#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p qa/results
python3 qa/verify-public-source.py
for file in qa/validate-candidate.mjs qa/geometry-static.mjs qa/independent/independent-contracts.mjs qa/independent/lifecycle-contracts.mjs qa/independent/lighting-wiring-contracts.mjs qa/independent/identity-protection.mjs qa/independent/pool-stress.mjs; do
  node --experimental-loader ./qa/three-resolver.mjs "$file"
done
for file in public/*.js public/*.mjs; do node --check "$file"; done
python3 qa/verify-public-source.py --reproduce-runtime-zip
