"""Extracted exact Blender native900 plate resampling, no render or scene save."""
import bpy,numpy as np,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from contract import work_dir,plate,sha,PADDED_PLATE_SHA
D=work_dir()/'full900';D.mkdir(exist_ok=True);ys=slice(0,600);xs=slice(0,900)
y=np.load(plate());ph,pw=y.shape[:2];a=np.ones((ph,pw,4),np.float32);a[:,:,:3]=y[::-1];im=bpy.data.images.new('Exact plate resample',pw,ph,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(a.ravel());im.update();im.scale(900,600);a=np.empty(900*600*4,np.float32);im.pixels.foreach_get(a);np.save(D/'padded-plate.npy',a.reshape(600,900,4)[ys,xs,:3])
assert sha(D/'padded-plate.npy')==PADDED_PLATE_SHA
