import sys,json,hashlib
from pathlib import Path
D=Path(__file__).resolve().parent
sys.path.insert(0,str(D/'python-deps'))
import PyOpenColorIO as ocio
import numpy as np
from PIL import Image
src=D.parent/'assets/environment/approved-scene-clean-environment-v1.png'
assert hashlib.sha256(src.read_bytes()).hexdigest()=='63eea1f374031f247981845c3e8051170a03c8f7a8928ca4ec961c9fde48fca1'
cfg=ocio.Config.CreateFromFile('/usr/share/blender/datafiles/colormanagement/config.ocio')
t=ocio.GroupTransform();t.appendTransform(ocio.LookTransform(src='Linear Rec.709',dst='Linear Rec.709',looks='AgX - Medium High Contrast'));t.appendTransform(ocio.DisplayViewTransform(src='Linear Rec.709',display='sRGB',view='AgX'))
fwd=cfg.getProcessor(t).getDefaultCPUProcessor();t.setDirection(ocio.TRANSFORM_DIR_INVERSE);inv=cfg.getProcessor(t).getDefaultCPUProcessor()
x=np.asarray(Image.open(src).convert('RGB')).astype(np.float32)/255.;x=np.ascontiguousarray(x);y=x.copy();inv.applyRGB(y);check=y.copy();fwd.applyRGB(check)
err=np.abs(check-x);assert np.isfinite(y).all()
np.save(D/'plate-scene-linear.npy',y)
report={'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'source_asset':'approved-scene-clean-environment-v1.png','purpose':'Invert the same AgX display transform so the static plate remains display-matched when composited with rendered CG. This is NOT HDR recovery. Dynamic range is reconstructed only for compositing consistency.','ocio':ocio.__version__,'display':'sRGB','view':'AgX','look':'AgX - Medium High Contrast','scene_linear_range':[float(y.min()),float(y.max())],'roundtrip_rgb_error_mean':float(err.mean()),'roundtrip_rgb_error_max':float(err.max())}
(D/'PLATE-COLOR-CONTRACT.json').write_text(json.dumps(report,indent=2));print(report)
