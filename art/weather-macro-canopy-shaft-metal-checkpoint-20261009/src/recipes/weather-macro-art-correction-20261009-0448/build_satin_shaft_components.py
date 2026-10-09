"""Selected satin steel and reference-supported coaxial sleeve/ferrule, no light edits."""
import bpy,numpy as np,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D=Path(__file__).parent;SRC=D/'PersonalOS-half-scale-wet-reflection-candidate.blend';SHA=json.loads((D/'HALF-SCALE-SELECTED-SHOT-MERGE.json').read_text())['candidate_sha256'];assert hashlib.sha256(SRC.read_bytes()).hexdigest()==SHA
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();shaft=s.objects['Dry clay / straight coaxial crown runner shaft'];points=shaft.data.splines[0].points;C=np.array(shaft.matrix_world@Vector(points[1].co[:3]));foot=np.array(shaft.matrix_world@Vector(points[-1].co[:3]));axis=C-foot;axis/=np.linalg.norm(axis);CM=np.array(s.camera.matrix_world);O=CM[:3,3];F=-CM[:3,2];R=CM[:3,0];U=CM[:3,1];MPU=15/88;worldscale=np.linalg.norm(np.array(shaft.matrix_world)[:3,0]);radius=shaft.data.bevel_depth*worldscale
base=shaft.data.materials[0];mat=base.copy();mat.name='Shaft only / satin neutral steel with shared reflections';p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
settings={'Base Color':(.42,.44,.46,1),'Metallic':1.,'Roughness':.22,'Anisotropic':0.,'Anisotropic IOR Level':0.,'Coat Weight':0.,'Emission Strength':0.}
for key,value in settings.items():
 if key not in p.inputs:continue
 for link in list(p.inputs[key].links):mat.node_tree.links.remove(link)
 p.inputs[key].default_value=value
for key in ['Normal','Tangent']:
 if key in p.inputs:
  for link in list(p.inputs[key].links):mat.node_tree.links.remove(link)
for name in [shaft.name,'Dry clay / runner collar','Dry clay / crown collar']:
 o=s.objects[name];o.data.materials.clear();o.data.materials.append(mat)
# New material is not assigned to ribs, struts, canopy or water.
mat['disclosure']='Satin metal art-direction test; not target-pixel matching';mat['original_shared_material']=base.name
rubber=bpy.data.materials.new('Shaft foot / neutral matte ferrule');rubber.use_nodes=True;rp=next(n for n in rubber.node_tree.nodes if n.type=='BSDF_PRINCIPLED');rp.inputs['Base Color'].default_value=(.032,.034,.037,1);rp.inputs['Metallic'].default_value=.04;rp.inputs['Roughness'].default_value=.5

def pix(v):
 q=np.asarray(v)-O;return np.stack([450+1325*(q@R)/(q@F),300-1325*(q@U)/(q@F)],-1)
def at_y(y):
 q=foot-O;t=(1325*(q@U)-(300-y)*(q@F))/((300-y)*(axis@F)-1325*(axis@U));return foot+axis*t
E1=R-axis*(R@axis);E1/=np.linalg.norm(E1);E2=np.cross(axis,E1)
def lathe(name,profile,material):
 n=64;verts=[];faces=[]
 for y,mult in profile:
  center=at_y(y)
  for i in range(n):a=2*math.pi*i/n;verts.append(center+radius*mult*(math.cos(a)*E1+math.sin(a)*E2))
 for j in range(len(profile)-1):
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 faces.append(tuple(range(n-1,-1,-1)));faces.append(tuple((len(profile)-1)*n+i for i in range(n)))
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.materials.append(material);m.update();o=bpy.data.objects.new(name,m);s.collection.objects.link(o)
 for poly in m.polygons:poly.use_smooth=poly.index<len(faces)-2
 o['design']='Reference-supported coaxial sleeve; no painted bands or longitudinal grooves';return o
sleeve_profile=[(382.4,1.18),(382.0,1.20),(360.0,1.20),(359.4,1.16),(358.9,1.10),(358.4,1.12),(347.0,1.12),(346.4,1.04),(346.0,1.01)]
sleeve=lathe('Shaft / stepped satin lower sleeve',sleeve_profile,mat)
foot_y=float(pix(foot)[1]);ferrule_profile=[(foot_y,1.0),(390.0,1.12),(389.2,1.22),(383.0,1.24),(382.2,1.22),(381.7,1.16)];ferrule=lathe('Shaft / short rounded matte ferrule',ferrule_profile,rubber)
# The hidden metal tube ends half a millimetre inside the cap. The assembly's
# original foot anchor and contact ring remain exactly fixed.
inv=shaft.matrix_world.inverted();points[-1].co=(*(inv@Vector(foot+axis*.003)),1);bpy.context.view_layer.update()
def evaluated(o):
 e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();v=np.array([e.matrix_world@p.co for p in m.vertices]);t=np.array([p.vertices for p in m.loop_triangles]);e.to_mesh_clear();return v,t
sv=[];st=[];offset=0
for o in [shaft,sleeve,ferrule]:
 v,t=evaluated(o);sv.extend(v);st.extend(t+offset);offset+=len(v)
sv=np.array(sv);st=np.array(st);S=BVHTree.FromPolygons(sv,st,all_triangles=True);bv,bt=evaluated(s.objects['BallBody / one original spherical actor']);B=BVHTree.FromPolygons(bv,bt,all_triangles=True);assert not S.overlap(B)
sp=pix(sv);rows=[]
for y in [225,250,275,300,325,346,350,359,370,380,385,389]:
 cuts=[]
 for tri in st:
  p=sp[tri]
  if p[:,1].min()<=y+.5<=p[:,1].max():
   for a,b in zip(p,np.roll(p,-1,axis=0)):
    if min(a[1],b[1])<=y+.5<=max(a[1],b[1]) and abs(a[1]-b[1])>1e-8:cuts.append(float(a[0]+(b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])))
 lo,hi=min(cuts),max(cuts);vis=[]
 for x in np.arange(lo+.03125,hi,.0625):
  ray=Vector(F+R*(x-450)/1325+U*(300-y-.5)/1325);ray.normalize();sh=S.ray_cast(Vector(O),ray,40);bh=B.ray_cast(Vector(O),ray,40);vis.append(sh[0] is not None and (bh[0] is None or sh[3]<bh[3]))
 rows.append({'row_y':y,'whole_assembly_width_px':hi-lo,'fraction_clear_of_Ball':float(np.mean(vis))});assert all(vis),(y,lo,hi)
receivers=[]
for name in ['Ground / unified continuous metric field','Water / finite storm-shelf hollows']:
 v,t=evaluated(s.objects[name]);receivers.append(BVHTree.FromPolygons(v,t,all_triangles=True))
def gz(x,y):
 hits=[b.ray_cast(Vector((x,y,2)),Vector((0,0,-1)),5)[0] for b in receivers];return max(h.z for h in hits if h is not None)
fv,_=evaluated(ferrule);low=fv[fv[:,2]<fv[:,2].min()+.01];gaps=[v[2]-gz(v[0],v[1]) for v in low];gap=min(gaps)*MPU*1000
# Dense round cap differs by micrometres from the old 16-sided bevel contact.
# Seat only this new cap on the unchanged axis, a subpixel construction fix.
ferrule_seating=0.
if gap<.025:
 ferrule_seating=(.025-gap)/1000/MPU/max(axis[2],.5);ferrule.location=Vector(axis*ferrule_seating);bpy.context.view_layer.update()
 fv,_=evaluated(ferrule);low=fv[fv[:,2]<fv[:,2].min()+.01];gap=min(v[2]-gz(v[0],v[1]) for v in low)*MPU*1000
assert gap>-.005,gap
OUT=D/'PersonalOS-half-scale-satin-shaft-stage.blend';bpy.ops.wm.save_as_mainfile(filepath=str(OUT),compress=True);report={'source_sha256':SHA,'candidate_sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'material_forked_from':base.name,'shaft_satin_material':mat.name,'settings':settings,'ribs_struts_canopy_water_materials_unchanged':True,'main_world_diameter_mm':2*radius*MPU*1000,'shaft_axis_and_visible_main_radius_unchanged':True,'foot_anchor_world':foot.tolist(),'crown_world':C.tolist(),'sleeve_profiles_native_y_and_radius_multiple':sleeve_profile,'ferrule_profiles_native_y_and_radius_multiple':ferrule_profile,'ferrule_min_receiver_gap_mm':gap,'ferrule_numerical_axial_seating_mm':ferrule_seating*MPU*1000,'ferrule_foot_pixel_change':(pix(foot+axis*ferrule_seating)-pix(foot)).tolist(),'shaft_assembly_Ball_intersections':0,'native_geometry_rows':rows,'lighting_unchanged_pending_one_flag':True,'surface_detail':'Geometry-only coaxial bevels and circumferential transitions, no decorative shader noise or painted bands','metal_tube_internal_end_adjustment_mm':.003*MPU*1000};(D/'SATIN-SHAFT-COMPONENT-BUILD.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
