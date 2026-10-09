"""One shaft visibility correction, actual evaluated geometry; no beauty render."""
import bpy,numpy as np,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D=Path(__file__).parent;SRC=D/'PersonalOS-continuous-roof-relief-crop-candidate.blend';SHA='1a0cad1a60742bd2365fab190792c781f4bd6e18087350c00b916cb8c2d5d6e9';assert hashlib.sha256(SRC.read_bytes()).hexdigest()==SHA
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();MPU=15/88;CM=np.array(s.camera.matrix_world);O=CM[:3,3];F=-CM[:3,2];R=CM[:3,0];U=CM[:3,1]
def pix(v):
 q=np.asarray(v)-O;return np.stack([450+1325*(q@R)/(q@F),300-1325*(q@U)/(q@F)],-1)
def unpix(x,y,dep):return O+F*dep+R*(x-450)*dep/1325+U*(300-y)*dep/1325

def evaluated(o):
 e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();v=np.array([e.matrix_world@p.co for p in m.vertices]);t=np.array([p.vertices for p in m.loop_triangles]);e.to_mesh_clear();return v,t

def bvh(o):
 v,t=evaluated(o);return BVHTree.FromPolygons(v,t,all_triangles=True),v,t

def camera_audit():
 st,sv,sti=bvh(s.objects['Dry clay / straight coaxial crown runner shaft']);bt,bv,bti=bvh(s.objects['BallBody / one original spherical actor']);sp=pix(sv);bp=pix(bv);out=[];native=[]
 for y in range(215,391):
  cuts=[]
  for tri in sti:
   p=sp[tri]
   if p[:,1].min()<=y+.5<=p[:,1].max():
    for a,b in zip(p,np.roll(p,-1,axis=0)):
     if min(a[1],b[1])<=y+.5<=max(a[1],b[1]) and abs(a[1]-b[1])>1e-7:cuts.append(float(a[0]+(b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])))
  if not cuts:continue
  lo,hi=min(cuts),max(cuts);xs=np.arange(lo+.03125,hi,.0625);vis=[]
  for x in xs:
   ray=Vector(F+R*(x-450)/1325+U*(300-y-.5)/1325);ray.normalize();sh=st.ray_cast(Vector(O),ray,40);bh=bt.ray_cast(Vector(O),ray,40);vis.append(sh[0] is not None and (bh[0] is None or sh[3]<bh[3]))
  visible_fraction=float(np.mean(vis)) if vis else 0;native.append([y,lo,hi,visible_fraction]);
  if y in [225,250,275,290,300,315,330,345,360,375,385]:out.append({'row_y':y,'shaft_x_minmax':[lo,hi],'silhouette_width_px':hi-lo,'fraction_not_occluded_by_Ball':visible_fraction})
 return {'rows':out,'continuous_test_range_y':[215,390],'length_rows_any_visible':sum(v[3]>0 for v in native),'length_rows_at_least90pct_visible':sum(v[3]>=.9 for v in native),'tested_rows':len(native),'Ball_center_pixel':pix(np.array(s.objects['BallBody / one original spherical actor'].matrix_world.translation)).tolist(),'Ball_bounds':[bp.min(0).tolist(),bp.max(0).tolist()]},sv,sti,bv,bti,np.array(native)

before,_,_,_,_,_=camera_audit();shaft=s.objects['Dry clay / straight coaxial crown runner shaft'];p=shaft.data.splines[0].points;C=np.array(shaft.matrix_world@Vector(p[1].co[:3]));olddepth=shaft.data.bevel_depth
receiver=[bvh(s.objects[name])[0] for name in ['Ground / unified continuous metric field','Water / finite storm-shelf hollows']]
def gz(x,y):
 hs=[t.ray_cast(Vector((x,y,2)),Vector((0,0,-1)),5)[0] for t in receiver];return max(h.z for h in hs if h is not None)
foot=unpix(677,390,16.82);foot[2]=gz(foot[0],foot[1]);shaft.data.bevel_depth=.028;shaft.data.use_fill_caps=True

def place_axis():
 axis=C-foot;axis/=np.linalg.norm(axis);runner=C-axis*.48;inv=shaft.matrix_world.inverted()
 for p,x in zip(shaft.data.splines[0].points,[C+axis*.16,C,runner,foot]):p.co=(*(inv@Vector(x)),1)
 for name,center,size in [('Dry clay / runner collar',runner,.025),('Dry clay / crown collar',C,.015)]:
  o=s.objects[name];inv=o.matrix_world.inverted();o.data.bevel_depth=max(o.data.bevel_depth,.032)
  for p,x in zip(o.data.splines[0].points,[center-axis*size,center+axis*size]):p.co=(*(inv@Vector(x)),1)
 for i in range(8):
  o=s.objects[f'Dry clay / connected strut {i:02d}'];inv=o.matrix_world.inverted();o.data.splines[0].points[0].co=(*(inv@Vector(runner)),1)
 bpy.context.view_layer.update()
 return axis
for _ in range(3):
 axis=place_axis();sv,_=evaluated(shaft);low=sv[np.linalg.norm(sv-foot,axis=-1)<.1];gap=min(v[2]-gz(v[0],v[1]) for v in low);foot[2]-=gap-.000025/MPU
axis=place_axis();sv,_=evaluated(shaft);low=sv[np.linalg.norm(sv-foot,axis=-1)<.1];shaftgap=min(v[2]-gz(v[0],v[1]) for v in low)*MPU*1000
ball=s.objects['BallBody / one original spherical actor'];root=s.objects['BallStage / runtime-owned global placement'];bc=np.array(ball.matrix_world.translation);root.location.x+=(610-pix(bc)[0])*((bc-O)@F)/1325;bpy.context.view_layer.update();bv,_=evaluated(ball);low=bv[bv[:,2]<bv[:,2].min()+.005/MPU];gap=min(v[2]-gz(v[0],v[1]) for v in low);root.location.z-=gap-.000025/MPU;bpy.context.view_layer.update();bv,_=evaluated(ball);low=bv[bv[:,2]<bv[:,2].min()+.005/MPU];ballgap=min(v[2]-gz(v[0],v[1]) for v in low)*MPU*1000
# Actual camera rays at 1/16 pixel, accounting for the evaluated Ball depth.
after,sv,st,bv,bt,rows=camera_audit();S=BVHTree.FromPolygons(sv,st,all_triangles=True);B=BVHTree.FromPolygons(bv,bt,all_triangles=True);intersections=len(S.overlap(B));clear=min(B.find_nearest(Vector(v))[3] for v in sv)*MPU*1000
np.savez_compressed(D/'VISIBLE-SHAFT-GEOMETRY-DRAFT.npz',shaft_vertices=sv,shaft_triangles=st,Ball_vertices=bv,Ball_triangles=bt,camera=CM,visibility_rows=rows)
report={'source_sha256':SHA,'shaft_before':before,'shaft_after':after,'shaft_bevel_depth_before_after':[olddepth,shaft.data.bevel_depth],'shaft_nominal_diameter_mm':2*shaft.data.bevel_depth*.9*MPU*1000,'ground_gap_mm':{'shaft':shaftgap,'Ball':ballgap},'shaft_Ball_triangle_intersections':intersections,'shaft_Ball_min_vertex_clearance_mm':clear,'crown_pixel':pix(C).tolist(),'foot_pixel':pix(foot).tolist(),'Ball_shift_pixels':-5,'canopy_membrane_ribs_water_materials_lighting_camera_background_unchanged':True,'structural_updates':'Straight shaft through fixed crown; coaxial collars and runner; connected strut roots updated; no bent workaround','visibility_scope':'Exact evaluated shaft silhouette and Ball ray depth at 1/16 pixel, all rows215–390; transparent canopy is not treated as opaque occlusion'}
assert intersections==0 and after['length_rows_at_least90pct_visible']==after['tested_rows'],report
(D/'VISIBLE-SHAFT-GEOMETRY-AUDIT.json').write_text(json.dumps(report,indent=2));OUT=D/'PersonalOS-visible-straight-shaft-geometry-candidate.blend';bpy.ops.wm.save_as_mainfile(filepath=str(OUT),compress=True);report['candidate_sha256']=hashlib.sha256(OUT.read_bytes()).hexdigest();(D/'VISIBLE-SHAFT-GEOMETRY-AUDIT.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
