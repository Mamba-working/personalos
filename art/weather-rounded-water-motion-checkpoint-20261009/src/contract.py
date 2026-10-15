"""External inputs and isolated outputs for this source-only render checkpoint."""
import hashlib
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MASTER_SHA = 'ea4f3c4833c7f9b1c4c18ac06a19721bf86e84bbc27f2426d64e31ed644c12e7'
PLATE_SHA = '1039d1f48c5ac373e1da1c4ba199ddeb333c83afba64f4aecce3c59a7f1aa1c7'
PADDED_PLATE_SHA = '9168001bf426c3570878eebf0d8fbaca7ce8a73900ec53a57c4ed0126978fc94'
OIDN_SHA = '1cb3a28ebc99b90d7548b0b8b16f70c163cb59abe8582458a254aa303338269c'
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def work_dir():
    p = Path(os.environ.get('WEATHER_WORK_DIR', ROOT / 'output')).resolve()
    if p == ROOT or (p.is_relative_to(ROOT) and not p.is_relative_to(ROOT / 'output')):
        raise ValueError('Output must be under checkpoint/output or outside the checkpoint')
    p.mkdir(parents=True, exist_ok=True)
    return p
def asset(name, expected, env=None):
    p = Path(os.environ.get(env, ROOT / 'assets' / name) if env else ROOT / 'assets' / name).resolve()
    if not p.is_file() or sha(p) != expected:
        raise ValueError('Missing or mismatched external input: ' + name)
    return p
def master():
    return asset('master.blend', MASTER_SHA, 'WEATHER_MASTER')
def plate():
    return asset('plate-scene-linear.npy', PLATE_SHA, 'WEATHER_PLATE')
def padded_plate():
    p = Path(os.environ.get('WEATHER_PADDED_PLATE', work_dir() / 'full900/padded-plate.npy')).resolve()
    if not p.is_file() or sha(p) != PADDED_PLATE_SHA:
        raise ValueError('Missing or mismatched exact native900 plate')
    return p
def oidn():
    p = Path(os.environ.get('WEATHER_OIDN', ROOT / 'assets/oidnDenoise')).resolve()
    if not p.is_file() or sha(p) != OIDN_SHA:
        raise ValueError('Missing or mismatched official OIDN executable')
    return p
