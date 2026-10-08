"""One material-only clear wet film + neutral reflective frame candidate.

API: apply_clear_wet_canopy(scene) -> JSON-serializable report.
Import has no scene effects. This module never opens/saves/renders a file, changes
lighting, changes ray visibility, or changes geometry. Invoke once on reopened
hybrid v4 (or v3, which has the same relevant source materials).
"""
import hashlib
import bpy

CANOPY = 'UmbrellaCanopy / continuous curved 8-panel membrane'
HEM = 'Continuous fine canopy hem'
PREFIX = 'Hybrid clear wet canopy / '
SOURCE_SHA256_V4 = 'c8353c35af9ec4eb9d8b93ba268a5d5290f01cfee877890995cbb0874c0b7f28'


def _state(scene):
    # Identity, geometry data and every transform are protected; the patch only
    # copies/assigns materials. Full material/mesh hashes can be added by caller.
    return {
        o.name: (o.as_pointer(), o.data.as_pointer() if o.data else None,
                 tuple(tuple(r) for r in o.matrix_world), o.hide_render,
                 tuple((m.name, m.type) for m in o.modifiers))
        for o in scene.objects
    }


def _slots(o):
    return tuple((s.link, s.material.as_pointer() if s.material else None)
                 for s in o.material_slots)


def _output(mat):
    return next(n for n in mat.node_tree.nodes
                if n.type == 'OUTPUT_MATERIAL' and n.is_active_output)


def _glass(mat, roughness, ior):
    n = mat.node_tree.nodes.new('ShaderNodeBsdfGlass')
    n.name = PREFIX + 'physical Fresnel dielectric'
    n.distribution = 'GGX'
    n.inputs['Color'].default_value = (1, 1, 1, 1)
    n.inputs['Roughness'].default_value = roughness
    n.inputs['IOR'].default_value = ior
    out = _output(mat)
    assert not out.inputs['Volume'].is_linked, 'Unexpected canopy volume'
    for link in list(out.inputs['Surface'].links):
        mat.node_tree.links.remove(link)
    mat.node_tree.links.new(n.outputs[0], out.inputs['Surface'])
    return n


def _fresh_glass(name, roughness, ior):
    m = bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    m.node_tree.nodes.remove(m.node_tree.nodes.get('Principled BSDF'))
    _glass(m, roughness, ior)
    return m


def _override(o, material):
    assert len(o.material_slots) == 1, ('Unexpected frame/bead slots', o.name)
    # Preserve linked cap mesh and its source material, including Ball beads.
    o.material_slots[0].link = 'OBJECT'
    o.material_slots[0].material = material


def apply_clear_wet_canopy(scene):
    """Apply the single candidate in memory; caller owns saving and render QA."""
    assert not any(m.name.startswith(PREFIX) for m in bpy.data.materials), \
        'Reopen the frozen source before applying this patch again'
    can = scene.objects[CANOPY]
    assert can.type == 'MESH' and len(can.data.materials) == 3
    source = list(can.data.materials)
    assert 'smooth-inner-normal' in source[1].name
    so = next(m for m in can.modifiers if m.type == 'SOLIDIFY')
    assert abs(so.thickness - .00065) < 1e-8
    assert so.material_offset == 1 and so.material_offset_rim == 2
    assert 'CanopyWetness_ProjectedXY_v1' in can.data.uv_layers
    for mat in source:
        assert abs(mat.node_tree.nodes['Principled BSDF'].inputs['IOR'].default_value - 1.38) < 1e-6
        assert not _output(mat).inputs['Volume'].is_linked
    outer = source[0]
    for name in ('Verified water-drop opacity', 'Map Range', 'Map Range.001',
                 'CanopyWetness / runtime recreatable'):
        assert name in outer.node_tree.nodes, ('Missing registered film node', name)

    frame = [o for o in scene.objects if o.name.startswith(
        ('Canopy rib ', 'Canopy support strut ', 'Canopy ferrule', 'Umbrella shaft /'))]
    assert len(frame) == 18, ('Expected eight ribs/eight struts/ferrule/shaft', len(frame))
    beads = [o for o in scene.objects if o.name.startswith(
        ('Canopy attached drop ', 'Attached hanging rim drop '))]
    assert len(beads) == 114, ('Expected 108 canopy caps and six hanging drops', len(beads))
    hem = scene.objects[HEM]
    for o in frame + beads + [hem]:
        assert len(o.material_slots) == 1
    changed_names = {CANOPY, HEM} | {o.name for o in frame + beads}
    before = _state(scene)
    untouched_slots = {o.name: _slots(o) for o in scene.objects if o.name not in changed_names}
    modifier_before = (so.thickness, so.offset, so.material_offset, so.material_offset_rim)

    # Only the outside shell carries localized water relief. Clear gaps and the
    # sheltered inside are smooth real glass closures, never transparent BSDFs.
    new_film = []
    for i, src in enumerate(source):
        mat = src.copy()
        mat.name = PREFIX + ('outer localized wet film', 'smooth inner film', 'thin clear edge')[i]
        glass = _glass(mat, 0.0 if i < 2 else .012, 1.38)
        if i == 0:
            nodes, links = mat.node_tree.nodes, mat.node_tree.links
            support = nodes.new('ShaderNodeMapRange')
            support.name = PREFIX + 'localized water support, not opacity'
            support.interpolation_type = 'SMOOTHERSTEP'
            support.clamp = True
            for k, v in [('From Min', .08), ('From Max', .22), ('To Min', 0), ('To Max', 1)]:
                support.inputs[k].default_value = v
            links.new(nodes['Verified water-drop opacity'].outputs['Color'], support.inputs['Value'])
            height = nodes.new('ShaderNodeMath')
            height.name = PREFIX + 'supported physical bead height'
            height.operation = 'MULTIPLY'
            links.new(nodes['Map Range'].outputs['Result'], height.inputs[0])
            links.new(support.outputs['Result'], height.inputs[1])
            bump = nodes.new('ShaderNodeBump')
            bump.name = PREFIX + 'localized water surface relief'
            bump.inputs['Distance'].default_value = .0032
            links.new(height.outputs[0], bump.inputs['Height'])
            wet = nodes['CanopyWetness / runtime recreatable']
            links.new(wet.outputs[0], bump.inputs['Strength'])
            links.new(bump.outputs['Normal'], glass.inputs['Normal'])
            r0 = nodes.new('ShaderNodeMath')
            r0.name = PREFIX + 'localized existing roughness'
            r0.operation = 'MULTIPLY'
            links.new(nodes['Map Range.001'].outputs['Result'], r0.inputs[0])
            links.new(support.outputs['Result'], r0.inputs[1])
            r1 = nodes.new('ShaderNodeMath')
            r1.name = PREFIX + 'preserve wetness state'
            r1.operation = 'MULTIPLY'
            links.new(r0.outputs[0], r1.inputs[0])
            links.new(wet.outputs[0], r1.inputs[1])
            r2 = nodes.new('ShaderNodeMath')
            r2.name = PREFIX + 'clear water microfinish'
            r2.operation = 'MULTIPLY'
            r2.inputs[1].default_value = .30
            links.new(r1.outputs[0], r2.inputs[0])
            links.new(r2.outputs[0], glass.inputs['Roughness'])
        can.data.materials[i] = mat
        new_film.append(mat)

    # Neutral silver rather than champagne, with no diffuse metal undercoat.
    metal = bpy.data.materials.new(PREFIX + 'neutral reflective silver frame')
    metal.use_nodes = True
    p = metal.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (.56, .58, .61, 1)
    p.inputs['Metallic'].default_value = 1.0
    p.inputs['Roughness'].default_value = .14
    anisotropic = p.inputs.get('Anisotropic IOR Level') or p.inputs.get('Anisotropic')
    assert anisotropic is not None, 'Unsupported Principled anisotropic socket'
    anisotropic.default_value = .18
    p.inputs['Coat Weight'].default_value = 0.0
    for o in frame:
        _override(o, metal)

    # The existing perimeter is a physical clear seam, not a gold wire.
    seam = _fresh_glass('clear rolled perimeter seam', .018, 1.38)
    _override(hem, seam)
    # Existing resolved cap/hanging-drop shapes are retained. New material is
    # object-linked, so the Ball's shared cap mesh/material is not changed.
    water = _fresh_glass('clear resolved water caps', .009, 1.333)
    for o in beads:
        _override(o, water)

    assert _state(scene) == before, 'Unexpected object/geometry/transform mutation'
    assert modifier_before == (so.thickness, so.offset, so.material_offset, so.material_offset_rim)
    assert all(_slots(scene.objects[n]) == slots for n, slots in untouched_slots.items()), \
        'Unexpected material-slot mutation outside the canopy/frame/water allowlist'
    for m in new_film + [metal, seam, water]:
        # No new opacity path, light-path branch or emission can hide lost optics.
        assert not any(n.type in {'BSDF_TRANSPARENT', 'LIGHT_PATH', 'EMISSION'}
                       for n in m.node_tree.nodes), ('Unexpected nonphysical branch', m.name)
    return {
        'api': 'apply_clear_wet_canopy(scene)',
        'source_v4_sha256': SOURCE_SHA256_V4,
        'materials_created': [m.name for m in new_film + [metal, seam, water]],
        'original_materials_modified': [],
        'objects_material_slots_changed': sorted(changed_names),
        'outer_film': {
            'closure': 'GGX Glass; actual Fresnel reflection and refraction',
            'IOR': 1.38, 'clear_gap_roughness': 0,
            'water_support_smootherstep': [.08, .22],
            'height_distance_m': .0032, 'wetness': float(wet.outputs[0].default_value),
            'wet_roughness_formula': 'source .025-.095 * support * retained wetness * .30',
            'source_registered_UV_and_map_bytes_unchanged': True,
            'source_opacity_packed_sha256': hashlib.sha256(bytes(
                outer.node_tree.nodes['Verified water-drop opacity'].image.packed_file.data)).hexdigest(),
        },
        'inner_film': {'IOR': 1.38, 'roughness': 0, 'normal': 'smooth, unlinked'},
        'frame': {'objects': len(frame), 'linear_RGB': [.56, .58, .61],
                  'metallic': 1, 'roughness': .14, 'anisotropic': .18},
        'perimeter_seam': {'IOR': 1.38, 'roughness': .018},
        'resolved_water_caps': {'objects': len(beads), 'IOR': 1.333, 'roughness': .009,
                                'closure': 'Glass for all rays; no shadow-ray override'},
        'geometry_camera_lighting_rain_ground_Ball_unchanged': True,
        'rendered_by_module': False,
        'limitations': [
            'Localized bump is a water-surface relief approximation, not separately resolved microdroplet geometry or a simulation.',
            'Reference canopy shape/pose and rib thickness differences remain unchanged.',
            'The silver frame reflects the retained artistic shared lighting; no measured alloy/IOR claim.',
            'Physical cap shadows replace the old cap-only shadow-transparency approximation for these 114 objects.',
            'This material candidate requires the caller-owned raw and denoised pixel gate before acceptance.',
        ],
    }
