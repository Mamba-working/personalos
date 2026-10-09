"""Read-only saved-candidate validation; zero new renders."""
import bpy,json,hashlib,math,sys,numpy as np
from pathlib import Path
D=Path(__file__).resolve().parent;sys.path.insert(0,str(D));from invariant_tools import snap,hashes
m=json.loads((D/'BUILD-MANIFEST.json').read_text());records=json.loads((D/'FRESH-TRAJECTORY-RECORDS.json').read_text());byid={r['record_index']:r for r in records};sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert sha(m['candidate'])==m['candidate_sha256'];bpy.ops.wm.open_mainfile(filepath=m['candidate']);s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();assert hashes(snap(bpy,m['original_datablock_names']))==m['protected_hashes'];drops=[o for o in s.objects if o.name.startswith('Canonical sphere rain / drop ')];assert len(drops)==489 and len({o.data.name for o in drops})==1
maxpos=0.;maxscale=0.;postcontact_count=0;close_key_counts={}
for o in drops:
 r=byid[o['record_index']]
 if 'render_cutoff'in r:
  curves=[fc for fc in o.animation_data.action.fcurves if fc.data_path=='scale'];assert len(curves)==3 and all(len(fc.keyframe_points)==4 for fc in curves);close_key_counts[str(r['record_index'])]=[len(fc.keyframe_points)for fc in curves]
for j in range(129):
 u=j/128;f=49+(u-.5)*.075;floor=math.floor(f);s.frame_set(floor,subframe=f-floor);dep=bpy.context.evaluated_depsgraph_get();dep.update()
 for o in drops:
  r=byid[o['record_index']];q=r.get('render_cutoff');e=o.evaluated_get(dep);p=np.array(e.matrix_world.translation);expected=np.array(r['nominal_center_AU'])+np.array(r['velocity_AU_s'])*((f-49)/24);maxpos=max(maxpos,float(np.linalg.norm(p-expected)));ratio=float(np.clip((q['zero_radius_fraction']-u)*128,0,1))if q else 1.;sc=np.array(e.matrix_world.to_scale());maxscale=max(maxscale,float(np.max(np.abs(sc-r['radius_AU']*ratio))))
  if q and u>=r['active_fraction']:assert sc.max()<1e-9;postcontact_count+=1
assert maxpos<2e-5 and maxscale<3e-5
r={'saved_candidate_sha256':m['candidate_sha256'],'original_source_sha256':m['source_sha256'],'source_unchanged':sha(m['source'])==m['source_sha256'],'candidate_unchanged':sha(m['candidate'])==m['candidate_sha256'],'all_original_invariants_reopened_equal':True,'saved_sphere_objects':len(drops),'shared_mesh_count':1,'renderer_sample_times_checked':129,'maximum_position_error_AU':maxpos,'maximum_radius_error_AU':maxscale,'post_contact_zero_radius_checks':postcontact_count,'saved_close_spaced_keyframe_counts':close_key_counts,'rendered_new_frames':0};(D/'SAVED-MOTION-VERIFIED.json').write_text(json.dumps(r,indent=2));print('SAVED_MOTION_VERIFIED',json.dumps(r),flush=True)
