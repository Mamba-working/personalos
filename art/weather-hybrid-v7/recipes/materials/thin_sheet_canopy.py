"""Energy-conserving smooth thin dielectric pair, one effective membrane surface.

PBRT4 ThinDielectricBxDF and Mitsuba thindielectric assume nearby parallel
interfaces, negligible lateral displacement, no absorption. This implements
Rsheet=2R/(1+R), Tsheet=1-Rsheet for exact unpolarized interface Fresnel R.
All rays share the same BSDF. Resolved water-drop and frame geometry/materials
from the clear-wet candidate remain unchanged. No opacity texture or ray selector.
"""
import bpy,math
NAME='Hybrid thin sheet / effective parallel dielectric pair'
def apply_thin_sheet(scene):
 can=scene.objects['UmbrellaCanopy / continuous curved 8-panel membrane'];old=can.data.materials[0];assert old.name.startswith('Hybrid clear wet canopy / outer')
 so=next(m for m in can.modifiers if m.type=='SOLIDIFY');assert abs(so.thickness-.00065)<1e-8
 before={'thickness':so.thickness,'offset':so.offset,'show_render':so.show_render,'show_viewport':so.show_viewport}
 mat=old.copy();mat.name=NAME;n=mat.node_tree.nodes;l=mat.node_tree.links
 bump=n['Hybrid clear wet canopy / localized water surface relief'];normal=bump.outputs['Normal']
 geom=n.new('ShaderNodeNewGeometry');geom.name='Thin sheet / shared incident direction'
 dot=n.new('ShaderNodeVectorMath');dot.operation='DOT_PRODUCT';l.new(geom.outputs['Incoming'],dot.inputs[0]);l.new(normal,dot.inputs[1])
 def mathnode(op,a,b=None,name=None):
  q=n.new('ShaderNodeMath');q.operation=op
  if name:q.name=name
  for idx,value in enumerate([a,b]):
   if value is None:continue
   if isinstance(value,(int,float)):q.inputs[idx].default_value=value
   else:l.new(value,q.inputs[idx])
  return q.outputs[0]
 c=mathnode('ABSOLUTE',dot.outputs['Value'],name='Thin sheet / abs cosine for symmetric air-film-air')
 c=mathnode('MINIMUM',c,1)
 # Snell at air-to-polymer boundary; absolute incident cosine for either side.
 eta=1.38;c2=mathnode('MULTIPLY',c,c);s2=mathnode('SUBTRACT',1,c2);st2=mathnode('DIVIDE',s2,eta*eta);ct=mathnode('SQRT',mathnode('MAXIMUM',mathnode('SUBTRACT',1,st2),0))
 ect=mathnode('MULTIPLY',eta,ct);ec=mathnode('MULTIPLY',eta,c)
 rs=mathnode('DIVIDE',mathnode('SUBTRACT',c,ect),mathnode('ADD',c,ect));rs2=mathnode('MULTIPLY',rs,rs)
 rp=mathnode('DIVIDE',mathnode('SUBTRACT',ec,ct),mathnode('ADD',ec,ct));rp2=mathnode('MULTIPLY',rp,rp)
 R=mathnode('MULTIPLY',mathnode('ADD',rs2,rp2),.5,name='Thin sheet / exact unpolarized interface Fresnel')
 eff=mathnode('DIVIDE',mathnode('MULTIPLY',R,2),mathnode('ADD',1,R),name='Thin sheet / full internal-series reflectance 2R over 1 plus R')
 trans=n.new('ShaderNodeBsdfTransparent');trans.name='Thin sheet / physical straight-through transmission';trans.inputs['Color'].default_value=(1,1,1,1)
 refl=n.new('ShaderNodeBsdfGlossy');refl.name='Thin sheet / unit specular reflection';refl.inputs['Color'].default_value=(1,1,1,1);refl.inputs['Roughness'].default_value=0;l.new(normal,refl.inputs['Normal'])
 mix=n.new('ShaderNodeMixShader');mix.name='Thin sheet / energy partition, transmission plus reflection';l.new(eff,mix.inputs[0]);l.new(trans.outputs[0],mix.inputs[1]);l.new(refl.outputs[0],mix.inputs[2]);out=next(q for q in n if q.type=='OUTPUT_MATERIAL' and q.is_active_output)
 for link in list(out.inputs['Surface'].links):l.remove(link)
 l.new(mix.outputs[0],out.inputs['Surface']);assert not out.inputs['Volume'].is_linked
 can.data.materials[0]=mat
 # Preserve the authored curved surface. Its shell modifier is disabled only in
 # this explicit thin-sheet branch, otherwise pair reflectance is counted twice.
 so.show_render=False;so.show_viewport=False
 return {'model':'Smooth thin dielectric parallel-interface pair','material':mat.name,'IOR':eta,'reflection':'2R/(1+R)','transmission':'(1-R)/(1+R)','R':'Exact unpolarized dielectric Fresnel using abs(dot(N,wi))','opacity_texture':False,'ray_selectors':False,'emission':False,'membrane_base_geometry_unchanged':True,'solidify_before':before,'solidify_now_rendered':False,'resolved_water_Glass_retained':True,'frame_and_hem_retained':True,'assumptions':['Local interfaces are parallel with negligible lateral ray displacement','Non-absorbing incoherent pair, no interference','Bump-normal wet microdetail perturbs pair orientation; it is not independently resolved droplet refraction','Existing resolved water caps retain full Glass refraction'],'sources':['https://pbr-book.org/4ed/Reflection_Models/Dielectric_BSDF','https://mitsuba.readthedocs.io/en/latest/src/generated/plugins_bsdfs.html#thin-dielectric-material-thindielectric']}
