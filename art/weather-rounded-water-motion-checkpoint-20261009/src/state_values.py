"""Exact read-only RNA serializers from the established state guard."""

def val(x):
    if isinstance(x, (str, int, float, bool)) or x is None:
        return x
    try:
        return [val(q) for q in x]
    except TypeError:
        return str(x)

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
