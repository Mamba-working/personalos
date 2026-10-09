"""One shared broad upper cloud opening; physical glass, no view/object lobe."""
import bpy,numpy as np,json,math,hashlib
from pathlib import Path
D=Path(__file__).parent;bpy.ops.wm.open_mainfile(filepath=str(D/'PersonalOS-macro-geometry-checkpoint.blend'));s=bpy.context.scene;s.frame_set(49)
node=next(n for n in s.world.node_tree.nodes if n.type=='TEX_IMAGE');old=node.image;w,h=old.size;a=np.empty(w*h*4,np.float32);old.pixels.foreach_get(a);field=a.reshape(h,w,4).copy();u,v=np.meshgrid((np.arange(w)+.5)/w,(np.arange(h)+.5)/h);phi=(u-.5)*2*np.pi;el=(v-.5)*np.pi;dirs=np.stack([np.cos(el)*np.sin(phi),np.cos(el)*np.cos(phi),np.sin(el)],-1);direction=np.array([.242404,.346189,.906308]);direction/=np.linalg.norm(direction);sigma=math.radians(35);gate=np.clip((np.degrees(el)-30)/15,0,1);gate=gate*gate*(3-2*gate);Y=np.array([.2126,.7152,.0722]);rgb=np.array([.95,1,1.08]);rgb/=rgb@Y;lobe=np.exp((dirs@direction-1)/sigma**2)*gate;added=lobe[:,:,None]*4.5*rgb;field[:,:,:3]+=added
im=bpy.data.images.new('Macro coordinated shared upper cloud opening',width=w,height=h,alpha=True,float_buffer=True);im.colorspace_settings.name='Linear Rec.709';im.pixels.foreach_set(field.ravel());im.update();im.pack();node.image=im;np.save(D/'macro-shared-cloud-field.npy',field[:,:,:3])
changes=[]
for name in ['Closed PVC 020mm / outer clear dielectric with retained wet rel','Closed PVC 020mm / inner correlated clear dielectric']:
 mat=bpy.data.materials[name]
 for n in mat.node_tree.nodes:
  if n.type=='BUMP':
   prior=n.inputs['Strength'].default_value;new=.65 if 'paired tension' in n.name else .45;n.inputs['Strength'].default_value=new;changes.append({'material':name,'node':n.name,'old_strength':prior,'new_strength':new})
weights=np.cos(el);report={'one_selected_shared_light_revision':True,'world_all_objects_all_ray_types':True,'warm_left_source_preserved':True,'added_source':'Broad neutral-cool upper cloud opening','direction_world':direction.tolist(),'angular_sigma_degrees':35,'smooth_elevation_gate_degrees':[30,45],'peak_scene_linear_luminance':4.5,'RGB_luminance_normalized':rgb.tolist(),'mean_Y_before':float(((field[:,:,:3]-added)@Y*weights).sum()/weights.sum()),'mean_Y_after':float((field[:,:,:3]@Y*weights).sum()/weights.sum()),'material_changes':changes,'glass_IOR_thickness_transmission_and_roughness_preserved':True,'camera_and_backdrop_unchanged':True,'no_view_specific_or_object_specific_shader':True,'selected_source_geometry':'PersonalOS-macro-geometry-checkpoint.blend','alternate_depth_reflection_not_applied':True}
(D/'MACRO-SHARED-LIGHT-DECISION.json').write_text(json.dumps(report,indent=2));s.render.resolution_x=900;s.render.resolution_y=600;s.render.resolution_percentage=100;s.render.use_border=False;s.render.use_crop_to_border=False
for n in s.node_tree.nodes:
 if n.type=='SCALE':n.inputs['X'].default_value=900;n.inputs['Y'].default_value=600
bpy.ops.wm.save_as_mainfile(filepath=str(D/'PersonalOS-coordinated-macro-shot-master.blend'),compress=True);print(json.dumps(report),flush=True)
