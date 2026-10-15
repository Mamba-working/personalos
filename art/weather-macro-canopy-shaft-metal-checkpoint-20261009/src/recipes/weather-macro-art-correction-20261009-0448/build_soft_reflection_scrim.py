"""One compact curved studio negative-fill helper with explicit nonphysical visibility."""
import bpy,numpy as np,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D=Path(__file__).parent;SRC=D/'PersonalOS-half-scale-satin-shaft-stage.blend';SHA=json.loads((D/'SATIN-SHAFT-COMPONENT-BUILD.json').read_text())['candidate_sha256'];assert hashlib.sha256(SRC.read_bytes()).hexdigest()==SHA
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();plan=json.loads((D/'SHARED-METAL-FLAG-WIDE-PLACEMENT.json').read_text());axis=np.array(plan['long_axis']);axis/=np.linalg.norm(axis);N=np.array(plan['view_facing_cylinder_normal']);T=np.array(plan['visible_right_tangent']);foot=np.array(json.loads((D/'SATIN-SHAFT-COMPONENT-BUILD.json').read_text())['foot_anchor_world']);CM=np.array(s.camera.matrix_world);O=CM[:3,3];F=-CM[:3,2];R=CM[:3,0];U=CM[:3,1]
def station(y):
 q=foot-O;return (1325*(q@U)-(300-y)*(q@F))/((300-y)*(axis@F)-1325*(axis@U))
radius=.16;t0=station(390)-.02;t1=station(215)+.35;phi0,phi1=-90.,170.;n=96;verts=[];uvs=[]
for j,t in enumerate([t0,t1]):
 for i,phi in enumerate(np.linspace(phi0,phi1,n+1)):
  a=math.radians(phi);rad=radius*(N*math.cos(a)+T*math.sin(a));tt=max(t,(.04-foot[2]-rad[2])/axis[2]) if j==0 else t;verts.append(foot+axis*tt+rad);uvs.append((i/n,(tt-t0)/(t1-t0)))
faces=[]
for i in range(n):faces.append((i,i+1,n+2+i,n+1+i))
mesh=bpy.data.meshes.new('Studio / curved reflection-only shaft negative fill');mesh.from_pydata(verts,[],faces);mesh.update();uv=mesh.uv_layers.new(name='PhysicalFlagArc');vi=np.empty(len(mesh.loops),np.int32);mesh.loops.foreach_get('vertex_index',vi);uv.data.foreach_set('uv',np.array(uvs,np.float32)[vi].ravel());o=bpy.data.objects.new(mesh.name,mesh);s.collection.objects.link(o)
for attr in ['visible_camera','visible_transmission','visible_diffuse','visible_shadow','visible_volume_scatter']:
 if hasattr(o,attr):setattr(o,attr,False)
o.visible_glossy=True
mat=bpy.data.materials.new('Studio / feathered curved neutral negative-fill reflection');mat.use_nodes=True;nt=mat.node_tree;nt.nodes.clear();tex=nt.nodes.new('ShaderNodeTexCoord');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(tex.outputs['UV'],sep.inputs[0])
def smooth(socket,lo,hi):
 m=nt.nodes.new('ShaderNodeMapRange');m.clamp=True;m.interpolation_type='SMOOTHSTEP';m.inputs['From Min'].default_value=lo;m.inputs['From Max'].default_value=hi;m.inputs['To Min'].default_value=0.;m.inputs['To Max'].default_value=1.;nt.links.new(socket,m.inputs['Value']);return m.outputs['Result']
def mul(a,b):
 m=nt.nodes.new('ShaderNodeMath');m.operation='MULTIPLY';nt.links.new(a,m.inputs[0]);nt.links.new(b,m.inputs[1]);return m.outputs[0]
# Global physical arc falloff, not a projected mask on the shaft or canopy.
left=smooth(sep.outputs['X'],(-80-phi0)/(phi1-phi0),(-40-phi0)/(phi1-phi0));right=smooth(sep.outputs['X'],(170-phi0)/(phi1-phi0),(130-phi0)/(phi1-phi0));bottom=smooth(sep.outputs['Y'],0,.025);top=smooth(sep.outputs['Y'],1,.975);weight=mul(mul(left,right),mul(bottom,top));density=nt.nodes.new('ShaderNodeMath');density.operation='MULTIPLY';density.inputs[1].default_value=.80;nt.links.new(weight,density.inputs[0]);weight=density.outputs[0];diff=nt.nodes.new('ShaderNodeBsdfDiffuse');diff.inputs['Color'].default_value=(.01,.01,.01,1);diff.inputs['Roughness'].default_value=1.;trans=nt.nodes.new('ShaderNodeBsdfTransparent');mix=nt.nodes.new('ShaderNodeMixShader');nt.links.new(weight,mix.inputs[0]);nt.links.new(trans.outputs[0],mix.inputs[1]);nt.links.new(diff.outputs[0],mix.inputs[2]);out=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(mix.outputs[0],out.inputs['Surface']);mesh.materials.append(mat)
o['disclosure']='Nonphysical film lookdev helper: glossy-visible only; invisible to camera, transmission, diffuse, volume and shadow rays. World-fixed curved flag, no object-specific gain or target image projection.';o['arc_degrees']=[phi0,phi1];o['soft_fill_arc_degrees']=[-80.,-40.,130.,170.];o['radius_world']=radius;o['uniform_peak_occlusion']=.80;o['density_disclosure']='Uniform 80 percent negative-fill scrim with one broad edge feather; no per-pixel or per-object material gain'
# Bounded geometric contact checks against the real Ball and half-scale membrane.
mesh.calc_loop_triangles();fv=np.array(verts);ft=np.array([t.vertices for t in mesh.loop_triangles]);flag=BVHTree.FromPolygons(fv,ft,all_triangles=True);checks={}
for name in ['BallBody / one original spherical actor','Dry clay / eight tensioned gores']:
 ob=s.objects[name];e=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();v=np.array([e.matrix_world@p.co for p in m.vertices]);t=np.array([p.vertices for p in m.loop_triangles]);e.to_mesh_clear();count=len(flag.overlap(BVHTree.FromPolygons(v,t,all_triangles=True)));checks[name]=count;assert count==0,(name,count)
# Retain a ray-level proof of the intended reflected coverage along the cylinder.
def soft(q):q=np.clip(q,0,1);return q*q*(3-2*q)
coverage=[]
for frac in [.1,.2,.25,.35,.4,.5,.6,.7,.8,.9,.95,.99]:
 theta=np.arcsin(2*frac-1);phi=np.degrees(2*theta);alpha=float(0.80*soft((phi+80)/40)*soft((170-phi)/40));coverage.append({'cylinder_width_fraction':frac,'normal_degrees':float(np.degrees(theta)),'reflection_azimuth_degrees':float(phi),'nominal_negative_fill_weight':alpha})
OUT=D/'PersonalOS-soft-reflection-scrim-candidate.blend';bpy.ops.wm.save_as_mainfile(filepath=str(OUT),compress=True);r={'source_sha256':SHA,'candidate_sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'one_curved_flag':True,'radius_world':radius,'arc_degrees':[phi0,phi1],'soft_fill_arc_degrees':[-80,-40,130,170],'uniform_peak_occlusion':.80,'source_style':'Compact cylindrical studio flag, not a bent shaft','reflectance':.01,'roughness':1.,'material_and_half_scale_roof_unchanged':True,'shaft_pose_sleeve_ferrule_unchanged':True,'World_and_lower_card_unchanged':True,'visibility':{k:bool(getattr(o,k))for k in ['visible_camera','visible_transmission','visible_diffuse','visible_glossy','visible_shadow','visible_volume_scatter']},'nonphysical_disclosure':o['disclosure'],'triangle_intersections':checks,'nominal_profile_coverage':coverage,'preflight_required':'Actual low-cost native shaft profile; angular proxy does not prove GGX appearance'};(D/'SOFT-REFLECTION-SCRIM-BUILD.json').write_text(json.dumps(r,indent=2));np.savez_compressed(D/'SOFT-REFLECTION-SCRIM-GEOMETRY.npz',vertices=fv,triangles=ft,axis=axis,foot=foot,camera=CM);print(json.dumps(r),flush=True)
