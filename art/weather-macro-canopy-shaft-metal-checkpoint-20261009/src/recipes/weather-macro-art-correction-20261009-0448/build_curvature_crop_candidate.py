"""One real mesoscopic membrane-curvature crop candidate, from retained macro master."""
import bpy,numpy as np,json,sys,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
D=Path(__file__).parent;sys.path.insert(0,str(D));MPU=15/88;SRC=D/'PersonalOS-coordinated-macro-shot-master.blend';SHA='d9cd1d03d6a6006d0719a9c29c4e71d69e739aa3530fbaeed3495cd4dd38dbdd';assert hashlib.sha256(SRC.read_bytes()).hexdigest()==SHA
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();o=s.objects['Dry clay / eight tensioned gores'];old=o.data;old.calc_loop_triangles();nv=12289
vlocal=np.empty((len(old.vertices),3));old.vertices.foreach_get('co',vlocal.ravel());M=np.array(o.matrix_world);ov=vlocal@M[:3,:3].T+M[:3,3];ov=ov[:nv];ot=np.array([t.vertices for t in old.loop_triangles if max(t.vertices)<nv]);tree=BVHTree.FromPolygons(ov,ot,all_triangles=True);orig=np.concatenate([np.repeat(ov[:1][None,:,:],256,axis=1),ov[1:].reshape(48,256,3)],axis=0)
# C1 interpolating subdivision preserves old anchor vertices and the fixed rim.
def catmull(p0,p1,p2,p3,t):return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
def sample(grid,r,a,cubic=False):
 r=np.clip(np.asarray(r),0,grid.shape[0]-1);a=np.asarray(a)%grid.shape[1];j=np.minimum(np.floor(r).astype(int),grid.shape[0]-2);i=np.floor(a).astype(int);fr=(r-j)[...,None];fa=(a-i)[...,None]
 if not cubic:return (grid[j,i]*(1-fa)+grid[j,(i+1)%grid.shape[1]]*fa)*(1-fr)+(grid[j+1,i]*(1-fa)+grid[j+1,(i+1)%grid.shape[1]]*fa)*fr
 rows=[]
 for dj in [-1,0,1,2]:
  jj=np.clip(j+dj,0,grid.shape[0]-1);rows.append(catmull(grid[jj,(i-1)%grid.shape[1]],grid[jj,i],grid[jj,(i+1)%grid.shape[1]],grid[jj,(i+2)%grid.shape[1]],fa))
 return catmull(*rows,fr)
NR=192;NA=1024;rg,ag=np.meshgrid(np.linspace(0,48,NR+1),np.arange(NA)*256/NA,indexing='ij');base=sample(orig,rg,ag,True);base[-1]=sample(orig,np.full(NA,48.),np.arange(NA)*256/NA,False);base[0]=ov[0]
def normals(grid):
 dr=np.gradient(grid,axis=0);dt=(np.roll(grid,-1,axis=1)-np.roll(grid,1,axis=1))/2;n=np.cross(dr,dt);n/=np.maximum(np.linalg.norm(n,axis=-1)[...,None],1e-12);n[0]=np.mean(n[1],axis=0);n[0]/=np.linalg.norm(n[0],axis=-1)[:,None];return n
bn=normals(base)
# FIELD_HELPER_CALL
from membrane_curvature_field import evaluate_membrane_curvature
height_m,support,field_report=evaluate_membrane_curvature(base,bn)
assert np.isfinite(height_m).all() and height_m.shape==base.shape[:2]
newgrid=base+bn*(height_m/MPU)[...,None];newgrid[0]=base[0];newgrid[-1]=base[-1];nn=normals(newgrid);outer=np.concatenate([newgrid[0,:1],newgrid[1:].reshape(-1,3)]);newnorm=np.concatenate([nn[0,:1],nn[1:].reshape(-1,3)]);N=len(outer);allv=np.concatenate([outer,outer-newnorm*(.00020/MPU)]);faces=[]
for i in range(NA):faces.append((0,1+i,1+(i+1)%NA))
for j in range(1,NR):
 for i in range(NA):
  a=1+(j-1)*NA+i;b=a+NA;c=1+j*NA+(i+1)%NA;d=1+(j-1)*NA+(i+1)%NA;faces.append((a,b,c,d))
Fouter=len(faces);faces.extend([tuple(k+N for k in reversed(f)) for f in faces.copy()])
for i in range(NA):
 a=N-NA+i;b=N-NA+(i+1)%NA;faces.append((a,a+N,b+N,b))
mesh=bpy.data.meshes.new('Curvature crop / real paired 020mm membrane');mesh.from_pydata(allv.tolist(),[],faces);mesh.update();mesh.materials.clear()
for mat in old.materials:mesh.materials.append(mat)
idx=np.concatenate([np.zeros(Fouter,np.int32),np.ones(Fouter,np.int32),np.full(NA,2,np.int32)]);mesh.polygons.foreach_set('material_index',idx);mesh.polygons.foreach_set('use_smooth',np.ones(len(mesh.polygons),bool));vi=np.empty(len(mesh.loops),np.int32);mesh.loops.foreach_get('vertex_index',vi);bare=vi%N;angle=np.where(bare==0,0,(bare-1)%NA)/NA;rad=np.where(bare==0,0,(bare-1)//NA+1)/NR
uv=mesh.uv_layers.new(name='ConnectedWetField_SurfaceMetric_v1');arr=np.stack([angle,rad],-1).astype(np.float32)
# Each seam face uses the same u=1 side for its zero-angle corner.
for p in mesh.polygons:
 lo=p.loop_start;ln=p.loop_total;us=arr[lo:lo+ln,0]
 if np.max(us)-np.min(us)>.5:us[us<.5]+=1
 if 0 in [int(x)%N for x in p.vertices]:
  for k in range(lo,lo+ln):
   if bare[k]==0:arr[k,0]=np.mean([arr[q,0] for q in range(lo,lo+ln) if bare[q]!=0])
uv.data.foreach_set('uv',arr.ravel())
# Preserve the source's authored projected physical texture coordinates.
oldvid=np.empty(len(old.loops),np.int32);old.loops.foreach_get('vertex_index',oldvid);uvdata=np.empty((len(old.loops),2));old.uv_layers['CanopyWetness_ProjectedXY_v1'].data.foreach_get('uv',uvdata.ravel());per=np.zeros((nv,2));mask=oldvid<nv;per[oldvid[mask]]=uvdata[mask];ug=np.concatenate([np.repeat(per[:1][None,:,:],256,axis=1),per[1:].reshape(48,256,2)],axis=0);uf=sample(ug,rg,ag,True);uf=np.concatenate([uf[0,:1],uf[1:].reshape(-1,2)]);uv=mesh.uv_layers.new(name='CanopyWetness_ProjectedXY_v1');uv.data.foreach_set('uv',uf[bare].astype(np.float32).ravel());mesh.uv_layers.active=mesh.uv_layers['ConnectedWetField_SurfaceMetric_v1']
# Shared per-vertex field replaces the old paired mesoscale bump only in support.
sp=np.concatenate([support[0,:1],support[1:].reshape(-1)]);attr=mesh.attributes.new(name='ActualCurvatureSupport',type='FLOAT',domain='POINT');attr.data.foreach_set('value',np.concatenate([sp,sp]).astype(np.float32));o.data=mesh;o.matrix_world=Matrix.Identity(4)
# Preserve all structural ribs/hem and all macro actor placements.
for name in ['Closed PVC 020mm / outer clear dielectric with retained wet rel','Closed PVC 020mm / inner correlated clear dielectric']:
 mat=bpy.data.materials[name];nt=mat.node_tree;an=nt.nodes.new('ShaderNodeAttribute');an.attribute_name='ActualCurvatureSupport';an.name='Physical membrane curvature support';sub=nt.nodes.new('ShaderNodeMath');sub.operation='SUBTRACT';sub.inputs[0].default_value=1.;nt.links.new(an.outputs['Fac'],sub.inputs[1]);mul=nt.nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=.65;nt.links.new(sub.outputs[0],mul.inputs[0]);n=nt.nodes.get('Closed PVC 020mm / 15um paired tension normal');nt.links.new(mul.outputs[0],n.inputs['Strength'])
# Re-seat resolved water by nearest old-surface chart, minimal normal rotation.
oldnorm=normals(orig);vertex_param=np.concatenate([[[0.,0.]],np.stack(np.meshgrid(np.arange(1,49),np.arange(256),indexing='ij'),-1).reshape(-1,2)])
def old_to_new(points):
 hits=[tree.find_nearest(Vector(p)) for p in points];near=np.array([h[0] for h in hits]);ind=np.array([h[2] for h in hits]);tri=ot[ind];a=ov[tri[:,0]];u=ov[tri[:,1]]-a;v=ov[tri[:,2]]-a;q=near-a;uu=(u*u).sum(1);uv=(u*v).sum(1);vv=(v*v).sum(1);qu=(q*u).sum(1);qv=(q*v).sum(1);det=uu*vv-uv*uv;b=(vv*qu-uv*qv)/det;c=(uu*qv-uv*qu)/det;w=np.stack([1-b-c,b,c],-1);pars=vertex_param[tri].copy();ang=pars[:,:,1];seam=np.ptp(ang,axis=1)>128;ang[seam]=np.where(ang[seam]<128,ang[seam]+256,ang[seam]);apex=tri==0
 for k in range(3):
  ii=apex[:,k];ang[ii,k]=(ang[ii,(k+1)%3]+ang[ii,(k+2)%3])/2
 r=(pars[:,:,0]*w).sum(1);a=(ang*w).sum(1)%256;op=sample(orig,r,a);on=sample(oldnorm,r,a);on/=np.maximum(np.linalg.norm(on,axis=1)[:,None],1e-12);npv=sample(newgrid,r*NR/48,a*NA/256);nnew=sample(nn,r*NR/48,a*NA/256);nnew/=np.maximum(np.linalg.norm(nnew,axis=1)[:,None],1e-12);k=np.cross(on,nnew);co=(on*nnew).sum(1)
 def rotate(x,kk=k,cc=co):return x+np.cross(kk,x)+np.cross(kk,np.cross(kk,x))/np.maximum((1+cc)[:,None],1e-8)
 return npv+rotate(points-op),k,co
visible=set()
def walk(c,hidden=False):
 hidden=hidden or c.hide_render
 if not hidden:visible.update(o.name for o in c.objects if not o.hide_render)
 for ch in c.children:walk(ch,hidden)
walk(s.collection)
moved=[]
for w in s.objects:
 if w.name not in visible or w.type!='MESH' or not w.name.startswith(('Readable wetness /','Wet PVC /','Fine-first water /')):continue
 # Ignore archived water whose collection is hidden.
 if all(c.hide_render for c in w.users_collection):continue
 mw=np.array(w.matrix_world);pv=np.empty((len(w.data.vertices),3));w.data.vertices.foreach_get('co',pv.ravel());pv=pv@mw[:3,:3].T+mw[:3,3];nw,k,co=old_to_new(pv);authored=None
 if w.data.has_custom_normals:
  lv=np.empty(len(w.data.loops),np.int32);w.data.loops.foreach_get('vertex_index',lv);ln=np.empty((len(w.data.loops),3));w.data.corner_normals.foreach_get('vector',ln.ravel());wn=ln@np.linalg.inv(mw[:3,:3]);kk=k[lv];cc=co[lv];wn=wn+np.cross(kk,wn)+np.cross(kk,np.cross(kk,wn))/np.maximum((1+cc)[:,None],1e-8);authored=wn@mw[:3,:3];authored/=np.maximum(np.linalg.norm(authored,axis=1)[:,None],1e-12)
 inv=np.array(w.matrix_world.inverted());local=nw@inv[:3,:3].T+inv[:3,3];w.data.vertices.foreach_set('co',local.astype(np.float32).ravel());w.data.update()
 if authored is not None:w.data.normals_split_custom_set(authored.tolist())
 moved.append({'object':w.name,'vertices':len(pv)})
# Shared upper opening gains real retained-cloud contrast, not a view/roof mask.
wnode=next(n for n in s.world.node_tree.nodes if n.type=='TEX_IMAGE');im=wnode.image;W,H=im.size;field=np.empty(W*H*4,np.float32);im.pixels.foreach_get(field);field=field.reshape(H,W,4);u,v=np.meshgrid((np.arange(W)+.5)/W,(np.arange(H)+.5)/H);phi=(u-.5)*2*np.pi;el=(v-.5)*np.pi;dirs=np.stack([np.cos(el)*np.sin(phi),np.cos(el)*np.cos(phi),np.sin(el)],-1);direction=np.array([.242404,.346189,.906308]);direction/=np.linalg.norm(direction);gate=np.clip((np.degrees(el)-30)/15,0,1);gate=gate*gate*(3-2*gate);lobe=np.exp((dirs@direction-1)/math.radians(35)**2)*gate;Y=np.array([.2126,.7152,.0722]);rgb=np.array([.95,1,1.08]);rgb/=rgb@Y;original=lobe[:,:,None]*4.5*rgb
plate=np.load(D/'plate-scene-linear.npy');ph,pw=plate.shape[:2];# Existing sky-only crop angularly mapped into the shared source.
U=np.clip(.5+(phi-math.radians(35))/math.radians(150),0,1);V=np.clip((math.radians(90)-el)/math.radians(70),0,1);sx=U*(pw-1);sy=V*(ph*.45);ix=np.floor(sx).astype(int);iy=np.floor(sy).astype(int);fx=sx-ix;fy=sy-iy;cx=np.minimum(ix+1,pw-1);cy=np.minimum(iy+1,ph-1);cloud=plate[iy,ix]*(1-fx)[...,None]*(1-fy)[...,None]+plate[iy,cx]*fx[...,None]*(1-fy)[...,None]+plate[cy,ix]*(1-fx)[...,None]*fy[...,None]+plate[cy,cx]*fx[...,None]*fy[...,None];lum=cloud@Y;roi=lobe>.08;lo,hi=np.percentile(lum[roi],[22,88]);structure=.06+np.clip((lum-lo)/(hi-lo),0,1)**1.1*2.5;weights=lobe*np.cos(el);structure/=np.sum(structure*weights)/np.sum(weights);field[:,:,:3]=np.maximum(field[:,:,:3]-original+original*structure[:,:,None],0);newim=bpy.data.images.new('Curvature crop / shared structured upper cloud',width=W,height=H,alpha=True,float_buffer=True);newim.colorspace_settings.name='Linear Rec.709';newim.pixels.foreach_set(field.ravel());newim.update();newim.pack();wnode.image=newim;np.save(D/'curvature-shared-cloud-field.npy',field[:,:,:3]);np.savez_compressed(D/'ACTUAL-CURVATURE-FIELD.npz',height_metres=height_m,support=support,normals=nn,outer=newgrid)
ang=np.degrees(np.arccos(np.clip(np.sum(bn*nn,axis=-1),-1,1)));report={'source_sha256':SHA,'one_candidate_only':True,'actual_geometry_displacement':True,'no_new_water_or_PVC_interface':True,'grid':[NR,NA],'vertices_closed_shell':len(allv),'polygons':len(faces),'height_mm_percentiles':np.percentile(height_m*1000,[0,1,50,99,100]).tolist(),'normal_rotation_degrees_percentiles':np.percentile(ang,[0,50,90,99,100]).tolist(),'macro_rim_and_crown_fixed':True,'PVC_thickness_mm':.20,'water_reseated':moved,'field_design':field_report,'lighting':'Same shared upper opening, angular retained-sky cloud contrast, same lobe-weighted integrated energy; no object/ray-specific mask','cloud_structure_range':np.percentile(structure[roi],[0,10,50,90,100]).tolist(),'camera_background_actor_shaft_unchanged':True};(D/'CURVATURE-CROP-BUILD.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(D/'PersonalOS-connected-curvature-crop-candidate.blend'),compress=True);print(json.dumps(report),flush=True)
