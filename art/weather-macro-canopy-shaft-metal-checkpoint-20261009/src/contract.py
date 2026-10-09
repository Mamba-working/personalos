"""Hash-checked external inputs; never installs tools or copies private assets."""
import hashlib
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MASTER_SHA = '92916e52cb240c30a239327462b067053cce1d6bc2a3c43b9ad5a151fbbb67ab'
PLATE_SHA = '06658ced2144d6afb80f7a05cbb6c8cbb24196dbf0e6968577aae3d6709d4899'
BLENDER_SHA = '0dfe9af0f3e67643ecf15327fa5e14e7315f61d1a81afdcafe76a71b1918e2b4'
OIDN_SHA = '1cb3a28ebc99b90d7548b0b8b16f70c163cb59abe8582458a254aa303338269c'
def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()
def work_dir():
    p = Path(os.environ.get('WEATHER_WORK_DIR', ROOT / 'output')).resolve()
    if p == ROOT or (p.is_relative_to(ROOT) and not p.is_relative_to(ROOT / 'output')):
        raise ValueError('Output must be under checkpoint/output or outside the checkpoint')
    p.mkdir(parents=True, exist_ok=True)
    return p
def asset(name, expected, env):
    p = Path(os.environ.get(env, ROOT / 'assets' / name)).resolve()
    if not p.is_file() or sha(p) != expected:
        raise ValueError('Missing or mismatched external input: ' + name)
    return p
def master():
    return asset('master.blend', MASTER_SHA, 'WEATHER_MASTER')
def plate():
    return asset('plate-crop.npy', PLATE_SHA, 'WEATHER_PLATE')
def oidn():
    return asset('oidnDenoise', OIDN_SHA, 'WEATHER_OIDN')
