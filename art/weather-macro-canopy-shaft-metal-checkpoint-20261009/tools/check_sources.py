"""Source/hash and synthetic helper checks only; never starts Blender or OIDN."""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True

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
        raw = p.read_bytes()
        assert len(raw) == row['bytes'] and b'\0' not in raw
        assert raw.decode('utf-8').encode('utf-8') == raw
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
    recipe = ROOT / 'src/recipes/weather-macro-art-correction-20261009-0448'
    # Synthetic cyclic sheet; does not use private geometry or prove the real scene.
    radii = np.linspace(0, .50, 41)
    angles = np.arange(256) * 2 * np.pi / 256
    rr, aa = np.meshgrid(radii, angles, indexing='ij')
    metres = np.stack([rr * np.cos(aa), rr * np.sin(aa), .54 - .22 * rr], axis=-1)
    normals = np.stack([.22 * np.cos(aa), .22 * np.sin(aa), np.ones_like(aa)], axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    for name, function in [('continuous_roof_relief_field', 'evaluate_continuous_roof_relief'),
                           ('half_scale_roof_relief_field', 'evaluate_half_scale_roof_relief')]:
        mod = load('checked_' + name, recipe / (name + '.py'))
        evaluate = getattr(mod, function)
        grid = metres / mod.MPU
        first = evaluate(grid, normals)
        second = evaluate(grid, normals)
        height, support, info = first
        assert height.shape == support.shape == rr.shape
        assert np.array_equal(height, second[0]) and np.array_equal(support, second[1])
        assert np.isfinite(height).all() and np.isfinite(support).all()
        assert np.all(height[0] == 0) and np.all(height[-1] == 0)
        assert np.all((support >= 0) & (support <= 1))
        assert info['no_scene_or_material_change'] and info['no_uv_or_camera_mask']
        try:
            evaluate(grid[:1], normals[:1])
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid cyclic grid accepted')
    tree = parsed['src/reproduce_postprocess.py']
    decoder = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == 'read')
    namespace = {'np': np}
    exec(compile(ast.Module(body=[decoder], type_ignores=[]), '<synthetic-pfm-check>', 'exec'), namespace)
    with tempfile.TemporaryDirectory() as temp:
        fixture = Path(temp) / 'fixture.pfm'
        rgb = np.array([[[.1, .2, .3], [1., 2., 3.]]], dtype='<f4')
        fixture.write_bytes(b'PF\n2 1\n-1.0\n' + rgb.tobytes())
        assert np.array_equal(namespace['read'](fixture), rgb)
    expr = next(n.value for n in ast.walk(tree) if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'out' for t in n.targets))
    expression = compile(ast.Expression(expr), '<synthetic-composite-check>', 'eval')
    plate = np.array([[[.5, .4, .3], [-.2, 1., .5]]])
    catch = np.array([[[.8, .9, 1.], [.5, .6, .7]]])
    alpha = np.array([[[0.], [1.]]])
    hero = np.array([[[0., 0., 0.], [.2, .3, .4]]])
    result = eval(expression, {}, {'hero': hero, 'alpha': alpha, 'plate': plate, 'catch': catch})
    assert np.allclose(result[0, 0], plate[0, 0] * catch[0, 0])
    assert np.array_equal(result[0, 1], hero[0, 1])
    contract = load('checked_contract', ROOT / 'src/contract.py')
    assert contract.MASTER_SHA == '92916e52cb240c30a239327462b067053cce1d6bc2a3c43b9ad5a151fbbb67ab'
    assert contract.PLATE_SHA == '06658ced2144d6afb80f7a05cbb6c8cbb24196dbf0e6968577aae3d6709d4899'
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
            p = Path(temp) / 'input.txt'
            p.write_text('test')
            os.environ['WEATHER_TEST_INPUT'] = str(p)
            assert contract.asset('fixture', hashlib.sha256(b'test').hexdigest(), 'WEATHER_TEST_INPUT') == p
            try:
                contract.asset('fixture', '0' * 64, 'WEATHER_TEST_INPUT')
            except ValueError:
                pass
            else:
                raise AssertionError('Mismatched external input accepted')
            os.environ.pop('WEATHER_TEST_INPUT')
    finally:
        if old is None:
            os.environ.pop('WEATHER_WORK_DIR', None)
        else:
            os.environ['WEATHER_WORK_DIR'] = old
    print(json.dumps({'AST_files': len(parsed), 'SHA256_files': len(sums), 'pure_helper_checks': 2,
                      'synthetic_PFM_composite_input_output_checks': 'passed',
                      'Blender_started': False, 'OIDN_started': False, 'rendered': False,
                      'full_product_tests': False}))

if __name__ == '__main__':
    main()
