"""One coordinated native900 wet-readability revision, executed only by apply(bpy).

Does not open a blend, launch Blender, render, save, or touch the World. Sizes are
camera-space lookdev hypotheses, not measurements recovered from the reference.
Preserves the loaded right-side pose and all existing shader settings/wiring;
only the two existing outer water image bindings are replaced. Uses the current
outer skin and evaluated hem BVHs. Memory is bounded by the existing fine meshes,
less than 50k new vertices, and two 2048x1024 float image maps.
"""
from pathlib import Path
import hashlib
import json
import math
import random

D = Path(__file__).resolve().parent
BASE_SHA256 = '7666a65cf86d266082a7bfaca0e13867236976b632bf0bd05061087a49c1650e'
CANOPY = 'Dry clay / eight tensioned gores'
HEM = 'Dry clay / chord-scalloped continuous hem'
WATER = 'Hybrid clear wet canopy / clear resolved water caps'
OUTER = 'Closed PVC 020mm / outer clear dielectric with retained wet rel'
UV_NAME = 'ConnectedWetField_SurfaceMetric_v1'
COLLECTION = 'Native900 wet readability / localized coherent revision'
MPU = 15 / 88
SEAT = .000010
FINE = {'Readable wetness / microbeads': (4071, 1.75, 1.30),
        'Readable wetness / small_beads': (763, 1.70, 1.30),
        'Readable wetness / coalesced_beads': (95, 1.55, 1.22)}

def _shader_state(bpy):
    """Guard current shader input values, links and all unrelated image bindings."""
    state = {}
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        nodes = []
        for node in mat.node_tree.nodes:
            vals = []
            for inp in node.inputs:
                if not hasattr(inp, 'default_value'):
                    continue
                v = inp.default_value
                try:
                    v = tuple(v)
                except TypeError:
                    pass
                vals.append((inp.identifier, v))
            image = getattr(node, 'image', None)
            image_name = image.name if image else None
            if mat.name == OUTER and node.name in ('Verified water-drop height', 'Verified water-drop opacity'):
                image_name = '<permitted water image>'
            nodes.append((node.name, node.bl_idname, tuple(vals), image_name))
        state[mat.name] = (tuple(nodes), tuple((l.from_node.name, l.from_socket.identifier,
                          l.to_node.name, l.to_socket.identifier) for l in mat.node_tree.links))
    return state


def apply(bpy, *, report_path=None):
    """Modify the already-loaded base once, returning a detailed JSON-safe report.

    report_path=False suppresses the optional JSON output. Caller owns scene
    opening, World changes, visual testing, any blend save, and delivery.
    """
    import numpy as np
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    from bpy_extras.object_utils import world_to_camera_view

    if bpy.data.collections.get(COLLECTION):
        raise RuntimeError('Readability patch already exists; reload base before applying')
    base = D / 'right-umbrella-fine-wet-hierarchy-lookdev.blend'
    digest = hashlib.sha256()
    with base.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(block)
    if digest.hexdigest() != BASE_SHA256:
        raise RuntimeError('Frozen right-side base hash mismatch')
    scene = bpy.context.scene
    camera = scene.camera
    if not camera or camera.data.type != 'PERSP':
        raise RuntimeError('Expected the current perspective camera')
    bpy.context.view_layer.update()
    shader_before = _shader_state(bpy)
    protected_matrices = {o.name: tuple(tuple(row) for row in o.matrix_world)
                          for o in scene.objects}
    canopy = bpy.data.objects[CANOPY]
    water = bpy.data.materials[WATER]
    mesh = canopy.data
    mesh.calc_loop_triangles()
    if len(mesh.vertices) < 12289 or len(mesh.polygons) < 12288:
        raise RuntimeError('Expected the actual outer 48 x 256 canopy')
    uv_layer = mesh.uv_layers.get(UV_NAME)
    if uv_layer is None:
        raise RuntimeError('Actual surface metric UV chart is missing')
    world = [canopy.matrix_world @ v.co for v in mesh.vertices[:12289]]
    tri_data = [t for t in mesh.loop_triangles if t.polygon_index < 12288]
    triangles = [tuple(t.vertices) for t in tri_data]
    normal_matrix = canopy.matrix_world.to_3x3().inverted().transposed()
    normals = [[(normal_matrix @ mesh.corner_normals[j].vector).normalized()
                for j in t.loops] for t in tri_data]
    uv_triangles = [[Vector((*uv_layer.data[j].uv, 0)) for j in t.loops]
                    for t in tri_data]
    surface = BVHTree.FromPolygons(world, triangles, all_triangles=True)
    up_axis = (world[0] - sum(world[-256:], Vector()) / 256).normalized()
    down = Vector((0, 0, -1))
    rng = random.Random(202610090238)
    collection = bpy.data.collections.new(COLLECTION)
    scene.collection.children.link(collection)
    def near(point):
        p, _, k, distance = surface.find_nearest(point)
        a, b, c = triangles[k]
        n = barycentric_transform(p, world[a], world[b], world[c], *normals[k]).normalized()
        if n.dot(up_axis) < 0:
            n.negate()
        return p, n, k

    def uv_at(p, k):
        a, b, c = triangles[k]
        uv = barycentric_transform(p, world[a], world[b], world[c], *uv_triangles[k])
        return (float(uv.x % 1), float(uv.y))

    def frame(n):
        d = down - n * down.dot(n)
        if d.length < 1e-7:
            d = Vector((1, 0, 0)) - n * n.x
        d.normalize()
        return d, n.cross(d).normalized()

    def at_uv(u, t):
        # Seed directly from the final actual exterior vertex grid, then BVH-seat.
        a = (u % 1) * 256
        i = int(a) % 256
        f = a - int(a)
        r = min(47.999999, max(0, t * 48))
        j = int(r)
        g = r - j
        def ring(rr):
            if rr == 0:
                return world[0]
            return world[1 + (rr - 1) * 256 + i].lerp(world[1 + (rr - 1) * 256 + (i + 1) % 256], f)
        return near(ring(j).lerp(ring(j + 1), g))

    def project(p):
        v = world_to_camera_view(scene, camera, p)
        return Vector((v.x * 900, (1 - v.y) * 600))

    def walk(q, length, count=None, phase=0.0, wander=0.0):
        count = count or max(2, math.ceil(abs(length) / .0007))
        ds = length / count
        points = [near(q)[0]]
        for j in range(count):
            p, n, _ = near(points[-1])
            d, side = frame(n)
            slope = wander * math.sin(phase + j / count * 5.1)
            step = (d + side * slope).normalized() * (ds / MPU)
            mid, mn, _ = near(p + step * .5)
            md, ms = frame(mn)
            point = near(p + (md + ms * slope).normalized() * (ds / MPU))[0]
            points.append(point)
        return points

    def evaluated_bvh(obj):
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        me = evaluated.to_mesh()
        me.calc_loop_triangles()
        vs = [evaluated.matrix_world @ v.co for v in me.vertices]
        fs = [tuple(t.vertices) for t in me.loop_triangles]
        evaluated.to_mesh_clear()
        return BVHTree.FromPolygons(vs, fs, all_triangles=True)

    hem_surface = evaluated_bvh(bpy.data.objects[HEM])
    camera_origin = camera.matrix_world.translation.copy()
    def crosses_pvc(p, tolerance_m=.00025):
        ray = p - camera_origin
        return surface.ray_cast(camera_origin, ray.normalized(),
                                max(0, ray.length - tolerance_m / MPU))[0] is not None

    vertices, faces, smooth, loop_normals = [], [], [], []
    records, contacts, reservations, exclusions = [], [], [], []
    retired = []
    # The previous authored population is replaced, never cumulatively added.
    prior_names = ['Wet PVC / restrained accents short tracks and hem drops',
                   'Wet PVC / rounded middle beads and joined runoff',
                   'Wet PVC / readable mesoscopic water hierarchy']
    for obj in scene.objects:
        if obj.name in prior_names or obj.name.startswith('Readable wetness / form'):
            if not obj.hide_render:
                retired.append(obj.name)
            obj.hide_render = True
            obj.hide_viewport = True

    def percentile(values):
        return np.percentile(values, [0, 25, 50, 75, 95, 100]).tolist()

    def component_indices(me):
        parent = list(range(len(me.vertices)))
        def find(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a
        for edge in me.edges:
            a, b = edge.vertices
            parent[find(b)] = find(a)
        groups = {}
        for i in range(len(parent)):
            groups.setdefault(find(i), []).append(i)
        return list(groups.values())

    fine_report = []
    fine_resolved_exclusions = []
    for name, (expected, footprint_scale, height_scale) in FINE.items():
        obj = bpy.data.objects[name]
        source = obj.data
        groups = component_indices(source)
        if len(groups) != expected:
            raise RuntimeError('Unexpected existing fine component count: ' + name)
        # Copy before editing, preserving the archived mesh and every other user.
        me = source.copy()
        me.name = 'Native900 wet readability / ' + name.split('/')[-1].strip()
        obj.data = me
        inv = obj.matrix_world.inverted()
        old_world = [obj.matrix_world @ v.co for v in source.vertices]
        before_sizes, after_sizes, contact_gaps, min_heights = [], [], [], []
        normal_frames = {}
        normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
        normal_inverse = normal_matrix.inverted()
        for ids in groups:
            old = [old_world[i] for i in ids]
            anchor = sum(old, Vector()) / len(old)
            q, n, k = near(anchor)
            old_px = [project(p) for p in old]
            before_sizes.append(max(max(p[i] for p in old_px) - min(p[i] for p in old_px)
                                    for i in range(2)))
            new, heights = [], []
            for vi in ids:
                original = old_world[vi]
                base_point, old_n, _ = near(original)
                height = max(0, (original - base_point).dot(old_n) * MPU)
                tangent = base_point - q
                tangent -= n * tangent.dot(n)
                foot, fn, _ = near(q + tangent * footprint_scale)
                new_height = SEAT + max(0, height - SEAT) * height_scale
                point = foot + fn * (new_height / MPU)
                me.vertices[vi].co = inv @ point
                normal_frames[vi] = (old_n.copy(), fn.copy())
                new.append(point)
                heights.append(new_height)
                if height < .000025:
                    contact_gaps.append(surface.find_nearest(point)[3] * MPU * 1e6)
            new_px = [project(p) for p in new]
            extent = [max(p[i] for p in new_px) - min(p[i] for p in new_px) for i in range(2)]
            after_sizes.append(max(extent))
            min_heights.append(min(heights) * 1e6)
            if max(extent) >= .85:
                radius = max((p - q - n * (p - q).dot(n)).length * MPU for p in new)
                fine_resolved_exclusions.append((q, radius * 1.15 + .0003))
        me.update()
        # Preserve split top/contact normals while correcting for the changed
        # tangent footprint and normal height; copied old normals would describe
        # the smaller source shape rather than this reshaped cap.
        corrected_normals = []
        for loop in me.loops:
            old_n, new_n = normal_frames[loop.vertex_index]
            world_normal = (normal_matrix @ source.corner_normals[loop.index].vector).normalized()
            component = world_normal.dot(old_n)
            adjusted = (world_normal - old_n * component) / footprint_scale + old_n * (component / height_scale)
            adjusted = old_n.rotation_difference(new_n) @ adjusted.normalized()
            corrected_normals.append(tuple((normal_inverse @ adjusted).normalized()))
        me.normals_split_custom_set(corrected_normals)
        me.update()
        obj.hide_render = False
        obj.hide_viewport = False
        # Connectivity is untouched; check inherited closed-shell edge incidence.
        uses = {}
        for poly in me.polygons:
            vv = list(poly.vertices)
            for a, b in zip(vv, vv[1:] + vv[:1]):
                edge = (min(a, b), max(a, b))
                uses[edge] = uses.get(edge, 0) + 1
        nonmanifold = sum(v != 2 for v in uses.values())
        if nonmanifold:
            raise RuntimeError('Existing fine mesh has non-closed edges: ' + name)
        fine_report.append({'object': name, 'component_count_unchanged': expected,
            'footprint_multiplier': footprint_scale, 'height_above_seat_multiplier': height_scale,
            'before_major_px_p0_p25_p50_p75_p95_p100': percentile(before_sizes),
            'after_major_px_p0_p25_p50_p75_p95_p100': percentile(after_sizes),
            'actual_contact_gap_um_min_max': [min(contact_gaps), max(contact_gaps)] if contact_gaps else None,
            'minimum_authored_height_um': min(min_heights), 'non_two_face_edges': nonmanifold,
            'custom_split_normals_corrected_for_footprint_and_height': True})
        print('WET_READABILITY_FINE', name, json.dumps(fine_report[-1]), flush=True)
    def add(vs, fs, top, explicit_normals, rec):
        origin = sum(vs, Vector()) / len(vs)
        volume = sum((vs[f[0]] - origin).dot((vs[f[j]] - origin).cross(vs[f[j + 1]] - origin)) / 6
                     for f in fs for j in range(1, len(f) - 1))
        if volume < 0:
            fs = [tuple(reversed(f)) for f in fs]
            volume = -volume
        if not volume > 1e-16:
            raise RuntimeError('Non-positive authored water volume: ' + str(rec))
        edges = {}
        for f in fs:
            for a, b in zip(f, f[1:] + f[:1]):
                key = tuple(sorted((a, b)))
                edges[key] = edges.get(key, 0) + 1
        if set(edges.values()) != {2}:
            raise RuntimeError('New water shell is not closed: ' + str(rec))
        acc = [Vector() for _ in vs]
        for f, is_top in zip(fs, top):
            if is_top:
                normal = (vs[f[1]] - vs[f[0]]).cross(vs[f[2]] - vs[f[0]])
                for index in f:
                    acc[index] += normal
        offset = len(vertices)
        vertices.extend(vs)
        for f, is_top in zip(fs, top):
            faces.append(tuple(offset + i for i in f))
            smooth.append(bool(is_top))
            for i in f:
                if is_top:
                    n = explicit_normals[i] if explicit_normals[i] is not None else acc[i].normalized()
                else:
                    n = -near(vs[i])[1] if rec['type'] != 'hem_pendant' else Vector((0, 0, 1))
                loop_normals.append(tuple(n))
        pixels = [project(p) for p in vs]
        extent = [max(p[i] for p in pixels) - min(p[i] for p in pixels) for i in range(2)]
        rec.update(volume_ul=volume * MPU ** 3 * 1e9, vertices=len(vs), polygons=len(fs),
                   all_edges_two_faces=True, native900_width_height=extent,
                   vertex_range=[offset, len(vertices)])
        records.append(rec)
        return rec

    def clear(q, radius):
        return all((q - p).length * MPU > radius + r for p, r in reservations)

    def cap(q, diameter, elongation, height, role):
        q, n, k = near(q)
        direction, side = frame(n)
        radius = diameter / 2
        sphere = (radius * radius + height * height) / (2 * height)
        vs, ns, fs, top = [], [], [], []
        rings, bottoms = [], []
        K = 24
        fractions = [.25, .48, .68, .84, .94, 1.0]
        def point(rr, angle, upper):
            x, y = rr * math.cos(angle) * elongation, rr * math.sin(angle)
            b, bn, _ = near(q + direction * (x / MPU) + side * (y / MPU))
            root = math.sqrt(max(1e-15, sphere * sphere - rr * rr))
            z = max(0, root - (sphere - height)) if upper else 0
            normal = (bn + direction * ((x / elongation ** 2) / root) + side * (y / root)).normalized()
            return b + bn * ((SEAT + z) / MPU), normal if upper else -bn
        p, nn = point(0, 0, True)
        vs.append(p); ns.append(nn)
        for frac in fractions:
            row = []
            for j in range(K):
                p, nn = point(radius * frac, j * 2 * math.pi / K, True)
                row.append(len(vs)); vs.append(p); ns.append(nn)
            rings.append(row)
        for j in range(K):
            fs.append((0, rings[0][j], rings[0][(j + 1) % K])); top.append(True)
        for a, b in zip(rings, rings[1:]):
            for j in range(K):
                fs.append((a[j], b[j], b[(j + 1) % K], a[(j + 1) % K])); top.append(True)
        center = len(vs)
        p, nn = point(0, 0, False)
        vs.append(p); ns.append(nn)
        for frac in fractions[:-1]:
            row = []
            for j in range(K):
                p, nn = point(radius * frac, j * 2 * math.pi / K, False)
                row.append(len(vs)); vs.append(p); ns.append(nn)
            bottoms.append(row)
        bottoms.append(rings[-1])
        for j in range(K):
            fs.append((center, bottoms[0][(j + 1) % K], bottoms[0][j])); top.append(False)
        for a, b in zip(bottoms, bottoms[1:]):
            for j in range(K):
                fs.append((a[(j + 1) % K], b[(j + 1) % K], b[j], a[j])); top.append(False)
        reservations.append((q, radius * elongation + .0007))
        exclusions.append((q, radius * elongation * 1.15 + .0004))
        contacts.extend(vs[i] for row in bottoms for i in row)
        add(vs, fs, top, ns, {'type': 'rounded_' + role, 'anchor_world': list(q),
                            'anchor_uv': uv_at(q, k), 'diameter_mm': diameter * 1000,
                            'elongation': elongation, 'height_mm': height * 1000})

    projected_canopy = [project(p) for p in world]
    xmin, xmax = min(p.x for p in projected_canopy), max(p.x for p in projected_canopy)
    ymin, ymax = min(p.y for p in projected_canopy), max(p.y for p in projected_canopy)

    def cap_sized(q, target_px, elongation, role):
        q, n, k = near(q)
        direction, side = frame(n)
        diameter = .001
        test = [q + direction * (v * diameter * elongation / MPU) for v in (-.5, .5)]
        test += [q + side * (v * diameter / MPU) for v in (-.5, .5)]
        test += [q + n * (.27 * diameter / MPU)]
        pp = [project(p) for p in test]
        measured = max(max(p[i] for p in pp) - min(p[i] for p in pp) for i in range(2))
        diameter *= target_px / max(.01, measured)
        diameter = min(.012, max(.0035, diameter))
        cap(q, diameter, elongation, diameter * .27, role)
        records[-1]['target_major_px_hypothesis'] = target_px
        records[-1]['straight_view_crosses_PVC'] = crosses_pvc(q + n * (diameter * .27 / MPU))

    candidates = []
    for i in range(2200):
        q, n, k = at_uv(rng.random(), rng.uniform(.12, .985))
        px = project(q)
        candidates.append((q, n, k, px, crosses_pvc(q + n * (.001 / MPU))))
    crest = [c for c in candidates if c[3].y < ymin + .18 * (ymax - ymin)]
    # Keep direct-view crest support first; transmitted support is still valid.
    rng.shuffle(crest)
    crest.sort(key=lambda p: p[4])
    selected_caps = []
    for q, n, k, px, blocked in crest:
        if len(selected_caps) >= 10:
            break
        if clear(q, .012) and all((px - p).length > 10 for p in selected_caps):
            cap_sized(q, [2.5, 3.2, 2.2, 3.7, 2.7, 3.0, 2.3, 4.0, 2.6, 3.4][len(selected_caps)],
                      rng.uniform(1, 1.13), 'crest')
            selected_caps.append(px)
    rim = []
    for j in range(512):
        q, n, k = at_uv((j + .37) / 512, .975)
        px = project(q)
        if px.x > xmin + .60 * (xmax - xmin):
            rim.append((q, n, k, px, crosses_pvc(q + n * (.001 / MPU))))
    rng.shuffle(rim)
    rim.sort(key=lambda p: p[4])
    rim_selected = []
    for q, n, k, px, blocked in rim:
        if len(rim_selected) >= 6:
            break
        if clear(q, .010) and all((px - p).length > 17 for p in rim_selected):
            cap_sized(q, [2.0, 2.5, 3.1, 2.2, 2.8, 2.4][len(rim_selected)], 1.08, 'rim')
            rim_selected.append(px)
    def track(q, length, width, height, phase, group):
        path = walk(q, length, count=26, phase=phase, wander=rng.uniform(.10, .27))
        vs, ns, fs, top, upper, lower = [], [], [], [], [], []
        q0, n0, _ = near(path[0])
        vs.append(q0 + n0 * (SEAT / MPU)); ns.append(None)
        K = 12
        for i, center in enumerate(path[1:-1], 1):
            t = i / (len(path) - 1)
            p, n, _ = near(center)
            direction, side = frame(n)
            # Two or three unequal lobes joined by short wet necks. All centerline
            # displacement follows projected gravity with bounded sideways drift.
            envelope = math.sin(math.pi * t) ** .62
            lobes = .34 + .57 * math.exp(-((t - .31) / .13) ** 2) + .83 * math.exp(-((t - .76) / .17) ** 2)
            half = width * .5 * envelope * lobes
            hh = min(height * envelope * (.52 + .48 * math.exp(-((t - .74) / .21) ** 2)), half * .84)
            radius = (half * half + hh * hh) / (2 * hh)
            row, bottom = [], []
            for j in range(K + 1):
                y = half * math.cos(math.pi * j / K)
                b, bn, _ = near(p + side * (y / MPU))
                z = max(0, math.sqrt(max(0, radius * radius - y * y)) - (radius - hh))
                row.append(len(vs)); vs.append(b + bn * ((SEAT + z) / MPU)); ns.append(None)
            for j in range(K + 1):
                if j in (0, K):
                    bottom.append(row[j])
                else:
                    y = half * math.cos(math.pi * j / K)
                    b, bn, _ = near(p + side * (y / MPU))
                    bottom.append(len(vs)); vs.append(b + bn * (SEAT / MPU)); ns.append(None)
            upper.append(row); lower.append(bottom)
            contacts.extend(vs[v] for v in bottom)
        qe, ne, ke = near(path[-1])
        end = len(vs); vs.append(qe + ne * (SEAT / MPU)); ns.append(None)
        for rows, is_top in ((upper, True), (lower, False)):
            for j in range(K):
                fs.append((0, rows[0][j + 1], rows[0][j]) if is_top else (0, rows[0][j], rows[0][j + 1])); top.append(is_top)
            for a, b in zip(rows, rows[1:]):
                for j in range(K):
                    fs.append((a[j], a[j + 1], b[j + 1], b[j]) if is_top else (a[j + 1], a[j], b[j], b[j + 1])); top.append(is_top)
            for j in range(K):
                fs.append((rows[-1][j], rows[-1][j + 1], end) if is_top else (rows[-1][j + 1], rows[-1][j], end)); top.append(is_top)
        exclusions.extend((p, width * .70 + .0005) for p in path)
        center = path[len(path) // 2]
        reservations.append((center, length * .5 + .001))
        add(vs, fs, top, ns, {'type': 'short_lobed_track', 'group': group,
                            'anchor_world': list(q0), 'anchor_uv': uv_at(q0, near(q0)[2]),
                            'length_mm': length * 1000, 'max_authored_width_mm': width * 1000,
                            'peak_height_mm': height * 1000,
                            'downhill_drop_mm': (path[0].z - path[-1].z) * MPU * 1000,
                            'maximum_uphill_step_mm': max(0, max((b.z - a.z) * MPU * 1000 for a, b in zip(path, path[1:])))})
        return qe

    # A restrained physical middle hierarchy replaces the former 56 tracks.
    # The map supplies irregular smaller wet detail; these remain short bodies.
    middle = [c for c in candidates if .22 < uv_at(c[0], c[2])[1] < .86]
    rng.shuffle(middle)
    track_positions = []
    for q, n, k, px, blocked in middle:
        if len(track_positions) >= 16:
            break
        if not clear(q, .018) or any((px - p).length < 15 for p in track_positions):
            continue
        direction, side = frame(n)
        px_per_m = (project(q + direction * (.001 / MPU)) - px).length / .001
        length = min(.019, max(.007, rng.uniform(3.0, 5.8) / max(100, px_per_m)))
        width = rng.uniform(.0022, .0035)
        track(q, length, width, width * .28, rng.random() * 6.28, len(track_positions))
        track_positions.append(px)

    # Screen-space lower silhouette determines exposed outlets. Do not enforce
    # the former global-low-z filter that collapsed all seven supports to x680-748.
    hem_candidates = []
    for j in range(2048):
        q, n, k = at_uv(j / 2048, .999999)
        hit = hem_surface.ray_cast(q + down * (.009 / MPU), -down, .018 / MPU)
        if hit[0] is None:
            continue
        p, hn, _, _ = hit
        if hn.z > -.08:
            continue
        px = project(p)
        hem_candidates.append((p, hn.normalized(), px, j / 2048))
    if not hem_candidates:
        raise RuntimeError('No actual evaluated lower-hem contacts found')
    right_x0 = max(xmin + .70 * (xmax - xmin), xmax - 105)
    right = [p for p in hem_candidates if p[2].x > right_x0]
    eligible = []
    for p in right:
        lower = max(t[2].y for t in hem_candidates if abs(t[2].x - p[2].x) < 2.5)
        test = p[0] + down * (.002 / MPU)
        if p[2].y >= lower - 2.0 and not crosses_pvc(test):
            eligible.append(p)
    if len(eligible) < 6:
        raise RuntimeError('Insufficient exposed right-hem supports; no hidden fallback used')
    minx, maxx = min(p[2].x for p in eligible), max(p[2].x for p in eligible)
    selected = []
    for fraction in (.04, .22, .41, .60, .79, .96):
        target_x = minx + fraction * (maxx - minx)
        choices = sorted(eligible, key=lambda p: abs(p[2].x - target_x))
        pick = next((p for p in choices if all((p[2] - s[2]).length > 9 for s in selected)), None)
        if pick:
            selected.append(pick)
    selected.sort(key=lambda p: p[2].x)
    if len(selected) < 5:
        raise RuntimeError('Fewer than five separated exposed right-hem contacts')
    def pendant(item, index):
        q, hn, px, u = item
        side = Vector((1, 0, 0)); cross = Vector((0, 1, 0))
        target_width = [1.3, 1.7, 2.1, 1.4, 1.9, 1.5][index]
        target_length = [4.4, 5.6, 6.5, 4.8, 6.1, 5.2][index]
        length_scale = abs(project(q + down * (.001 / MPU)).y - px.y) / .001
        width_scale = max(abs(project(q + axis * (.001 / MPU)).x - px.x)
                          for axis in (side, cross)) / .001
        length = target_length / max(100, length_scale)
        diameter = target_width / max(100, width_scale)
        # Horizontal circular section projects along the combination of XY axes.
        width_scale = math.sqrt(sum((project(q + axis * (.001 / MPU)).x - px.x) ** 2
                                    for axis in (side, cross))) / .001
        diameter = target_width / max(100, width_scale)
        neck = diameter * .14
        K, NR = 20, 24
        vs = [q + hn * (SEAT / MPU)]
        ns = [None]
        rows = []
        # Finite top contact disk follows actual evaluated hem underside.
        contact_row = []
        max_contact = 0
        for j in range(K):
            a = 2 * math.pi * j / K
            guess = q + side * (neck * math.cos(a) / MPU) + cross * (neck * math.sin(a) / MPU)
            hq, normal, _, _ = hem_surface.find_nearest(guess)
            p = hq + normal.normalized() * (SEAT / MPU)
            contact_row.append(len(vs)); vs.append(p); ns.append(None)
            max_contact = max(max_contact, hem_surface.find_nearest(p)[3] * MPU)
        rows.append(contact_row)
        for j in range(1, NR):
            t = j / NR
            # Narrow unequal neck, one pendant lobe, rounded terminal pinch.
            if t < .22:
                radius = neck * (1 - .12 * math.sin(math.pi * t / .22))
            else:
                radius = diameter * .5 * math.sin(math.pi * (t - .12) / .88) ** .78
            center = q + down * ((SEAT + length * t) / MPU)
            row = []
            for k in range(K):
                a = 2 * math.pi * k / K
                row.append(len(vs)); vs.append(center + side * (radius * math.cos(a) / MPU) + cross * (radius * math.sin(a) / MPU)); ns.append(None)
            rows.append(row)
        tip = len(vs); vs.append(q + down * ((SEAT + length) / MPU)); ns.append(None)
        fs, top = [], []
        for k in range(K):
            fs.append((0, rows[0][(k + 1) % K], rows[0][k])); top.append(False)
        for a, b in zip(rows, rows[1:]):
            for k in range(K):
                fs.append((a[k], a[(k + 1) % K], b[(k + 1) % K], b[k])); top.append(True)
        for k in range(K):
            fs.append((rows[-1][k], rows[-1][(k + 1) % K], tip)); top.append(True)
        add(vs, fs, top, ns, {'type': 'hem_pendant', 'index': index, 'hem_u': u,
                            'attachment_world': list(q), 'attachment_native900': list(px),
                            'target_width_length_px_hypothesis': [target_width, target_length],
                            'straight_view_below_contact_crosses_PVC': crosses_pvc(q + down * (.002 / MPU)),
                            'length_mm': length * 1000,
                            'diameter_mm': diameter * 1000,
                            'finite_attachment_diameter_mm': neck * 2 * 1000,
                            'hem_contact_max_gap_um': max_contact * 1e6})
        return vs[tip], diameter

    def detached(center, diameter, stretch, parent):
        K, NR = 16, 10
        radius = diameter / 2 / MPU
        vs = [center + Vector((0, 0, radius * stretch))]
        rows = []
        for j in range(1, NR):
            theta = math.pi * j / NR
            row = []
            for k in range(K):
                phi = 2 * math.pi * k / K
                row.append(len(vs)); vs.append(center + Vector((radius * math.sin(theta) * math.cos(phi), radius * math.sin(theta) * math.sin(phi), radius * stretch * math.cos(theta))))
            rows.append(row)
        tip = len(vs); vs.append(center - Vector((0, 0, radius * stretch)))
        fs = [(0, rows[0][k], rows[0][(k + 1) % K]) for k in range(K)]
        for a, b in zip(rows, rows[1:]):
            fs.extend((a[k], b[k], b[(k + 1) % K], a[(k + 1) % K]) for k in range(K))
        fs.extend((rows[-1][k], tip, rows[-1][(k + 1) % K]) for k in range(K))
        add(vs, fs, [True] * len(fs), [None] * len(vs), {'type': 'detached_successor',
            'parent_pendant': parent, 'center_world': list(center), 'diameter_mm': diameter * 1000,
            'gravity_axis_stretch': stretch})

    for index, item in enumerate(selected):
        tip, diameter = pendant(item, index)
        if index in (1, 3, 5):
            # Disconnected successor, with a real 2-3 pixel air gap after tip.
            pixel_per_m = (project(tip + down * (.001 / MPU)) - project(tip)).length / .001
            small_diameter = diameter * .52
            gap = 2.3 / max(100, pixel_per_m)
            stretch = 1.14
            center = tip + down * ((gap + small_diameter * .5 * stretch) / MPU)
            detached(center, small_diameter, stretch, index)

    newmesh = bpy.data.meshes.new('Native900 wet readability / closed surface bodies')
    newmesh.from_pydata(vertices, [], faces)
    newmesh.update()
    newmesh.materials.append(water)
    for p, sm in zip(newmesh.polygons, smooth):
        p.use_smooth = sm
    newmesh.normals_split_custom_set(loop_normals)
    obj = bpy.data.objects.new('Wet PVC / native900 restrained resolved wetness', newmesh)
    collection.objects.link(obj)
    obj['static_current_state'] = True
    obj['connected_bodies'] = len(records)

    # Two float buffers use the existing inverse encodings. Clear windows have
    # exactly zero effective wet height and support. No roughness/PVC/fold edits.
    W, H = 2048, 1024
    wet_height = np.zeros((H, W), dtype=np.float32)
    wet_support = np.zeros((H, W), dtype=np.float32)
    mask = np.ones((H, W), dtype=np.float32)
    stamp_records = []

    def uv_delta(a, b):
        return np.array((((a[0] - b[0] + .5) % 1) - .5, a[1] - b[1]), dtype=float)

    def footprint(q, radius_along, radius_across):
        q, n, k = near(q)
        d, side = frame(n)
        uv = uv_at(q, k)
        # Local metric Jacobian from the final BVH, not UV-as-world distances.
        pp, pn, pk = near(q + d * (.001 / MPU))
        ss, sn, sk = near(q + side * (.001 / MPU))
        a = uv_delta(uv_at(pp, pk), uv) * (radius_along / .001)
        b = uv_delta(uv_at(ss, sk), uv) * (radius_across / .001)
        return uv, np.column_stack((a, b))

    def stamp(q, radius_along, radius_across, amplitude, mode='wet'):
        uv, axes = footprint(q, radius_along, radius_across)
        if abs(float(np.linalg.det(axes))) < 1e-12:
            return False
        inverse = np.linalg.inv(axes)
        span = np.sqrt((axes ** 2).sum(axis=1))
        # Restrict polar/seam degeneracies instead of painting broad artifacts.
        if span[0] > .10 or span[1] > .10:
            return False
        x0 = int(math.floor((uv[0] - span[0]) * W)) - 1
        x1 = int(math.ceil((uv[0] + span[0]) * W)) + 1
        y0 = max(0, int(math.floor((uv[1] - span[1]) * H)) - 1)
        y1 = min(H, int(math.ceil((uv[1] + span[1]) * H)) + 1)
        if y1 <= y0:
            return False
        xx = np.arange(x0, x1)
        yy = np.arange(y0, y1)
        du = (xx + .5) / W - uv[0]
        dv = (yy + .5) / H - uv[1]
        a = inverse[0, 0] * du[None, :] + inverse[0, 1] * dv[:, None]
        b = inverse[1, 0] * du[None, :] + inverse[1, 1] * dv[:, None]
        r2 = a * a + b * b
        inside = np.clip(1 - r2, 0, 1)
        indexes = np.ix_(yy, xx % W)
        if mode == 'exclude':
            # Zero throughout the body footprint; smooth skirt outside it.
            keep = np.clip((r2 - .65) / .35, 0, 1)
            keep = keep * keep * (3 - 2 * keep)
            mask[indexes] = np.minimum(mask[indexes], keep)
        else:
            local_height = amplitude * inside ** 1.15
            support = np.clip(inside * 4, 0, 1)
            support = support * support * (3 - 2 * support)
            wet_height[indexes] = np.maximum(wet_height[indexes], local_height)
            wet_support[indexes] = np.maximum(wet_support[indexes], support)
        return True

    # Explicit cluster islands, with broad gaps between them. Every feature is
    # surface-seated and metric-correct; no full-panel white noise/frost layer.
    cluster_candidates = [c for c in candidates if .18 < uv_at(c[0], c[2])[1] < .92]
    rng.shuffle(cluster_candidates)
    cluster_centers = []
    for c in cluster_candidates:
        if len(cluster_centers) >= 28:
            break
        if all((c[3] - other[3]).length > 20 for other in cluster_centers):
            cluster_centers.append(c)
    for ci, (center, cn, ck, cpx, blocked) in enumerate(cluster_centers):
        direction, side = frame(cn)
        spread = rng.uniform(.012, .025)
        for j in range(64):
            q, n, k = near(center + direction * (rng.gauss(0, spread) / MPU)
                          + side * (rng.gauss(0, spread * .8) / MPU))
            u, t = uv_at(q, k)
            if not .12 < t < .965:
                continue
            d, lateral = frame(n)
            px = project(q)
            ppm = max((project(q + axis * (.001 / MPU)) - px).length
                      for axis in (d, lateral)) / .001
            target_px = rng.uniform(.75, 1.80)
            radius = min(.0033, max(.0010, target_px / max(180, ppm) / 2))
            elongation = rng.uniform(1.0, 1.8)
            if stamp(q, radius * elongation, radius, rng.uniform(.10, .26)):
                stamp_records.append({'role': 'clustered_micro_normal', 'cluster': ci,
                    'anchor_native900': list(px), 'minor_footprint_target_px': target_px})
        if ci % 2 == 0:
            # A short, irregular, two-lobed wet connection within this island.
            length = rng.uniform(.009, .018)
            phase = rng.random() * 6.28
            path = walk(center, length, count=7, phase=phase, wander=.25)
            for ii, q in enumerate(path):
                rr = rng.uniform(.0010, .0020) * (.75 + .25 * math.sin(ii * 1.7))
                stamp(q, rr * 1.3, rr, rng.uniform(.12, .22))
            stamp_records.append({'role': 'short_irregular_micro_normal_connection',
                                  'cluster': ci, 'length_mm': length * 1000})
    for q, radius in exclusions + fine_resolved_exclusions:
        stamp(q, radius, radius, 0, mode='exclude')
    wet_height *= mask
    wet_support *= mask
    nodes = bpy.data.materials[OUTER].node_tree.nodes
    image_records = []
    pairs = [('Verified water-drop height', 'Map Range', wet_height, 'height'),
             ('Verified water-drop opacity', 'Hybrid clear wet canopy / localized water support, not opacity',
              wet_support, 'support')]
    for node_name, range_name, data, label in pairs:
        old = nodes[node_name].image
        range_node = nodes[range_name]
        low = float(range_node.inputs['From Min'].default_value)
        high = float(range_node.inputs['From Max'].default_value)
        if abs(float(range_node.inputs['To Min'].default_value)) > 1e-9 or abs(float(range_node.inputs['To Max'].default_value) - 1) > 1e-9:
            raise RuntimeError('Expected existing zero-to-one water decoding')
        image = bpy.data.images.new('Native900 wet readability / clustered ' + label,
                                   width=W, height=H, alpha=True, float_buffer=True)
        image.colorspace_settings.name = 'Non-Color'
        pixels = np.ones((H, W, 4), dtype=np.float32)
        pixels[:, :, :3] = (low + data * (high - low))[:, :, None]
        image.pixels.foreach_set(pixels.ravel())
        image.update()
        image.pack()
        nodes[node_name].image = image
        image_records.append({'node': node_name, 'old_image': old.name if old else None,
            'new_image': image.name, 'size': [W, H], 'float_buffer': True,
            'effective_value_min_max': [float(data.min()), float(data.max())],
            'encoded_zero': low, 'encoded_one': high})
        del pixels

    bpy.context.view_layer.update()
    if _shader_state(bpy) != shader_before:
        raise RuntimeError('Protected shader values/wiring or non-water images changed')
    for name, old_matrix in protected_matrices.items():
        if tuple(tuple(row) for row in bpy.data.objects[name].matrix_world) != old_matrix:
            raise RuntimeError('Protected pose matrix changed: ' + name)
    counts = {}
    sizes = {}
    for rec in records:
        role = rec['type']
        counts[role] = counts.get(role, 0) + 1
        sizes.setdefault(role, []).append(rec['native900_width_height'])
    gaps = [surface.find_nearest(p)[3] * MPU * 1e6 for p in contacts]
    effective = wet_height * wet_support
    bump_distance_m = float(nodes['Hybrid clear wet canopy / localized water surface relief'].inputs['Distance'].default_value) * MPU
    report = {'version': 1, 'base_sha256': BASE_SHA256, 'native_resolution': [900, 600],
        'fine_meshes': fine_report, 'retired_previous_visible_water_objects': retired,
        'new_authored_counts': counts, 'new_geometry_vertices': len(vertices),
        'new_geometry_polygons': len(faces), 'new_closed_bodies_all_edges_two_faces': True,
        'projected_width_height_px_by_role': {k: {'width_percentiles': percentile([a[0] for a in v]),
            'height_percentiles': percentile([a[1] for a in v]), 'major_percentiles': percentile([max(a) for a in v])}
            for k, v in sizes.items()},
        'actual_outer_contact_gap_um_min_max': [min(gaps), max(gaps)] if gaps else None,
        'exposed_right_hem_candidate_count': len(eligible),
        'selected_hem_attachments_native900': [list(p[2]) for p in selected],
        'water_images': image_records,
        'normal_field': {'cluster_count': len(cluster_centers),
            'micro_normal_stamps': sum(s['role'] == 'clustered_micro_normal' for s in stamp_records),
            'short_irregular_connections': sum(s['role'] != 'clustered_micro_normal' for s in stamp_records),
            'uv_texel_fraction_any_effective_height': float(np.mean(effective > 1e-6)),
            'uv_texel_fraction_effective_height_above_001': float(np.mean(effective > .01)),
            'uv_texel_fraction_exact_clear': float(np.mean(effective == 0)),
            'maximum_equivalent_bump_height_mm': float(effective.max()) * bump_distance_m * 1000,
            'field_exclusion_count_for_resolved_fine': len(fine_resolved_exclusions),
            'field_exclusion_count_for_new_bodies': len(exclusions)},
        'all_existing_shader_values_links_and_other_image_bindings_unchanged': True,
        'all_existing_object_world_matrices_unchanged': True,
        'world_untouched': True, 'Ball_PVC_folds_roughness_untouched': True,
        'records': records,
        'approximations': [
            'Camera-space sizes are art-direction hypotheses; no literal recovered reference measurement claim.',
            'Native900 projected extents are measured during apply; final path-traced raw/denoised visibility is still unverified.',
            'Normal-only micro-relief is a bounded bump approximation and has no fluid volume or silhouette.',
            'UV clear fraction is a texture-domain diagnostic, not an area-weighted canopy fraction.',
            'Existing fine component counts and connectivity are retained; footprints are re-seated to the real outer BVH.',
            'Tiny fine/fine or fine/new geometry overlaps are not boolean-unioned; the normal field is suppressed under resolved bodies.',
            'Hem visibility is a straight-ray/screen-silhouette proxy; refraction and full scene occlusion require the crop render.',
            'Pendants and disconnected successors are authored transient forms, not a fluid/contact-angle simulation.',
            'Ten-micrometre seating allowance is retained; existing dielectric water and PVC conventions are unchanged.'
        ], 'no_base_open_no_blend_save_no_render': True}
    if report_path is not False:
        destination = Path(report_path) if report_path else D / 'WET-READABILITY-PATCH-REPORT.json'
        destination.write_text(json.dumps(report, indent=2))
    print('WET_READABILITY_PATCH_APPLIED', json.dumps({
        'counts': counts, 'fine_medians': [r['after_major_px_p0_p25_p50_p75_p95_p100'][2] for r in fine_report],
        'hem_attachments': report['selected_hem_attachments_native900'],
        'normal_field': report['normal_field']}), flush=True)
    return report
