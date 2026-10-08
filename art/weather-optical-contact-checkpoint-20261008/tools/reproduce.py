"""Source checks and dry-run planning by default; execution requires --execute."""
import argparse
import ast
import fcntl
import json
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from contract import MASTER_SHA256, OIDN_SHA256, PLATE_SHA256, sha


def source_checks():
    inventory = json.loads((ROOT / 'PUBLIC-FILE-MANIFEST.json').read_text())
    expected = {item['path']: item for item in inventory['files']}
    excluded = {'PUBLIC-FILE-MANIFEST.json', 'SHA256SUMS'}
    ignored = {'output', '.dependencies', 'assets', '__pycache__'}
    actual = {path.relative_to(ROOT).as_posix() for path in ROOT.rglob('*')
              if path.is_file() and not ignored.intersection(path.relative_to(ROOT).parts)
              and path.relative_to(ROOT).as_posix() not in excluded}
    if actual != set(expected):
        raise RuntimeError('Public source inventory mismatch')
    count = 0
    for name, item in expected.items():
        path = ROOT / name
        if path.is_symlink() or sha(path) != item['sha256'] or path.stat().st_size != item['bytes']:
            raise RuntimeError('Public source identity mismatch: ' + name)
        if path.suffix == '.py':
            ast.parse(path.read_text(), filename=name)
            count += 1
    checksum_paths = set()
    for line in (ROOT / 'SHA256SUMS').read_text().splitlines():
        digest, name = line.split('  ', 1)
        if name not in set(expected) | {'PUBLIC-FILE-MANIFEST.json'} or sha(ROOT / name) != digest:
            raise RuntimeError('Source checksum mismatch')
        checksum_paths.add(name)
    if checksum_paths != set(expected) | {'PUBLIC-FILE-MANIFEST.json'}:
        raise RuntimeError('Source checksum inventory incomplete')
    return {'public_files': len(expected) + 2, 'python_syntax_files': count, 'source_checks': 'pass'}


def identity(path, expected):
    return 'missing' if not path.is_file() else ('verified' if sha(path) == expected else 'hash-mismatch')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('stage', choices=['verify', 'render', 'export', 'denoise', 'display', 'pipeline'])
    parser.add_argument('--master', type=Path, default=ROOT / 'assets' / 'master.blend')
    parser.add_argument('--plate', type=Path, default=ROOT / 'assets' / 'plate-scene-linear.npy')
    parser.add_argument('--oidn', type=Path, default=ROOT / '.dependencies' / 'oidnDenoise')
    parser.add_argument('--blender', default='blender')
    parser.add_argument('--work-dir', type=Path, default=ROOT / 'output' / 'checkpoint')
    parser.add_argument('--lock-file', type=Path)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    checks = source_checks()
    master, plate, oidn = args.master.resolve(), args.plate.resolve(), args.oidn.resolve()
    states = {'master': identity(master, MASTER_SHA256), 'plate': identity(plate, PLATE_SHA256),
              'oidn': identity(oidn, OIDN_SHA256)}
    if args.stage == 'verify':
        print(json.dumps({**checks, 'external_inputs': states, 'render_validation': 'not-run'}, indent=2))
        return
    work = args.work_dir.resolve()
    output_root = (ROOT / 'output').resolve()
    if output_root not in work.parents:
        raise RuntimeError('Work directory must be a child of this kit output tree')
    stages = ['render', 'export', 'denoise', 'display'] if args.stage == 'pipeline' else [args.stage]
    if args.execute and ('render' in stages) and work.exists() and any(work.iterdir()):
        raise RuntimeError('Render requires a fresh, empty output directory')
    if args.execute and any(state != 'verified' for state in states.values()):
        raise RuntimeError('Exact externally supplied master, calibrated plate and OIDN are required')
    timeouts = {'render': 600, 'export': 90, 'denoise': 180, 'display': 90}
    for stage in stages:
        if stage == 'render':
            script_args = [str(ROOT / 'src' / 'render_full.py'), '--', '--master', str(master), '--work-dir', str(work)]
        elif stage == 'denoise':
            script_args = [str(ROOT / 'src' / 'denoise_hybrid.py'), '--oidn', str(oidn), '--work-dir', str(work)]
        else:
            script_args = [str(ROOT / 'src' / 'process_hybrid.py'), '--', stage, '--plate', str(plate), '--work-dir', str(work)]
        command = ([sys.executable, *script_args] if stage == 'denoise' else
                   [args.blender, '-b', '-t', '2', '--python-exit-code', '1', '--python', *script_args])
        guarded = [sys.executable, str(ROOT / 'tools' / 'guard.py'), '--work-dir', str(work),
                   '--label', 'checkpoint-' + stage, '--timeout', str(timeouts[stage]), '--', *command]
        print(json.dumps({'stage': stage, 'execute': args.execute, 'command': guarded}), flush=True)
        if not args.execute:
            continue
        work.mkdir(parents=True, exist_ok=True)
        lock_path = args.lock_file.resolve() if args.lock_file else output_root / '.heavy-check.lock'
        with lock_path.open('a') as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            subprocess.run(guarded, check=True)


if __name__ == '__main__':
    main()
