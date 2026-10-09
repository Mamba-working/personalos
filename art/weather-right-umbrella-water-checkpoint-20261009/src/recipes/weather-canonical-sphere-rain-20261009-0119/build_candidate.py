import bpy,bmesh,json,hashlib,math,sys,numpy as np
from pathlib import Path
from mathutils import Vector
D=Path(__file__).resolve().parent;R=D.parent;sys.path.insert(0,str(D));from invariant_tools import snap,hashes
SRC=R/'weather-rounded-water-rim-milestone-20261008-2354/rounded-water-visible-rim-milestone.blend';OUT=D/'canonical-sphere-rain-candidate.blend';EXPECTED='ea4f3c4833c7f9b1c4c18ac06a19721bf86e84bbc27f2426d64e31ed644c12e7';sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert sha(SRC)==EXPECTED and not OUT.exists()
records=json.loads((D/'FRESH-TRAJECTORY-RECORDS.json').read_text());audit=json.loads((D/'TRAJECTORY-AUDIT.json').read_text());assert audit['source_sha256']==EXPECTED and not any('unresolved' in r['collision_status']for r in records)
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();assert s.render.fps==24 and s.render.fps_base==1 and not s.camera.data.dof.use_dof;assert not s.camera.animation_data
before=snap(bpy);original={k:list(v)for k,v in before.items()};before_hashes=hashes(before);visible=set()
def walk(c,hidden=False):
 hidden=hidden or c.hide_render
 if not hidden:visible.update(o.name for o in c.objects if not o.hide_render)
 for child in c.children:walk(child,hidden)
walk(s.collection)
assert not any(s.objects[n].animation_data for n in visible),'Visible source animation would blur existing state'
coll=bpy.data.collections.new('Canonical sphere rain / 1 over 320 second proof');s.collection.children.link(coll)
mat=bpy.data.materials.new('Canonical sphere rain / clear water IOR1.333');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');glass=nodes.new('ShaderNodeBsdfGlass');glass.distribution='GGX';glass.inputs['Color'].default_value=(1,1,1,1);glass.inputs['Roughness'].default_value=0;glass.inputs['IOR'].default_value=1.333;mat.node_tree.links.new(glass.outputs['BSDF'],out.inputs['Surface'])
bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=4,radius=1);mesh=bpy.data.meshes.new('Canonical sphere rain / shared smooth unit sphere');bm.to_mesh(mesh);bm.free();mesh.materials.append(mat)
for p in mesh.polygons:p.use_smooth=True
mesh.update();T=1/320;FPS=24;FRAME=49;OPEN=FRAME-T*FPS/2;CLOSE=FRAME+T*FPS/2;INTERVALS=128;moving=[];cutoffs=[]
for r in records:
 if r['active_fraction']<=0:continue
 o=bpy.data.objects.new('Canonical sphere rain / drop %04d'%r['record_index'],mesh);coll.objects.link(o);rad=r['radius_AU'];o.scale=(rad,)*3;center=Vector(r['nominal_center_AU']);velocity=Vector(r['velocity_AU_s']);o.cycles.use_motion_blur=True;o.cycles.use_deform_motion=False;o.cycles.motion_steps=1
 for f in [48,50]:o.location=center+velocity*((f-FRAME)/FPS);o.keyframe_insert(data_path='location',frame=f)
 if r['active_fraction']<1:
  # Cycles4.3.2 motion_steps7 exports129 uniformly spaced transforms. End the
  # rendered radius at the last transform sample strictly before physical contact.
  # Linear collapse spans one fine sample interval,24.414microseconds. This is
  # shorter than one ordinary3-transform motion interval(1.5625milliseconds).
  stop_i=max(1,int(math.floor(r['active_fraction']*INTERVALS)));stop_frac=stop_i/INTERVALS;start_frac=(stop_i-1)/INTERVALS;assert stop_frac<r['active_fraction']
  start_frame=OPEN+T*FPS*start_frac;stop_frame=OPEN+T*FPS*stop_frac
  for axis in range(3):
   fc=o.animation_data.action.fcurves.new(data_path='scale',index=axis);fc.keyframe_points.add(4)
   for key,(f,rr) in zip(fc.keyframe_points,[(48,rad),(start_frame,rad),(stop_frame,0.),(50,0.)]):key.co=(f,rr);key.interpolation='LINEAR'
  o.cycles.motion_steps=7
  q={'record_index':r['record_index'],'contact_object':r['contact_object'],'physical_active_fraction':r['active_fraction'],'collapse_start_fraction':start_frac,'zero_radius_fraction':stop_frac,'collapse_duration_seconds':T/INTERVALS,'zero_radius_early_seconds':T*(r['active_fraction']-stop_frac),'renderer_transforms':129,'center_continues_linearly_after_radius_zero':True};cutoffs.append(q);r['render_cutoff']=q
 for fc in o.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 o['record_index']=r['record_index'];o['physical_radius_m']=r['radius_m'];o['metres_per_authoring_unit']=15/88;o['depth_band']=r['depth_band'];o['contact_status']=r['collision_status'];moving.append(o)
s.render.use_motion_blur=True;s.render.motion_blur_shutter=T*FPS;s.render.motion_blur_position='CENTER';s.cycles.rolling_shutter_type='NONE';curve=s.render.motion_blur_shutter_curve;curve.initialize()
for point in curve.curves[0].points:point.location[1]=1.;point.handle_type='VECTOR'
curve.update();shutter_values=[float(curve.evaluate(curve.curves[0],x/128))for x in range(129)];assert max(abs(x-1)for x in shutter_values)<1e-6
# Verify evaluated transforms at actual renderer sample times, including contact disappearances.
byid={r['record_index']:r for r in records};cutbyid={r['record_index']:r for r in cutoffs};max_pos=0.;max_scale=0.;min_contact_margin=1.
for j in range(129):
 fraction=j/128;f=OPEN+(CLOSE-OPEN)*fraction;floor=math.floor(f);s.frame_set(floor,subframe=f-floor);dep=bpy.context.evaluated_depsgraph_get();dep.update()
 for o in moving:
  r=byid[o['record_index']];e=o.evaluated_get(dep);expected=np.array(r['nominal_center_AU'])+np.array(r['velocity_AU_s'])*((f-FRAME)/FPS);max_pos=max(max_pos,float(np.linalg.norm(np.array(e.matrix_world.translation)-expected)));q=cutbyid.get(r['record_index']);ratio=1.
  if q:ratio=float(np.clip((q['zero_radius_fraction']-fraction)/(1/128),0,1))
  actual=np.array(e.matrix_world.to_scale());err=float(np.max(np.abs(actual-r['radius_AU']*ratio)))
  if err>max_scale:
   max_scale=err;worst={'index':r['record_index'],'fraction':fraction,'actual':actual.tolist(),'expected':r['radius_AU']*ratio,'cut':q,'curves':[[fc.data_path,fc.array_index,[list(k.co)for k in fc.keyframe_points]]for fc in o.animation_data.action.fcurves]}
  if q and fraction>=r['active_fraction']:assert actual.max()<1e-9,'Nonzero radius after contact'
s.frame_set(FRAME);bpy.context.view_layer.update();assert max_pos<2e-5,('position',max_pos);print('WORST_SCALE',worst,flush=True);assert max_scale<3e-5,('scale',max_scale)
after=snap(bpy,original);after_hashes=hashes(after)
if before_hashes!=after_hashes:
 (D/'INVARIANT-DIFFERENCE.json').write_text(json.dumps({'before':before_hashes,'after':after_hashes},indent=2));raise AssertionError('Protected source changed')
print('INVARIANTS_AND_EVALUATED_MOTION_PASSED',len(moving),max_pos,max_scale,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT),compress=True);assert sha(SRC)==EXPECTED
(D/'FRESH-TRAJECTORY-RECORDS.json').write_text(json.dumps(records,indent=2));manifest={'source':str(SRC),'source_sha256':EXPECTED,'source_unchanged':True,'candidate':str(OUT),'candidate_sha256':sha(OUT),'retained_master':False,'all_non_rain_invariants_passed':True,'original_datablock_names':original,'protected_hashes':before_hashes,'render_frame':FRAME,'fps':24,'shutter_seconds':T,'shutter_frames':T*FPS,'box_shutter_constant':True,'full_shutter_normalization':True,'near_mid_far_before_culling':audit['before_culling'],'near_mid_far_after_culling':audit['after_culling'],'shared_sphere_object_count':len(moving),'shared_sphere_vertices':len(mesh.vertices),'shared_sphere_triangles':len(mesh.polygons),'metres_per_authoring_unit':15/88,'physical_radii_m_min_max':[min(r['radius_m']for r in records),max(r['radius_m']for r in records)],'prescribed_terminal_velocity_no_gravity_added':True,'density_authored_not_calibrated_rain_rate':True,'source_dof_disabled':True,'precontact_radius_collapses':cutoffs,'maximum_evaluated_center_error_AU':max_pos,'maximum_evaluated_radius_error_AU':max_scale,'no_emission_or_artistic_radiance_boost':True,'no_screen_overlay':True,'old_hidden_rain_unchanged_and_hidden':True,'native_scene_transmission_and_occlusion':True,'technical_motion_sampling_sources':['https://raw.githubusercontent.com/blender/blender/v4.3.2/intern/cycles/blender/util.h','https://raw.githubusercontent.com/blender/blender/v4.3.2/intern/cycles/scene/object.h'],'scope':'Single physical-sphere Cycles motion-blur proof; no animation/runtime or fluid simulation acceptance'};(D/'BUILD-MANIFEST.json').write_text(json.dumps(manifest,indent=2));print('CANDIDATE_SAVED',str(OUT),manifest['candidate_sha256'],flush=True)
