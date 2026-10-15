"""Small native crop rendering; stream one frame through export/OIDN/AgX at a time."""
import bpy,sys,numpy as np,json,time,hashlib,subprocess,gc
from pathlib import Path
SOURCE_DIR=Path(__file__).resolve().parent;sys.path.insert(0,str(SOURCE_DIR));from contract import work_dir,padded_plate,oidn
D=work_dir();from continuous_water import Water,RECT,FPS,RELEASE,SRC,SHA
args=sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else ['pilot'];mode=args[0];samples=128
W=Water();s=bpy.context.scene;original_frame=s.frame_current;s.render.resolution_x=900;s.render.resolution_y=600;s.render.resolution_percentage=100;s.cycles.samples=samples;s.cycles.use_adaptive_sampling=False;s.cycles.use_denoising=False;s.cycles.seed=0;s.cycles.use_animated_seed=False;s.render.use_border=True;s.render.use_crop_to_border=False;s.render.border_min_x=RECT[0]/900;s.render.border_max_x=RECT[2]/900;s.render.border_min_y=(600-RECT[3])/600;s.render.border_max_y=(600-RECT[1])/600
S=D/'work-frame';S.mkdir(exist_ok=True);OUT=D/mode;OUT.mkdir(exist_ok=True)
for n in s.node_tree.nodes:
 if n.type=='SCALE':n.inputs['X'].default_value=900;n.inputs['Y'].default_value=600
 if n.type=='OUTPUT_FILE':n.base_path=str(S)
bpy.context.view_layer.cycles.denoising_store_passes=True;rl=next(n for n in s.node_tree.nodes if n.type=='R_LAYERS')
for socket,name in [('Denoising Albedo','albedo'),('Denoising Normal','normal')]:
 f=s.node_tree.nodes.new('CompositorNodeOutputFile');f.base_path=str(S);f.format.file_format='OPEN_EXR';f.format.color_mode='RGB';f.format.color_depth='32';f.file_slots[0].path=name+'-';s.node_tree.links.new(rl.outputs[socket],f.inputs[0])
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='32';s.render.filepath=str(S/'composite.exr');ys=slice(600-RECT[3],600-RECT[1]);xs=slice(RECT[0],RECT[2]);plate=np.load(padded_plate())[ys,xs]
exe=oidn();assert hashlib.sha256(exe.read_bytes()).hexdigest()=='1cb3a28ebc99b90d7548b0b8b16f70c163cb59abe8582458a254aa303338269c'
display=bpy.data.scenes.new('Offline preview export only');display.view_settings.view_transform='AgX';display.view_settings.look='AgX - Medium High Contrast';display.view_settings.exposure=0;display.view_settings.gamma=1;display.render.image_settings.file_format='PNG';display.render.image_settings.color_mode='RGBA';display.render.image_settings.color_depth='8'

def readpfm(p):
 with p.open('rb') as f:assert f.readline().strip()==b'PF';w,h=map(int,f.readline().split());assert float(f.readline())<0;return np.frombuffer(f.read(),'<f4').reshape(h,w,3)
def savepng(a,p):
 h,w=a.shape[:2];x=np.ones((h,w,4),np.float32);x[:,:,:3]=a;im=bpy.data.images.new('Temporary crop output',w,h,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(x.ravel());im.update();im.save_render(str(p),scene=display);bpy.data.images.remove(im)

frames=[(55,None,'f055'),(64,False,'f064-pre'),(64,True,'f064-post'),(66,None,'f066'),(72,None,'f072')]if mode=='pilot'else[(i,None,'f%03d'%i)for i in range(75)]
recs=[]
for i,force,label in frames:
 if (OUT/(label+'-guided.png')).exists():continue
 start=time.monotonic();W.set_time(i/FPS,force);bpy.ops.render.render(write_still=True);arr={}
 for kind in ['hero','catcher','albedo','normal']:
  im=bpy.data.images.load(str(S/('%s-%04d.exr'%(kind,original_frame))));im.colorspace_settings.name='Non-Color'if kind=='normal'else'Linear Rec.709';w,h=im.size;x=np.empty(w*h*4,np.float32);im.pixels.foreach_get(x);arr[kind]=np.array(x.reshape(h,w,4)[ys,xs],np.float32);bpy.data.images.remove(im)
  with(S/(kind+'.pfm')).open('wb')as f:f.write(('PF\n%d %d\n-1.0\n'%(arr[kind].shape[1],arr[kind].shape[0])).encode());f.write(arr[kind][:,:,:3].astype('<f4').tobytes())
 for name,kind in [('color','hero'),('guided','hero'),('catcher-denoised','catcher')]:
  cmd=[str(exe),'--device','cpu','--quality','high','--threads','2','--maxmem','512','--hdr',str(S/(kind+'.pfm')),'--output',str(S/(name+'.pfm'))]
  if name=='guided':cmd+=['--alb',str(S/'albedo.pfm'),'--nrm',str(S/'normal.pfm')]
  p=subprocess.run(cmd,capture_output=True,text=True,timeout=60);assert p.returncode==0,(p.stdout,p.stderr)
 for treatment in ['raw','color','guided']:
  h=arr['hero'][:,:,:3]if treatment=='raw'else readpfm(S/(treatment+'.pfm'));c=arr['catcher'][:,:,:3]if treatment=='raw'else readpfm(S/'catcher-denoised.pfm');a=h+(1-arr['hero'][:,:,3:4])*plate*c;savepng(a,OUT/(label+'-'+treatment+'.png'))
 if mode=='pilot':np.savez_compressed(OUT/(label+'-raw-data.npz'),**arr)
 rec={'frame':i,'time_s':i/FPS,'label':label,'force_split':force,'elapsed_s':time.monotonic()-start,'samples':samples,'drop_visible':not W.drop.hide_render};recs.append(rec);(OUT/'RENDER-TIMINGS.json').write_text(json.dumps(recs,indent=2));print('CROP_FRAME_READY',json.dumps(rec),flush=True)
 del arr;gc.collect()
assert hashlib.sha256(SRC.read_bytes()).hexdigest()==SHA
(D/(mode+'-RENDER-CONTRACT.json')).write_text(json.dumps({'samples':samples,'fixed_seed':0,'animated_seed':False,'native_buffer':[900,600],'crop':RECT,'frames_rendered_this_run':len(recs),'source_sha256_after':SHA,'source_saved':False,'master_duplicate_created':False,'raw_export_per_frame':'hero/catcher/albedo/normal from same raw sample buffer; native crop then OIDN guided hero and color catcher; original plate unchanged','bounded_buffers':'Only one padded source pass and one current crop are exported at a time; temporary images removed each iteration'},indent=2))
