import bpy,json,hashlib,time,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from contract import work_dir,master,MASTER_SHA
BASE=work_dir();state='full900';D=BASE/state;D.mkdir(exist_ok=True);rec={'source':str(master()),'source_sha256':MASTER_SHA};SRC=Path(rec['source']);H=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert H(SRC)==rec['source_sha256'];O=D/'wet-render';O.mkdir(exist_ok=True);assert not(O/'composite.exr').exists();bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.render.resolution_x=900;s.render.resolution_y=600;s.render.resolution_percentage=100;s.cycles.samples=512;s.cycles.use_adaptive_sampling=False;s.cycles.use_denoising=False;s.cycles.seed=0;s.camera.data.dof.use_dof=False;s.render.use_border=False;s.render.use_crop_to_border=False;rect=[0,0,900,600];s.render.border_min_x=rect[0]/900;s.render.border_max_x=rect[2]/900;s.render.border_min_y=(600-rect[3])/600;s.render.border_max_y=(600-rect[1])/600
for n in s.node_tree.nodes:
 if n.type=='SCALE':n.inputs['X'].default_value=900;n.inputs['Y'].default_value=600
 if n.type=='OUTPUT_FILE':n.base_path=str(O)
bpy.context.view_layer.cycles.denoising_store_passes=True;rl=next(n for n in s.node_tree.nodes if n.type=='R_LAYERS')
for socket,name in [('Denoising Albedo','albedo'),('Denoising Normal','normal')]:
 f=s.node_tree.nodes.new('CompositorNodeOutputFile');f.base_path=str(O);f.format.file_format='OPEN_EXR';f.format.color_mode='RGB';f.format.color_depth='32';f.file_slots[0].path=name+'-';s.node_tree.links.new(rl.outputs[socket],f.inputs[0])
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='32';s.render.filepath=str(O/'composite.exr');t=time.monotonic();bpy.ops.render.render(write_still=True);assert H(SRC)==rec['source_sha256'];(D/'RENDER-MANIFEST.json').write_text(json.dumps({'state':state,'source_sha256':rec['source_sha256'],'rect':rect,'native_buffer':[900,600],'samples':512,'seed':0,'seconds':time.monotonic()-t,'scope':'One selected clean full900 elongation frame,512 samples, no airborne rain or UI added'},indent=2));print('PHASE_CROP_READY',state,flush=True)
