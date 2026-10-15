"""Export actual guide passes and composite linear CG over an untouched plate."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
import numpy as np
from contract import FRAME, PLATE_SHA256, SIZE, require_absent, require_blender, require_hash, sha


def check_pixels(array, shape):
    if array.shape != shape or not np.isfinite(array).all():
        raise RuntimeError('Unexpected dimensions or non-finite pass pixels')


def read_pfm(path):
    with path.open('rb') as stream:
        if stream.readline().strip() != b'PF':
            raise RuntimeError('Expected three-channel PFM')
        width, height = map(int, stream.readline().split())
        if float(stream.readline()) != -1.0:
            raise RuntimeError('Expected unscaled little-endian PFM')
        pixels = np.frombuffer(stream.read(), '<f4').reshape(height, width, 3)
    check_pixels(pixels, (SIZE[1], SIZE[0], 3))
    return pixels


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['export', 'display'])
    parser.add_argument('--work-dir', type=Path, required=True)
    parser.add_argument('--plate', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    require_blender(bpy)
    work = args.work_dir.resolve()
    if args.mode == 'export':
        kinds = ('hero', 'catcher', 'albedo', 'normal')
        require_absent([work / (kind + suffix) for kind in kinds for suffix in ('-rgba.npy', '.pfm')])
        for kind in kinds:
            image = bpy.data.images.load(str(work / (kind + '-%04d.exr' % FRAME)))
            image.colorspace_settings.name = 'Non-Color' if kind == 'normal' else 'Linear Rec.709'
            width, height = image.size
            pixels = np.empty(width * height * 4, np.float32)
            image.pixels.foreach_get(pixels)
            pixels = pixels.reshape(height, width, 4)
            check_pixels(pixels, (SIZE[1], SIZE[0], 4))
            np.save(work / (kind + '-rgba.npy'), pixels)
            with (work / (kind + '.pfm')).open('wb') as stream:
                stream.write(('PF\n%d %d\n-1.0\n' % (width, height)).encode())
                stream.write(pixels[:, :, :3].astype('<f4').tobytes())
            bpy.data.images.remove(image)
        return
    plate_path = require_hash(args.plate, PLATE_SHA256, 'External calibrated plate')
    require_absent([work / name for name in ('hybrid-guided.png', 'hybrid-guided.exr', 'DISPLAY-CONTRACT.json')])
    hero = read_pfm(work / 'hero-denoised.pfm')
    catcher = read_pfm(work / 'catcher-denoised.pfm')
    raw = np.load(work / 'hero-rgba.npy', allow_pickle=False)
    check_pixels(raw, (SIZE[1], SIZE[0], 4))
    alpha = raw[:, :, 3:4]
    if np.any(alpha < 0) or np.any(alpha > 1):
        raise RuntimeError('Raw hero coverage is outside [0, 1]')
    plate = np.load(plate_path, allow_pickle=False)
    check_pixels(plate, (SIZE[1], SIZE[0], 3))
    # Raw Blender/PFM buffers are bottom-up; supplied calibrated NPY is top-down.
    composed = hero + (1 - alpha) * plate[::-1] * catcher
    check_pixels(composed, (SIZE[1], SIZE[0], 3))
    rgba = np.ones((SIZE[1], SIZE[0], 4), np.float32)
    rgba[:, :, :3] = composed
    image = bpy.data.images.new('Linear CG over unchanged plate', *SIZE, alpha=True, float_buffer=True)
    image.colorspace_settings.name = 'Linear Rec.709'
    image.pixels.foreach_set(rgba.ravel())
    image.update()
    scene = bpy.context.scene
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    image.save_render(str(work / 'hybrid-guided.png'), scene=scene)
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '32'
    image.save_render(str(work / 'hybrid-guided.exr'), scene=scene)
    report = {'dimensions': list(SIZE), 'static_plate_denoised': False, 'raw_CG_alpha_preserved': True,
              'linear_composite': 'hero_premultiplied_rgb + (1-hero_alpha) * plate_rgb * shadow_catcher_rgb',
              'display': 'AgX - Medium High Contrast, exposure 0, gamma 1, once',
              'plate_sha256': PLATE_SHA256, 'output_sha256': sha(work / 'hybrid-guided.png')}
    (work / 'DISPLAY-CONTRACT.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
