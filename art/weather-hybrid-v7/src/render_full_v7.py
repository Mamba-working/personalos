"""Approved single useful-resolution diagnostic of persisted, unchanged hybrid v7."""
import bpy,json,hashlib,time
from pathlib import Path
D=Path(__file__).resolve().parent;O=D/'full-v7';O.mkdir(exist_ok=True)
SRC=D/'hybrid-hero-structured-v7.blend';sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();expected=json.loads((D/'V7-SAVED-SOURCE-VERIFICATION.json').read_text())['source_sha256'];assert sha(SRC)==expected;assert not (O/'composite.exr').exists()
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.render.use_border=False;s.render.use_crop_to_border=False;s.render.resolution_x=900;s.render.resolution_y=600;s.render.resolution_percentage=100;s.cycles.samples=128;s.cycles.use_adaptive_sampling=False;s.cycles.use_denoising=False;s.cycles.seed=0;s.camera.data.dof.use_dof=False
for n in s.node_tree.nodes:
 if n.type=='SCALE':n.inputs['X'].default_value=900;n.inputs['Y'].default_value=600
 if n.type=='OUTPUT_FILE':n.base_path=str(O)
bpy.context.view_layer.cycles.denoising_store_passes=True
rl=next(n for n in s.node_tree.nodes if n.type=='R_LAYERS')
for socket,name in [('Denoising Albedo','albedo'),('Denoising Normal','normal')]:
 f=s.node_tree.nodes.new('CompositorNodeOutputFile');f.base_path=str(O);f.format.file_format='OPEN_EXR';f.format.color_mode='RGB';f.format.color_depth='32';f.file_slots[0].path=name+'-';s.node_tree.links.new(rl.outputs[socket],f.inputs[0])
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='32';s.render.filepath=str(O/'composite.exr');t=time.monotonic();bpy.ops.render.render(write_still=True)
s.render.image_settings.file_format='PNG';s.render.image_settings.color_depth='8';bpy.data.images['Render Result'].save_render(str(O/'hybrid-raw.png'),scene=s)
r={'source':str(SRC),'source_sha256':expected,'source_unchanged':sha(SRC)==expected,'dimensions':[900,600],'samples':128,'seed':0,'DOF':False,'view':'AgX - Medium High Contrast','exposure':0,'rain':'Same genuine 3D static shutter capsules','unchanged_from_reviewed_preview':'Hero, materials, camera, shared lighting, ground catchers, generated plate and compositing graph unchanged. The same900x600/128-sample state is expanded from the reviewed native hero border to the full frame.','scope':'Offline fixed-view hybrid art diagnostic, not real-time or fully reactive near terrain','render_seconds':time.monotonic()-t,'raw_sha256':sha(O/'hybrid-raw.png')};(O/'RENDER-MANIFEST.json').write_text(json.dumps(r,indent=2));print('FULL_DIAGNOSTIC_READY',json.dumps(r),flush=True)
