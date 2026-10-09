import bpy,json,numpy as np,math,hashlib,copy,sys,gc
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D=Path(__file__).resolve().parent;R=D.parent;P=R/'weather-right-wet-readability-crop-20261009-0238';Q=R/'weather-right-umbrella-correction-20261009-0153';sys.path.insert(0,str(D));from invariant_tools import snap,hashes
SRC=P/'coordinated-wet-readability-crop-candidate.blend';SHA='9a7101c2dcc760555cee189f38b441887cb06c2fe97e7db0cb85e6ae1f63640e';OUT=D/'right-umbrella-wet-correction-milestone.blend';H=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert H(SRC)==SHA and not OUT.exists();bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;s.frame_set(49);bpy.context.view_layer.update();before=snap(bpy);original={k:list(v)for k,v in before.items()};wr=json.loads((P/'WET-READABILITY-PATCH-REPORT.json').read_text());obj=s.objects['Wet PVC / native900 restrained resolved wetness'];old=obj.data;old.use_fake_user=True;cut=min(r['vertex_range'][0]for r in wr['records']if r['type']=='hem_pendant');vs=[v.co.copy()for v in old.vertices[:cut]];fs=[];smooth=[];normals=[]
for p in old.polygons:
 if max(p.vertices)<cut:fs.append(tuple(p.vertices));smooth.append(p.use_smooth);normals.extend(tuple(old.corner_normals[i].vector)for i in p.loop_indices)
assert obj.matrix_world==__import__('mathutils').Matrix.Identity(4)
hem=s.objects['Dry clay / chord-scalloped continuous hem'];e=hem.evaluated_get(bpy.context.evaluated_depsgraph_get());me=e.to_mesh();me.calc_loop_triangles();tree=BVHTree.FromPolygons([e.matrix_world@v.co for v in me.vertices],[tuple(t.vertices)for t in me.loop_triangles],all_triangles=True);e.to_mesh_clear();cam=s.camera;O=cam.matrix_world.translation;right=cam.matrix_world.col[0].to_3d();up=cam.matrix_world.col[1].to_3d();fw=-cam.matrix_world.col[2].to_3d();AU=15/88;SEAT=.000010

def pix(p):q=p-O;z=q.dot(fw);return Vector((450+1325*q.dot(right)/z,300-1325*q.dot(up)/z))
def append(v,f,top,rec):
 center=sum(v,Vector())/len(v);volume=sum((v[a[0]]-center).dot((v[a[j]]-center).cross(v[a[j+1]]-center))/6 for a in f for j in range(1,len(a)-1))
 if volume<0:f=[tuple(reversed(a))for a in f];volume=-volume
 edges={}
 for a in f:
  for x,y in zip(a,a[1:]+a[:1]):key=tuple(sorted((x,y)));edges[key]=edges.get(key,0)+1
 assert set(edges.values())=={2}and volume>0
 acc=[Vector()for _ in v]
 for a,t in zip(f,top):
  if t:
   n=(v[a[1]]-v[a[0]]).cross(v[a[2]]-v[a[0]])
   for i in a:acc[i]+=n
 off=len(vs);vs.extend(v)
 for a,t in zip(f,top):
  fs.append(tuple(off+i for i in a));smooth.append(t)
  face=(v[a[1]]-v[a[0]]).cross(v[a[2]]-v[a[0]]).normalized()
  for i in a:normals.append(tuple(acc[i].normalized()if t else face))
 pp=np.array([list(pix(p))for p in v]);rec.update({'vertex_range':[off,len(vs)],'native900_width_height':np.ptp(pp,axis=0).tolist(),'volume_ul':volume*AU**3*1e9,'all_edges_two_faces':True});return rec
phases=[('near_release',1.65,7.1),('refilling',1.45,1.5),('accumulating',2.0,4.0),('freshly_wetted',1.0,.9),('neck_developing',1.75,5.4),('compact_accumulation',1.5,2.4)];records=[];tips=[];down=Vector((0,0,-1));side=Vector((1,0,0));cross=Vector((0,1,0))
for rec in [r for r in wr['records']if r['type']=='hem_pendant']:
 i=rec['index'];phase,width_px,length_px=phases[i];q=Vector(rec['attachment_world']);hq,hn,_,_=tree.find_nearest(q);q=hq;hn.normalize();px=pix(q);ppm_z=abs((pix(q+down*(.001/AU))-px).y)/.001;ppm_x=math.sqrt(sum((pix(q+a*(.001/AU)).x-px.x)**2 for a in [side,cross]))/.001;length=length_px/ppm_z;diam=width_px/ppm_x;neck=diam*(.10 if i==0 else .14);K,NR=20,24;v=[q+hn*(SEAT/AU)];rows=[];contact=[];maxgap=0.
 for k in range(K):
  a=2*math.pi*k/K;guess=q+side*(neck*math.cos(a)/AU)+cross*(neck*math.sin(a)/AU);p,n,_,_=tree.find_nearest(guess);p=p+n.normalized()*(SEAT/AU);contact.append(len(v));v.append(p);maxgap=max(maxgap,tree.find_nearest(p)[3]*AU*1e6)
 rows.append(contact)
 for j in range(1,NR):
  t=j/NR;neck_end=.29 if i==0 else .13 if i in [1,3,5]else .22
  if t<neck_end:radius=neck*(1-.12*math.sin(math.pi*t/neck_end))
  else:radius=diam*.5*math.sin(math.pi*(t-neck_end*.55)/(1-neck_end*.55))**(.70 if i in [1,3,5]else .83)
  center=q+down*((SEAT+length*t)/AU);row=[]
  for k in range(K):a=2*math.pi*k/K;row.append(len(v));v.append(center+side*(radius*math.cos(a)/AU)+cross*(radius*math.sin(a)/AU))
  rows.append(row)
 tip=len(v);v.append(q+down*((SEAT+length)/AU));f=[];top=[]
 for k in range(K):f.append((0,rows[0][(k+1)%K],rows[0][k]));top.append(False)
 for a,b in zip(rows,rows[1:]):
  for k in range(K):f.append((a[k],a[(k+1)%K],b[(k+1)%K],b[k]));top.append(True)
 for k in range(K):f.append((rows[-1][k],rows[-1][(k+1)%K],tip));top.append(True)
 r=append(v,f,top,{'type':'hem_pendant','index':i,'authored_stage':phase,'attachment_world':list(q),'attachment_native900':list(px),'length_mm':length*1000,'diameter_mm':diam*1000,'contact_max_gap_um':maxgap});records.append(r);tips.append((q,v[tip],diam,i,ppm_z))
# Only one detached successor, beneath the actual lowest selected attachment.
q,tip,diam,i,ppm_z=min(tips,key=lambda t:t[0].z);gap_m=2.3/ppm_z;diam_m=.9/ppm_x;rad=diam_m/(2*AU);center=tip+down*((gap_m+diam_m*.57)/AU);K,NR=16,10;v=[center+Vector((0,0,rad*1.14))];rows=[]
for j in range(1,NR):
 theta=math.pi*j/NR;row=[]
 for k in range(K):phi=2*math.pi*k/K;row.append(len(v));v.append(center+Vector((rad*math.sin(theta)*math.cos(phi),rad*math.sin(theta)*math.sin(phi),rad*1.14*math.cos(theta))))
 rows.append(row)
t=len(v);v.append(center-Vector((0,0,rad*1.14)));f=[(0,rows[0][k],rows[0][(k+1)%K])for k in range(K)]
for a,b in zip(rows,rows[1:]):f.extend((a[k],b[k],b[(k+1)%K],a[(k+1)%K])for k in range(K))
f.extend((rows[-1][k],t,rows[-1][(k+1)%K])for k in range(K));records.append(append(v,f,[True]*len(f),{'type':'detached_successor','parent_pendant':i,'lowest_selected_attachment':True,'center_world':list(center)}))
mesh=bpy.data.meshes.new('Wet correction milestone / irregular accumulation stages');mesh.from_pydata(vs,[],fs);mesh.update();mesh.materials.append(old.materials[0])
for p,sm in zip(mesh.polygons,smooth):p.use_smooth=sm
mesh.normals_split_custom_set(normals);obj.data=mesh;bpy.context.view_layer.update();assert np.array_equal(np.array([p.co for p in mesh.vertices[:cut]]),np.array([p.co for p in old.vertices[:cut]]))
phase_report={'source_sha256':SHA,'six_attachment_positions_unchanged':True,'all_non_pendant_water_vertices_and_loop_normals_preserved':True,'different_accumulation_stages_not_continuous_animation':True,'single_successor_at_lowest_selected_attachment':True,'records':records,'unchanged_lighting_materials_normal_field_pose':True};(D/'PENDANT-PHASE-VARIATION.json').write_text(json.dumps(phase_report,indent=2))
# Recompute original authored rain contacts with the final pendant-only geometry.
for c in bpy.data.collections:
 if c.name in ['Canonical sphere rain / 1 over 320 second proof','Corrected right scene / recut original rain','Wet readability / recut original rain']:c.hide_render=True
code=(R/'weather-canonical-sphere-rain-20261009-0119/preflight.py').read_text();code=code.replace("SRC=R/'weather-rounded-water-rim-milestone-20261008-2354/rounded-water-visible-rim-milestone.blend';EXPECTED='ea4f3c4833c7f9b1c4c18ac06a19721bf86e84bbc27f2426d64e31ed644c12e7'","SRC=R/'weather-right-wet-readability-crop-20261009-0238/coordinated-wet-readability-crop-candidate.blend';EXPECTED='9a7101c2dcc760555cee189f38b441887cb06c2fe97e7db0cb85e6ae1f63640e'").replace("bpy.ops.wm.open_mainfile(filepath=str(SRC));s=bpy.context.scene;","s=bpy.context.scene;");exec(compile(code,str(D/'recompute_rain.py'),'exec'),{'__file__':str(D/'recompute_rain.py'),'__name__':'__rain__'});gc.collect();code=(Q/'build_selected_lookdev.py').read_text();a=code.index("records=json.loads((D/'FRESH-TRAJECTORY-RECORDS.json')");b=code.index('# Protect every other source',a);code=code[a:b].replace("'Corrected right scene / recut original rain'","'Final wet correction / recut original rain'").replace("'Corrected right rain / drop %04d'","'Final wet correction rain / drop %04d'");exec(compile(code,str(D/'build_final_rain.py'),'exec'),globals());(D/'FRESH-TRAJECTORY-RECORDS.json').write_text(json.dumps(records,indent=2));s.frame_set(49);bpy.context.view_layer.update();after=snap(bpy,original);aa=copy.deepcopy(after);bb=copy.deepcopy(before)
# The one permitted existing object's data link and original-rain visibility.
aa['objects'][obj.name]['data']=bb['objects'][obj.name]['data']
aa['objects'][obj.name]['properties']['dimensions']=bb['objects'][obj.name]['properties']['dimensions']
aa['objects'][obj.name]['properties']['bound_box']=bb['objects'][obj.name]['properties']['bound_box']
for state in [aa,bb]:state['collections']['Wet readability / recut original rain']['properties']['hide_render']=True
(D/'PROTECTED-HASHES.json').write_text(json.dumps({'before':hashes(bb),'after':hashes(aa)},indent=2))
if aa!=bb:
 diffs=[]
 def diff(a,b,path=''):
  if type(a)!=type(b):diffs.append([path,str(a)[:200],str(b)[:200]]);return
  if isinstance(a,dict):
   for k in sorted(set(a)|set(b)):
    if k not in a or k not in b:diffs.append([path+'/'+k,k in a,k in b])
    else:diff(a[k],b[k],path+'/'+k)
  elif isinstance(a,(list,tuple)):
   if len(a)!=len(b):diffs.append([path,'length',len(a),len(b)])
   else:
    for i,(x,y)in enumerate(zip(a,b)):diff(x,y,path+'/'+str(i))
  elif a!=b:diffs.append([path,a,b])
 diff(bb,aa);(D/'PROTECTED-DIFFERENCES.json').write_text(json.dumps(diffs,indent=2));print('DIFFERENCES',diffs[:12],flush=True);raise AssertionError('Changes exceeded pendant variation')
expected=hashes(after);bpy.ops.wm.save_as_mainfile(filepath=str(OUT),compress=True);sha=H(OUT);bpy.ops.wm.open_mainfile(filepath=str(OUT));bpy.context.scene.frame_set(49);bpy.context.view_layer.update();assert hashes(snap(bpy,original))==expected;assert H(SRC)==SHA
report={'source':str(SRC),'source_sha256':SHA,'candidate':str(OUT),'candidate_sha256':sha,'original_datablock_names':original,'saved_state_hashes':expected,'only_pendant_stages_and_one_successor_changed':True,'lighting_materials_World_fine_field_pose_exact':True,'protected_state_and_reopen_passed':True,'pendant_report':'PENDANT-PHASE-VARIATION.json','rain_spheres':len(moving),'rain_status_counts':audit['status_counts'],'no_DOF_or_stronger_rain':True,'render_plan':'One full900x600/512 proof, raw/color/guided, then review and Library persistence','not_rendered':True};(D/'BUILD-MANIFEST.json').write_text(json.dumps(report,indent=2));print('FINAL_CORRECTION_MASTER_SAVED',sha,flush=True)
