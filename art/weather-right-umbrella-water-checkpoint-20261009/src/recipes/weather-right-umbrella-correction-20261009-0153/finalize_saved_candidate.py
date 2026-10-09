import bpy,sys,json,hashlib,copy,math,numpy as np
from pathlib import Path
D=Path(__file__).resolve().parent;sys.path.insert(0,str(D));from invariant_tools import snap,hashes
R=D.parent;SRC=R/'weather-canonical-sphere-rain-20261009-0119/canonical-sphere-rain-candidate.blend';OUT=D/'right-umbrella-fine-wet-hierarchy-lookdev.blend';SHA='be19d3dd793ac283da075631acc307a15ed808cf993ec610a46267553af6aec4';H=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert H(SRC)==SHA;candidate_hash=H(OUT)
pose=json.loads((D/'RIGHT-POSE-GEOMETRY-CHECK.json').read_text());water=json.loads((D/'CONSOLIDATED-WATER-REPORT.json').read_text());records=json.loads((D/'FRESH-TRAJECTORY-RECORDS.json').read_text());audit=json.loads((D/'TRAJECTORY-AUDIT.json').read_text());diffs=json.loads((D/'REOPEN-DIFFERENCES.json').read_text());assert all(any('/'+key+'/'in r[0]for key in ['matrix_world','matrix_local','dimensions'])for r in diffs),'Unexpected saved-file difference'
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();before=snap(bpy);original={k:list(v)for k,v in before.items()};allowed_objects=set(pose['moved_umbrella_objects'])|{'BallStage / runtime-owned global placement'}|{o.name for o in s.objects['BallStage / runtime-owned global placement'].children_recursive};allowed_data={before['objects'][n]['data']for n in pose['moved_umbrella_objects']};old_images={r['old_image']for r in water['water_images']}
bpy.ops.wm.open_mainfile(filepath=str(OUT));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();all_after=snap(bpy);retired=[]
for category in ['meshes','images']:
 for name in list(original[category]):
  if name not in all_after[category]:
   assert name in(allowed_data if category=='meshes'else old_images),(category,name);original[category].remove(name);before[category].pop(name);retired.append([category,name])
after=snap(bpy,original);aa=copy.deepcopy(after);bb=copy.deepcopy(before)
for name in allowed_objects:aa['objects'].pop(name,None);bb['objects'].pop(name,None)
for group in ['meshes','curves']:
 for name in allowed_data:aa[group].pop(name,None);bb[group].pop(name,None)
outer='Closed PVC 020mm / outer clear dielectric with retained wet rel'
for state in [aa,bb]:
 for nn in ['Verified water-drop height','Verified water-drop opacity']:state['materials'][outer]['nodes'][nn].pop('image',None)
 state['collections']['Canonical sphere rain / 1 over 320 second proof']['properties']['hide_render']=True
assert aa==bb,'Saved candidate changed protected source state'
drops=[o for o in s.objects if o.name.startswith('Corrected right rain / drop ')];byid={r['record_index']:r for r in records};maxpos=0.;maxscale=0.;post=0
for j in range(129):
 u=j/128;f=49+(u-.5)*.075;ff=math.floor(f);s.frame_set(ff,subframe=f-ff);dep=bpy.context.evaluated_depsgraph_get();dep.update()
 for o in drops:
  r=byid[o['record_index']];q=r.get('render_cutoff');e=o.evaluated_get(dep);expected=np.array(r['nominal_center_AU'])+np.array(r['velocity_AU_s'])*((f-49)/24);maxpos=max(maxpos,float(np.linalg.norm(np.array(e.matrix_world.translation)-expected)));ratio=float(np.clip((q['zero_radius_fraction']-u)*128,0,1))if q else 1.;sc=np.array(e.matrix_world.to_scale());maxscale=max(maxscale,float(np.max(np.abs(sc-r['radius_AU']*ratio))))
  if q and u>=r['active_fraction']:assert sc.max()<1e-9;post+=1
s.frame_set(49);bpy.context.view_layer.update();assert maxpos<2e-5 and maxscale<3e-5 and not s.camera.data.dof.use_dof;assert hashes(snap(bpy,original))==hashes(after);assert H(SRC)==SHA and H(OUT)==candidate_hash
report={'source':str(SRC),'source_sha256':SHA,'candidate':str(OUT),'candidate_sha256':candidate_hash,'selected_pose':pose,'water_report_file':'CONSOLIDATED-WATER-REPORT.json','original_datablock_names':original,'saved_state_hashes':hashes(after),'protected_non_target_state_exact':True,'saved_reopened_verified':True,'retired_unused_water_datablocks':retired,'hidden_retired_water_cache_fields_excluded':['matrix_world','matrix_local','dimensions'],'all_serialized_hidden_object_basis_and_visibility_retained':True,'rain_authored_before_culling':audit['before_culling'],'rain_fresh_status_counts':audit['status_counts'],'rain_rendered_sphere_count':len(drops),'rain_too_short_prefix_withheld':[r['record_index']for r in records if r.get('render_withheld')],'precontact_collapses':[r['render_cutoff']for r in records if 'render_cutoff'in r],'maximum_motion_position_error_AU':maxpos,'maximum_motion_scale_error_AU':maxscale,'post_contact_zero_radius_checks':post,'DOF_disabled':True,'stronger_rain_proposal_not_applied':True,'not_rendered':True,'not_retained_or_accepted':True};(D/'BUILD-MANIFEST.json').write_text(json.dumps(report,indent=2));print('SAVED_RIGHT_UMBRELLA_WATER_VERIFIED',candidate_hash,len(drops),water['new_authored_counts'],flush=True)
