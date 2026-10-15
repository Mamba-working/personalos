import importlib.util,hashlib,json
from pathlib import Path
R=Path(__file__).resolve().parent.parent
p=R/'weather-ball-ceramic-candidate-20261008-0546/patch_ceramic.py';sp=importlib.util.spec_from_file_location('snapshot_helpers',p);h=importlib.util.module_from_spec(sp);sp.loader.exec_module(h)
def snap(bpy,original=None):
 q=h.frozen_scene_snapshot(bpy)
 q['curves']={c.name:{'properties':h.rna_values(c),'splines':[[h.val(p.co)for p in s.points]for s in c.splines]}for c in bpy.data.curves}
 # These are the only pre-save scene settings authorized to change.
 for row in q['scenes'].values():
  for k in ['use_motion_blur','motion_blur_shutter','motion_blur_position']:row['render'].pop(k,None)
  for k in ['rolling_shutter_type']:row['cycles'].pop(k,None)
 if original:
  for category in q:q[category]={k:v for k,v in q[category].items()if k in original[category]}
 return q
def hashes(q):return {k:hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()for k,v in q.items()}
