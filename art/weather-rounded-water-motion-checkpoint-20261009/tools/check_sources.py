"""AST/checksum and small source-math checks only. Never imports bpy or renders."""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import numpy as np
ROOT = Path(__file__).resolve().parents[1]


def load_contract():
    spec = importlib.util.spec_from_file_location('checked_contract', ROOT / 'src/contract.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def main():
    parsed = {}
    for path in ROOT.rglob('*.py'):
        if not path.is_relative_to(ROOT / 'output'):
            parsed[path.relative_to(ROOT).as_posix()] = ast.parse(path.read_text(), filename=str(path))
    sums = {}
    for line in (ROOT / 'SHA256SUMS').read_text().splitlines():
        digest, rel = line.split('  ', 1)
        p = ROOT / rel
        assert not p.is_symlink() and p.is_file(), rel
        assert hashlib.sha256(p.read_bytes()).hexdigest() == digest, rel
        sums[rel] = digest
    manifest = json.loads((ROOT / 'PUBLIC-FILE-MANIFEST.json').read_text())
    for record in manifest['files']:
        p = ROOT / record['path']
        assert p.stat().st_size == record['bytes']
        assert sums[record['path']] == record['sha256']
    mapping = json.loads((ROOT / 'SOURCE-COPY-MAPPING.json').read_text())
    for record in mapping['files']:
        assert sums[record['public_path']] == record['public_sha256']
    tree = parsed['src/continuous_water.py']
    selected = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in {'smooth', 'metric'}]
    water = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Water')
    lower = next(n for n in water.body if isinstance(n, ast.FunctionDef) and n.name == 'lower_at')
    selected.append(lower)
    namespace = {'np': np, 'MPU': 15/88}
    exec(compile(ast.Module(body=selected, type_ignores=[]), '<source-only-math>', 'exec'), namespace)
    smooth, metric, lower_at = [namespace[n] for n in ['smooth', 'metric', 'lower_at']]
    assert float(smooth(0)) == 0 and float(smooth(1)) == 1
    assert float(smooth(-2)) == 0 and float(smooth(3)) == 1
    v = np.array([[0.,0.,0.], [1.,0.,0.], [0.,1.,0.], [0.,0.,1.]])
    tr = np.array([[0,2,1], [0,1,3], [0,3,2], [1,2,3]])
    vol, center = metric(v,tr)
    assert np.isclose(vol, (15/88)**3/6)
    moved, moved_center = metric(v + [3.,7.,-2.], tr)
    assert np.isclose(moved,vol) and np.allclose(moved_center, center+[3.,7.,-2.])
    target = center + (v-center)*[1.05,.95,1.02]
    tvol, tc = metric(target,tr)
    target = center + (target-tc)*(vol/tvol)**(1/3)
    fake = SimpleNamespace(lower0=v, lower_center=center, lower_vol=vol, lower_tr=tr, rounded=target)
    assert np.allclose(lower_at(fake,0),v)
    for dt in [.00001,1/30,2/30,3/30,.15]:
        lo=lower_at(fake,dt);lv,lc=metric(lo,tr)
        assert np.isclose(lv,vol,rtol=1e-10)
        assert np.allclose(lc,center-[0,0,.5*9.81*dt*dt/(15/88)])
    guard = load_contract()
    assert guard.MASTER_SHA == 'ea4f3c4833c7f9b1c4c18ac06a19721bf86e84bbc27f2426d64e31ed644c12e7'
    old = os.environ.get('WEATHER_WORK_DIR')
    try:
        os.environ['WEATHER_WORK_DIR']=str(ROOT/'src')
        try: guard.work_dir()
        except ValueError: pass
        else: raise AssertionError('Source output path accepted')
        with tempfile.TemporaryDirectory() as temp:
            os.environ['WEATHER_WORK_DIR']=temp
            assert guard.work_dir() == Path(temp).resolve()
            p=Path(temp)/'input.txt';p.write_text('test')
            os.environ['WEATHER_TEST_INPUT']=str(p)
            assert guard.asset('fixture.txt',hashlib.sha256(b'test').hexdigest(),'WEATHER_TEST_INPUT')==p
            try: guard.asset('fixture.txt','0'*64,'WEATHER_TEST_INPUT')
            except ValueError: pass
            else: raise AssertionError('Mismatched input accepted')
            os.environ.pop('WEATHER_TEST_INPUT')
    finally:
        if old is None: os.environ.pop('WEATHER_WORK_DIR',None)
        else: os.environ['WEATHER_WORK_DIR']=old
    print(json.dumps({'AST_files':len(parsed),'SHA256_files':len(sums),
                      'small_math_and_contract_tests':'passed','Blender_started':False,
                      'rendered':False,'full_product_tests':False}))


if __name__ == '__main__':
    main()
