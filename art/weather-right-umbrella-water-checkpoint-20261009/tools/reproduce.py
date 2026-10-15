"""Plan by default; bounded exact-master still replay only with --execute."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
import contract

def plan(work, blender='blender', oidn='oidnDenoise', master=None):
    master = str(master or os.environ.get('WEATHER_MASTER', ROOT / 'assets/master.blend'))
    def blend(script, *args):
        return [blender, '-b', '-t', '2', '--python-exit-code', '1', '--python', str(ROOT / 'src' / script), '--', *args]
    commands = [
        ('render-final-native900-512', 2400, blend('reproduce_render.py', '--blend', master, '--output', str(work))),
        ('export-final-native900', 180, blend('reproduce_postprocess.py', '--output', str(work), '--stage', 'export')),
        ('denoise-final-native900', 180, [sys.executable, str(ROOT / 'src/reproduce_denoise.py'), '--oidn', oidn, '--output', str(work)]),
        ('display-final-native900', 180, blend('reproduce_postprocess.py', '--output', str(work), '--stage', 'display')),
    ]
    return [{'label': label, 'timeout_seconds': timeout,
             'command': ['flock', '--close', str(work / 'heavy-render.lock'), sys.executable, str(ROOT / 'tools/guard.py'), '--work-dir', str(work), '--label', label, '--timeout', str(timeout), '--', *cmd]}
            for label, timeout, cmd in commands]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    work = contract.work_dir()
    commands = plan(work)
    if args.execute:
        master = contract.master(); contract.plate(); oidn = contract.oidn()
        blender = shutil.which(os.environ.get('BLENDER_BIN', 'blender'))
        if not blender or contract.sha(blender) != contract.BLENDER_SHA:
            raise ValueError('Exact recorded official Blender executable is required')
        if not shutil.which('flock'):
            raise ValueError('Linux flock is required')
        if any(work.glob('*.exr')) or (work / 'processed').exists():
            raise ValueError('Use a fresh output directory without render or processing artifacts')
        commands = plan(work, blender, str(oidn), master)
    for row in commands:
        print(json.dumps({'execute': args.execute, **row}), flush=True)
        if args.execute:
            subprocess.run(row['command'], env={**os.environ, 'WEATHER_WORK_DIR': str(work)}, check=True)
    if args.execute:
        contract.master(); contract.plate()

if __name__ == '__main__':
    main()
