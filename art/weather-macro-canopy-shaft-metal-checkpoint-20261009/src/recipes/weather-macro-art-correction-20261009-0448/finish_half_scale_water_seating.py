"""Resolve only residual bead/roof triangle contacts, preserving every bead shape."""
import bpy,numpy as np,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D=Path(__file__).parent;P=D/'PersonalOS-half-scale-roof-stage.blend';before=hashlib.sha256(P.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(P));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();MPU=15/88
c=s.objects['Dry clay / eight tensioned gores'];N=len(c.data.vertices)//2;c.data.calc_loop_triangles();v=np.empty((len(c.data.vertices),3));c.data.vertices.foreach_get('co',v.ravel());M=np.array(c.matrix_world);v=v@M[:3,:3].T+M[:3,3];tt=np.array([t.vertices for t in c.data.loop_triangles if max(t.vertices)<N]);roof=BVHTree.FromPolygons(v[:N],tt,all_triangles=True);records=[]
for name in ['Readable wetness / microbeads','Readable wetness / small_beads','Readable wetness / coalesced_beads']:
 o=s.objects[name];m=o.data;m.calc_loop_triangles();p=np.empty((len(m.vertices),3));m.vertices.foreach_get('co',p.ravel());M=np.array(o.matrix_world);p=p@M[:3,:3].T+M[:3,3];tri=np.array([t.vertices for t in m.loop_triangles]);pairs=roof.overlap(BVHTree.FromPolygons(p,tri,all_triangles=True));parent=np.arange(len(p))
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return int(i)
 for e in m.edges:
  a,b=map(int,e.vertices);ra,rb=find(a),find(b)
  if ra!=rb:parent[rb]=ra
 roots=np.array([find(i) for i in range(len(p))]);affected=sorted(set(int(roots[tri[j,0]]) for _,j in pairs));lifts=[]
 for key in affected:
  ids=np.flatnonzero(roots==key);gtri=tri[roots[tri[:,0]]==key];mapper=np.full(len(p),-1,np.int32);mapper[ids]=np.arange(len(ids));gtri=mapper[gtri];points=p[ids].copy();hits=[roof.find_nearest(Vector(q)) for q in points];signed=np.array([(Vector(q)-h[0]).dot(h[1]) for q,h in zip(points,hits)]);k=int(np.argmin(signed));normal=np.array(hits[k][1])
  def intersects(delta):return bool(roof.overlap(BVHTree.FromPolygons(points+normal*delta,gtri,all_triangles=True)))
  lo,hi=0.,.00002/MPU
  while intersects(hi):
   hi*=2
   if hi>.0005/MPU:raise RuntimeError('Unexpected >0.5mm bead contact correction')
  for _ in range(10):
   mid=(lo+hi)/2
   if intersects(mid):lo=mid
   else:hi=mid
  delta=hi+.000003/MPU;p[ids]+=normal*delta;lifts.append(float(delta*MPU*1000))
 inv=np.array(o.matrix_world.inverted());local=p@inv[:3,:3].T+inv[:3,3];m.vertices.foreach_set('co',local.astype(np.float32).ravel());m.update();records.append({'object':name,'original_triangle_intersection_pairs':len(pairs),'corrected_bodies':len(affected),'extra_lift_mm':lifts})
c['membrane_deformation_not_water_depth']='Continuous2D relief extrema about-2.17/+2.33mm are PVC shape displacement; material shell0.20mm. Existing water-cap dimensions preserved.'
bpy.ops.wm.save_as_mainfile(filepath=str(P),compress=True);r={'source_sha256':before,'final_sha256':hashlib.sha256(P.read_bytes()).hexdigest(),'method':'Minimum positive whole-body translation along contact normal until exact triangle intersection clears, plus3µm safety margin; no shape/UV/material/normal change','objects':records};(D/'HALF-SCALE-WATER-CONTACT-FINISH.json').write_text(json.dumps(r,indent=2));print(json.dumps(r),flush=True)
