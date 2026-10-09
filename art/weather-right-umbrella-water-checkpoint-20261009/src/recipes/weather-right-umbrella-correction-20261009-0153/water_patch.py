"""Conservative fine-first water correction; call apply(bpy, old_to_new_matrix).

This module does not open the base, render, save a blend, or run on import.
The caller owns the current scene and must first transform the whole umbrella.
The matrix must map the frozen donor canopy world coordinates to its final pose,
including any positive uniform scale. Nonuniform scaling/shear is rejected.

Only three donor mesh datablocks are requested. Blender may automatically append
their dependencies; newly introduced material/image/node-group dependencies are
removed immediately after remapping to the current water material. No donor
objects, scene, collections, or material graphs are retained. Exact source object
matrices are read from the donor's saved geometry snapshot, not guessed.

New water is an authored transient, not a fluid/contact-angle simulation. Tracks
are closed, short, lobed height-graph bodies on the actual triangulated exterior;
pendants are closed hanging bodies with finite contacts on the evaluated hem.
All retain the existing dielectric convention and a 10-micrometre seating gap.
"""

from pathlib import Path
import bisect
import hashlib
import json
import math
import random

D = Path(__file__).resolve().parent
R = D.parent
MPU = 15 / 88
DONOR = R / 'weather-frozen-composition-current-wet-20261008-1952/frozen-balanced-readable-wet-robust-outlet.blend'
DONOR_SHA256 = '9d09b57cd6bb26894a7ed49fda8f548681051077711666656ed91fac53fcda4f'
DONOR_SNAPSHOT = DONOR.parent / 'WATER-AFTER-STATE.json'
FINE = {'Readable wetness / microbeads': 4071,
        'Readable wetness / small_beads': 763,
        'Readable wetness / coalesced_beads': 95}
CANOPY = 'Dry clay / eight tensioned gores'
HEM = 'Dry clay / chord-scalloped continuous hem'
WATER = 'Hybrid clear wet canopy / clear resolved water caps'
OUTER = 'Closed PVC 020mm / outer clear dielectric with retained wet rel'
UV_NAME = 'ConnectedWetField_SurfaceMetric_v1'
COLLECTION = 'Fine-first water / coherent short runoff correction'
SEAT = 0.000010


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


def _restore_fine(bpy, transform, collection, water):
    """Append only donor fine meshes, preserving their UVs and custom normals."""
    from mathutils import Matrix
    digest = hashlib.sha256(DONOR.read_bytes()).hexdigest()
    if digest != DONOR_SHA256:
        raise RuntimeError('Fine donor hash mismatch; refusing to guess its ancestry')
    snapshot = json.loads(DONOR_SNAPSHOT.read_text())['objects']
    before = {kind: {x.as_pointer() for x in getattr(bpy.data, kind)}
              for kind in ('materials', 'images', 'node_groups', 'textures')}
    mesh_names = [snapshot[n]['data'] for n in FINE]
    with bpy.data.libraries.load(str(DONOR), link=False) as (source, target):
        missing = [n for n in mesh_names if n not in source.meshes]
        if missing:
            raise RuntimeError('Missing requested donor meshes: ' + str(missing))
        target.meshes = mesh_names
    records = []
    for name, mesh in zip(FINE, target.meshes):
        if mesh is None:
            raise RuntimeError('Donor mesh append failed: ' + name)
        mesh.materials.clear()
        mesh.materials.append(water)
        for poly in mesh.polygons:
            poly.material_index = 0
        obj = bpy.data.objects.get(name)
        if obj is None:
            obj = bpy.data.objects.new(name, mesh)
            collection.objects.link(obj)
        else:
            obj.data = mesh
        # The donor's stored world matrix is identity today, but use its actual
        # recorded value so a future source cannot silently be treated as identity.
        donor_world = Matrix(snapshot[name]['canonical_world'])
        obj.matrix_world = transform @ donor_world
        obj.hide_render = False
        obj.hide_viewport = False
        obj['connected_bodies'] = FINE[name]
        obj['fine_first_source'] = str(DONOR)
        records.append({'object': name, 'donor_components': FINE[name],
                        'vertices': len(mesh.vertices), 'polygons': len(mesh.polygons),
                        'custom_normals': bool(mesh.has_custom_normals),
                        'uv_layers': list(mesh.uv_layers.keys()),
                        'donor_world_matrix': [list(row) for row in donor_world],
                        'final_world_matrix': [list(row) for row in obj.matrix_world],
                        'restored_without_random_thinning': True})
    removed = {}
    for kind in ('materials', 'textures', 'node_groups', 'images'):
        data = getattr(bpy.data, kind)
        new = [x for x in data if x.as_pointer() not in before[kind]]
        removed[kind] = [x.name for x in new]
        for x in new:
            data.remove(x, do_unlink=True)
    return records, removed


def _neutral_water_images(bpy):
    """Retire obsolete normal-only water; leave all sheet/roughness data intact."""
    import numpy as np
    nodes = bpy.data.materials[OUTER].node_tree.nodes
    pairs = [('Verified water-drop height', 'Map Range', 'Fine-first water / neutral height'),
             ('Verified water-drop opacity', 'Hybrid clear wet canopy / localized water support, not opacity',
              'Fine-first water / neutral support')]
    result = []
    for node_name, range_name, image_name in pairs:
        old = nodes[node_name].image
        w, h = tuple(old.size) if old else (2048, 1024)
        value = float(nodes[range_name].inputs['From Min'].default_value)
        image = bpy.data.images.new(image_name, width=w, height=h, alpha=True, float_buffer=True)
        image.colorspace_settings.name = 'Non-Color'
        pixels = np.ones((h, w, 4), dtype=np.float32)
        pixels[:, :, :3] = value
        image.pixels.foreach_set(pixels.ravel())
        image.update()
        image.pack()
        nodes[node_name].image = image
        result.append({'node': node_name, 'old_image': old.name if old else None,
                       'new_image': image.name, 'encoded_zero_value': value,
                       'size': [w, h]})
    return result


def apply(bpy, old_to_new_matrix, *, rebuild_water_images=True, report_path=None):
    """Apply once to a loaded, already posed current base; return a JSON report.

    The optional report file is the only filesystem output. Scene save/render and
    final raw/denoised native-pixel acceptance belong to the caller.
    """
    from mathutils import Matrix, Vector
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    from bpy_extras.object_utils import world_to_camera_view

    if bpy.data.collections.get(COLLECTION):
        raise RuntimeError('Water patch already applied; reload the unpatched base before retrying')
    transform = Matrix(old_to_new_matrix)
    scales = [transform.to_3x3().col[i].length for i in range(3)]
    scale = sum(scales) / 3
    if scale <= 0 or max(scales) - min(scales) > 1e-5 or transform.to_3x3().determinant() <= 0:
        raise RuntimeError('old_to_new_matrix must be a positive rigid/uniform-scale transform')
    unit_cols = [transform.to_3x3().col[i].normalized() for i in range(3)]
    if max(abs(unit_cols[i].dot(unit_cols[j])) for i in range(3) for j in range(i)) > 1e-5:
        raise RuntimeError('old_to_new_matrix contains shear')
    bpy.context.view_layer.update()
    shader_before = _shader_state(bpy)
    scene = bpy.context.scene
    camera = scene.camera
    canopy = bpy.data.objects[CANOPY]
    water = bpy.data.materials[WATER]
    mesh = canopy.data
    mesh.calc_loop_triangles()
    if len(mesh.vertices) < 12289 or len(mesh.polygons) < 12288:
        raise RuntimeError('Current exterior does not have the frozen 48 × 256 canopy topology')
    uv_layer = mesh.uv_layers.get(UV_NAME)
    if uv_layer is None:
        raise RuntimeError('Actual surface metric UV chart is missing')
    world = [canopy.matrix_world @ v.co for v in mesh.vertices[:12289]]
    tri_data = [t for t in mesh.loop_triangles if t.polygon_index < 12288]
    triangles = [tuple(t.vertices) for t in tri_data]
    normal_matrix = canopy.matrix_world.to_3x3().inverted().transposed()
    normals = [[(normal_matrix @ mesh.corner_normals[j].vector).normalized() for j in t.loops] for t in tri_data]
    uv_triangles = [[Vector((*uv_layer.data[j].uv, 0)) for j in t.loops] for t in tri_data]
    surface = BVHTree.FromPolygons(world, triangles, all_triangles=True)
    up_axis = (transform.to_3x3() @ Vector((0.5081059403423753, 0.07101421895840652, 0.8583620064369799))).normalized()
    down = Vector((0, 0, -1))
    rng = random.Random(202610090208)
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
    existing = []
    for obj in scene.objects:
        if (obj.name.startswith('Readable wetness / form') or
            obj.name in ('Wet PVC / rounded middle beads and joined runoff',
                         'Wet PVC / readable mesoscopic water hierarchy')):
            obj.hide_render = True
            obj.hide_viewport = True
            existing.append(obj.name)
    fine_report, removed_dependencies = _restore_fine(bpy, transform, collection, water)
    bpy.context.view_layer.update()
    vertices, faces, smooth, loop_normals = [], [], [], []
    records, contacts, reservations = [], [], []

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
        contacts.extend(vs[i] for row in bottoms for i in row)
        add(vs, fs, top, ns, {'type': 'rounded_' + role, 'anchor_world': list(q),
                            'anchor_uv': uv_at(q, k), 'diameter_mm': diameter * 1000,
                            'elongation': elongation, 'height_mm': height * 1000})

    # Sparse small accents are selected in the final camera, rather than inherited
    # from the old interior-only UV acceptance window.
    candidates = []
    for _ in range(2200):
        u, t = rng.random(), rng.uniform(.10, .91)
        q, n, k = at_uv(u, t)
        px = project(q)
        candidates.append((q, n, k, px))
    ymin = min(p[3].y for p in candidates)
    ymax = max(p[3].y for p in candidates)
    crest = [p for p in candidates if p[3].y < ymin + .19 * (ymax - ymin)]
    rng.shuffle(crest)
    for q, n, k, px in crest:
        if sum(r['type'] == 'rounded_crest' for r in records) >= 22:
            break
        if clear(q, .006):
            diameter = rng.uniform(.0025, .0045)
            cap(q, diameter, rng.uniform(1, 1.18), diameter * rng.uniform(.23, .33), 'crest')
    rim_candidates = [at_uv((j + .31) / 128, rng.uniform(.964, .981))[0] for j in range(128)]
    rng.shuffle(rim_candidates)
    for q in rim_candidates:
        if sum(r['type'] == 'rounded_rim' for r in records) >= 10:
            break
        if clear(q, .007):
            diameter = rng.uniform(.0022, .0038)
            cap(q, diameter, rng.uniform(1, 1.15), diameter * rng.uniform(.24, .34), 'rim')

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
        center = path[len(path) // 2]
        reservations.append((center, length * .5 + .001))
        add(vs, fs, top, ns, {'type': 'short_lobed_track', 'group': group,
                            'anchor_world': list(q0), 'anchor_uv': uv_at(q0, near(q0)[2]),
                            'length_mm': length * 1000, 'max_authored_width_mm': width * 1000,
                            'peak_height_mm': height * 1000,
                            'downhill_drop_mm': (path[0].z - path[-1].z) * MPU * 1000,
                            'maximum_uphill_step_mm': max(0, max((b.z - a.z) * MPU * 1000 for a, b in zip(path, path[1:])))})
        return qe

    # Sample area proportionally; keep paths short rather than overlaying long
    # tongues. Twelve downstream companions create clearly broken track groups.
    weights, running = [], 0.0
    for a, b, c in triangles:
        running += (world[b] - world[a]).cross(world[c] - world[a]).length / 2
        weights.append(running)
    for index in range(44):
        for attempt in range(2000):
            k = min(len(triangles) - 1, bisect.bisect_left(weights, rng.random() * running))
            a, b, c = triangles[k]
            x, y = rng.random(), rng.random()
            if x + y > 1:
                x, y = 1 - x, 1 - y
            q, n, k = near(world[a] + (world[b] - world[a]) * x + (world[c] - world[a]) * y)
            u, t = uv_at(q, k)
            seam = (u * 8) % 1
            if .22 < t < .925 and min(seam, 1 - seam) > .055 and clear(q, .012):
                break
        else:
            raise RuntimeError('Cannot place non-overlapping short tracks')
        length = rng.uniform(.0055, .0160)
        width = rng.uniform(.0011, .0025)
        end = track(q, length, width, min(.00085, width * rng.uniform(.24, .37)), rng.random() * 6.28, index)
        if index < 12:
            # The companion is separately closed, leaving a genuine 1.2–3 mm gap.
            start = walk(end, rng.uniform(.0012, .0030))[-1]
            if uv_at(start, near(start)[2])[1] < .95:
                track(start, rng.uniform(.003, .0075), width * rng.uniform(.55, .9),
                      width * .22, rng.random() * 6.28, index)

    # Actual lower hem support, with camera spacing and gravity-low eligibility.
    hem_candidates = []
    for j in range(256):
        q, n, k = at_uv(j / 256, .999999)
        hit = hem_surface.ray_cast(q + down * (.009 / MPU), -down, .018 / MPU)
        if hit[0] is None:
            continue
        p, hn, _, _ = hit
        if hn.z > -.18:
            continue
        hem_candidates.append((p, hn.normalized(), project(p), j / 256))
    if len(hem_candidates) < 7:
        raise RuntimeError('Could not locate enough gravity-facing actual hem supports')
    zmin = min(p[0].z for p in hem_candidates)
    zmax = max(p[0].z for p in hem_candidates)
    threshold = zmin + .61 * (zmax - zmin)
    low = [p for p in hem_candidates if p[0].z <= threshold]
    low.sort(key=lambda p: p[2].x)
    selected = []
    for fraction in [.025, .16, .31, .49, .68, .83, .975]:
        target_x = low[0][2].x + fraction * (low[-1][2].x - low[0][2].x)
        choices = sorted(low, key=lambda p: abs(p[2].x - target_x) + .20 * (p[2].y - max(v[2].y for v in low)) ** 2)
        pick = next((p for p in choices if all((p[0] - s[0]).length * MPU > .020 and (p[2] - s[2]).length > 5.5 for s in selected)), None)
        if pick:
            selected.append(pick)
    if len(selected) < 5:
        raise RuntimeError('Too few separately readable hem outlets after final-pose selection')

    def pendant(item, index):
        q, hn, px, u = item
        side = Vector((1, 0, 0)); cross = Vector((0, 1, 0))
        length = [.0053, .0074, .0091, .0045, .0064, .0082, .0058][index]
        diameter = [.0018, .0023, .0028, .0015, .0021, .0025, .0019][index]
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
                            'attachment_world': list(q), 'length_mm': length * 1000,
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
        if index in (1, 3, 5, 6):
            detached(tip + down * (rng.uniform(.003, .007) / MPU), diameter * rng.uniform(.37, .48),
                     rng.uniform(1.04, 1.22), index)

    newmesh = bpy.data.meshes.new('Fine-first water / closed restrained surface bodies')
    newmesh.from_pydata(vertices, [], faces)
    newmesh.update()
    newmesh.materials.append(water)
    for p, sm in zip(newmesh.polygons, smooth):
        p.use_smooth = sm
    newmesh.normals_split_custom_set(loop_normals)
    obj = bpy.data.objects.new('Wet PVC / restrained accents short tracks and hem drops', newmesh)
    collection.objects.link(obj)
    obj['static_current_state'] = True
    obj['connected_bodies'] = len(records)
    images = _neutral_water_images(bpy) if rebuild_water_images else []
    bpy.context.view_layer.update()
    if _shader_state(bpy) != shader_before:
        raise RuntimeError('Protected shader values, wiring, or unrelated image bindings changed')
    counts = {}
    for rec in records:
        counts[rec['type']] = counts.get(rec['type'], 0) + 1
    gaps = [surface.find_nearest(p)[3] * MPU for p in contacts]
    report = {'version': 1, 'donor': str(DONOR), 'donor_sha256': DONOR_SHA256,
              'transform': [list(row) for row in transform], 'uniform_scale': scale,
              'retired_visible_water_objects': existing,
              'fine_meshes': fine_report, 'fine_source_total': sum(FINE.values()),
              'donor_dependency_datablocks_removed': removed_dependencies,
              'new_authored_counts': counts, 'new_authored_geometry': {'vertices': len(vertices),
                  'polygons': len(faces), 'triangles': sum(len(f) - 2 for f in faces)},
              'new_authored_volume_ul': sum(r['volume_ul'] for r in records),
              'actual_outer_surface_contact_gap_um': [min(gaps) * 1e6, max(gaps) * 1e6],
              'water_images': images, 'current_material_node_values_and_wiring_unchanged': True,
              'paired_fold_and_roughness_images_unchanged': True,
              'canopy_geometry_and_PVC_thickness_unchanged': True,
              'new_objects': [obj.name], 'records': records,
              'approximations': [
                  'Authored transient water geometry; no fluid, equilibrium, mass-conservation or measured contact-angle claim.',
                  'The full fine donor is restored without random thinning; tiny fine/new-body overlaps are not boolean-unioned.',
                  'New tracks use the actual outer BVH and gravity, with bounded lateral wandering; separate companion shells make real breaks.',
                  'Finite pendant contact disks use evaluated lower hem geometry; 10 micrometre dielectric seating allowance is retained.',
                  'Normal-only water is neutralized, eliminating all old broad relief islands, absorption holes and long water tracks; retained fine/new physical shells provide water.',
                  'Existing shader roughness map is deliberately preserved, including any historical wetness imprint.',
                  'Donor matrix uses the exact saved donor-object snapshot; that snapshot predates outlet-only changes which do not transform fine meshes.',
                  'Native900 raw and delivery-denoised visual acceptance is still required; count/geometry checks are not visual acceptance.'],
              'no_base_open_no_blend_save_no_render': True}
    if not rebuild_water_images:
        report['approximations'].append('Water image rebuilding was disabled; obsolete holes and long texture tracks remain.')
    if report_path is not False:
        destination = Path(report_path) if report_path else D / 'COHERENT-WATER-PATCH-REPORT.json'
        destination.write_text(json.dumps(report, indent=2))
    print('COHERENT_WATER_PATCH_APPLIED', json.dumps({
        'fine_source_total': report['fine_source_total'], 'new_authored_counts': counts,
        'retired_old_forms': len(existing), 'contact_gap_um': report['actual_outer_surface_contact_gap_um'],
        'water_field': 'neutralized' if images else 'unchanged'}), flush=True)
    return report
