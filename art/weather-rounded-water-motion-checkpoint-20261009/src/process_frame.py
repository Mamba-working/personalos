import bpy,numpy as np,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from contract import work_dir,plate
BASE=work_dir();D=BASE/sys.argv[-2];mode=sys.argv[-1];rect=(0,0,900,600);ys=slice(600-rect[3],600-rect[1]);xs=slice(rect[0],rect[2]);O=D/'processed';O.mkdir(exist_ok=True)
if mode=='export':
 for kind in ['hero','catcher','albedo','normal']:
  im=bpy.data.images.load(str(D/'wet-render'/(kind+'-0049.exr')));im.colorspace_settings.name='Non-Color' if kind=='normal' else 'Linear Rec.709';w,h=im.size;arr=np.empty(w*h*4,np.float32);im.pixels.foreach_get(arr);full=arr.reshape(h,w,4);assert full.shape==(600,900,4);a=np.array(full[ys,xs],np.float32);np.save(O/(kind+'-rgba.npy'),a)
  with (O/(kind+'.pfm')).open('wb') as f:f.write(('PF\n%d %d\n-1.0\n'%(a.shape[1],a.shape[0])).encode());f.write(a[:,:,:3].astype('<f4').tobytes())
 y=np.load(plate());ph,pw=y.shape[:2];a=np.ones((ph,pw,4),np.float32);a[:,:,:3]=y[::-1];im=bpy.data.images.new('Exact plate resample',pw,ph,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(a.ravel());im.update();im.scale(900,600);a=np.empty(900*600*4,np.float32);im.pixels.foreach_get(a);np.save(D/'padded-plate.npy',a.reshape(600,900,4)[ys,xs,:3])
else:
 def read(p):
  with p.open('rb') as f:assert f.readline().strip()==b'PF';w,h=map(int,f.readline().split());assert float(f.readline())<0;return np.frombuffer(f.read(),'<f4').reshape(h,w,3)
 s=bpy.context.scene;s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=0;s.view_settings.gamma=1;plate=np.load(D/'padded-plate.npy');h,w=plate.shape[:2];alpha=np.load(O/'hero-rgba.npy')[:,:,3:4]
 for mode in ['raw','color','guided']:
  hero=read(O/('hero-'+mode+'.pfm')) if mode!='raw' else np.load(O/'hero-rgba.npy')[:,:,:3];catch=read(O/'catcher-denoised.pfm') if mode!='raw' else np.load(O/'catcher-rgba.npy')[:,:,:3];composed=hero+(1-alpha)*plate*catch;np.save(O/('composite-'+mode+'.npy'),composed);a=np.ones((h,w,4),np.float32);a[:,:,:3]=composed;im=bpy.data.images.new('wet'+mode,w,h,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(a.ravel());im.update();s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='8';im.save_render(str(O/('padded-'+mode+'.png')),scene=s)
 print('WET_RAW_COLOR_GUIDED_DISPLAYED',flush=True)
