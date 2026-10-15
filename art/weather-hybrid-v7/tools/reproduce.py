"""Validate source-only inventory or explicitly run an owner-supplied master.

Stages print their command by default. --execute opts into bounded execution.
No dependency download, install, scene rebuilding, publication or deployment.
"""
import argparse
import ast
import fcntl
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def source_checks():
    inventory = json.loads((ROOT / 'provenance' / 'PUBLIC-FILE-MANIFEST.json').read_text())
    expected = {entry['path']: entry for entry in inventory['files']}
    actual = {path.relative_to(ROOT).as_posix() for path in ROOT.rglob('*')
              if path.is_file() and 'output' not in path.relative_to(ROOT).parts
              and '.dependencies' not in path.relative_to(ROOT).parts
              and '__pycache__' not in path.relative_to(ROOT).parts
              and path.relative_to(ROOT).as_posix() not in {
                  'provenance/PUBLIC-FILE-MANIFEST.json',
                  'assets/environment/approved-scene-clean-environment-v1.png'}
              and not path.name.endswith('.blend')}
    if actual != set(expected):
        raise RuntimeError('Public payload inventory differs: ' +
                           json.dumps({'missing': sorted(set(expected) - actual),
                                       'unexpected': sorted(actual - set(expected))}))
    count = 0
    for relative, entry in expected.items():
        path = ROOT / relative
        if path.is_symlink() or sha(path) != entry['sha256']:
            raise RuntimeError('Public payload file hash mismatch: ' + relative)
        if path.suffix == '.py':
            ast.parse(path.read_text(), filename=relative)
            count += 1
    return {'public_files': len(expected), 'python_syntax_files': count,
            'inventory_and_hashes': 'pass', 'python_syntax': 'pass'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('stage', choices=['verify', 'extract', 'render', 'export',
                                         'denoise', 'display', 'pipeline'])
    parser.add_argument('--master', type=Path, default=ROOT / 'assets' / 'scene' / 'master.blend')
    parser.add_argument('--oidn', type=Path)
    parser.add_argument('--blender', default='blender')
    parser.add_argument('--work-dir', type=Path, default=ROOT / 'output' / 'v7')
    parser.add_argument('--lock-file', type=Path)
    parser.add_argument('--execute', action='store_true')
    options = parser.parse_args()
    checks = source_checks()
    manifest = json.loads((ROOT / 'provenance' / 'DEPENDENCIES.json').read_text())
    expected = manifest['master_scene']['sha256']
    master = options.master.resolve()
    master_state = 'missing' if not master.is_file() else (
        'verified' if sha(master) == expected else 'hash-mismatch')
    oidn_state = 'not-supplied' if options.oidn is None else (
        'missing' if not options.oidn.is_file() else (
            'verified' if sha(options.oidn) == manifest['oidn']['executable_sha256'] else 'hash-mismatch'))
    if options.stage == 'verify':
        print(json.dumps({**checks, 'master_scene': master_state,
                          'oidn_executable': oidn_state,
                          'render_validation': 'not-run',
                          'reproducibility': 'Requires the exact owner-provided packed master'}, indent=2))
        return
    work = options.work_dir.resolve()
    output_root = (ROOT / 'output').resolve()
    if work != output_root and output_root not in work.parents:
        raise RuntimeError('Work directory must be beneath this kit\'s output directory')
    stages = ['extract', 'render', 'export', 'denoise', 'display'] if options.stage == 'pipeline' else [options.stage]
    timeouts = {'extract': 90, 'render': 600, 'export': 90, 'denoise': 180, 'display': 90}
    for stage in stages:
        worker = [str(ROOT / 'tools' / 'run_frozen.py'), '--', stage,
                  '--work-dir', str(work), '--master', str(master)]
        if options.oidn is not None:
            worker += ['--oidn', str(options.oidn.resolve())]
        command = ([sys.executable, *worker] if stage == 'denoise' else
                   [options.blender, '-b', '-t', '2', '--python-exit-code', '1',
                    '--python', *worker])
        guarded = [sys.executable, str(ROOT / 'tools' / 'guard.py'),
                   '--work-dir', str(work), '--label', 'hybrid-' + stage,
                   '--timeout', str(timeouts[stage]), '--', *command]
        print(json.dumps({'stage': stage, 'execute': options.execute, 'command': guarded}), flush=True)
        if not options.execute:
            continue
        if master_state != 'verified':
            raise RuntimeError('Exact owner-provided packed master is required')
        if stage == 'denoise' and oidn_state != 'verified':
            raise RuntimeError('Exact official OIDN executable is required')
        work.mkdir(parents=True, exist_ok=True)
        lock_path = options.lock_file.resolve() if options.lock_file else output_root / '.heavy-check.lock'
        with lock_path.open('a') as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            subprocess.run(guarded, check=True)


if __name__ == '__main__':
    main()
