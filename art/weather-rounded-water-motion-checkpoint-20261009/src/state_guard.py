"""Read-only protected-state audit helpers; no material patch is included."""
import hashlib,json
import state_values
def load_helpers():
    return state_values

def snapshot(bpy):
    """Meaningful deterministic scene state, not session IDs or saved file paths."""
    import numpy as np
    h = load_helpers()

    def array_hash(collection, attribute, width, dtype):
        data = np.empty(len(collection)*width, dtype=dtype)
        collection.foreach_get(attribute, data)
        return hashlib.sha256(data.tobytes()).hexdigest()

    def canonical(ob):
        return canonical(ob.parent) @ ob.matrix_parent_inverse @ ob.matrix_basis if ob.parent else ob.matrix_basis.copy()

    def mesh_state(m):
        return {
            'counts': [len(m.vertices), len(m.edges), len(m.loops), len(m.polygons)],
            'positions': array_hash(m.vertices, 'co', 3, np.float32),
            'edges': array_hash(m.edges, 'vertices', 2, np.int32),
            'loop_indices': array_hash(m.loops, 'vertex_index', 1, np.int32),
            'polygon_loop_start': array_hash(m.polygons, 'loop_start', 1, np.int32),
            'polygon_loop_total': array_hash(m.polygons, 'loop_total', 1, np.int32),
            'polygon_material': array_hash(m.polygons, 'material_index', 1, np.int32),
            'polygon_smooth': array_hash(m.polygons, 'use_smooth', 1, np.bool_),
            'uv': {u.name: array_hash(u.data, 'uv', 2, np.float32) for u in m.uv_layers},
            'corner_normals': array_hash(m.corner_normals, 'vector', 3, np.float32),
            'materials': [m.name if m else None for m in m.materials],
        }

    s = bpy.context.scene
    result = {
        'objects': {
            o.name: {
                'canonical_world': list(map(list, canonical(o))),
                'basis': list(map(list, o.matrix_basis)),
                'parent_inverse': list(map(list, o.matrix_parent_inverse)),
                'parent': o.parent.name if o.parent else None,
                'data': o.data.name if o.data else None,
                'type': o.type,
                'materials': [(sl.link, sl.material.name if sl.material else None) for sl in o.material_slots],
                'visibility': {k: getattr(o, k) for k in ['hide_render', 'hide_viewport', 'visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow', 'is_shadow_catcher']},
                'modifiers': [(m.name, h.rna_values(m)) for m in o.modifiers],
                'constraints': [(c.name, h.rna_values(c)) for c in o.constraints],
                'custom_properties': {k: h.val(v) for k, v in o.items()},
            } for o in bpy.data.objects
        },
        'meshes': {m.name: mesh_state(m) for m in bpy.data.meshes},
        'curves': {m.name: {'properties': h.rna_values(m), 'splines': [{'properties': h.rna_values(sp), 'points': [[list(p.co), p.radius, p.tilt, p.weight] for p in sp.points], 'bezier': [[list(p.co), list(p.handle_left), list(p.handle_right), p.radius, p.tilt] for p in sp.bezier_points]} for sp in m.splines]} for m in bpy.data.curves},
        'materials': {m.name: {'graph': h.graph_state(m.node_tree) if m.use_nodes else None, 'properties': h.rna_values(m)} for m in bpy.data.materials},
        'worlds': {w.name: h.graph_state(w.node_tree) for w in bpy.data.worlds if w.use_nodes},
        'node_groups': {g.name: h.graph_state(g) for g in bpy.data.node_groups},
        'cameras': {c.name: {'data': h.rna_values(c), 'dof': h.rna_values(c.dof)} for c in bpy.data.cameras},
        'lights': {l.name: h.rna_values(l) for l in bpy.data.lights},
        'render': h.rna_values(s.render),
        'cycles': h.rna_values(s.cycles),
        'display': h.rna_values(s.view_settings),
        'units': h.rna_values(s.unit_settings),
        'compositor': h.graph_state(s.node_tree),
        'scene_bindings': {'camera': s.camera.name if s.camera else None, 'world': s.world.name if s.world else None, 'frame': s.frame_current, 'frame_subframe': s.frame_subframe},
        'view_layers': {v.name: {'properties': h.rna_values(v), 'cycles': h.rna_values(v.cycles)} for v in s.view_layers},
        'images': {im.name: {'path': im.filepath, 'size': list(im.size), 'colorspace': im.colorspace_settings.name, 'packed': hashlib.sha256(bytes(im.packed_file.data)).hexdigest() if im.packed_file else None} for im in bpy.data.images},
        'collections': {c.name: {'hide_render': c.hide_render, 'hide_viewport': c.hide_viewport, 'objects': sorted(o.name for o in c.objects)} for c in bpy.data.collections},
    }
    return json.loads(json.dumps(result))

def differences(a, b, path=()):
    if type(a) != type(b):
        return [{'path': list(path), 'before': a, 'after': b}]
    if isinstance(a, dict):
        assert a.keys() == b.keys(), ('Changed state keys', path, a.keys() ^ b.keys())
        return [d for k in a for d in differences(a[k], b[k], path+(k,))]
    if isinstance(a, list):
        assert len(a) == len(b), ('Changed list length', path)
        return [d for i in range(len(a)) for d in differences(a[i], b[i], path+(i,))]
    return [] if a == b else [{'path': list(path), 'before': a, 'after': b}]
