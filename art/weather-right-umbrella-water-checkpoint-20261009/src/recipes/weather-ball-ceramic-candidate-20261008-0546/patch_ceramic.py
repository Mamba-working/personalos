"""Exact read-only snapshot helper closure; no material patch or scene builder."""
import hashlib,json
MATERIAL="Ball / ivory ceramic F2E9DD"
GROUP="__unused_no_groups_created__"

def val(x):
    if isinstance(x, (str, int, float, bool)) or x is None:
        return x
    try:
        return [val(q) for q in x]
    except TypeError:
        return str(x)

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
