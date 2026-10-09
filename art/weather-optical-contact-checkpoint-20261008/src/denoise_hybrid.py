"""OIDN 2.5.1: actual guide passes for hero, color-only catcher, raw alpha kept."""
import argparse
import json
import subprocess
from pathlib import Path
from contract import OIDN_SHA256, require_absent, require_hash, sha


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--work-dir', type=Path, required=True)
    parser.add_argument('--oidn', type=Path, required=True)
    args = parser.parse_args()
    work = args.work_dir.resolve()
    executable = require_hash(args.oidn, OIDN_SHA256, 'Official OIDN 2.5.1 executable')
    for name in ('hero.pfm', 'catcher.pfm', 'albedo.pfm', 'normal.pfm', 'hero-rgba.npy'):
        if not (work / name).is_file():
            raise RuntimeError('Required exported pass missing: ' + name)
    require_absent([work / 'DENOISE-CONTRACT.json', *[work / (kind + '-denoised.pfm') for kind in ('hero', 'catcher')]])
    records = []
    for kind in ('hero', 'catcher'):
        command = [str(executable), '--device', 'cpu', '--quality', 'high', '--threads', '2',
                   '--maxmem', '1024', '--hdr', str(work / (kind + '.pfm')),
                   '--output', str(work / (kind + '-denoised.pfm'))]
        if kind == 'hero':
            command += ['--alb', str(work / 'albedo.pfm'), '--nrm', str(work / 'normal.pfm')]
        result = subprocess.run(command, capture_output=True, text=True, timeout=180)
        (work / (kind + '-denoise.log')).write_text(result.stdout + '\n' + result.stderr)
        result.check_returncode()
        records.append({'kind': kind, 'sha256': sha(work / (kind + '-denoised.pfm'))})
    report = {'oidn_sha256': OIDN_SHA256, 'records': records,
              'method': 'Official OIDN 2.5.1 HDR/high, CPU, actual hero albedo+normal guides; catcher color-only. Static plate untouched; original alpha retained.'}
    (work / 'DENOISE-CONTRACT.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
