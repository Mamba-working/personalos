"""One coordinated macro scene revision. No beauty render. Source remains immutable."""
import bpy, numpy as np, json, math, hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
D=Path(__file__).resolve().parent;R=D.parent;SRC=R/'weather-library-recovery-20261009-0417/PersonalOS-right-umbrella-wet-correction-master.blend';SHA='4a4b2c998e7334b053fedd39a964cc9c629e6467060a56e7241952a13e4911e8';assert hashlib.sha256(SRC.read_bytes()).hexdigest()==SHA
bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();MPU=15/88
CM=np.array(s.camera.matrix_world);O=CM[:3,3];RIGHT=CM[:3,0];UP=CM[:3,1];FWD=-CM[:3,2];F=1325.
def pix(p):
 q=np.asarray(p)-O;dep=q@FWD;return np.stack((450+F*(q@RIGHT)/dep,300-F*(q@UP)/dep),axis=-1)
def unpix(x,y,dep):return O+FWD*dep+RIGHT*(x-450)*dep/F+UP*(300-y)*dep/F
def verts(o):
 v=np.empty((len(o.data.vertices),3));o.data.vertices.foreach_get('co',v.ravel());m=np.array(o.matrix_world);return v@m[:3,:3].T+m[:3,3]
def setverts(o,v):
 m=np.array(o.matrix_world.inverted());v=v@m[:3,:3].T+m[:3,3];o.data.vertices.foreach_set('co',v.astype(np.float32).ravel());o.data.update()
def evaluated(o):
 ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();me.calc_loop_triangles();v=np.array([ev.matrix_world@x.co for x in me.vertices]);tr=np.array([t.vertices for t in me.loop_triangles]);ev.to_mesh_clear();return v,tr
can=s.objects['Dry clay / eight tensioned gores'];cv=verts(can);NV=12289;C=cv[0];rim=cv[NV-256:NV];oldn=C-rim.mean(0);oldn/=np.linalg.norm(oldn);u=rim[0]-C;u-=oldn*(u@oldn);u/=np.linalg.norm(u);v=np.cross(oldn,u);assert (rim[64]-C)@v>0
rel=cv[:NV]-C;oldrad=np.linalg.norm(rel-(rel@oldn)[:,None]*oldn,axis=1);oldh=rel@oldn;rr=oldrad[-256:];hh=np.concatenate((np.zeros((1,256)),oldh[1:].reshape(48,256)),axis=0);mean_h=hh.mean(1)
newn=RIGHT*.48+UP*.86+FWD*.13;newn/=np.linalg.norm(newn);cross=np.cross(oldn,newn);c=oldn@newn;K=np.array([[0,-cross[2],cross[1]],[cross[2],0,-cross[0]],[-cross[1],cross[0],0]]);Q=np.eye(3)+K+K@K/(1+c);NU=Q@u;NVEC=Q@v;NC=unpix(707,145,(C-O)@FWD);H=-mean_h[-1]*1.06

def chart(p):
 d=np.atleast_2d(p)-C;x=d@u;y=d@v;th=np.arctan2(y,x)%(2*np.pi);a=th*256/(2*np.pi);i=np.floor(a).astype(int)%256;f=a-np.floor(a);Rr=rr[i]*(1-f)+rr[(i+1)%256]*f;t=np.sqrt(x*x+y*y)/Rr;return t,th,i,f,Rr

def surface(t,th,i,f,Rr):
 # New continuous eight-gore tension surface: quadratic rib bend plus mild
 # downwind elastic displacement. Scalloping remains tied to the eight ribs.
 r=t*Rr*1.09;tr=np.clip(t*48,0,48);j=np.minimum(np.floor(tr).astype(int),47);g=tr-j
 h0=hh[j,i]*(1-f)+hh[j,(i+1)%256]*f;h1=hh[j+1,i]*(1-f)+hh[j+1,(i+1)%256]*f;oh=h0*(1-g)+h1*g
 mh=np.interp(np.clip(t,0,1),np.linspace(0,1,49),mean_h);sag=(oh-mh)*.7
 nh=-H*t*t+sag
 wind=(.5+.5*np.cos(th+np.pi/4))
 P=NC+r[:,None]*(np.cos(th)[:,None]*NU+np.sin(th)[:,None]*NVEC)+nh[:,None]*newn
 P-=.14*t[:,None]**2*RIGHT
 P-=.16*(t**3*wind)[:,None]*UP
 return P,oh

def deform(p):
 p=np.atleast_2d(p);t,th,i,f,Rr=chart(p);base,oh=surface(t,th,i,f,Rr);delta=(p-C)@oldn-oh
 # Preserve signed, small normal offsets approximately in the same membrane
 # coordinate chart; exact 0.20 mm shell is reseated below after normal update.
 return base+delta[:,None]*newn
visible=set()
def walk(col,hidden=False):
 hidden=hidden or col.hide_render
 if not hidden:visible.update(o.name for o in col.objects if not o.hide_render)
 for child in col.children:walk(child,hidden)
walk(s.collection)
propnames=sorted(n for n in visible if n.startswith(('Dry clay /','Readable wetness /','Wet PVC /','Fine-first water /')))
skip=('straight coaxial','runner collar','crown collar','connected strut')
for name in propnames:
 if any(x in name for x in skip):continue
 o=s.objects[name]
 if o.type=='MESH':
  ov=verts(o); authored=None
  if o.data.has_custom_normals:
   # Transport the original analytic lens normals by inverse-transpose of the
   # actual nonlinear geometry Jacobian, retaining intended cap/underside splits.
   ln=np.empty((len(o.data.loops),3));o.data.corner_normals.foreach_get('vector',ln.ravel());vi=np.empty(len(o.data.loops),dtype=np.int32);o.data.loops.foreach_get('vertex_index',vi);m3=np.array(o.matrix_world)[:3,:3];wn=ln@np.linalg.inv(m3);eps=1e-4;J=np.empty((len(ov),3,3))
   for ax in range(3):
    step=np.zeros(3);step[ax]=eps;J[:,:,ax]=(deform(ov+step)-deform(ov-step))/(2*eps)
   wn=np.einsum('li,lij->lj',wn,np.linalg.inv(J)[vi]);authored=wn@m3;authored/=np.maximum(np.linalg.norm(authored,axis=1)[:,None],1e-12)
  setverts(o,deform(ov))
  if authored is not None:o.data.normals_split_custom_set(authored.tolist())
 elif o.type=='CURVE':
  inv=o.matrix_world.inverted()
  for sp in o.data.splines:
   ps=np.array([o.matrix_world@p.co.to_3d() for p in sp.points]);npv=deform(ps)
   for p,x in zip(sp.points,npv):p.co=(*(inv@Vector(x)),1)
bpy.context.view_layer.update()
# Reseat inner shell to physical 0.20 mm using outer surface geometric normals.
cv2=verts(can);can.data.calc_loop_triangles();tr=np.array([t.vertices for t in can.data.loop_triangles if max(t.vertices)<12289]);norm=np.zeros((12289,3));face=np.cross(cv2[tr[:,1]]-cv2[tr[:,0]],cv2[tr[:,2]]-cv2[tr[:,0]])
for k in range(3):np.add.at(norm,tr[:,k],face)
norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-12)
if norm[0]@newn<0:norm=-norm
cv2[12289:]=cv2[:12289]-norm*(.00020/MPU);setverts(can,cv2)
# A separate straight shaft, mild crown-joint wind flex, no shaft bending.
foot=unpix(665,390,16.82);axis=NC-foot;axis/=np.linalg.norm(axis)
# Exact receiver surface at the chosen foot x/y.
receivers=[]
for name in ['Ground / unified continuous metric field','Water / finite storm-shelf hollows']:
 gv,gt=evaluated(s.objects[name]);receivers.append(BVHTree.FromPolygons(gv,gt,all_triangles=True))
def ground_z(x,y):
 hit=[b.ray_cast(Vector((x,y,2)),Vector((0,0,-1)),5)[0] for b in receivers];hit=[h.z for h in hit if h is not None];return max(hit)
foot[2]=ground_z(foot[0],foot[1])+.003/MPU;axis=NC-foot;axis/=np.linalg.norm(axis);runner=NC-axis*.48
shaft=s.objects['Dry clay / straight coaxial crown runner shaft'];inv=shaft.matrix_world.inverted();pseq=[NC+axis*.16,NC,runner,foot]
for p,x in zip(shaft.data.splines[0].points,pseq):p.co=(*(inv@Vector(x)),1)
for name,center,size in [('Dry clay / runner collar',runner,.025),('Dry clay / crown collar',NC,.015)]:
 o=s.objects[name];inv=o.matrix_world.inverted()
 for p,x in zip(o.data.splines[0].points,[center-axis*size,center+axis*size]):p.co=(*(inv@Vector(x)),1)
for i in range(8):
 name='Dry clay / connected strut %02d'%i;o=s.objects[name];inv=o.matrix_world.inverted();end=cv2[1+(27-1)*256+i*32]-norm[1+(27-1)*256+i*32]*.025
 for p,x in zip(o.data.splines[0].points,[runner,end]):p.co=(*(inv@Vector(x)),1)
# Relocate the original actor as a whole; untouched face topology and expression.
ball=s.objects['BallBody / one original spherical actor'];root=s.objects['BallStage / runtime-owned global placement'];ballv,_=evaluated(ball);beforecenter=np.array(ball.matrix_world.translation);dx=(615-pix(beforecenter)[0])*((beforecenter-O)@FWD)/F;root.location.x+=dx;bpy.context.view_layer.update();ballv,_=evaluated(ball)
low=ballv[:,2].min();gaps=[p[2]-ground_z(p[0],p[1]) for p in ballv[ballv[:,2]<low+.005/MPU]];mingap=min(gaps);root.location.z-=mingap-.000025/MPU;bpy.context.view_layer.update();ballv,bt=evaluated(ball)
# Grounding is geometric, with 25 µm closest dry receiver gap. No contact paint.
# Re-cull current airborne rain against the remodelled roof and moved Ball.
roofTree=BVHTree.FromPolygons(cv2[:12289],tr,all_triangles=True);ballTree=BVHTree.FromPolygons(ballv,bt,all_triangles=True)
culled=[]
for name in sorted(visible):
 if not ('rain / drop' in name.lower() or 'rain / moving drop' in name.lower()):continue
 o=s.objects[name];pos=o.matrix_world.translation.copy();hit=roofTree.ray_cast(pos+Vector((-.12,.015,8)),Vector((.015,-.001875,-1)).normalized(),8.2)[0]
 # Drops lower than an intersected roof should already have collided upstream.
 if hit is not None and hit.z>pos.z+.001:
  o.hide_render=True;o.hide_viewport=True;culled.append(name);continue
 if ballTree.find_nearest(pos)[3] <.015 and (pos-Vector(ball.matrix_world.translation)).length<.9:o.hide_render=True;o.hide_viewport=True;culled.append(name)
# Actual projected geometry for review, no beauty render needed.
curves={}
for name in propnames:
 o=s.objects[name]
 if o.type=='CURVE':curves[name]=[pix(np.array(o.matrix_world@p.co.to_3d())).tolist() for p in o.data.splines[0].points]
np.savez_compressed(D/'NEW-ROOF-WORLD-GEOMETRY.npz',vertices=cv2[:12289],normals=norm,triangles=tr,camera=O,pixels=pix(cv2[:12289]))
report={'source_SHA256':SHA,'source_unchanged':hashlib.sha256(SRC.read_bytes()).hexdigest()==SHA,'roof_type':'Nonlinear convex eight-gore quadratic tension membrane with coherent ribs, scallops and smooth downwind flex','canopy_bounds900':[pix(cv2[:12289]).min(0).tolist(),pix(cv2[:12289]).max(0).tolist()],'rim_pixels900':pix(cv2[12289-256:12289:32]).tolist(),'crown900':pix(NC).tolist(),'shaft900':[pix(x).tolist() for x in pseq],'Ball_center900':pix(np.array(ball.matrix_world.translation)).tolist(),'Ball_bounds900':[pix(ballv).min(0).tolist(),pix(ballv).max(0).tolist()],'PVC_thickness_mm':.20,'Ball_receiver_min_gap_mm':.025,'rigid_rotation_only':False,'crown_joint_windflex_deg':math.degrees(math.acos(np.clip(axis@newn,-1,1))),'rain_reculled':len(culled),'rain_hidden':culled,'curves':curves,'roof_points900':pix(cv2[:12289]).tolist(),'roof_triangles':tr.tolist(),'Ball_points900':pix(ballv).tolist()}
(D/'MACRO-GEOMETRY-DRAFT.json').write_text(json.dumps(report));bpy.ops.wm.save_as_mainfile(filepath=str(D/'PersonalOS-macro-geometry-checkpoint.blend'),compress=True);print('MACRO_DRAFT',json.dumps({k:v for k,v in report.items() if k not in ['curves','roof_points900','roof_triangles','Ball_points900','rain_hidden']}),flush=True)
