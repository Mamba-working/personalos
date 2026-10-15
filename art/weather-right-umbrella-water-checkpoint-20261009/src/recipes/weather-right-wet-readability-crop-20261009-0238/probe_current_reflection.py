import bpy,json,math,hashlib,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
from bpy_extras.object_utils import world_to_camera_view
D=Path(__file__).resolve().parent;R=D.parent;SRC=R/'weather-right-umbrella-correction-20261009-0153/right-umbrella-fine-wet-hierarchy-lookdev.blend';bpy.ops.wm.open_mainfile(filepath=str(SRC));bpy.context.view_layer.update();s=bpy.context.scene;cam=s.camera;O=cam.matrix_world.translation;rot=cam.matrix_world.to_3x3();right=rot@Vector((1,0,0));downscreen=rot@Vector((0,-1,0));forward=rot@Vector((0,0,-1));focal=900*cam.data.lens/cam.data.sensor_width;MPU=15/88;can=s.objects['Dry clay / eight tensioned gores'];m=can.data;m.calc_loop_triangles();V=[can.matrix_world@v.co for v in m.vertices];T=[tuple(t.vertices) for t in m.loop_triangles];UV=[];NOR=[];matids=[];nm=can.matrix_world.to_3x3().inverted().transposed();ul=m.uv_layers['ConnectedWetField_SurfaceMetric_v1']
for t in m.loop_triangles:UV.append([Vector((*ul.data[l].uv,0)) for l in t.loops]);NOR.append([(nm@m.corner_normals[l].vector).normalized() for l in t.loops]);matids.append(m.polygons[t.polygon_index].material_index)
bv=BVHTree.FromPolygons(V,T,all_triangles=True);nodes=m.materials[0].node_tree.nodes;strength=nodes['CanopyWetness / runtime recreatable'].outputs[0].default_value;distance=nodes['Hybrid clear wet canopy / localized water surface relief'].inputs['Distance'].default_value;tex=[]
for name in ['Verified water-drop height','Verified water-drop opacity']:
 im=nodes[name].image;w,h=im.size;a=np.empty(w*h*4,np.float32);im.pixels.foreach_get(a);tex.append(a.reshape(h,w,4)[:,:,0])
ht,mt=tex;HH,WW=ht.shape;lo=nodes['Map Range'].inputs['From Min'].default_value;hi=nodes['Map Range'].inputs['From Max'].default_value;sup=nodes['Hybrid clear wet canopy / localized water support, not opacity'];slo=sup.inputs['From Min'].default_value;shi=sup.inputs['From Max'].default_value

def sample(a,uv):
 x=(uv.x%1)*WW-.5;y=(uv.y%1)*HH-.5;ix=math.floor(x);iy=math.floor(y);fx=x-ix;fy=y-iy;return float((1-fy)*((1-fx)*a[iy%HH,ix%WW]+fx*a[iy%HH,(ix+1)%WW])+fy*((1-fx)*a[(iy+1)%HH,ix%WW]+fx*a[(iy+1)%HH,(ix+1)%WW]))
def height(uv):return distance*max(0,min(1,(sample(ht,uv)-lo)/(hi-lo)))*max(0,min(1,(sample(mt,uv)-slo)/(shi-slo)))
def interpolate(q,k,data):
 a,b,c=T[k];return barycentric_transform(q,V[a],V[b],V[c],*data[k])
def perturb(q,k,n,ng):
 uv=interpolate(q,k,UV);v=q-O;den=ng.dot(v)
 if abs(den)<1e-8:return n,0.,height(uv),0.
 span=v.dot(forward)/focal;dx=(right-v*(ng.dot(right)/den))*span;dy=(downscreen-v*(ng.dot(downscreen)/den))*span;hc=height(uv);hx=height(interpolate(q+dx,k,UV));hy=height(interpolate(q+dy,k,UV));rx=dy.cross(n);ry=n.cross(dx);det=dx.dot(rx)
 if abs(det)<1e-18:return n,0.,hc,0.
 gradient=(hx-hc)*rx+(hy-hc)*ry;grad=gradient/abs(det);slope=grad.length;out=(abs(det)*n-(1 if det>0 else -1)*gradient).normalized();out=(strength*out+(1-strength)*n).normalized();angle=math.degrees(n.angle(out));return out,slope,hc,angle
# Exact active shared World lookup, not a generated or inferred environment.
wi=next(n.image for n in s.world.node_tree.nodes if n.type=='TEX_IMAGE');ew,eh=wi.size;wa=np.empty(ew*eh*4,np.float32);wi.pixels.foreach_get(wa);W=wa.reshape(eh,ew,4)[:,:,:3];reference=np.load(R/'weather-lateral-shared-field-20261008-0919/lateral-neutral-shared-field.npy');assert np.array_equal(W,reference);np.save(D/'actual-shared-world-linear.npy',W);YV=np.array([.2126,.7152,.0722])
def env(d):
 u=math.atan2(d.x,d.y)/(2*math.pi)+.5;v=math.asin(max(-1,min(1,d.z)))/math.pi+.5;x=u*ew-.5;y=v*eh-.5;i=math.floor(x);j=math.floor(y);a=x-i;b=y-j;return ((1-b)*((1-a)*W[j%eh,i%ew]+a*W[j%eh,(i+1)%ew])+b*((1-a)*W[(j+1)%eh,i%ew]+a*W[(j+1)%eh,(i+1)%ew])).astype(float)
# Other glossy-visible active geometry can block a nominal World direction.
active=set()
def collect(c):
 if c.hide_render:return
 for ob in c.objects:
  if not ob.hide_render and ob.type in ['MESH','CURVE'] and ob.visible_glossy and ob!=can and not ob.name.startswith(('Corrected right rain /','Canonical sphere rain /')):active.add(ob)
 for ch in c.children:collect(ch)
collect(s.collection);others=[];dg=bpy.context.evaluated_depsgraph_get()
for ob in sorted(active,key=lambda x:x.name):
 e=ob.evaluated_get(dg);mm=e.to_mesh();mm.calc_loop_triangles();vv=[e.matrix_world@v.co for v in mm.vertices];tt=[tuple(t.vertices)for t in mm.loop_triangles];others.append((ob.name,BVHTree.FromPolygons(vv,tt,all_triangles=True)));e.to_mesh_clear()
bodytree=next(t for n,t in others if n.startswith('BallBody'))
def fresnel(rd,n,eta):
 ci=max(0,min(1,-rd.dot(n)));st2=eta*eta*(1-ci*ci)
 if st2>=1:return 1.,None
 ct=math.sqrt(1-st2);rs=(eta*ci-ct)/(eta*ci+ct);rp=(ci-eta*ct)/(ci+eta*ct);F=.5*(rs*rs+rp*rp);return F,(eta*rd+(eta*ci-ct)*n).normalized()
def shade(q,k,rd,wet):
 ng=(V[T[k][1]]-V[T[k][0]]).cross(V[T[k][2]]-V[T[k][0]]).normalized();nn=interpolate(q,k,NOR).normalized()
 if wet and matids[k]==0:nn,*_=perturb(q,k,nn,ng)
 entering=rd.dot(ng)<0;nn=nn if entering else -nn
 if rd.dot(nn)>0:nn=-nn
 eta=1/1.54 if entering else 1.54;F,td=fresnel(rd,nn,eta);return nn,F,td

def escape(q,rd,wet):
 ro=q+rd*.000002;weight=1.;steps=[]
 for _ in range(8):
  p,ng,k,dist=bv.ray_cast(ro,rd);nearest=[]
  for name,t in others:
   pp,nn,kk,dd=t.ray_cast(ro,rd,dist if p is not None else 1000.)
   if pp is not None:nearest.append((dd,name))
  if nearest:return {'terminal':min(nearest)[1],'direction':list(rd),'weight':weight,'steps':steps}
  if p is None:return {'terminal':'World','direction':list(rd),'RGB':env(rd).tolist(),'Y':float(env(rd)@YV),'weight':weight,'steps':steps}
  nn,F,td=shade(p,k,rd,wet);steps.append({'material':matids[k],'TIR':td is None})
  if td is None:rd=(rd-2*rd.dot(nn)*nn).normalized()
  else:rd=td;weight*=1-F
  ro=p+rd*.000002
 return {'terminal':'bounce_limit','direction':list(rd),'weight':weight,'steps':steps}
rows=[]
for py in range(125,350,8):
 for px in range(490,822,8):
  rd=(rot@Vector(((px+.5-450)/focal,(300-py-.5)/focal,-1))).normalized();q,ng,k,dist=bv.ray_cast(O,rd)
  if q is None or bodytree.ray_cast(O,rd,max(0,dist-.000002))[0] is not None:continue
  directn,directF,td=shade(q,k,rd,False);direct=escape(q,(rd-2*rd.dot(directn)*directn).normalized(),False);direct['fresnel_weight']=directF;rec={'pixel900':[px,py],'first_interface_material':matids[k],'direct_dry_reflection':direct}
  # Seek the outer interface on the transmitted primary path.
  incoming=rd;trans=1.;outer=None
  for step in range(3):
   if matids[k]==0:outer=(q,ng,k,incoming,trans);break
   nn,F,td=shade(q,k,incoming,False)
   if td is None:break
   trans*=1-F;incoming=td;q,ng,k,dd=bv.ray_cast(q+incoming*.000002,incoming)
   if q is None:break
  if outer:
   q,ng,k,incoming,trans=outer;nn=interpolate(q,k,NOR).normalized();pn,sl,hh,ang=perturb(q,k,nn,ng);rec.update({'outer_point_au':list(q),'outer_normal_flat':list(nn),'outer_normal_wet':list(pn),'height_mm':hh*MPU*1000,'normal_rotation_degrees':ang})
   for mode in ['flat','wet']:
    n,F,td=shade(q,k,incoming,mode=='wet');rr=(incoming-2*incoming.dot(n)*n).normalized();p=escape(q,rr,mode=='wet');p['fresnel_weight']=trans*F*p['weight'];rec[mode+'_outer_reflection']=p
  rows.append(rec)
# Actual current Ball camera-visible normals for irradiance budgeting, plus bounds.
ballpoints=[]
for py in range(240,412,8):
 for px in range(475,635,8):
  rd=(rot@Vector(((px+.5-450)/focal,(300-py-.5)/focal,-1))).normalized();p,n,k,dist=bodytree.ray_cast(O,rd)
  if p is not None:ballpoints.append({'pixel900':[px,py],'point_au':list(p),'normal':list(n)})
np.save(D/'ball-budget-normals.npy',np.array([r['normal']for r in ballpoints]));(D/'BALL-PROBE-POINTS.json').write_text(json.dumps(ballpoints));(D/'WORLD-DIRECTION-PROBES.json').write_text(json.dumps(rows));wets=[r for r in rows if r.get('normal_rotation_degrees',0)>.2 and r.get('flat_outer_reflection',{}).get('terminal')=='World' and r.get('wet_outer_reflection',{}).get('terminal')=='World'];diff=[abs(r['wet_outer_reflection']['Y']-r['flat_outer_reflection']['Y']) for r in wets];angle=[math.degrees(Vector(r['flat_outer_reflection']['direction']).angle(Vector(r['wet_outer_reflection']['direction']))) for r in wets]
rep={'source':str(SRC),'source_sha256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'world_image':wi.name,'world_image_matches_existing_array_exactly':True,'world_lookup':'U=atan2(direction.x,direction.y)/(2pi)+.5; V=asin(direction.z)/pi+.5; bilinear exact packed image','pixel_grid':[490,125,822,350,8],'canopy_samples':len(rows),'supported_wet_reflection_World_pairs':len(wets),'World_reflection_direction_change_degrees':np.percentile(angle,[10,50,90,100]).tolist() if angle else None,'World_absolute_luminance_difference':np.percentile(diff,[10,50,90,100]).tolist() if diff else None,'Ball_visible_normals':len(ballpoints),'method':'Geometric primary refraction to outer film, flat/wet reflected directions, then geometric exit through closed film with Fresnel path weights; active glossy-visible geometry checked before World. Uses actual packed connected field and native900 tangent derivatives.','limits':['Not sampled Cycles lobe decomposition','Common15um tension, roughness sampling and fine-water refraction are omitted','Paths hitting another object are classified as non-World rather than continuing through it','World Generated-coordinate direction convention is checked separately before authoring','No scene modification or render']};(D/'DIRECTION-PROBE-SUMMARY.json').write_text(json.dumps(rep,indent=2));print(json.dumps(rep),flush=True)
