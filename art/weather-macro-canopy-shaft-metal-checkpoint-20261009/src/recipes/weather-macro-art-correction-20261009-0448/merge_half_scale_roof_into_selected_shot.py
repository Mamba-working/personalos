"""Replace only audited roof/water meshes in the selected visible-shaft/card scene."""
import bpy,numpy as np,hashlib,json
from pathlib import Path
D=Path(__file__).parent;BASE=D/'PersonalOS-visible-shaft-and-reflection-card-candidate.blend';BSHA='da2bf4fac431c9b077aa06dd4ce3d3ed94d5a2630060f365634b8312f53afd9a';STAGE=D/'PersonalOS-half-scale-roof-stage.blend';SSHA=json.loads((D/'HALF-SCALE-SCENE-GEOMETRY-AUDIT.json').read_text())['master_sha256'];assert hashlib.sha256(BASE.read_bytes()).hexdigest()==BSHA;assert hashlib.sha256(STAGE.read_bytes()).hexdigest()==SSHA
bpy.ops.wm.open_mainfile(filepath=str(BASE));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();names=['Dry clay / eight tensioned gores','Readable wetness / microbeads','Readable wetness / small_beads','Readable wetness / coalesced_beads','Wet PVC / native900 restrained resolved wetness'];unchanged={o.name:(o.data.as_pointer() if o.data else None,np.array(o.matrix_world).copy()) for o in s.objects if o.name not in names};scene_names=set(o.name for o in s.objects);original_object_pointers={o.as_pointer() for o in bpy.data.objects}
with bpy.data.libraries.load(str(STAGE),link=False) as (src,dst):dst.objects=list(names)
# Loaded objects need dependency-graph evaluation with their source parents.
# Link only the temporary library objects in a render-hidden collection.
tmp=bpy.data.collections.new('Temporary half-scale mesh transfer');s.collection.children.link(tmp);tmp.hide_render=True
loaded=[o for o in bpy.data.objects if o.as_pointer() not in original_object_pointers]
for o in loaded:tmp.objects.link(o)
s.frame_set(49);bpy.context.view_layer.update()
changed=[]
for expected,src in zip(names,dst.objects):
 target=s.objects[expected];assert np.max(np.abs(np.array(src.matrix_world)-np.array(target.matrix_world)))<1e-8,(expected,'matrix mismatch',np.array(src.matrix_world).tolist(),np.array(target.matrix_world).tolist());old=target.data;target.data=src.data;changed.append({'object':expected,'vertices':len(src.data.vertices),'matrix_unchanged':True})
 if old.users==0:bpy.data.meshes.remove(old)
for o in loaded:bpy.data.objects.remove(o,do_unlink=True)
bpy.data.collections.remove(tmp)
bpy.context.view_layer.update()
assert set(o.name for o in s.objects)==scene_names
for name,(ptr,matrix) in unchanged.items():
 o=s.objects[name];assert (o.data.as_pointer() if o.data else None)==ptr,name;assert np.array_equal(np.array(o.matrix_world),matrix),name
w=next(n for n in s.world.node_tree.nodes if n.type=='TEX_IMAGE');a=np.empty(len(w.image.pixels),np.float32);w.image.pixels.foreach_get(a);wh=hashlib.sha256(a.tobytes()).hexdigest();assert wh=='654245cc300350617e61e8700ddad40d496b4eb5b882b9538aa62b68ac7e2484';card=s.objects['Studio / finite lower daylight bounce reflection card'];assert not card.visible_camera and card.visible_glossy and card.visible_diffuse and card.visible_transmission
s['half_scale_refinement']='Only continuous membrane/water meshes replaced. All field wavelengths and displacement coefficient halved; fixed seed and support. Shaft, Ball, card, World and camera unchanged.'
OUT=D/'PersonalOS-half-scale-wet-reflection-candidate.blend';bpy.ops.wm.save_as_mainfile(filepath=str(OUT),compress=True);report={'selected_shaft_card_base_sha256':BSHA,'audited_roof_stage_sha256':SSHA,'candidate_sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'changed_objects':changed,'all_other_scene_object_data_and_matrices_unchanged':True,'scene_object_membership_unchanged':True,'World_pixel_sha256':wh,'card_unchanged':True,'shaft_material_status':'Original pale material still present; awaiting the one metallic-finish revision before next crop','audit_inherited':'Audited stage mesh data and identical transforms preserve the paired-shell and water-contact checks. Ball/shaft pose remains selected base.'};(D/'HALF-SCALE-SELECTED-SHOT-MERGE.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
