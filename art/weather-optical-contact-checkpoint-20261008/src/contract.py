"""Fixed-view pre-revision checkpoint contract. No scene construction."""
import hashlib
from pathlib import Path

MASTER_SHA256 = 'f887b703ac88d7b6728ac36b3a5f4e4f81a75c2e5d7604ef147260e62521287b'
PLATE_SHA256 = '1039d1f48c5ac373e1da1c4ba199ddeb333c83afba64f4aecce3c59a7f1aa1c7'
OIDN_SHA256 = '1cb3a28ebc99b90d7548b0b8b16f70c163cb59abe8582458a254aa303338269c'
FRAME = 49
SIZE = (1536, 1024)


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def require_hash(path, expected, label):
    path = Path(path).resolve()
    if not path.is_file() or sha(path) != expected:
        raise RuntimeError(label + ' is missing or has the wrong SHA-256')
    return path


def require_blender(bpy):
    if tuple(bpy.app.version) != (4, 3, 2):
        raise RuntimeError('This checkpoint requires Blender 4.3.2')


def require_absent(paths):
    for path in paths:
        if Path(path).exists():
            raise RuntimeError('Refusing to overwrite stage output: ' + Path(path).name)
