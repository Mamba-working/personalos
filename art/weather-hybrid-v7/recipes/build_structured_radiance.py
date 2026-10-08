"""One SDR-derived, all-ray storm radiance calibration. Not recovered HDR."""
import numpy as np,json,math,hashlib
from pathlib import Path
D=Path(__file__).resolve().parent;src=np.maximum(np.load(D/'plate-scene-linear.npy'),0);sh,sw=src.shape[:2]
W,H=1024,512;uu,vv=np.meshgrid((np.arange(W)+.5)/W,(np.arange(H)+.5)/H);phi=(uu-.5)*2*np.pi;el=(vv-.5)*np.pi
x=np.cos(el)*np.sin(phi);y=np.cos(el)*np.cos(phi);z=np.sin(el);dirs=np.stack([x,y,z],axis=-1)
key=np.array([-.22311237454414368,.9686135649681091,.10958324372768402]);key/=np.linalg.norm(key);kp=np.arctan2(key[0],key[1]);ke=np.arcsin(key[2]);u0=.1620501921902606;v0=.668960401383117
U=(u0+(phi-kp)/(2*np.pi))%1
E=np.maximum(el,0);sy=np.where(E<=ke,.59-(.59-(1-v0))*E/ke,(1-v0)*(1-(E-ke)/(np.pi/2-ke)));sy=np.clip(sy,0,.59)
def sample(U,V):
 fx=U*(sw-1);fy=V*(sh-1);ix=np.floor(fx).astype(int);iy=np.floor(fy).astype(int);dx=fx-ix;dy=fy-iy;ix1=np.minimum(ix+1,sw-1);iy1=np.minimum(iy+1,sh-1)
 return src[iy,ix]*(1-dx)[...,None]*(1-dy)[...,None]+src[iy,ix1]*dx[...,None]*(1-dy)[...,None]+src[iy1,ix]*(1-dx)[...,None]*dy[...,None]+src[iy1,ix1]*dx[...,None]*dy[...,None]
cloud=sample(U,sy);lum=cloud@np.array([.2126,.7152,.0722]);contrast=np.clip((np.maximum(lum,1e-6)/.35)**.4,.4,2);sky=cloud*contrast[...,None]
# Smoothly close the authoring seam with the same sampled edge colors.
seam=np.minimum(U,1-U);seamw=np.clip(seam/.025,0,1);edge=.5*(sample(np.zeros_like(U),sy)+sample(np.ones_like(U),sy));sky=sky*seamw[...,None]+edge*(1-seamw[...,None])
horizon=np.clip((el-math.radians(-6))/math.radians(9),0,1);horizon=horizon*horizon*(3-2*horizon);base=np.array([.05,.07,.10])*(1-horizon[...,None])+sky*horizon[...,None]
# Bounded visible opening, plus a compact shared warm upper-left sky break.
key_sigma=math.radians(6);key_shape=np.exp((dirs@key-1)/(key_sigma**2));opening=key_shape[...,None]*np.array([12.,9.,5.64])
fill=np.array([-.70,-.35,.62]);fill/=np.linalg.norm(fill);fill_sigma=math.radians(12);fill_shape=np.exp((dirs@fill-1)/(fill_sigma**2));fp=math.atan2(fill[0],fill[1]);fe=math.asin(fill[2]);fU=(u0+(fp-kp)/(2*np.pi))%1;fV=(1-v0)*(1-(fe-ke)/(np.pi/2-ke));centerlum=float(sample(np.array(fU),np.array(fV))@np.array([.2126,.7152,.0722]));edge_structure=np.clip(lum/max(centerlum,1e-5),.35,1.6);fillfield=fill_shape[...,None]*np.array([18.,15.3,11.7])*edge_structure[...,None]
field=np.maximum(base+opening+fillfield,0).astype(np.float32);assert np.isfinite(field).all();np.save(D/'structured-storm-radiance.npy',field)
domega=np.cos(el)*(2*np.pi/W)*(np.pi/H)
probes={}
for name,n in [('front',[0,-1,0]),('front_left',[-.6,-.8,0]),('front_right',[.6,-.8,0]),('upper_front',[0,-.8,.6])]:
 n=np.array(n)/np.linalg.norm(n);e=(field*np.maximum(dirs@n,0)[...,None]*domega[...,None]).sum(axis=(0,1))/np.pi;probes[name]=e.tolist()
ylum=field@np.array([.2126,.7152,.0722]);r={'source':'AI-generated approved-scene-clean-environment-v1.png, inverse-display data used as calibrated structure only','source_asset':'approved-scene-clean-environment-v1.png','label':'SDR-derived art-directed radiance calibration, not recovered HDR','map_dimensions':[W,H],'map_orientation':'array bottom-up, phi=(u-.5)*2pi where direction=(cos(el)sin(phi),cos(el)cos(phi),sin(el)), el=(v-.5)*pi','mapping':'Upper59% source sky remapped onto hemisphere; source warm-opening centroid aligned to exact plate world direction. Off-camera radiance is an explicit constructed continuation, not measured sky.','source_luminance_contrast_exponent':1.4,'contrast_multiplier_clip':[.4,2.0],'seam_fraction':.025,'lower_world_RGB':[.05,.07,.10],'opening_direction':key.tolist(),'opening_peak_RGB':[12,9,5.64],'opening_sigma_degrees':6,'front_upper_left_direction':fill.tolist(),'front_upper_left_peak_RGB':[18,15.3,11.7],'front_upper_left_sigma_degrees':12,'front_source_structure_multiplier_range':[.35,1.6],'uniform_frontal_fill_removed':True,'all_objects_all_rays_same_field':True,'no_LIGHT_objects':True,'diffuse_irradiance_over_pi_probes_RGB':probes,'luminance_percentiles':{str(q):float(np.percentile(ylum,q)) for q in [0,10,50,90,99,100]},'mean_spherical_Y':float((ylum*domega).sum()/(4*np.pi))};(D/'STRUCTURED-RADIANCE-CONTRACT.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
