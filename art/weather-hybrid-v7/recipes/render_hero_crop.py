"""Native900px registered hero crop; never presented as a rendered whole frame."""
import bpy,json,hashlib,time,sys,importlib.util
from pathlib import Path
D=Path(__file__).resolve().parent;args=sys.argv[sys.argv.index('--')+1:];label=args[0]
SOURCES={
'hero-baseline-v4':('hybrid-rain-hero-v4.blend','c8353c35af9ec4eb9d8b93ba268a5d5290f01cfee877890995cbb0874c0b7f28'),
'hero-canopy-v5':('hybrid-rain-hero-v4-canopy-candidate.blend','6271bd8348d2bafa74009ff96dac469bbfdb7baf84862faf6dcf63add30467ec'),
'hero-thin-v6':('hybrid-rain-hero-v4-thin-sheet-candidate.blend','204dacf2711681eedb2c76f1f24353af5cb2d9b85b1e676ec1622c0634ec0572'),
'hero-structured-v7':('hybrid-hero-structured-v7.blend','3f585ba68ed972b3013eb23fcec7da99ab26671fa68502c10c0ac702432b2555')}
assert label in SOURCES;O=D/label;O.mkdir(exist_ok=True);filename,expected=SOURCES[label];SRC=D/filename;sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert sha(SRC)==expected;assert not (O/'composite.exr').exists();bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene
s.render.resolution_x=900;s.render.resolution_y=600;s.render.resolution_percentage=100;s.cycles.samples=128;s.cycles.use_adaptive_sampling=False;s.cycles.use_denoising=False;s.cycles.seed=0;s.camera.data.dof.use_dof=False
# Full-size buffers preserve image registration; only specified border is sampled.
s.render.use_border=True;s.render.use_crop_to_border=False;s.render.border_min_x=430/900;s.render.border_max_x=840/900;s.render.border_min_y=(600-425)/600;s.render.border_max_y=(600-80)/600
for n in s.node_tree.nodes:
 if n.type=='SCALE':n.inputs['X'].default_value=900;n.inputs['Y'].default_value=600
 if n.type=='OUTPUT_FILE':n.base_path=str(O)
# Store genuine Cycles denoising guide passes for material-preserving filtering.
bpy.context.view_layer.cycles.denoising_store_passes=True
rl=next(n for n in s.node_tree.nodes if n.type=='R_LAYERS')
for socket,name in [('Denoising Albedo','albedo'),('Denoising Normal','normal')]:
 f=s.node_tree.nodes.new('CompositorNodeOutputFile');f.base_path=str(O);f.format.file_format='OPEN_EXR';f.format.color_mode='RGB';f.format.color_depth='32';f.file_slots[0].path=name+'-';s.node_tree.links.new(rl.outputs[socket],f.inputs[0])
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='32';s.render.filepath=str(O/'composite.exr');t=time.monotonic();bpy.ops.render.render(write_still=True)
s.render.image_settings.file_format='PNG';s.render.image_settings.color_depth='8';bpy.data.images['Render Result'].save_render(str(O/'hybrid-raw.png'),scene=s)
r={'source':str(SRC),'source_sha256':expected,'source_unchanged':sha(SRC)==expected,'full_buffer_dimensions':[900,600],'rendered_rectangle_top_origin':[430,80,840,425],'samples':128,'seed':0,'DOF':False,'scope':'Only a native-resolution hero crop is sampled. Unrendered frame area is not valid image evidence.','unchanged':'Identity, camera and plate fixed; scene changes only as documented in selected source manifest','render_seconds':time.monotonic()-t,'raw_sha256':sha(O/'hybrid-raw.png')};(O/'RENDER-MANIFEST.json').write_text(json.dumps(r,indent=2));print('HERO_CROP_READY',json.dumps(r),flush=True)
