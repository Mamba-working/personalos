"""One rigid right-side assembly pose, analytical projection only; no save or render."""
import bpy,json,hashlib,math,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
D=Path(__file__).resolve().parent;R=D.parent;SRC=R/'weather-canonical-sphere-rain-20261009-0119/canonical-sphere-rain-candidate.blend';SHA='be19d3dd793ac283da075631acc307a15ed808cf993ec610a46267553af6aec4';H=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert H(SRC)==SHA
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();cam=s.camera;cm=cam.matrix_world;O=cm.translation.copy();F=1325.;forward=-cm.col[2].to_3d();right=cm.col[0].to_3d();up=cm.col[1].to_3d();AU=15/88
visible=set()
def walk(c,hidden=False):
 hidden=hidden or c.hide_render
 if not hidden:visible.update(o.name for o in c.objects if not o.hide_render)
 for child in c.children:walk(child,hidden)
walk(s.collection);props=sorted(n for n in visible if n.startswith(('Dry clay /','Readable wetness /','Wet PVC /')));assert len(props)==42,len(props)
def geo(o):
 e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();v=np.empty((len(m.vertices),3),np.float32);m.vertices.foreach_get('co',v.ravel());mt=np.array(e.matrix_world);v=v@mt[:3,:3].T+mt[:3,3];tri=np.empty((len(m.loop_triangles),3),np.int32);m.loop_triangles.foreach_get('vertices',tri.ravel());e.to_mesh_clear();return v,tri

def pix(v):
 v=np.asarray(v);q=v-np.array(O);z=q@np.array(forward);return np.stack([450+F*(q@np.array(right))/z,300-F*(q@np.array(up))/z],axis=-1)
def tree(o):v,t=geo(o);return BVHTree.FromPolygons(v,t,all_triangles=True)
receivers=[tree(s.objects[n])for n in ['Ground / unified continuous metric field','Water / finite storm-shelf hollows']]
shaft=s.objects['Dry clay / straight coaxial crown runner shaft'];oldline=[shaft.matrix_world@p.co.to_3d()for p in shaft.data.splines[0].points];Cold=oldline[1];Pold=oldline[-1];oldaxis=(Cold-Pold).normalized();length=(Cold-Pold).length
ball=s.objects['BallBody / one original spherical actor'];root=s.objects['BallStage / runtime-owned global placement'];can=s.objects['Dry clay / eight tensioned gores']
def project_state():
 bv,bt=geo(ball);cv,ct=geo(can);curves={}
 for name in props:
  o=s.objects[name]
  if o.type=='CURVE':curves[name]=[list(pix(o.matrix_world@p.co.to_3d()))for p in o.data.splines[0].points]
 eyes={}
 for name in ['LeftEye / original 48-point contour','RightEye / original 48-point contour']:
  ev,et=geo(s.objects[name]);eyes[name]=pix(ev).tolist()
 return {'Ball_points900':pix(bv).tolist(),'Ball_center900':pix(ball.matrix_world.translation).tolist(),'eyes_points900':eyes,'canopy_points900':pix(cv).tolist(),'canopy_triangles':ct.tolist(),'curves':curves,'shaft_points900':curves[shaft.name],'canopy_bounds900':[pix(cv).min(0).tolist(),pix(cv).max(0).tolist()]}
before=project_state()
# One selected coherent three-quarter pose; reference envelope over ferrule score.
selected=json.loads((D/'SELECTED-POSE.json').read_text());Ball_x=selected['Ball_center_x'];Cnew=Vector(selected['crown_AU']);Pnew=Vector(selected['foot_AU']);newaxis=Vector(selected['axis']);Q=oldaxis.rotation_difference(newaxis);X=Matrix(selected['transform']);foot_pixel=selected['foot_pixel'];crown_pixel=selected['crown_pixel'];scale=selected['scale'];oldmatrices={name:s.objects[name].matrix_world.copy()for name in props}
for name in props:s.objects[name].matrix_world=X@oldmatrices[name]
# Preserve actual0.20mm PVC thickness despite modest uniform macro scale.
cmsh=can.data;nv=12289;assert len(cmsh.vertices)==2*nv
for i in range(nv):
 a=cmsh.vertices[i].co.copy();b=cmsh.vertices[i+nv].co.copy();cmsh.vertices[i+nv].co=a+(b-a)/scale
cmsh.update()
# Keep shaft diameter unchanged; compensate transform scale in the bevel radius.
shaft.data.bevel_depth/=scale
# Preserve Ball identity and size; move its entire actor root laterally.
ballz=(ball.matrix_world.translation-O).dot(forward);dx=(Ball_x-before['Ball_center900'][0])*ballz/F;root.location+=right*dx;bpy.context.view_layer.update()
# Preserve prior real ground gap under Ball through this lateral movement.
def contact_gap(vertices):
 low=float(vertices[:,2].min());out=[]
 for a in vertices[vertices[:,2]<low+.004/AU]:
  p=Vector(a);hs=[t.ray_cast(p+Vector((0,0,1)),Vector((0,0,-1)),2)[0]for t in receivers];hs=[h for h in hs if h is not None]
  if hs:out.append(float(p.z-max(h.z for h in hs)))
 return min(out)
# Inspect old position without changing the source file.
root.location-=right*dx;bpy.context.view_layer.update();oldgap=contact_gap(geo(ball)[0]);root.location+=right*dx;bpy.context.view_layer.update();newgap=contact_gap(geo(ball)[0]);root.location.z+=oldgap-newgap;bpy.context.view_layer.update()
# Seat the shaft's finite radius along its unchanged straight/coaxial axis.
shaft.data.splines[0].points[-1].co=(*(shaft.matrix_world.inverted()@Pnew),1);bpy.context.view_layer.update();sv,st=geo(shaft);tip=sv[np.linalg.norm(sv-np.array(Pnew),axis=1)<.008/AU]
def gaps(points):
 out=[]
 for q in points:
  p=Vector(q);hs=[t.ray_cast(p+Vector((0,0,1)),Vector((0,0,-1)),2)[0]for t in receivers];hs=[h for h in hs if h is not None]
  if hs:out.append(p.z-max(h.z for h in hs))
 return min(out)
lo,hi=-.03/AU,.03/AU
for _ in range(32):
 mid=(lo+hi)/2
 if gaps(tip-np.array(newaxis)*mid)>0:lo=mid
 else:hi=mid
extension=(lo+hi)/2;Pseat=Pnew-newaxis*extension;shaft.data.splines[0].points[-1].co=(*(shaft.matrix_world.inverted()@Pseat),1);bpy.context.view_layer.update();after=project_state();bc=ball.matrix_world.translation;clearances=[]
for name in props:
 tr=tree(s.objects[name]);clearances.append({'name':name,'clearance_to_Ball_sphere_mm':(tr.find_nearest(bc)[3]-.88)*AU*1000})
bodytree=tree(ball);shaft_samples=[]
for j in range(101):
 p=Cnew.lerp(Pseat,j/100);vec=p-O;hit=bodytree.ray_cast(O,vec.normalized(),vec.length-.0001)[0];shaft_samples.append({'pixel900':pix(p).tolist(),'Ball_occluded':hit is not None})
line=[shaft.matrix_world@p.co.to_3d()for p in shaft.data.splines[0].points];max_deviation=max((p-Cold).length for p in [])if False else max((p-Pseat).cross(newaxis).length for p in line);assert max_deviation<1e-5
report={'source':str(SRC),'source_sha256':SHA,'source_unchanged':H(SRC)==SHA,'no_render':True,'no_blend_save':True,'draft_relation':'Selected three-quarter canopy with straight foot right of Ball; modest10percent canopy size correction','canopy_uniform_scale':scale,'PVC_thickness_preserved_mm':.20,'shaft_diameter_preserved':True,'reference_anchor_estimates_native900':{'Ball_center_x':616,'crown':[707,143],'foot':[657,390]},'old_crown_AU':list(Cold),'old_foot_AU':list(Pold),'new_crown_AU':list(Cnew),'new_foot_AU':list(Pseat),'old_axis':list(oldaxis),'new_axis':list(newaxis),'rigid_rotation_degrees':math.degrees(Q.angle),'rigid_transform':[list(row)for row in X],'moved_umbrella_objects':props,'Ball_root_translation_AU':list(right*dx+Vector((0,0,oldgap-newgap))),'Ball_old_vertical_receiver_gap_mm':oldgap*AU*1000,'Ball_new_vertical_receiver_gap_mm':contact_gap(geo(ball)[0])*AU*1000,'shaft_contact_extension_mm':extension*AU*1000,'shaft_max_axis_deviation_AU':max_deviation,'minimum_prop_Ball_clearance_mm':min(r['clearance_to_Ball_sphere_mm']for r in clearances),'clearances':clearances,'shaft_samples':shaft_samples,'shaft_Ball_occluded_samples':sum(r['Ball_occluded']for r in shaft_samples),'before':{'Ball_center900':before['Ball_center900'],'shaft_points900':before['shaft_points900'],'canopy_bounds900':before['canopy_bounds900']},'after':{'Ball_center900':after['Ball_center900'],'shaft_points900':after['shaft_points900'],'canopy_bounds900':after['canopy_bounds900']},'non_rain_materials_camera_World_ground_unchanged':True,'roof_and_attached_water_uniformly_scaled_and_rigidly_transformed':True,'water_morphology_not_yet_corrected':True,'airborne_rain_not_reculled_for_draft':'Must rerun against selected corrected geometry before any rain render','grounding_visual_caveat':'Actual Ball ground gap preserved; existing detached-looking dark oval is not claimed fixed and remains a required actual-image review item'}
(D/'RIGHT-POSE-GEOMETRY-CHECK.json').write_text(json.dumps(report,indent=2));(D/'ACTUAL-PROJECTION-BEFORE.json').write_text(json.dumps(before));(D/'ACTUAL-PROJECTION-DRAFT.json').write_text(json.dumps(after));print('RIGHT_POSE_PROJECTED',json.dumps({k:v for k,v in report.items()if k not in ['clearances','shaft_samples','moved_umbrella_objects']}),flush=True)
