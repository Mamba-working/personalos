"""Read-only, one bounded shared flag placement. No scene edits or beauty render."""
import numpy as np,json
from pathlib import Path
D=Path(__file__).parent
q=np.load(D/'VISIBLE-SHAFT-GEOMETRY-DRAFT.npz');s=q['shaft_vertices'];st=q['shaft_triangles'];foot=s[:10].mean(0);top=s[10:20].mean(0);axis=top-foot;axis/=np.linalg.norm(axis);CM=q['camera'];O=CM[:3,3];F=-CM[:3,2];U=CM[:3,1];R=CM[:3,0]
def norm(x):return x/np.linalg.norm(x,axis=-1,keepdims=True)
def project(x):
 p=x-O;return np.stack([450+1325*(p@R)/(p@F),300-1325*(p@U)/(p@F)],-1)
def rowp(y):
 z=300-y;t=((foot-O)@(1325*U-z*F))/((z*F-1325*U)@axis);return foot+t*axis
lo=rowp(390);hi=rowp(215);M=(lo+hi)/2;V=norm(O-M);N0=norm(V-(V@axis)*axis);right=np.cross(axis,N0);right*=np.sign(right@R);N25=np.cos(np.deg2rad(25))*N0+np.sin(np.deg2rad(25))*right;direction=norm(2*(N25@V)*N25-V);centre=M+.6*direction;normal=norm(direction-(direction@axis)*axis);short=norm(np.cross(axis,normal));height=np.linalg.norm(hi-lo)+.4;width=1.2
corners=np.array([centre-axis*height/2-short*width/2,centre-axis*height/2+short*width/2,centre+axis*height/2+short*width/2,centre+axis*height/2-short*width/2])
# Clip the same plane polygon to z >= .05 world ground clearance.
uncut_corners=corners.copy();clearance_z=.05
clipped=[]
for p0,p1 in zip(corners,np.roll(corners,-1,axis=0)):
 inside0=p0[2]>=clearance_z;inside1=p1[2]>=clearance_z
 if inside0:clipped.append(p0)
 if inside0!=inside1:clipped.append(p0+(p1-p0)*(clearance_z-p0[2])/(p1[2]-p0[2]))
corners=np.array(clipped)
# Polygon order above has face normal short x axis = normal.
def hits(pos,direction,maxdistance=np.inf):
 den=direction@normal
 with np.errstate(divide='ignore',invalid='ignore'):t=((centre-pos)@normal)/den
 p=pos+t[...,None]*direction-centre
 h=(t>1e-7)&(t<maxdistance)&(np.abs(p@axis)<=height/2)&(np.abs(p@short)<=width/2)&(np.abs(den)>1e-12)&(pos[...,2]+t*direction[...,2]>=clearance_z)
 return h,t,p
az=np.deg2rad(-84.6);el=np.deg2rad(25.5);key=np.array([np.cos(el)*np.sin(az),np.cos(el)*np.cos(az),np.sin(el)])
# Exact evaluated mesh intersections, smoothly interpolated radial normals.
A=s[st[:,0]];E1=s[st[:,1]]-A;E2=s[st[:,2]]-A
shaftrows=[];shaft_samples=[]
for y in [250,275,300,325]:
 _,x0,x1,_=q['visibility_rows'][q['visibility_rows'][:,0]==y][0];xs=np.arange(x0+1/128,x1,1/64);ray=norm(F+R*(xs[:,None]-450)/1325+U*(300-y-.5)/1325)
 H=np.cross(ray[:,None,:],E2);det=np.einsum('tj,ntj->nt',E1,H);inv=np.divide(1,det,out=np.zeros_like(det),where=np.abs(det)>1e-12);S=O-A;u=inv*np.einsum('tj,ntj->nt',S,H);Q=np.cross(S,E1);v=inv*np.einsum('nj,tj->nt',ray,Q);t=inv*np.einsum('tj,tj->t',E2,Q)[None,:];t=np.where((u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)&(t>0),t,np.inf);ti=t.argmin(1);distance=t[np.arange(len(xs)),ti];good=np.isfinite(distance);xs=xs[good];ray=ray[good];pos=O+distance[good,None]*ray;nn=norm(pos-foot-((pos-foot)@axis)[:,None]*axis);vv=-ray;reflect=norm(2*(nn*vv).sum(1)[:,None]*nn-vv);hit,ht,_=hits(pos,reflect);blocked,_,_=hits(pos,np.broadcast_to(key,pos.shape));angle=np.degrees(np.arctan2(nn@right,nn@N0));shaftrows.append({'y':y,'visible_width_px':x1-x0,'sample_count':len(xs),'blocked_perfect_reflection_fraction':float(hit.mean()),'blocked_reflection_x_minmax':([float(xs[hit].min()),float(xs[hit].max())] if hit.any() else None),'blocked_normal_angle_minmax_deg':([float(angle[hit].min()),float(angle[hit].max())] if hit.any() else None),'blocked_reflection_shaft_width_fraction_minmax':([float(((xs-x0)/(x1-x0))[hit].min()),float(((xs-x0)/(x1-x0))[hit].max())] if hit.any() else None),'warm_key_blocked_count':int(blocked.sum()),'direct_key_facing_fraction':float((nn@key>0).mean())});shaft_samples.append((xs,pos,nn,vv,hit))
roof=np.load(D/'CONTINUOUS-ROOF-REFLECTION-NATIVE-RAYS.npz');dr=np.load(D/'CONTINUOUS-ROOF-REFLECTION-DIRECTIONS.npz');reach=np.load(D/'CONTINUOUS-LOWER-CARD-REACH.npz');rp=roof['positions'];valid=dr['valid'];refl=dr['reflections'];roothit,_,_=hits(rp,refl);rh=roothit&valid;kr,_,_=hits(rp,np.broadcast_to(key,rp.shape));kr&=valid
rrp=rp[:,0];rtarget=reach['crossing'];rtodelta=rtarget-rrp;rtdist=np.linalg.norm(rtodelta,axis=1);rtodir=norm(rtodelta);ch,_,_=hits(rrp,rtodir,rtdist);cardvalid=reach['inner']&reach['geometric_hit'];reachable=cardvalid&((reach['status']==1)|(reach['status']==2))
ball=np.load(D/'CONTINUOUS-BALL-EXACT-GEOMETRY.npz');bp=q['Ball_vertices'];bn=ball['normals'];bv=norm(O-bp);bvis=(bn*bv).sum(1)>0;br=norm(2*(bn*bv).sum(1)[:,None]*bn-bv);bh,_,_=hits(bp,br);bkey,_,_=hits(bp,np.broadcast_to(key,bp.shape));bkeyfront=(bn@key)>0
# Visible-Ball dense raster probes from previous cache, translated to exact current geometry.
be=np.load(D/'CONTINUOUS-BALL-EXPOSURE-ANALYTIC.npz');bshift=np.mean(bp-ball['vertices'],axis=0);bep=be['positions']+bshift;ben=be['normals'];bev=norm(O-bep);ber=norm(2*(ben*bev).sum(1)[:,None]*ben-bev);beh,_,_=hits(bep,ber);bek,_,_=hits(bep,np.broadcast_to(key,bep.shape))
# Sample card segments to Ball hemisphere using fixed quadrature, not an optimization.
nx=40;ny=68;cx=1.3+(np.arange(nx)+.5)/nx*2.5;cy=2.4+(np.arange(ny)+.5)/ny*4.3;XX,YY=np.meshgrid(cx,cy);cp=np.stack([XX.ravel(),YY.ravel(),np.full(XX.size,.2)],1);cw=(np.sin(np.pi*(XX-1.3)/2.5)**2*np.sin(np.pi*(YY-2.4)/4.3)**2).ravel();ball_card_total=0.;ball_card_blocked=0.;ball_any_block=0
for p,n in zip(bep,ben):
 delta=cp-p;dst=np.linalg.norm(delta,axis=1);di=delta/dst[:,None];mask,_,_=hits(np.broadcast_to(p,di.shape),di,dst);weight=np.maximum(di@n,0)*np.maximum(-di[:,2],0)/dst**2*cw;ball_card_total+=weight.sum();ball_card_blocked+=weight[mask].sum();ball_any_block+=int(np.any(mask& (weight>0)))
report={'basis':'One placement only. Exposed shaft axial span at master y=215..390, midpoint in world. 0.6 world offset along +25deg visible-right normal perfect reflection; width 1.2 = 2*.6*tan(45deg), then same plane clipped at world z=.05; long axis parallel shaft; exposed axial length + .4 world margin. No optimization or scene changes.', 'geometry_source':'VISIBLE-SHAFT-GEOMETRY-DRAFT.npz','centre':centre.tolist(),'normal_outward':normal.tolist(),'long_axis':axis.tolist(),'short_axis':short.tolist(),'width':width,'height':height,'corners_ordered':corners.tolist(),'shaft_midpoint':M.tolist(),'midshaft_view':V.tolist(),'view_facing_cylinder_normal':N0.tolist(),'visible_right_tangent':right.tolist(),'target_normal_25deg':N25.tolist(),'target_reflection_direction':direction.tolist(),'untrimmed_rectangle_corners':uncut_corners.tolist(),'ground_clearance_clip_z':clearance_z,'world_bbox':[corners.min(0).tolist(),corners.max(0).tolist()],'camera_projected_corners':project(corners).tolist(),'shaft_rows':shaftrows,'roof_cached_rays':{'caveat':'Prior continuous-relief geometry, same broad shape; half-scale roof microrelief differs. No new Blender ray trace.','valid_interface_count':int(valid.sum()),'flag_perfect_reflection_hits':int(rh.sum()),'hit_interfaces_by_index':rh.sum(0).tolist(),'hit_pixels':int(rh.any(1).sum()),'first_interface_hit_pixels':int(rh[:,0].sum()),'warm_key_blocked_interfaces':int(kr.sum()),'warm_key_blocked_first_interfaces':int(kr[:,0].sum()),'card_geometric_reach_pixels':int(cardvalid.sum()),'card_segments_intercepted_all':int((ch&cardvalid).sum()),'card_current_reachable_pixels':int(reachable.sum()),'card_segments_intercepted_current_reachable':int((ch&reachable).sum()),'card_relevant_segment_min_y':float(np.nanmin(np.minimum(rrp[cardvalid,1],rtarget[cardvalid,1]))),'flag_max_y':float(corners[:,1].max())},'Ball':{'exact_applied_shift':bshift.tolist(),'vertex_count':len(bp),'visible_vertex_count':int(bvis.sum()),'visible_vertex_perfect_reflection_flag_hits':int((bh&bvis).sum()),'warm_key_blocked_all_vertices':int(bkey.sum()),'warm_key_blocked_key_facing_vertices':int((bkey&bkeyfront).sum()),'cached_visible_raster_sample_count':len(bep),'raster_perfect_reflection_hits':int(beh.sum()),'raster_warm_key_blocked_count':int(bek.sum()),'card_direct_irradiance_quadrature_blocked_fraction':ball_card_blocked/ball_card_total,'card_nonzero_block_raster_points':ball_any_block},'render_required':'A satin/GGX roughness .22 response is not identical to perfect-reflection ray hits. Need the planned native crop to verify final dark-band strength; this calculation cannot prove appearance.'}
(D/'SHARED-METAL-FLAG-WIDE-PLACEMENT.json').write_text(json.dumps(report,indent=2));np.savez_compressed(D/'SHARED-METAL-FLAG-WIDE-PLACEMENT.npz',centre=centre,normal=normal,long_axis=axis,short_axis=short,width=width,height=height,corners=corners)
print(json.dumps(report,indent=2))
