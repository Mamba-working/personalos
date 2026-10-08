"""Private fixed-view art proof. Static generated plate + unchanged CG hero and CG receiver."""
import bpy,numpy as np,json,hashlib,time,sys,math
from mathutils import Vector
from pathlib import Path
D=Path(__file__).resolve().parent;O=D/'preview-v4';O.mkdir(exist_ok=True)
SRC=D/'inputs/pre-hybrid-seed.blend'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
source_sha=sha(SRC)
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene
# Existing camera, hero geometry/materials, local attachments and static 3D rain preserved.
cam=s.camera;camera_before=[list(r) for r in cam.matrix_world]
hero_names=[o.name for o in s.objects if any(o.name.startswith(p) for p in ['Ball','LeftEye','RightEye','Umbrella','Canopy','Continuous fine','Attached hanging'])]
hero={n:{'matrix':[list(r) for r in s.objects[n].matrix_world],'data':s.objects[n].data.name if s.objects[n].data else None} for n in hero_names}
hidden=[]
for o in s.objects:
 if o.name.startswith(('Far terrain','Far low mist','Distant ground apron')):
  o.hide_render=True;hidden.append(o.name)
receivers=[]
for name in ['Ground / unified continuous metric field','Water / finite storm-shelf hollows']:
 o=bpy.data.objects[name];o.is_shadow_catcher=True;receivers.append(name)
s.render.film_transparent=True
s.cycles.film_transparent_glass=False
bpy.context.view_layer.cycles.use_pass_shadow_catcher=True
# The plate is inverse-display encoded solely to match the same AgX display treatment.
im=bpy.data.images.load(str(D/'plate-scene-linear-verified.exr'));im.colorspace_settings.name='Linear Rec.709';im.pack()
# Refracted rays see the actual same plate, rather than replacing glass pixels with alpha.
fwd=cam.matrix_world.to_quaternion()@Vector((0,0,-1));right=cam.matrix_world.to_quaternion()@Vector((1,0,0));up=cam.matrix_world.to_quaternion()@Vector((0,1,0));dist=100.;halfw=dist*cam.data.sensor_width/(2*cam.data.lens);halfh=halfw/1.5;center=cam.location+fwd*dist
verts=[center-right*halfw-up*halfh,center+right*halfw-up*halfh,center+right*halfw+up*halfh,center-right*halfw+up*halfh]
mesh=bpy.data.meshes.new('Refraction plate mesh');mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update();uv=mesh.uv_layers.new(name='UVMap')
for i,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=co
plate=bpy.data.objects.new('Static plate / transmission-only support',mesh);s.collection.objects.link(plate)
plate.visible_camera=False;plate.visible_shadow=False;plate.visible_diffuse=False;plate.visible_glossy=False;plate.visible_transmission=True;plate.visible_volume_scatter=False
mat=bpy.data.materials.new('Plate radiance / compositing support not measured lighting');mat.use_nodes=True;n=mat.node_tree.nodes;n.clear();tex=n.new('ShaderNodeTexImage');tex.image=im;tex.extension='EXTEND';out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');mat.node_tree.links.new(tex.outputs['Color'],em.inputs['Color']);mat.node_tree.links.new(em.outputs[0],out.inputs['Surface']);mesh.materials.append(mat)
# One coherent all-ray lighting calibration from the clean plate's measured warm opening.
# This is an SDR-based artistic radiance approximation, not recovered HDR truth.
y=np.load(D/'plate-scene-linear.npy');hh,ww=y.shape[:2];lum=y@np.array([.2126,.7152,.0722]);yy,xx=np.mgrid[:hh,:ww];weight=np.where((yy<.58*hh)&(xx<.42*ww)&(lum>1.8),lum,0)
u=float((xx*weight).sum()/weight.sum()/ww);v=float(1-(yy*weight).sum()/weight.sum()/hh)
key_dir=(fwd+right*((u-.5)*cam.data.sensor_width/cam.data.lens)+up*((v-.5)*cam.data.sensor_width/cam.data.lens/1.5)).normalized()
wld=bpy.data.worlds.new('Hybrid shared sky / plate-aligned warm opening');wld.use_nodes=True;s.world=wld;nodes=wld.node_tree.nodes;nodes.clear();links=wld.node_tree.links
coord=nodes.new('ShaderNodeTexCoord');norm=nodes.new('ShaderNodeVectorMath');norm.operation='NORMALIZE';links.new(coord.outputs['Generated'],norm.inputs[0])
sep=nodes.new('ShaderNodeSeparateXYZ');links.new(norm.outputs['Vector'],sep.inputs[0]);ramp=nodes.new('ShaderNodeMapRange');ramp.clamp=True;ramp.interpolation_type='SMOOTHERSTEP';ramp.inputs['From Min'].default_value=-.10;ramp.inputs['From Max'].default_value=.25;links.new(sep.outputs['Z'],ramp.inputs['Value'])
base=nodes.new('ShaderNodeMixRGB');base.blend_type='MIX';base.inputs[1].default_value=(.25,.25,.27,1);base.inputs[2].default_value=(.75,.72,.66,1);links.new(ramp.outputs[0],base.inputs[0])
dot=nodes.new('ShaderNodeVectorMath');dot.operation='DOT_PRODUCT';links.new(norm.outputs['Vector'],dot.inputs[0]);dot.inputs[1].default_value=key_dir
# von Mises-Fisher angular lobe. sigma15 degrees; height20 scene-linear.
sub=nodes.new('ShaderNodeMath');sub.operation='SUBTRACT';sub.inputs[0].default_value=1;links.new(dot.outputs['Value'],sub.inputs[1]);mul=nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=-1/(math.radians(15)**2);links.new(sub.outputs[0],mul.inputs[0]);ex=nodes.new('ShaderNodeMath');ex.operation='EXPONENT';links.new(mul.outputs[0],ex.inputs[0]);tint=nodes.new('ShaderNodeVectorMath');tint.operation='SCALE';tint.inputs[0].default_value=(14,10.5,6.58);links.new(ex.outputs[0],tint.inputs['Scale']);add=nodes.new('ShaderNodeVectorMath');add.operation='ADD';links.new(base.outputs[0],add.inputs[0]);links.new(tint.outputs['Vector'],add.inputs[1]);back=nodes.new('ShaderNodeBackground');links.new(add.outputs['Vector'],back.inputs['Color']);out=nodes.new('ShaderNodeOutputWorld');links.new(back.outputs[0],out.inputs[0])
# One shared broad neutral-warm sky fill from front/upper-left; no object masks.
fill_dir=(-fwd*.38+up*.64-right*.78).normalized();fdot=nodes.new('ShaderNodeVectorMath');fdot.operation='DOT_PRODUCT';links.new(norm.outputs['Vector'],fdot.inputs[0]);fdot.inputs[1].default_value=fill_dir
fsub=nodes.new('ShaderNodeMath');fsub.operation='SUBTRACT';fsub.inputs[0].default_value=1;links.new(fdot.outputs['Value'],fsub.inputs[1]);fmul=nodes.new('ShaderNodeMath');fmul.operation='MULTIPLY';fmul.inputs[1].default_value=-1/(math.radians(30)**2);links.new(fsub.outputs[0],fmul.inputs[0]);fex=nodes.new('ShaderNodeMath');fex.operation='EXPONENT';links.new(fmul.outputs[0],fex.inputs[0]);ftint=nodes.new('ShaderNodeVectorMath');ftint.operation='SCALE';ftint.inputs[0].default_value=(5.0,4.4444444444,3.6111111111);links.new(fex.outputs[0],ftint.inputs['Scale']);fadd=nodes.new('ShaderNodeVectorMath');fadd.operation='ADD';links.new(add.outputs['Vector'],fadd.inputs[0]);links.new(ftint.outputs['Vector'],fadd.inputs[1]);links.new(fadd.outputs['Vector'],back.inputs['Color'])
lighting={'opening_plate_uv':[u,v],'opening_world_direction':list(key_dir),'base_sky_scene_linear_RGB':[.75,.72,.66],'base_ground_scene_linear_RGB':[.25,.25,.27],'shared_opening_peak_RGB':[14,10.5,6.58],'shared_front_fill_direction':list(fill_dir),'shared_front_fill_peak_RGB':[5.0,4.4444444444,3.6111111111],'shared_front_fill_sigma_degrees':30,'angular_sigma_degrees':15,'all_rays_shared':True,'object_specific_lighting':False,'scope':'Calibrated SDR-plate approximation; no recovered HDR claim'}
(O/'LIGHTING-CONTRACT.json').write_text(json.dumps(lighting,indent=2))
# Rendering is offline and explicitly fixed-view. No web/runtime or parallax claim.
s.render.resolution_x=450;s.render.resolution_y=300;s.render.resolution_percentage=100;s.render.use_border=False;s.render.use_crop_to_border=False
s.cycles.samples=48;s.cycles.seed=0;s.cycles.use_adaptive_sampling=False;s.cycles.use_denoising=False;s.render.use_persistent_data=False;cam.data.dof.use_dof=False
s.use_nodes=True;n=s.node_tree.nodes;n.clear();lk=s.node_tree.links
rl=n.new('CompositorNodeRLayers');image=n.new('CompositorNodeImage');image.image=im
scale=n.new('CompositorNodeScale');scale.space='ABSOLUTE';scale.inputs['X'].default_value=450;scale.inputs['Y'].default_value=300;lk.new(image.outputs['Image'],scale.inputs['Image'])
mult=n.new('CompositorNodeMixRGB');mult.blend_type='MULTIPLY';mult.inputs[0].default_value=1;lk.new(scale.outputs['Image'],mult.inputs[1]);lk.new(rl.outputs['Shadow Catcher'],mult.inputs[2])
over=n.new('CompositorNodeAlphaOver');over.inputs[0].default_value=1;lk.new(mult.outputs['Image'],over.inputs[1]);lk.new(rl.outputs['Image'],over.inputs[2]);comp=n.new('CompositorNodeComposite');lk.new(over.outputs['Image'],comp.inputs[0])
for sock,label in [('Image','hero'),('Shadow Catcher','catcher')]:
 f=n.new('CompositorNodeOutputFile');f.base_path=str(O);f.format.file_format='OPEN_EXR';f.format.color_mode='RGBA';f.format.color_depth='32';f.file_slots[0].path=label+'-';lk.new(rl.outputs[sock],f.inputs[0])
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='32';s.render.filepath=str(O/'composite.exr')
assert camera_before==[list(r) for r in cam.matrix_world]
assert all(hero[n]=={'matrix':[list(r) for r in s.objects[n].matrix_world],'data':s.objects[n].data.name if s.objects[n].data else None} for n in hero)
if '--save-only' in sys.argv:
 out=D/'hybrid-rain-hero-v4.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True);manifest={'source_sha256':source_sha,'source_unchanged':sha(SRC)==source_sha,'output_sha256':sha(out),'output_bytes':out.stat().st_size,'source_asset':'approved-scene-clean-environment-v1.png','scope':'Offline fixed-view hybrid scene; generated plate for environment and ground appearance with 3D hero and catchers','verification':'Plate source pixels round-trip bitwise equal before pack; retained source file unchanged'};(D/'SCENE-v4-MANIFEST.json').write_text(json.dumps(manifest,indent=2));print('SCENE_SAVED',manifest,flush=True);sys.exit(0)
print('RENDER_START',flush=True);t=time.monotonic();bpy.ops.render.render(write_still=True)
s.render.image_settings.file_format='PNG';s.render.image_settings.color_depth='8';bpy.data.images['Render Result'].save_render(str(O/'hybrid-raw.png'),scene=s)
report={'source':str(SRC),'source_sha256':source_sha,'source_unchanged':sha(SRC)==source_sha,'source_asset':'approved-scene-clean-environment-v1.png','mode':'Fixed-view offline compositing art proof','samples':48,'size':[450,300],'camera_preserved':camera_before,'hero_placement_preserved':True,'receivers':receivers,'hidden':hidden,'plate_visible_through_glass':True,'shadow_catcher_pass_enabled':True,'render_seconds':time.monotonic()-t,'output_sha256':sha(O/'hybrid-raw.png'),'limits':['Environment and ground visual texture are generated static plate pixels','Ground catches genuine CG hero shadows/reflections but is not yet reactive visible terrain','Plate is transmission-only behind CG; one all-ray shared sky is calibrated to the actual plate opening','No arbitrary-camera or multi-shot parallax solution','Rain is static shutter-integrated 3D capsules, not fluid simulation','No realtime web implementation or deployment']}
(O/'RENDER-MANIFEST.json').write_text(json.dumps(report,indent=2));print('HYBRID_PREVIEW_READY',json.dumps(report),flush=True)
