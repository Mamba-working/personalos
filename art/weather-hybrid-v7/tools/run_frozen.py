"""Run the retained v7 stages with output paths supplied by the portable launcher.

The three retained pipeline source files are byte-for-byte unchanged. Only the
master-scene and OIDN path expressions are replaced in memory. __file__ points
at the isolated output directory so the original D-relative output logic holds.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER_SHA256 = '3f585ba68ed972b3013eb23fcec7da99ab26671fa68502c10c0ac702432b2555'


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument('stage', choices=['extract', 'render', 'export', 'denoise', 'display'])
    parser.add_argument('--work-dir', type=Path, required=True)
    parser.add_argument('--master', type=Path, required=True)
    parser.add_argument('--oidn', type=Path)
    options = parser.parse_args(args)
    work = options.work_dir.resolve()
    master = options.master.resolve()
    if sha(master) != MASTER_SHA256:
        raise RuntimeError('Owner-provided master scene SHA-256 mismatch')
    work.mkdir(parents=True, exist_ok=True)
    if options.stage != 'denoise':
        import bpy
        if tuple(bpy.app.version) != (4, 3, 2):
            raise RuntimeError('Blender 4.3.2 is required')
    if options.stage == 'extract':
        import numpy as np
        bpy.ops.wm.open_mainfile(filepath=str(master))
        image = bpy.data.images.get('plate-scene-linear-verified.exr')
        if image is None or not image.packed_file:
            raise RuntimeError('Required packed inverse-display plate is absent')
        width, height = image.size
        rgba = np.empty(width * height * 4, np.float32)
        image.pixels.foreach_get(rgba)
        rgb = rgba.reshape(height, width, 4)[:, :, :3]
        if (width, height) != (1536, 1024) or not np.isfinite(rgb).all():
            raise RuntimeError('Unexpected packed-plate dimensions or non-finite pixels')
        # Blender pixels are bottom-up; retained process_hybrid.py reads top-down.
        destination = work / 'plate-scene-linear.npy'
        if destination.exists():
            raise RuntimeError('Use a fresh output directory; plate output already exists')
        np.save(destination, np.ascontiguousarray(rgb[::-1]))
        report = {'master_sha256': MASTER_SHA256, 'width': width, 'height': height,
                  'extraction': 'Packed float32 plate pixels; no inverse transform rerun',
                  'numpy': np.__version__, 'plate_npy_sha256': sha(destination)}
        (work / 'PACKED-PLATE-EXTRACTION.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report))
        return
    sources = {'render': 'render_full_v7.py', 'export': 'process_hybrid.py',
               'denoise': 'denoise_hybrid.py', 'display': 'process_hybrid.py'}
    name = sources[options.stage]
    code = (ROOT / 'src' / name).read_text()
    namespace = {'__name__': '__main__', '__file__': str(work / name)}
    if options.stage == 'render':
        old = "SRC=D/'hybrid-hero-structured-v7.blend'"
        if code.count(old) != 1:
            raise RuntimeError('Frozen render source path contract changed')
        code = code.replace(old, 'SRC=__MASTER__', 1)
        namespace['__MASTER__'] = master
        (work / 'V7-SAVED-SOURCE-VERIFICATION.json').write_bytes(
            (ROOT / 'provenance' / 'V7-SAVED-SOURCE-VERIFICATION.json').read_bytes())
    elif options.stage == 'denoise':
        if options.oidn is None:
            raise RuntimeError('Provide the official OIDN 2.5.1 executable')
        old = "exe=D.parent/'oidn-restore-2.5.1-20261007-9zJ5fR/oidn-2.5.1.x86_64.linux/bin/oidnDenoise'"
        if code.count(old) != 1:
            raise RuntimeError('Frozen denoiser source path contract changed')
        code = code.replace(old, 'exe=__OIDN__', 1)
        namespace['__OIDN__'] = options.oidn.resolve()
        sys.argv = [name, 'full-v7']
    else:
        sys.argv = [name, '--', options.stage, 'full-v7']
    exec(compile(code, str(ROOT / 'src' / name), 'exec'), namespace)


if __name__ == '__main__':
    main()
