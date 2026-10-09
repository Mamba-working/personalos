"""Blender export/display stages. Exact linear plate remains an owner-provided external input."""
import bpy,numpy as np,sys,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--stage',choices=['export','display'],required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);O=Path(a.output).resolve();P=O/'processed';P.mkdir(exist_ok=True);ROOT=Path(__file__).resolve().parent;sys.path.insert(0,str(ROOT));from contract import plate
if a.stage=='export':
 for kind in ['hero','catcher','albedo','normal']:
  im=bpy.data.images.load(str(O/(kind+'-0049.exr')));im.colorspace_settings.name='Non-Color'if kind=='normal'else'Linear Rec.709';w,h=im.size;arr=np.empty(w*h*4,np.float32);im.pixels.foreach_get(arr);arr=arr.reshape(h,w,4);assert arr.shape==(600,900,4);np.save(P/(kind+'-rgba.npy'),arr)
  with(P/(kind+'.pfm')).open('wb')as f:f.write(b'PF\n900 600\n-1.0\n');f.write(arr[:,:,:3].astype('<f4').tobytes())
 y=np.load(plate());ph,pw=y.shape[:2];arr=np.ones((ph,pw,4),np.float32);arr[:,:,:3]=y[::-1];im=bpy.data.images.new('Exact review plate resample',pw,ph,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(arr.ravel());im.update();im.scale(900,600);arr=np.empty(900*600*4,np.float32);im.pixels.foreach_get(arr);np.save(P/'plate.npy',arr.reshape(600,900,4)[:,:,:3])
else:
 def read(path):
  with path.open('rb')as f:assert f.readline().strip()==b'PF';w,h=map(int,f.readline().split());assert float(f.readline())<0;return np.frombuffer(f.read(),'<f4').reshape(h,w,3)
 s=bpy.context.scene;s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=0;s.view_settings.gamma=1;plate=np.load(P/'plate.npy');alpha=np.load(P/'hero-rgba.npy')[:,:,3:4]
 for mode in ['raw','color','guided']:
  hero=read(P/('hero-'+mode+'.pfm'))if mode!='raw'else np.load(P/'hero-rgba.npy')[:,:,:3];catch=read(P/'catcher-denoised.pfm')if mode!='raw'else np.load(P/'catcher-rgba.npy')[:,:,:3];combined=hero+(1-alpha)*plate*catch;np.save(P/('composite-'+mode+'.npy'),combined);arr=np.ones((600,900,4),np.float32);arr[:,:,:3]=combined;im=bpy.data.images.new('Reproduced '+mode,900,600,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(arr.ravel());im.update();s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='8';im.save_render(str(P/('native900-'+mode+'.png')),scene=s)
