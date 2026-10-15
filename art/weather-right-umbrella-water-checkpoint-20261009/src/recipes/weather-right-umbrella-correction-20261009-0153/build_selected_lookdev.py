"""One source-copy build: selected right-side pose, consolidated water, fresh rain contacts."""
import bpy,sys,runpy,json,hashlib,copy,math,bmesh,numpy as np,gc
from pathlib import Path
from mathutils import Vector,Matrix
D=Path(__file__).resolve().parent;R=D.parent;sys.path.insert(0,str(D));sys.path.insert(0,str(R/'weather-canonical-sphere-rain-20261009-0119'));from invariant_tools import snap,hashes
SRC=R/'weather-canonical-sphere-rain-20261009-0119/canonical-sphere-rain-candidate.blend';OUT=D/'right-umbrella-fine-wet-hierarchy-lookdev.blend';SHA='be19d3dd793ac283da075631acc307a15ed808cf993ec610a46267553af6aec4';H=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert H(SRC)==SHA;bpy.ops.wm.open_mainfile(filepath=str(SRC));bpy.context.scene.frame_set(49);bpy.context.view_layer.update();before=snap(bpy);original={k:list(v)for k,v in before.items()}
runpy.run_path(str(D/'project_right_pose.py'),run_name='__pose__');s=bpy.context.scene;pose=json.loads((D/'RIGHT-POSE-GEOMETRY-CHECK.json').read_text());assert pose['minimum_prop_Ball_clearance_mm']>0 and pose['shaft_max_axis_deviation_AU']<1e-5
import water_patch
print('APPLY_CONSOLIDATED_WATER_START',flush=True);water_report=water_patch.apply(bpy,Matrix(pose['rigid_transform']));(D/'CONSOLIDATED-WATER-REPORT.json').write_text(json.dumps(water_report,indent=2,default=str));print('CONSOLIDATED_WATER_APPLIED',flush=True)
# Original radii, velocities and authored density stay. A new geometry arrangement
# requires fresh contacts; no stronger-rain or DOF proposal is applied.
old_rain_collection=bpy.data.collections['Canonical sphere rain / 1 over 320 second proof'];old_rain_collection.hide_render=True
# Reuse the established exact sweep implementation in the current modified scene.
text=(R/'weather-canonical-sphere-rain-20261009-0119/preflight.py').read_text();text=text.replace("SRC=R/'weather-rounded-water-rim-milestone-20261008-2354/rounded-water-visible-rim-milestone.blend';EXPECTED='ea4f3c4833c7f9b1c4c18ac06a19721bf86e84bbc27f2426d64e31ed644c12e7'", "SRC=R/'weather-canonical-sphere-rain-20261009-0119/canonical-sphere-rain-candidate.blend';EXPECTED='be19d3dd793ac283da075631acc307a15ed808cf993ec610a46267553af6aec4'");text=text.replace("bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;", "s=bpy.context.scene;")
exec(compile(text,str(D/'recompute_current_rain.py'),'exec'),{'__file__':str(D/'recompute_current_rain.py'),'__name__':'__rain_preflight__'});gc.collect()
records=json.loads((D/'FRESH-TRAJECTORY-RECORDS.json').read_text());audit=json.loads((D/'TRAJECTORY-AUDIT.json').read_text());assert not any('unresolved'in r['collision_status']for r in records)
coll=bpy.data.collections.new('Corrected right scene / recut original rain');s.collection.children.link(coll);mesh=bpy.data.meshes['Canonical sphere rain / shared smooth unit sphere'];T=1/320;FRAME=49;FPS=24;OPEN=FRAME-T*FPS/2;CLOSE=FRAME+T*FPS/2;moving=[];cutoffs=[];too_short=[]
for r in records:
 if r['active_fraction']<=0:continue
 if r['active_fraction']<1/128:
  r['render_withheld']='Positive prefix shorter than one available transform interval; no post-contact sphere allowed';too_short.append(r['record_index']);continue
 o=bpy.data.objects.new('Corrected right rain / drop %04d'%r['record_index'],mesh);coll.objects.link(o);rad=r['radius_AU'];o.scale=(rad,)*3;center=Vector(r['nominal_center_AU']);velocity=Vector(r['velocity_AU_s']);o.cycles.use_motion_blur=True;o.cycles.use_deform_motion=False;o.cycles.motion_steps=1
 for f in [48,50]:o.location=center+velocity*((f-FRAME)/FPS);o.keyframe_insert(data_path='location',frame=f)
 if r['active_fraction']<1:
  stop_i=int(math.floor(r['active_fraction']*128));stop_frac=stop_i/128;start_frac=(stop_i-1)/128;assert stop_frac<r['active_fraction'];start_frame=OPEN+T*FPS*start_frac;stop_frame=OPEN+T*FPS*stop_frac
  for axis in range(3):
   fc=o.animation_data.action.fcurves.new(data_path='scale',index=axis);fc.keyframe_points.add(4)
   for key,(f,rr)in zip(fc.keyframe_points,[(48,rad),(start_frame,rad),(stop_frame,0.),(50,0.)]):key.co=(f,rr);key.interpolation='LINEAR'
  o.cycles.motion_steps=7;q={'record_index':r['record_index'],'contact_object':r['contact_object'],'physical_active_fraction':r['active_fraction'],'collapse_start_fraction':start_frac,'zero_radius_fraction':stop_frac,'collapse_duration_seconds':T/128,'zero_radius_early_seconds':T*(r['active_fraction']-stop_frac)};cutoffs.append(q);r['render_cutoff']=q
 for fc in o.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 o['record_index']=r['record_index'];o['physical_radius_m']=r['radius_m'];moving.append(o)
byid={r['record_index']:r for r in records};maxpos=0.;maxscale=0.
for j in range(129):
 u=j/128;f=OPEN+(CLOSE-OPEN)*u;ff=math.floor(f);s.frame_set(ff,subframe=f-ff);dep=bpy.context.evaluated_depsgraph_get();dep.update()
 for o in moving:
  r=byid[o['record_index']];q=r.get('render_cutoff');e=o.evaluated_get(dep);expected=np.array(r['nominal_center_AU'])+np.array(r['velocity_AU_s'])*((f-49)/24);maxpos=max(maxpos,float(np.linalg.norm(np.array(e.matrix_world.translation)-expected)));ratio=float(np.clip((q['zero_radius_fraction']-u)*128,0,1))if q else 1.;sc=np.array(e.matrix_world.to_scale());maxscale=max(maxscale,float(np.max(np.abs(sc-r['radius_AU']*ratio))))
  if q and u>=r['active_fraction']:assert sc.max()<1e-9
s.frame_set(49);bpy.context.view_layer.update();assert maxpos<2e-5 and maxscale<3e-5 and not s.camera.data.dof.use_dof
# Protect every other source object/material/scene. Material exemption is restricted
# to image bindings on the two pre-existing outer-water image nodes.
after=snap(bpy,original);aa=copy.deepcopy(after);bb=copy.deepcopy(before);allowed_objects=set(pose['moved_umbrella_objects'])|{'BallStage / runtime-owned global placement'}|{o.name for o in s.objects['BallStage / runtime-owned global placement'].children_recursive}
for name in allowed_objects:
 aa['objects'].pop(name,None);bb['objects'].pop(name,None)
# Allowed umbrella mesh/curve geometry changes; Ball and eye meshes stay protected.
allowed_data=set()
for name in pose['moved_umbrella_objects']:
 rec=before['objects'].get(name)
 if rec:allowed_data.add(rec.get('data'))
for group in ['meshes','curves']:
 for name in allowed_data:aa[group].pop(name,None);bb[group].pop(name,None)
# Current fine objects can be replaced, but all unrelated datablocks must persist.
outer='Closed PVC 020mm / outer clear dielectric with retained wet rel'
for state in [aa,bb]:
 for nn in ['Verified water-drop height','Verified water-drop opacity']:state['materials'][outer]['nodes'][nn].pop('image',None)
 state['collections']['Canonical sphere rain / 1 over 320 second proof']['properties']['hide_render']=True
# Imported fine geometry can alter old mesh users only; protected mesh content hashes above remain exact.
if aa!=bb:
 differing=[k for k in aa if aa[k]!=bb[k]];(D/'PROTECTED-DIFFERENCE.json').write_text(json.dumps({'categories':differing,'before':hashes(bb),'after':hashes(aa)},indent=2));raise AssertionError('Unexpected protected changes: '+str(differing))
(D/'FRESH-TRAJECTORY-RECORDS.json').write_text(json.dumps(records,indent=2))
# Blender drops newly unused replaced water meshes/images when reopening. These
# are declared water-only retirements, not protected content or pose drift.
retired=[]
for category,data in [('meshes',bpy.data.meshes),('images',bpy.data.images)]:
 for name in list(original[category]):
  block=data.get(name)
  if block is not None and block.users==0 and not block.use_fake_user:
   if category=='meshes':assert name in allowed_data
   else:assert name in [r['old_image']for r in water_report['water_images']]
   original[category].remove(name);retired.append([category,name])
after=snap(bpy,original);state_hashes=hashes(after)
if not OUT.exists():bpy.ops.wm.save_as_mainfile(filepath=str(OUT),compress=True)
sha=H(OUT);bpy.ops.wm.open_mainfile(filepath=str(OUT));bpy.context.scene.frame_set(49);bpy.context.view_layer.update();reopened=snap(bpy,original)
if hashes(reopened)!=state_hashes:
 diffs=[]
 def diff(a,b,path=''):
  if type(a)!=type(b):diffs.append([path,str(a)[:160],str(b)[:160]]);return
  if isinstance(a,dict):
   for k in sorted(set(a)|set(b)):
    if k not in a or k not in b:diffs.append([path+'/'+k,'missing'if k not in a else'present','missing'if k not in b else'present'])
    else:diff(a[k],b[k],path+'/'+k)
  elif isinstance(a,(list,tuple)):
   if len(a)!=len(b):diffs.append([path,'length',len(a),len(b)])
   else:
    for i,(x,y)in enumerate(zip(a,b)):diff(x,y,path+'/'+str(i))
  elif a!=b:diffs.append([path,a,b])
 diff(after,reopened);(D/'REOPEN-DIFFERENCES.json').write_text(json.dumps(diffs,indent=2));print('REOPEN_DIFFERENCES',diffs[:20],flush=True);raise AssertionError('Saved candidate differs from expected')
assert H(SRC)==SHA
report={'source':str(SRC),'source_sha256':SHA,'candidate':str(OUT),'candidate_sha256':sha,'selected_pose':pose,'water_report_file':'CONSOLIDATED-WATER-REPORT.json','original_datablock_names':original,'saved_state_hashes':state_hashes,'declared_unused_water_datablocks_dropped_on_save':retired,'protected_non_target_state_exact':True,'saved_reopened_exact':True,'rain_authored_before_culling':audit['before_culling'],'rain_fresh_status_counts':audit['status_counts'],'rain_rendered_sphere_count':len(moving),'rain_too_short_prefix_withheld':too_short,'precontact_collapses':cutoffs,'maximum_motion_position_error_AU':maxpos,'maximum_motion_scale_error_AU':maxscale,'DOF_disabled':True,'stronger_rain_proposal_not_applied':True,'not_rendered':True,'not_retained_or_accepted':True};(D/'BUILD-MANIFEST.json').write_text(json.dumps(report,indent=2,default=str));print('RIGHT_UMBRELLA_WATER_CANDIDATE_SAVED',sha,len(moving),flush=True)
