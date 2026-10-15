"""Render an externally supplied checkpoint; never save changes to the master."""
import argparse
import json
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from contract import FRAME, MASTER_SHA256, SIZE, require_absent, require_blender, require_hash, sha


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--master', type=Path, required=True)
    parser.add_argument('--work-dir', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    require_blender(bpy)
    master = require_hash(args.master, MASTER_SHA256, 'External packed master')
    work = args.work_dir.resolve()
    require_absent([work / 'composite.exr', work / 'hybrid-raw.png', work / 'RENDER-MANIFEST.json',
                    *[work / (name + '-%04d.exr' % FRAME) for name in ('hero', 'catcher', 'albedo', 'normal')]])
    work.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(master))
    scene = bpy.context.scene
    scene.frame_set(FRAME)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 2
    scene.render.resolution_x, scene.render.resolution_y = SIZE
    scene.render.resolution_percentage = 100
    scene.cycles.samples = 128
    scene.cycles.seed = 0
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.camera.data.dof.use_dof = False
    scene.render.use_border = False
    scene.render.use_crop_to_border = False
    for node in scene.node_tree.nodes:
        if node.type == 'SCALE':
            node.inputs['X'].default_value, node.inputs['Y'].default_value = SIZE
        if node.type == 'OUTPUT_FILE':
            node.base_path = str(work)
    bpy.context.view_layer.cycles.denoising_store_passes = True
    layers = next(node for node in scene.node_tree.nodes if node.type == 'R_LAYERS')
    for socket, name in [('Denoising Albedo', 'albedo'), ('Denoising Normal', 'normal')]:
        node = scene.node_tree.nodes.new('CompositorNodeOutputFile')
        node.base_path = str(work)
        node.format.file_format = 'OPEN_EXR'
        node.format.color_mode = 'RGB'
        node.format.color_depth = '32'
        node.file_slots[0].path = name + '-'
        scene.node_tree.links.new(layers.outputs[socket], node.inputs[0])
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '32'
    scene.render.filepath = str(work / 'composite.exr')
    started = time.monotonic()
    bpy.ops.render.render(write_still=True)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_depth = '8'
    bpy.data.images['Render Result'].save_render(str(work / 'hybrid-raw.png'), scene=scene)
    if sha(master) != MASTER_SHA256:
        raise RuntimeError('External source changed during the render')
    report = {'master_sha256': MASTER_SHA256, 'source_unchanged': True, 'frame': FRAME,
              'dimensions': list(SIZE), 'samples': 128, 'seed': 0, 'DOF': False,
              'render_seconds': time.monotonic() - started,
              'scope': 'Pre-revision optical/contact checkpoint; offline fixed-view CG over static plate. Not final art acceptance.'}
    (work / 'RENDER-MANIFEST.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
