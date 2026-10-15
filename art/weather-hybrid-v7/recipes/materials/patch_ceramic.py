#!/usr/bin/env python3
"""Copy-only warm satin ceramic and charcoal eye material patch. No geometry/light edits."""
import argparse,hashlib,json,sys,copy
from pathlib import Path
BODY='BallBody / one original spherical actor'
MATERIAL='Ball / ivory ceramic F2E9DD'
EYES='Original charcoal eyes / 252B38'
GROUP='__unused_no_groups_created__'
PREFIX='Ceramic v2 / '
EXPECTED_SOURCE='c8353c35af9ec4eb9d8b93ba268a5d5290f01cfee877890995cbb0874c0b7f28'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def require(c,m):
 if not c:raise RuntimeError(m)
def val(x):
    if isinstance(x, (str, int, float, bool)) or x is None:
        return x
    try:
        return [val(q) for q in x]
    except TypeError:
        return str(x)


def original_material_signature(m):
    """Exact serializer used by the established source manifest, for preflight."""
    nodes = []
    for n in m.node_tree.nodes:
        d = {'name': n.name, 'type': n.bl_idname,
             'inputs': [[i.identifier, val(i.default_value)] for i in n.inputs if hasattr(i, 'default_value')]}
        for k in ['operation', 'blend_type', 'space', 'uv_map', 'attribute_name', 'attribute_type',
                  'noise_dimensions', 'normalize', 'interpolation', 'extension', 'projection']:
            if hasattr(n, k):
                d[k] = val(getattr(n, k))
        if hasattr(n, 'image'):
            d['image'] = n.image.name if n.image else None
        if hasattr(n, 'color_ramp'):
            d['ramp'] = [[e.position, list(e.color)] for e in n.color_ramp.elements]
        nodes.append(d)
    links = sorted((l.from_node.name, l.from_socket.identifier, l.to_node.name, l.to_socket.identifier)
                   for l in m.node_tree.links)
    return hashlib.sha256(json.dumps({'nodes': nodes, 'links': links}, sort_keys=True).encode()).hexdigest()


def mesh_hash(m):
    import numpy as np
    co = np.empty((len(m.vertices), 3), np.float32)
    m.vertices.foreach_get('co', co.ravel())
    indices = np.empty(len(m.loops), np.int32)
    m.loops.foreach_get('vertex_index', indices)
    return hashlib.sha256(co.tobytes() + indices.tobytes()).hexdigest()


def rna_values(owner):
    out = {}
    for prop in owner.bl_rna.properties:
        if prop.identifier in {'rna_type','session_uid'}:
            continue
        if prop.type in {'BOOLEAN', 'INT', 'FLOAT', 'STRING', 'ENUM'}:
            try:
                out[prop.identifier] = val(getattr(owner, prop.identifier))
            except (AttributeError, TypeError):
                pass
    return out


def graph_state(tree, excluded=()):
    skip = set(excluded)
    nodes = {}
    for n in tree.nodes:
        if n.name in skip:
            continue
        row = {'properties': rna_values(n),
               'inputs': [(i.identifier, val(i.default_value)) for i in n.inputs if hasattr(i, 'default_value')],
               'outputs': [(i.identifier, val(i.default_value)) for i in n.outputs if hasattr(i, 'default_value')]}
        if hasattr(n, 'image'):
            row['image'] = n.image.name if n.image else None
        if hasattr(n, 'node_tree'):
            row['node_tree'] = n.node_tree.name if n.node_tree else None
        if hasattr(n, 'color_ramp'):
            row['ramp'] = [(e.position, val(e.color)) for e in n.color_ramp.elements]
        nodes[n.name] = row
    links = sorted((l.from_node.name, l.from_socket.identifier, l.to_node.name, l.to_socket.identifier)
                   for l in tree.links if l.from_node.name not in skip and l.to_node.name not in skip)
    return {'nodes': nodes, 'links': links}


def frozen_scene_snapshot(bpy, exclude_ball_nodes=()):
    """Read-only guards around operations that only create two nodes and a group."""
    objects = {}
    for o in bpy.data.objects:
        objects[o.name] = {'properties': rna_values(o), 'matrix_world': val(o.matrix_world),
                           'matrix_basis': val(o.matrix_basis), 'parent': o.parent.name if o.parent else None,
                           'data': o.data.name if o.data else None,
                           'modifiers': [(m.name, rna_values(m)) for m in o.modifiers],
                           'materials': [s.material.name if s.material else None for s in o.material_slots]}
    materials = {m.name: graph_state(m.node_tree, exclude_ball_nodes if m.name == MATERIAL else ())
                 for m in bpy.data.materials if m.use_nodes}
    scenes = {}
    for s in bpy.data.scenes:
        scenes[s.name] = {'scene': rna_values(s), 'render': rna_values(s.render), 'cycles': rna_values(s.cycles),
                          'display': rna_values(s.view_settings), 'camera': s.camera.name if s.camera else None,
                          'world': s.world.name if s.world else None,
                          'compositor': graph_state(s.node_tree) if s.use_nodes else None}
    return {
        'objects': objects,
        'meshes': {m.name: mesh_hash(m) for m in bpy.data.meshes},
        'materials': materials,
        'worlds': {w.name: graph_state(w.node_tree) for w in bpy.data.worlds if w.use_nodes},
        'node_groups': {g.name: graph_state(g) for g in bpy.data.node_groups if g.name != GROUP},
        'cameras': {c.name: {'camera': rna_values(c), 'dof': rna_values(c.dof)} for c in bpy.data.cameras},
        'lights': {l.name: rna_values(l) for l in bpy.data.lights},
        'collections': {c.name: {'properties': rna_values(c), 'objects': sorted(o.name for o in c.objects)}
                        for c in bpy.data.collections},
        'images': {im.name: {'path': im.filepath, 'size': val(im.size), 'colorspace': im.colorspace_settings.name,
                             'packed_sha256': hashlib.sha256(bytes(im.packed_file.data)).hexdigest() if im.packed_file else None}
                   for im in bpy.data.images},
        'scenes': scenes,
    }



def protected_snapshot(bpy):
 snap=frozen_scene_snapshot(bpy)
 for k in (MATERIAL,EYES):snap['materials'].pop(k)
 # Include curve geometry, which is untouched by this material-only patch.
 snap['curves']={c.name:{'properties':rna_values(c),'splines':[[val(p.co) for p in s.points] for s in c.splines]} for c in bpy.data.curves}
 return snap

def patch(bpy):
 m=bpy.data.materials[MATERIAL];t=m.node_tree;n=t.nodes;l=t.links;p=n['Principled BSDF']
 require(not any(x.name.startswith(PREFIX) for x in n),'Patch already present')
 # Warm ivory substrate, with nonmetallic energy-conserving ceramic BRDF.
 p.inputs['Base Color'].default_value=(.76,.72,.65,1)
 p.inputs['Roughness'].default_value=.34
 p.inputs['Coat Weight'].default_value=.38
 p.inputs['Coat Roughness'].default_value=.21
 p.inputs['Coat IOR'].default_value=1.47
 # Restore a resolved but low-height satin microstructure to the substrate.
 noise=n['Noise Texture'];noise.inputs['Scale'].default_value=42
 noise.inputs['Detail'].default_value=1.5;noise.inputs['Roughness'].default_value=.56
 bump=n['Bump'];bump.inputs['Strength'].default_value=.40;bump.inputs['Distance'].default_value=.006
 def node(typ,name):
  q=n.new(typ);q.name=PREFIX+name;return q
 def remap(name,src,lo,hi,a,b):
  q=node('ShaderNodeMapRange',name);q.clamp=True;q.interpolation_type='SMOOTHERSTEP'
  q.inputs['From Min'].default_value=lo;q.inputs['From Max'].default_value=hi
  q.inputs['To Min'].default_value=a;q.inputs['To Max'].default_value=b
  l.new(src,q.inputs['Value']);return q.outputs['Result']
 coord=n['Texture Coordinate'].outputs['Object']
 wet=node('ShaderNodeTexNoise','continuous sparse wetting');wet.inputs['Scale'].default_value=7.5
 wet.inputs['Detail'].default_value=2;wet.inputs['Roughness'].default_value=.58;l.new(coord,wet.inputs['Vector'])
 coverage=remap('wet domains 0 to 1',wet.outputs['Fac'],.56,.70,0,1)
 l.new(remap('satin to locally wet coat',coverage,0,1,.21,.065),p.inputs['Coat Roughness'])
 l.new(remap('thin glaze to wet film',coverage,0,1,.38,.82),p.inputs['Coat Weight'])
 # Glaze follows the same coherent surface at much lower amplitude than substrate.
 cb=node('ShaderNodeBump','glaze relief');cb.inputs['Strength'].default_value=.22;cb.inputs['Distance'].default_value=.003
 l.new(noise.outputs['Fac'],cb.inputs['Height']);l.new(cb.outputs['Normal'],p.inputs['Coat Normal'])
 l.new(remap('ceramic satin roughness',noise.outputs['Fac'],.22,.78,.29,.4),p.inputs['Roughness'])
 # Weak ivory firing variation follows the same microstructure, avoiding dirt or painted spots.
 grain=remap('subtle ivory firing variance',noise.outputs['Fac'],.2,.8,.92,1.02)
 tint=node('ShaderNodeMixRGB','ivory substrate');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[1].default_value=(.76,.72,.65,1);l.new(grain,tint.inputs[2]);l.new(tint.outputs['Color'],p.inputs['Base Color'])
 # Dark physical charcoal eyes retain both meshes and every contour/modifier.
 e=bpy.data.materials[EYES];et=e.node_tree;ep=et.nodes['Principled BSDF']
 ep.inputs['Base Color'].default_value=(.008,.012,.019,1);ep.inputs['Roughness'].default_value=.31;ep.inputs['Specular IOR Level'].default_value=.22
 ep.inputs['Coat Weight'].default_value=0;ep.inputs['Coat Roughness'].default_value=.16;ep.inputs['Coat IOR'].default_value=1.47
 bev=et.nodes.new('ShaderNodeBevel');bev.name=PREFIX+'soft charcoal edge normal';bev.samples=4;bev.inputs['Radius'].default_value=.006
 et.links.new(bev.outputs['Normal'],ep.inputs['Normal']);et.links.new(bev.outputs['Normal'],ep.inputs['Coat Normal'])
 return {'allowlist':[MATERIAL,EYES],'base_linear_RGB':[.76,.72,.65],'substrate_roughness_range':[.29,.40],'coat_weight_range':[.38,.82],'coat_roughness_range':[.065,.21],'body_noise_scale':42,'ivory_color_multiplication_range':[.92,1.02],'body_bump_strength':.4,'body_bump_distance_m':.006,'coat_bump_strength':.22,'coat_bump_distance_m':.003,'eye_linear_RGB':[.008,.012,.019],'eye_roughness':.31,'eye_specular_IOR_level':.22,'eye_coat_weight':0,'eye_coat_roughness':.16,'eye_shader_bevel_m':.006,'scope':'Only shader graphs on original body and original eyes. No mesh, silhouette, pose, camera, plate, World, canopy, ground, beads, lights, compositing or render setting edits.'}

def main():
 a=argparse.ArgumentParser();a.add_argument('--apply',action='store_true');a.add_argument('--source');a.add_argument('--expected-source-sha256');a.add_argument('--output');q=a.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:])
 if not q.apply:print(json.dumps({'disabled_by_default':True,'scope':'Original Ball/eye material graphs only; copy-only; requires explicit source hash/output'}));return
 require(q.source and q.expected_source_sha256 and q.output,'Require explicit source/hash/output')
 src=Path(q.source).resolve();out=Path(q.output).resolve();require(src!=out and not out.exists(),'Distinct unused output required')
 require(sha(src)==q.expected_source_sha256,'Source SHA mismatch')
 import bpy
 require(tuple(bpy.app.version)==(4,3,2),'Blender4.3.2 required');bpy.ops.wm.open_mainfile(filepath=str(src))
 # Source contract locks baseline shader; geometry guard below prevents identity drift.
 require(original_material_signature(bpy.data.materials[MATERIAL])=='8f9191919b4aaaebf41509799c146d8bee6656245e8e9313c62ffb4dff3210fc','Unexpected Ball source material')
 users={k:sorted(o.name for o in bpy.data.objects if any(s.material and s.material.name==k for s in o.material_slots)) for k in (MATERIAL,EYES)}
 require(users[MATERIAL]==[BODY],'Body material unexpected user')
 require(users[EYES]==['LeftEye / original 48-point contour','RightEye / original 48-point contour'],'Eye material unexpected users')
 orphan_images=[im.name for im in bpy.data.images if im.users==0 and not im.use_fake_user]
 before=protected_snapshot(bpy);before_hash=hashlib.sha256(json.dumps(before,sort_keys=True).encode()).hexdigest()
 data=patch(bpy);bpy.context.view_layer.update();after=protected_snapshot(bpy);require(before==after,'State changed outside two allowed material graphs')
 meshes={k:mesh_hash(bpy.data.objects[k].data) for k in [BODY,'LeftEye / original 48-point contour','RightEye / original 48-point contour']}
 bpy.ops.wm.save_as_mainfile(filepath=str(out),copy=True,compress=True)
 require(sha(src)==q.expected_source_sha256,'Source changed')
 data.update(source=str(src),source_sha256=q.expected_source_sha256,output=str(out),output_sha256=sha(out),script_sha256=sha(__file__),source_unchanged=True,protected_state_sha256=before_hash,unchanged_mesh_hashes=meshes,protected_state_unchanged=True)
 # Actual saved-copy reopen check using the same protected-state representation.
 bpy.ops.wm.open_mainfile(filepath=str(out));reopened=protected_snapshot(bpy)
 persistent_before=copy.deepcopy(before)
 for name in orphan_images:
  persistent_before['images'].pop(name,None);reopened['images'].pop(name,None)
 require(reopened==persistent_before,'Saved copy protected-state mismatch')
 data['Blender_automatic_unsaved_zero_user_images']=orphan_images
 data['reopen_comparison_excludes_session_uid']=True
 data['saved_copy_reopened_and_protected_state_verified']=True
 out.with_suffix('.material-manifest.json').write_text(json.dumps(data,indent=2));print(json.dumps(data,indent=2))
if __name__=='__main__':main()
