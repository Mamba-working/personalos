"""Reproducible water-only offline transient. No fluid-simulation or runtime claim.
Loads the retained milestone read-only. Connected geometry deforms continuously;
a <0.01-pixel neck is split with unchanged boundary coordinates at release.
"""
import bpy,bmesh,numpy as np,json,hashlib,math,sys,importlib.util,copy
from pathlib import Path
from mathutils import Vector
from contract import work_dir,master
SOURCE_DIR=Path(__file__).resolve().parent
D=work_dir();SRC=master()
SHA='ea4f3c4833c7f9b1c4c18ac06a19721bf86e84bbc27f2426d64e31ed644c12e7'
NAME='Readable wetness / form00 with connected feeder and pendant';MPU=15/88
A=np.array([5.353706359863281,1.8181995153427124,.5621602535247803],float)
FPS=30;COUNT=75;ELONG=55/30;RELEASE=64/30;RECT=[710,305,810,377]

def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
helper=load('state_guard',SOURCE_DIR/'state_guard.py')
import mesh_helpers as rr

def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)

def arrays(m):
 m.calc_loop_triangles();return np.array([list(v.co) for v in m.vertices],float),[tuple(f.vertices) for f in m.polygons],np.array([list(f.vertices) for f in m.loop_triangles],int)

def metric(v,tr):
 origin=v.mean(0);x=v-origin;a,b,c=[x[tr[:,i]]for i in range(3)];w=np.einsum('ij,ij->i',a,np.cross(b,c))/6;vol=w.sum();center=origin+(((a+b+c)/4)*w[:,None]).sum(0)/vol;return abs(vol)*MPU**3,center

def writecoords(m,v):m.vertices.foreach_set('co',v.astype(np.float32).ravel());m.update()

def closed(m):return rr.closed(m)

class Water:
 def __init__(self,audit=False):
  assert hashlib.sha256(SRC.read_bytes()).hexdigest()==SHA
  bpy.ops.wm.open_mainfile(filepath=str(SRC));bpy.context.view_layer.update();self.before=helper.snapshot(bpy) if audit else None
  self.ob=bpy.data.objects[NAME];self.m=self.ob.data;self.original_mesh_name=self.m.name;self.mat=self.m.materials[0]
  self.original_volume=rr.stats(self.m)[0]
  bm=bmesh.new();bm.from_mesh(self.m)
  for mm in [.5,1.,1.5,2.,2.5,3.,3.5,4.]:
   bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-9,plane_co=Vector((0,0,A[2]-mm/1000/MPU)),plane_no=Vector((0,0,1)),clear_inner=False,clear_outer=False)
  bm.to_mesh(self.m);bm.free();rr.clean(self.m);assert closed(self.m)
  self.base,self.faces,self.tr=arrays(self.m);self.depth=(A[2]-self.base[:,2])*MPU
  self.acc=self.base.copy();z=self.depth;mask=z>.002;f=np.clip((z-.002)/.004,0,1);self.acc[mask,:2]=A[:2]+(self.base[mask,:2]-A[:2])*(1-.28*f[mask,None]);self.acc[mask,2]=A[2]-(.002+(z[mask]-.002)*.4375)/MPU
  # Exact plane vertices at depth 2 mm define the topology handoff.
  plane=A[2]-.002/MPU;lo=rr.bisect(self.m,plane,False);self.lower_base,self.lower_faces,self.lower_tr=arrays(lo);self.lower_target=metric(self.lower_base,self.lower_tr)[0];bpy.data.meshes.remove(lo)
  # Build a vertex-id correspondence for the lower closed shell, including cut ring.
  self.lower_indices=np.array([int(np.argmin(np.linalg.norm(self.base-v,axis=1)))for v in self.lower_base]);assert np.max(np.linalg.norm(self.base[self.lower_indices]-self.lower_base,axis=1))<2e-6
  up=rr.bisect(self.m,plane,True);ub,uf,self.base_upper_tr=arrays(up);self.upper_target=metric(ub,self.base_upper_tr)[0];self.upper_indices=np.array([int(np.argmin(np.linalg.norm(self.base-v,axis=1)))for v in ub]);bpy.data.meshes.remove(up)
  self.final=self.connected(RELEASE)
  writecoords(self.m,self.final);up=rr.bisect(self.m,plane,True);low=rr.bisect(self.m,plane,False)
  self.upper0,self.upper_faces,self.upper_tr=arrays(up);self.lower0,self.lower_faces,self.lower_tr=arrays(low);self.upper_vol,self.upper_center=metric(self.upper0,self.upper_tr);self.lower_vol,self.lower_center=metric(self.lower0,self.lower_tr)
  # Target sphere-like shape, gradually approached after detachment. Same volume and centroid.
  delta=self.lower0-self.lower_center;r=np.linalg.norm(delta,axis=1);unit=delta/np.maximum(r[:,None],1e-12);unit[:,2]*=1.04
  target=self.lower_center+unit;vol,c=metric(target,self.lower_tr);self.rounded=self.lower_center+(target-c)*(self.lower_vol/vol)**(1/3)
  self.drop=bpy.data.objects.new('Offline preview / released primary lens',low);self.ob.users_collection[0].objects.link(self.drop);low.materials.append(self.mat);self.drop.hide_render=True
  self.upmesh=up;self.upmesh.materials.append(self.mat);self.original_data=self.m
  left,right=0.,.15
  for _ in range(40):
   mid=(left+right)/2
   if self.project(self.lower_at(mid))[:,1].min()<RECT[3]+1:left=mid
   else:right=mid
  self.exit_dt=right;assert self.lower_at(self.exit_dt)[:,2].min()>.016155779361724854
  self.set_time(0)
  if audit:self.audit()

 def connected(self,t):
  a=float(smooth(t/ELONG));v=(1-a)*self.acc+a*self.base
  p=float(smooth((t-ELONG)/(RELEASE-ELONG)))
  if p>0:
   z=self.depth;kernel=np.where(np.abs(z-.002)<.00192,.5*(1+np.cos(np.pi*np.clip((z-.002)/.00192,-1,1))),0);rad=1-p*(1-.008)*kernel
   v[:,:2]=A[:2]+(v[:,:2]-A[:2])*rad[:,None]
   # Redistribute pinched lower-neck volume into the existing lower lobe smoothly.
   weight=smooth((z-.002)/.003);lo=self.lower_indices
   left,right=1.,1.2
   for _ in range(26):
    scale=(left+right)*.5;c=v.copy();c[:,:2]=A[:2]+(c[:,:2]-A[:2])*(1+(scale-1)*weight[:,None]);vol,_=metric(c[lo],self.lower_tr)
    if vol<self.lower_target:left=scale
    else:right=scale
   v[:,:2]=A[:2]+(v[:,:2]-A[:2])*(1+((left+right)*.5-1)*weight[:,None])
   # Upper-neck liquid recoils locally; conserve the connected upper water volume too.
   uw=np.where((z>.00008)&(z<.002),np.sin(np.pi*np.clip((z-.00008)/.00192,0,1))**2,0);ui=self.upper_indices;left,right=1.,3.
   for _ in range(26):
    scale=(left+right)*.5;c=v.copy();c[:,:2]=A[:2]+(c[:,:2]-A[:2])*(1+(scale-1)*uw[:,None]);vol,_=metric(c[ui],self.base_upper_tr)
    if vol<self.upper_target:left=scale
    else:right=scale
   v[:,:2]=A[:2]+(v[:,:2]-A[:2])*(1+((left+right)*.5-1)*uw[:,None])
  return v

 def lower_at(self,dt):
  # Surface-tension-inspired relaxation; no instantaneous rounding or displacement.
  relax=float(smooth(dt/.10));v=(1-relax)*self.lower0+relax*self.rounded;vol,c=metric(v,self.lower_tr);v=self.lower_center+(v-c)*(self.lower_vol/vol)**(1/3);v[:,2]-=.5*9.81*dt*dt/MPU;return v

 def set_time(self,t,force=None):
  split=(t>=RELEASE) if force is None else force
  if not split:
   self.ob.data=self.original_data;writecoords(self.original_data,self.connected(t));self.drop.hide_render=True;v=self.connected(t);lo=None
  else:
   self.ob.data=self.upmesh;writecoords(self.upmesh,self.upper0);dt=max(0,t-RELEASE);lo=self.lower_at(min(dt,self.exit_dt));writecoords(self.drop.data,lo)
   # Crop-local preview: retire the falling body only after it has completely left view,
   # before unseen ground contact. Never teleport a visible water body.
   xy=self.project(lo);self.drop.hide_render=bool(dt>=self.exit_dt)
   v=self.upper0
  bpy.context.view_layer.update();return v,lo

 def project(self,v):
  s=bpy.context.scene;dep=bpy.context.evaluated_depsgraph_get();P=np.array(s.camera.calc_matrix_camera(dep,x=900,y=600))@np.array(s.camera.matrix_world.inverted());q=np.c_[v,np.ones(len(v))]@P.T;q=q[:,:3]/q[:,3,None];return np.c_[(q[:,0]+1)*450,(1-q[:,1])*300]

 def audit(self):
  self.set_time(RELEASE,False);beforev=np.array([list(v.co)for v in self.ob.data.vertices]);bv,bc=metric(beforev,self.tr);self.set_time(RELEASE,True)
  boundary=np.vstack([self.upper0,self.lower0]);near=max(float(np.min(np.linalg.norm(beforev-v,axis=1))) for v in boundary)
  plane=np.abs((A[2]-self.final[:,2])*MPU-.002)<2e-7;neckxy=self.project(self.final[plane]);neck=float(np.linalg.norm(neckxy.max(0)-neckxy.min(0)))
  report={'source':str(SRC),'source_sha256':SHA,'fps':FPS,'frame_count':COUNT,'duration_s':COUNT/FPS,'native_buffer':[900,600],'crop_top_origin':RECT,'elongation_s':ELONG,'release_s':RELEASE,'metres_per_blender_unit':MPU,'gravity_m_s2':9.81,'source_connected_volume_ul':self.original_volume*1e9,'released_volume_ul':self.lower_vol*1e9,'residual_volume_ul':self.upper_vol*1e9,'split_conservation_relative_error':abs(bv-self.upper_vol-self.lower_vol)/bv,'same_time_split_boundary_max_displacement_mm':near*MPU*1000,'neck_projected_diameter_px_at_split':neck,'release_geometry_identical_before_motion':near*MPU<1e-7,'source_ground_clearance_mm':93.06894445961173,'retire_only_beyond_crop_lower_edge_px':RECT[3]+1,'offscreen_retirement_ms_after_release':self.exit_dt*1000,'retirement_lowest_height_above_ground_mm':float((self.lower_at(self.exit_dt)[:,2].min()-.016155779361724854)*MPU*1000),'necking_mass_error_relative':abs(self.upper_vol+self.lower_vol-self.original_volume)/self.original_volume,'topology_closed':{'before':closed(self.original_data),'upper':closed(self.upmesh),'released':closed(self.drop.data)},'scope':'One primary water object deforms; one daughter lobe splits. All non-primary-water scene state retained. Offline authored transient, not a fluid simulation or runtime FPS measurement.'}
  # Compare source state while excluding only water geometry and the daughter object.
  after=helper.snapshot(bpy);expected=copy.deepcopy(self.before)
  for name in list(expected['meshes']):
   if name==self.original_mesh_name:expected['meshes'][name]=after['meshes'][name]
  for name in after['meshes']:
   if name not in expected['meshes']:expected['meshes'][name]=after['meshes'][name]
  expected['objects'][NAME]=after['objects'][NAME];expected['objects'][self.drop.name]=after['objects'][self.drop.name]
  for name in expected['materials']:expected['materials'][name]['properties']['users']=after['materials'][name]['properties']['users']
  for name in expected['collections']:expected['collections'][name]=after['collections'][name]
  residual=helper.differences(expected,after);assert not residual,residual;report['protected_scene_state_residual']=residual
  assert report['split_conservation_relative_error']<2e-5 and report['release_geometry_identical_before_motion'] and neck<.02
  (D/'GEOMETRY-AND-CONTINUITY.json').write_text(json.dumps(report,indent=2))
  np.savez_compressed(D/'water-animation-geometry.npz',base_vertices=self.base,accumulation_vertices=self.acc,triangles=self.tr,split_upper_vertices=self.upper0,split_upper_triangles=self.upper_tr,split_lower_vertices=self.lower0,split_lower_triangles=self.lower_tr,rounded_target_vertices=self.rounded)
  frames=[]
  for i in range(COUNT):
   t=i/FPS;v,lo=self.set_time(t);rec={'frame':i,'time_s':t,'phase':'accumulation'if t<ELONG else 'necking'if t<RELEASE else 'released','drop_visible':not self.drop.hide_render}
   if lo is not None:
    vol,c=metric(lo,self.lower_tr);xy=self.project(lo);rec.update({'released_volume_ul':vol*1e9,'released_centroid_m':(c*MPU).tolist(),'released_bbox900':[float(xy[:,0].min()),float(xy[:,1].min()),float(xy[:,0].max()),float(xy[:,1].max())],'fall_mm':.5*9.81*min(t-RELEASE,self.exit_dt)**2*1000,'trajectory_ended_offscreen':t-RELEASE>=self.exit_dt,'lowest_drop_height_mm':float((lo[:,2].min()-.016155779361724854)*MPU*1000)})
   frames.append(rec)
  (D/'FRAME-GEOMETRY.json').write_text(json.dumps(frames,indent=2));self.set_time(0)
