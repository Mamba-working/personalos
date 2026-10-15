"""Fresh radius-aware sphere sweeps against the retained current visible scene."""
import bpy,numpy as np,json,hashlib,time,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D=Path(__file__).resolve().parent;R=D.parent;SRC=R/'weather-rounded-water-rim-milestone-20261008-2354/rounded-water-visible-rim-milestone.blend';EXPECTED='ea4f3c4833c7f9b1c4c18ac06a19721bf86e84bbc27f2426d64e31ed644c12e7'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert sha(SRC)==EXPECTED
old=json.loads((R/'weather-rain-optical-atlas-20261008-0713/original-900-records.json').read_text());assert len(old)==900
AU=15/88;T=1/320;LEGACY_T=.0125;EPS=2.5e-5;MAXSTEPS=1024
# Stable identity hash selection, exact approved authored counts; no replacement after culling.
def band(r):return 'near' if r['camera_depth_m']<10 else 'mid' if r['camera_depth_m']<25 else 'far'
selected=[]
for b,count in [('near',14),('mid',200),('far',278)]:
 ids=[i for i,r in enumerate(old)if band(r)==b];ids.sort(key=lambda i:hashlib.sha256(('canonical-sphere-rain-v1:'+str(old[i]['sample'])).encode()).hexdigest());selected.extend(ids[:count])
selected.sort();assert len(selected)==492
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);dep=bpy.context.evaluated_depsgraph_get();cam=np.array(s.camera.matrix_world.translation);mat=np.array(s.camera.matrix_world);F=900*s.camera.data.lens/s.camera.data.sensor_width;visible=set()
def walk(c,hidden=False):
 hidden=hidden or c.hide_render
 if not hidden:visible.update(o.name for o in c.objects if not o.hide_render)
 for child in c.children:walk(child,hidden)
walk(s.collection);vertices=[];faces=[];face_object=[];objects=[];start=time.monotonic()
for name in sorted(visible):
 obj=s.objects[name]
 if obj.type not in {'MESH','CURVE','SURFACE','META','FONT'}:continue
 assert not name.startswith(('Static rain /','Rain /','Rain drop source')),'Unexpected visible old rain'
 e=obj.evaluated_get(dep);mesh=e.to_mesh();mesh.calc_loop_triangles();v=np.empty((len(mesh.vertices),3),np.float32);mesh.vertices.foreach_get('co',v.ravel());M=np.array(e.matrix_world);v=v@M[:3,:3].T+M[:3,3];tri=np.empty((len(mesh.loop_triangles),3),np.int32);mesh.loop_triangles.foreach_get('vertices',tri.ravel());offset=len(vertices);oi=len(objects);vertices.extend(v.tolist());faces.extend((tri+offset).tolist());face_object.extend([oi]*len(tri));objects.append({'name':name,'triangles':len(tri),'vertices':len(v),'bounds':[v.min(0).tolist(),v.max(0).tolist()]});e.to_mesh_clear()
print('BUILD_GLOBAL_BVH',len(vertices),len(faces),'objects',len(objects),flush=True);tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True,epsilon=0.);face_object=np.array(face_object,np.int32);del vertices,faces
print('BVH_READY',time.monotonic()-start,flush=True);zmax=max(o['bounds'][1][2]for o in objects);records=[];counts={}
def project(p):
 q=p-cam;z=q@(-mat[:3,2]);return np.stack([450+F*(q@mat[:3,0])/z,300-F*(q@mat[:3,1])/z],axis=-1)
def sweep(p0,direction,length,radius):
 travel=0.
 for step in range(MAXSTEPS):
  p=p0+direction*travel;hit,n,face,distance=tree.find_nearest(Vector(p));clearance=float(distance)-radius
  if clearance<=EPS:return travel,'first_contact',int(face_object[face]),step+1
  if clearance>=length-travel:return length,'clear_full',None,step+1
  travel+=.8*clearance
 return travel,'bounded_march_unresolved',int(face_object[face]),MAXSTEPS
for i in selected:
 r=old[i];legacy_velocity=np.array(r['velocity_world_m_s']);center=np.array(r['start_world_m'])+legacy_velocity*LEGACY_T/2;v=legacy_velocity/AU;p0=center-v*T/2;radius=r['radius_m']/AU;length=float(np.linalg.norm(v)*T);direction=v/np.linalg.norm(v);pos=Vector(p0);hit,n,face,distance=tree.find_nearest(pos);oi=int(face_object[face]);signed=float((pos-hit).dot(n));status='clear_full_shutter';travel=0.;contact=None;steps=0;shelter=None
 if distance<=radius+EPS:status='initial_radius_overlap';contact=oi
 elif signed < -EPS:status='initial_inside_or_below_oriented_surface';contact=oi
 else:
  # A backwards radius-aware sweep to above every current collider tests whether
  # this nominal start has already passed through canopy/Ball/ground upstream.
  upstream_length=max(0.,(zmax+1.-p0[2])/(-direction[2]));up,upstatus,upobj,upsteps=sweep(p0,-direction,upstream_length,radius)
  if upstatus!='clear_full':status='initial_sheltered_upstream' if upstatus=='first_contact'else 'upstream_unresolved_culled';contact=upobj;shelter={'distance_AU':up,'steps':upsteps,'status':upstatus}
  else:
   travel,status,contact,steps=sweep(p0,direction,length,radius)
   if status=='clear_full':status='clear_full_shutter'
 active=travel/length;end=p0+v*T*active;pixlength=float(np.linalg.norm(project(end)-project(p0)))
 records.append({'record_index':i,'sample_id':r['sample'],'depth_band':band(r),'legacy_camera_depth_AU':r['camera_depth_m'],'nominal_center_AU':center.tolist(),'legacy_start_AU':r['start_world_m'],'start_AU':p0.tolist(),'end_airborne_AU':end.tolist(),'unclipped_end_AU':(p0+v*T).tolist(),'radius_m':r['radius_m'],'radius_AU':radius,'velocity_m_s':r['velocity_world_m_s'],'velocity_AU_s':v.tolist(),'active_fraction':active,'active_seconds':T*active,'collision_status':status,'contact_object':objects[contact]['name'] if contact is not None else None,'verified_clear_prefix_AU':travel,'full_length_AU':length,'projected_active_length_px':pixlength,'projected_nominal_length_px':float(np.linalg.norm(project(p0+v*T)-project(p0))),'projected_center_px':project(center).tolist(),'distance_march_steps':steps,'shelter':shelter,'old_clipped_lifetime_reused':False});counts[status]=counts.get(status,0)+1
 if len(records)%100==0:print('SWEEPS',len(records),counts,time.monotonic()-start,flush=True)
assert len(records)==492
(D/'FRESH-TRAJECTORY-RECORDS.json').write_text(json.dumps(records,indent=2));audit={'source_sha256':EXPECTED,'source_unchanged':sha(SRC)==EXPECTED,'metres_per_AU':AU,'ball_diameter_m':.30,'anchor':'Original center recovered with legacy .0125s exposure before applying corrected SI velocity and new1/320s exposure','shutter_seconds':T,'selection':'Sort each legacy depth band by sha256(canonical-sphere-rain-v1:sample_id), choose14/200/278, never replenish','band_bounds_AU':[4,10,25,70],'before_culling':{b:sum(r['depth_band']==b for r in records)for b in ['near','mid','far']},'after_culling':{b:sum(r['depth_band']==b and r['active_fraction']>0 for r in records)for b in ['near','mid','far']},'status_counts':counts,'radius_range_AU':[min(r['radius_AU']for r in records),max(r['radius_AU']for r in records)],'projected_nominal_length_px_median_by_band':{b:float(np.median([r['projected_nominal_length_px']for r in records if r['depth_band']==b]))for b in ['near','mid','far']},'contact_tolerance_AU':EPS,'contact_tolerance_m':EPS*AU,'march_step_fraction_of_surface_clearance':.8,'maximum_steps_per_path':MAXSTEPS,'collision_proof':'Conservative1-Lipschitz nearest-triangle distance sphere sweep; initial overlap/inward-side and upstream-sheltered starts withheld. Stop at first contact or bounded unresolved prefix. Current evaluated render-visible geometry only.','physical_rainfall_rate_calibrated':False,'objects':objects,'elapsed_seconds':time.monotonic()-start};(D/'TRAJECTORY-AUDIT.json').write_text(json.dumps(audit,indent=2));print('FRESH_TRAJECTORIES_READY',json.dumps({k:v for k,v in audit.items()if k!='objects'}),flush=True)
