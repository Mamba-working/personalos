"""Keep retained resource/deadline guard reports inside the isolated output tree."""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--work-dir', type=Path, required=True)
parser.add_argument('--label', required=True)
parser.add_argument('--timeout', type=int, required=True)
parser.add_argument('command', nargs=argparse.REMAINDER)
options = parser.parse_args()
work = options.work_dir.resolve()
work.mkdir(parents=True, exist_ok=True)
sys.argv = ['run_guarded.py', '--label', options.label, '--timeout', str(options.timeout),
            *options.command]
source = ROOT / 'src' / 'run_guarded.py'
exec(compile(source.read_text(), str(source), 'exec'),
     {'__name__': '__main__', '__file__': str(work / 'run_guarded.py')})
