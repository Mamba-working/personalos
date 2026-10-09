"""Print bounded offline reproduction stages; execute only with explicit --execute."""
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


def plan(pipeline, work, blender='blender'):
    def blend(script, *args):
        return [blender, '-b', '-t', '2', '--python-exit-code', '1', '--python',
                str(ROOT / 'src' / script), *(['--', *args] if args else [])]
    if pipeline == 'full':
        commands = [('render-full900-512', 2400, blend('render_full900.py')),
                    ('export-full900-512', 180, blend('process_frame.py', 'full900', 'export')),
                    ('denoise-full900-512', 180, [sys.executable, str(ROOT / 'src/denoise_frame.py')]),
                    ('display-full900-512', 180, blend('process_frame.py', 'full900', 'display'))]
    else:
        commands = [('prepare-native900-plate', 180, blend('prepare_plate.py')),
                    ('audit-water-geometry', 240, blend('audit_animation.py')),
                    ('audit-water-subframes', 240, blend('audit_continuity_detail.py')),
                    ('pilot-native-rim128', 300, blend('render_frames.py', 'pilot')),
                    ('sequence-native-rim128', 1200, blend('render_frames.py', 'sequence')),
                    ('encode-and-decode-preview', 180, [sys.executable, str(ROOT / 'src/package_preview.py')])]
    lock = os.environ.get('WEATHER_RENDER_LOCK', str(work / 'heavy-render.lock'))
    return [{'label': label, 'timeout_seconds': timeout,
             'command': ['flock', '--close', lock, sys.executable, str(ROOT / 'tools/guard.py'),
                         '--work-dir', str(work), '--label', label, '--timeout', str(timeout), '--', *cmd]}
            for label, timeout, cmd in commands]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pipeline', choices=['full', 'motion'], required=True)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    work = contract.work_dir()
    commands = plan(args.pipeline, work)
    if args.execute:
        contract.master(); contract.plate(); contract.oidn()
        blender = shutil.which('blender')
        if not blender or contract.sha(blender) != '0dfe9af0f3e67643ecf15327fa5e14e7315f61d1a81afdcafe76a71b1918e2b4':
            raise ValueError('Exact recorded official Blender executable is required')
        if not shutil.which('flock'):
            raise ValueError('Linux flock is required')
        if args.pipeline == 'motion' and (not shutil.which('ffmpeg') or not shutil.which('ffprobe')):
            raise ValueError('External ffmpeg/ffprobe are required')
        commands = plan(args.pipeline, work, blender)
    for record in commands:
        print(json.dumps({'execute': args.execute, **record}), flush=True)
        if args.execute:
            subprocess.run(record['command'], env={**os.environ, 'WEATHER_WORK_DIR': str(work)}, check=True)
    if args.execute:
        contract.master()  # Verify source input remains byte-identical after all stages.


if __name__ == '__main__':
    main()
