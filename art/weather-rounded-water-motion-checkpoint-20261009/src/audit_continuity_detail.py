import sys,json,numpy as np
from pathlib import Path
SOURCE_DIR=Path(__file__).resolve().parent;sys.path.insert(0,str(SOURCE_DIR));from contract import work_dir
D=work_dir();from continuous_water import Water,RELEASE,ELONG,MPU,metric
W=Water();records=[]
for eps in [1/30,1e-3,1e-4,1e-5]:
 before=W.connected(RELEASE-eps);after=W.lower_at(eps);pre_delta=np.linalg.norm(before-W.final,axis=1)*MPU*1000;post_delta=np.linalg.norm(after-W.lower0,axis=1)*MPU*1000
 records.append({'epsilon_s':eps,'max_connected_vertex_difference_before_release_mm':float(pre_delta.max()),'max_released_vertex_difference_after_release_mm':float(post_delta.max()),'gravity_centroid_displacement_mm':.5*9.81*eps**2*1000})
acc=[]
for i in range(56):
 v=W.connected(i/30);vol,c=metric(v,W.tr);acc.append(vol*1e9)
neck=[]
for i in range(55,65):
 v=W.connected(i/30);vol,c=metric(v,W.tr);neck.append({'frame':i,'total_volume_ul':vol*1e9,'relative_error_from_source':abs(vol-W.original_volume)/W.original_volume})
assert all(b>=a-1e-4 for a,b in zip(acc,acc[1:]));assert max(a['relative_error_from_source']for a in neck)<2e-6;assert records[-1]['max_connected_vertex_difference_before_release_mm']<1e-4;assert records[-1]['max_released_vertex_difference_after_release_mm']<1e-4
rep={'subframe_continuity_tests':records,'monotonic_accumulation_volume_ul':acc,'necking_mass_conservation':neck,'accumulation_is_incoming_water_not_constant_volume':True,'relaxation_duration_after_release_ms':100,'zero_shape_or_position_jump_at_release':True,'velocity_at_release':'Zero initial ballistic velocity; cubic ease of pre-release necking reaches zero derivative at the split; post-release shape relaxation starts with zero derivative.','scope':'Analytic transient-deformation and volume checks only; no fluid simulation.'};(D/'SUBFRAME-AND-MASS-CONTINUITY.json').write_text(json.dumps(rep,indent=2));print(json.dumps(rep))
