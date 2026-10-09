import bpy,numpy as np,sys,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--stage',choices=['export','display'],required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);D=Path(__file__).parent;sys.path.insert(0,str(D));from contract import plate;O=Path(a.output).resolve();P=O/'processed';P.mkdir(exist_ok=True);W,H=355,300
if a.stage=='export':
 for kind in ['hero','catcher','albedo','normal']:
  im=bpy.data.images.load(str(O/(kind+'-0049.exr')));im.colorspace_settings.name='Non-Color' if kind=='normal' else 'Linear Rec.709';w,h=im.size;assert(w,h)==(W,H),(kind,w,h);arr=np.empty(w*h*4,np.float32);im.pixels.foreach_get(arr);arr=arr.reshape(h,w,4);np.save(P/(kind+'-rgba.npy'),arr)
  with(P/(kind+'.pfm')).open('wb')as f:f.write(f'PF\n{W} {H}\n-1.0\n'.encode());f.write(arr[:,:,:3].astype('<f4').tobytes())
 np.save(P/'plate.npy',np.load(plate()))
else:
 def read(p):
  with p.open('rb')as f:assert f.readline().strip()==b'PF';w,h=map(int,f.readline().split());assert float(f.readline())<0;return np.frombuffer(f.read(),'<f4').reshape(h,w,3)
 s=bpy.context.scene;s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=0;s.view_settings.gamma=1;plate=np.load(P/'plate.npy');alpha=np.load(P/'hero-rgba.npy')[:,:,3:4]
 for mode in ['raw','color','guided']:
  hero=read(P/('hero-'+mode+'.pfm')) if mode!='raw' else np.load(P/'hero-rgba.npy')[:,:,:3];catch=read(P/'catcher-denoised.pfm') if mode!='raw' else np.load(P/'catcher-rgba.npy')[:,:,:3];out=hero+(1-alpha)*plate*catch;np.save(P/('composite-'+mode+'.npy'),out);arr=np.ones((H,W,4),np.float32);arr[:,:,:3]=out;im=bpy.data.images.new('Half-scale roof and softened reflection scrim crop '+mode,W,H,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(arr.ravel());im.update();s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='8';im.save_render(str(P/('native-crop-'+mode+'.png')),scene=s)
