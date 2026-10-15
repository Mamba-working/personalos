"""Exact mesh helper functions extracted from the tested rim refinement."""
import bpy,bmesh,numpy as np
from mathutils import Vector
MPU=15/88

def closed(m):
 ids=np.empty(len(m.loops),np.int32);m.loops.foreach_get('edge_index',ids);return bool(len(m.edges))and bool(np.all(np.bincount(ids,minlength=len(m.edges))==2))

def stats(m):
 m.calc_loop_triangles();v=np.array([list(p.co)for p in m.vertices]);origin=v.mean(0);vv=v-origin;t=np.array([list(t.vertices)for t in m.loop_triangles]);a,b,c=[vv[t[:,i]]for i in range(3)];sv=np.einsum('ij,ij->i',a,np.cross(b,c))/6;vol=sv.sum();center=origin+(((a+b+c)/4)*sv[:,None]).sum(0)/vol;return abs(vol)*MPU**3,Vector(center)

def clean(m):
 for f in m.polygons:f.use_smooth=True
 m.update()
 if m.has_custom_normals:m.normals_split_custom_set([(0.,0.,0.)]*len(m.loops))

def bisect(m,z,upper):
 bm=bmesh.new();bm.from_mesh(m);bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-8,plane_co=Vector((0,0,z)),plane_no=Vector((0,0,1)),clear_inner=upper,clear_outer=not upper);bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));out=bpy.data.meshes.new('Rim refinement / '+('upper'if upper else'released lens'));bm.to_mesh(out);bm.free();clean(out);assert closed(out);return out
