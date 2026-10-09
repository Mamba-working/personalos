"""AST/hash/source-helper checks only. No Blender, render, asset download or scene save."""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def main():
    manifest = json.loads((ROOT / 'PUBLIC-FILE-MANIFEST.json').read_text())
    sums = dict(line.split('  ', 1)[::-1] for line in (ROOT / 'SHA256SUMS').read_text().splitlines())
    parsed = {}
    for row in manifest['files']:
        p = ROOT / row['path']
        assert not p.is_symlink() and p.is_file(), row['path']
        raw = p.read_bytes(); assert len(raw) == row['bytes']
        assert raw.decode('utf-8').encode('utf-8') == raw and b'\0' not in raw
        assert hashlib.sha256(raw).hexdigest() == row['sha256'] == sums[row['path']]
        if p.suffix == '.py':
            parsed[row['path']] = ast.parse(raw.decode('utf-8'), filename=row['path'])
    assert set(sums) == {r['path'] for r in manifest['files']} | {'PUBLIC-FILE-MANIFEST.json'}
    assert hashlib.sha256((ROOT / 'PUBLIC-FILE-MANIFEST.json').read_bytes()).hexdigest() == sums['PUBLIC-FILE-MANIFEST.json']
    mapping = json.loads((ROOT / 'SOURCE-COPY-MAPPING.json').read_text())
    for row in mapping['files']:
        assert sums[row['public_path']] == row['public_sha256']
        if row['status'].startswith('Byte-identical'):
            assert row['public_sha256'] == row['original_sha256']
    recipe = ROOT / 'src/recipes/weather-right-umbrella-correction-20261009-0153'
    for name in ['water_patch', 'wet_readability_patch']:
        mod = load('checked_' + name, recipe / (name + '.py'))
        assert callable(mod.apply) and mod.MPU == 15/88 and mod.SEAT == .000010
    for stage in ['weather-canonical-sphere-rain-20261009-0119', 'weather-right-umbrella-correction-20261009-0153', 'weather-right-wet-readability-crop-20261009-0238', 'weather-right-wet-correction-milestone-20261009-0259']:
        mod = load('checked_invariants_' + stage, ROOT / 'src/recipes' / stage / 'invariant_tools.py')
        assert callable(mod.snap) and callable(mod.h.frozen_scene_snapshot)
        assert mod.hashes({'part': {'z': 3, 'a': [1, 2]}}) == mod.hashes({'part': {'a': [1, 2], 'z': 3}})
    # Exercise the exact original PFM decoder on a synthetic tiny fixture.
    tree = parsed['src/reproduce_postprocess.py']
    decoder = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == 'read')
    namespace = {'np': np}
    exec(compile(ast.Module(body=[decoder], type_ignores=[]), '<source-pfm-check>', 'exec'), namespace)
    with tempfile.TemporaryDirectory() as temp:
        fixture = Path(temp) / 'fixture.pfm'
        rgb = np.array([[[0.1, 0.2, 0.3], [1., 2., 3.]]], dtype='<f4')
        fixture.write_bytes(b'PF\n2 1\n-1.0\n' + rgb.tobytes())
        assert np.array_equal(namespace['read'](fixture), rgb)
    # Extract and exercise the retained composite expression with premultiplied alpha.
    expr = next(n.value for n in ast.walk(tree) if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'combined' for t in n.targets))
    expression = compile(ast.Expression(expr), '<source-composite-check>', 'eval')
    plate = np.array([[[.5, .4, .3], [2., 1., .5]]])
    catch = np.array([[[.8, .9, 1.], [.5, .6, .7]]])
    alpha = np.array([[[0.], [1.]]]); hero = np.array([[[0., 0., 0.], [.2, .3, .4]]])
    result = eval(expression, {}, {'hero': hero, 'alpha': alpha, 'plate': plate, 'catch': catch})
    assert np.allclose(result[0, 0], plate[0, 0] * catch[0, 0]) and np.array_equal(result[0, 1], hero[0, 1])
    contract = load('checked_contract', ROOT / 'src/contract.py')
    old = os.environ.get('WEATHER_WORK_DIR')
    try:
        os.environ['WEATHER_WORK_DIR'] = str(ROOT / 'src')
        try:
            contract.work_dir()
        except ValueError:
            pass
        else:
            raise AssertionError('Source directory accepted as output')
        with tempfile.TemporaryDirectory() as temp:
            os.environ['WEATHER_WORK_DIR'] = temp
            assert contract.work_dir() == Path(temp).resolve()
            p = Path(temp) / 'input.txt'; p.write_text('test')
            os.environ['WEATHER_TEST_INPUT'] = str(p)
            assert contract.asset('fixture', hashlib.sha256(b'test').hexdigest(), 'WEATHER_TEST_INPUT') == p
            try:
                contract.asset('fixture', '0' * 64, 'WEATHER_TEST_INPUT')
            except ValueError:
                pass
            else:
                raise AssertionError('Mismatched asset accepted')
            os.environ.pop('WEATHER_TEST_INPUT')
    finally:
        if old is None: os.environ.pop('WEATHER_WORK_DIR', None)
        else: os.environ['WEATHER_WORK_DIR'] = old
    print(json.dumps({'AST_files': len(parsed), 'SHA256_files': len(sums), 'safe_recipe_imports': 6, 'small_PFM_composite_contract_tests': 'passed', 'Blender_started': False, 'rendered': False, 'full_product_tests': False}))

if __name__ == '__main__':
    main()
