import bpy,numpy as np,json,sys,hashlib
from pathlib import Path
D=Path(__file__).resolve().parent;args=sys.argv[sys.argv.index('--')+1:];mode=args[0];label=args[1] if len(args)>1 else 'preview-v1';assert label in ['preview-v1','preview-v2','preview-v3','preview-v4','full-v3','full-v7','hero-baseline-v4','hero-canopy-v5','hero-thin-v6','hero-structured-v7','hero-material-v5'];O=D/label
if mode=='export':
 for kind in (['hero','catcher','albedo','normal'] if (O/'albedo-0049.exr').exists() else ['hero','catcher']):
  p=O/(kind+'-0049.exr');im=bpy.data.images.load(str(p));im.colorspace_settings.name='Non-Color' if kind=='normal' else 'Linear Rec.709';w,h=im.size;a=np.empty(w*h*4,np.float32);im.pixels.foreach_get(a);a=a.reshape(h,w,4);np.save(O/(kind+'-rgba.npy'),a)
  with (O/(kind+'.pfm')).open('wb') as f:f.write(('PF\n%d %d\n-1.0\n'%(w,h)).encode());f.write(a[:,:,:3].astype('<f4').tobytes())
  print(kind,'range',float(a.min()),float(a.max()),'alpha',float(a[:,:,3].min()),float(a[:,:,3].max()),flush=True)
else:
 def read(name):
  with (O/(name+'-denoised.pfm')).open('rb') as f:
   assert f.readline().strip()==b'PF';w,h=map(int,f.readline().split());assert float(f.readline())<0;return np.frombuffer(f.read(),'<f4').reshape(h,w,3)
 hero=read('hero');catch=read('catcher');h,w=hero.shape[:2];alpha=np.load(O/'hero-rgba.npy')[:,:,3:4]
 y=np.load(D/'plate-scene-linear.npy');ph,pw=y.shape[:2];a0=np.ones((ph,pw,4),np.float32);a0[:,:,:3]=y[::-1];plate=bpy.data.images.new('Exact inverse-display plate data',pw,ph,alpha=True,float_buffer=True);plate.colorspace_settings.name='Linear Rec.709';plate.pixels.foreach_set(a0.ravel());plate.update();plate.scale(w,h);p=np.empty(w*h*4,np.float32);plate.pixels.foreach_get(p);p=p.reshape(h,w,4)[:,:,:3]
 # RLayers image is premultiplied. Keep rendered coverage; only CG radiance is denoised.
 composed=hero+(1-alpha)*p*catch
 a=np.ones((h,w,4),np.float32);a[:,:,:3]=composed
 im=bpy.data.images.new('Denoised CG over unchanged static plate',w,h,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(a.ravel());im.update()
 s=bpy.context.scene;s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=0;s.view_settings.gamma=1;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='8';im.save_render(str(O/'hybrid-guided.png'),scene=s)
 # Also preserve exact scene-linear composite for later inspection.
 s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='32';im.save_render(str(O/'hybrid-guided.exr'),scene=s)
 report={'dimensions':[w,h],'static_plate_denoised':False,'CG_only_denoised':True,'raw_CG_alpha_preserved':True,'linear_composite':'hero_premultiplied_rgb + (1-hero_alpha) * plate_rgb * shadow_catcher_rgb','display':'AgX - Medium High Contrast, exposure0 gamma1, once','output_sha256':hashlib.sha256((O/'hybrid-guided.png').read_bytes()).hexdigest()};(O/'DISPLAY-CONTRACT.json').write_text(json.dumps(report,indent=2));print(report)
