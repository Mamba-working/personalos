import bpy,numpy as np,json,hashlib,sys,copy,gc,math
from pathlib import Path
from mathutils import Vector
D=Path(__file__).resolve().parent;R=D.parent;P=R/'weather-right-umbrella-correction-20261009-0153';sys.path.insert(0,str(P));sys.path.insert(0,str(D));from invariant_tools import snap,hashes
SRC=P/'right-umbrella-fine-wet-hierarchy-lookdev.blend';SHA='7666a65cf86d266082a7bfaca0e13867236976b632bf0bd05061087a49c1650e';OUT=D/'coordinated-wet-readability-crop-candidate.blend';H=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert H(SRC)==SHA and not OUT.exists();bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();before=snap(bpy);original={k:list(v)for k,v in before.items()}
# Retain all old image/mesh bytes inside this copy for a clean exact reopen guard.
for name in ['Readable wetness / microbeads','Readable wetness / small_beads','Readable wetness / coalesced_beads']:s.objects[name].data.use_fake_user=True
outer=bpy.data.materials['Closed PVC 020mm / outer clear dielectric with retained wet rel'];old_water_images=[]
for name in ['Verified water-drop height','Verified water-drop opacity']:
 im=outer.node_tree.nodes[name].image;im.use_fake_user=True;old_water_images.append(im.name)
world_tex=next(n for n in s.world.node_tree.nodes if n.type=='TEX_IMAGE');world_tex.image.use_fake_user=True;worldname=s.world.name
import wet_readability_patch
water=wet_readability_patch.apply(bpy,report_path=D/'WET-READABILITY-PATCH-REPORT.json');print('WATER_PATCH_READY',flush=True)
# Install the sole shared all-ray World revision without altering the plate.
field=np.load(D/'coordinated-shared-opening.npy');h,w=field.shape[:2];a=np.ones((h,w,4),np.float32);a[:,:,:3]=field;im=bpy.data.images.new('Shared lateral warm core and halo / wet read proof',w,h,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(a.ravel());im.update();fmt=s.render.image_settings;oldfmt=(fmt.file_format,fmt.color_mode,fmt.color_depth);fmt.file_format='OPEN_EXR';fmt.color_mode='RGBA';fmt.color_depth='32';exr=D/'coordinated-shared-opening.exr';im.save_render(str(exr),scene=s);fmt.file_format,fmt.color_mode,fmt.color_depth=oldfmt;bpy.data.images.remove(im);im=bpy.data.images.load(str(exr));im.colorspace_settings.name='Linear Rec.709';b=np.empty(w*h*4,np.float32);im.pixels.foreach_get(b);assert np.array_equal(b.reshape(h,w,4)[:,:,:3],field);im.pack();world_tex.image=im;del a,b,field;gc.collect()
# Fresh rain lifetimes remain bounded by the changed visible water geometry.
for name in ['Canonical sphere rain / 1 over 320 second proof','Corrected right scene / recut original rain']:
 if name in bpy.data.collections:bpy.data.collections[name].hide_render=True
text=(R/'weather-canonical-sphere-rain-20261009-0119/preflight.py').read_text();text=text.replace("SRC=R/'weather-rounded-water-rim-milestone-20261008-2354/rounded-water-visible-rim-milestone.blend';EXPECTED='ea4f3c4833c7f9b1c4c18ac06a19721bf86e84bbc27f2426d64e31ed644c12e7'", "SRC=R/'weather-right-umbrella-correction-20261009-0153/right-umbrella-fine-wet-hierarchy-lookdev.blend';EXPECTED='7666a65cf86d266082a7bfaca0e13867236976b632bf0bd05061087a49c1650e'");text=text.replace("bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;", "s=bpy.context.scene;");exec(compile(text,str(D/'recompute_rain.py'),'exec'),{'__file__':str(D/'recompute_rain.py'),'__name__':'__rain__'});gc.collect()
# Reuse the already-tested129-sample key construction, without rebuilding pose.
code=(P/'build_selected_lookdev.py').read_text();start=code.index("records=json.loads((D/'FRESH-TRAJECTORY-RECORDS.json')");end=code.index('# Protect every other source',start);code=code[start:end];code=code.replace("'Corrected right scene / recut original rain'", "'Wet readability / recut original rain'").replace("'Corrected right rain / drop %04d'", "'Wet readability rain / drop %04d'");exec(compile(code,str(D/'build_recut_rain.py'),'exec'),globals());(D/'FRESH-TRAJECTORY-RECORDS.json').write_text(json.dumps(records,indent=2));s.frame_set(49);bpy.context.view_layer.update()
after=snap(bpy,original);aa=copy.deepcopy(after);bb=copy.deepcopy(before)
# Exactly the three fine geometry replacements and prior only-water visibility.
changed_names=['Readable wetness / microbeads','Readable wetness / small_beads','Readable wetness / coalesced_beads']+water['retired_previous_visible_water_objects']
for name in changed_names:
 aa['objects'].pop(name,None);bb['objects'].pop(name,None)
# Current old fine mesh bytes are still retained exactly; new copies contain changes.
for state in [aa,bb]:
 for name in ['Verified water-drop height','Verified water-drop opacity']:state['materials'][outer.name]['nodes'][name].pop('image',None)
 state['worlds'][worldname]['nodes'][world_tex.name].pop('image',None)
 state['collections']['Corrected right scene / recut original rain']['properties']['hide_render']=True
assert aa==bb,'Unrelated source state changed';expected=hashes(after)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT),compress=True);candidate_sha=H(OUT);bpy.ops.wm.open_mainfile(filepath=str(OUT));bpy.context.scene.frame_set(49);bpy.context.view_layer.update();actual=hashes(snap(bpy,original));(D/'SAVE-REOPEN-HASHES.json').write_text(json.dumps({'expected':expected,'actual':actual},indent=2));assert actual==expected;assert H(SRC)==SHA
man={'source':str(SRC),'source_sha256':SHA,'candidate':str(OUT),'candidate_sha256':candidate_sha,'original_datablock_names':original,'saved_state_hashes':expected,'protected_state_and_reopen_passed':True,'camera_pose_Ball_PVC_thickness_fold_and_roughness_unchanged':True,'shared_World_only_change':'One texture binding; lateral core+halo, same integrated warm energy, no object/ray-specific branch','water_only_shader_changes':'Two existing water image bindings; localized micro-normal relief/support','water_report':'WET-READABILITY-PATCH-REPORT.json','World_report':'SHARED-OPENING-CHANGE.json','rendered_rain_spheres':len(moving),'rain_status_counts':audit['status_counts'],'no_DOF_or_stronger_airborne_density':True,'authorized_render':'One native900 canopy crop first; no full frame until visibly improved and parent reviewed','crop_top_origin':[475,100,835,395],'samples':512,'not_rendered':True};(D/'BUILD-MANIFEST.json').write_text(json.dumps(man,indent=2));print('COORDINATED_CROP_CANDIDATE_SAVED',candidate_sha,flush=True)
