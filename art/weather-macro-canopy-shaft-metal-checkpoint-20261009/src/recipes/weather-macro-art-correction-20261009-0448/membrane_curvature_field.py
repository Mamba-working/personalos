"""One deterministic metric connected-ribbon displacement proposal.
Pure NumPy; never opens or writes a Blender scene and never renders.
API: h_m, support, info = evaluate_membrane_curvature(outer_grid_bu, normals_grid)
Input shape: (radial_count+1, angular_count, 3), crown duplicated in row 0.
Output h_m is metres (divide by 15/88 when displacing Blender-unit vertices).
"""
import numpy as np
from consultant_connected_membrane_field_0528 import connected_height, _smoothstep
MPU = 15. / 88.
# Angular entries use the ORIGINAL 256-column indexing, independent of refinement.
# These deliberately nonperiodic paths form 5 main runoff systems and tributaries.
# Each tributary ends exactly on its parent path. All geometry is surface-attached.
PATHS = [
    dict(name='left upper trunk', coords=[(.40,115),(.57,119),(.74,118),(.90,123),(.995,122)], phase=.4, width_scale=1.12),
    dict(name='left front trunk', coords=[(.29,126),(.46,132),(.62,134),(.79,132),(.94,134),(.995,133)], phase=1.7, width_scale=1.10),
    dict(name='left front tributary', coords=[(.59,141),(.66,138),(.73,133),(.79,132)], phase=2.3, width_scale=1.0, taper_end=False),
    dict(name='central front trunk', coords=[(.25,139),(.42,141),(.57,138),(.74,141),(.89,140),(.995,143)], phase=1.1, width_scale=1.15),
    dict(name='central front tributary', coords=[(.48,146),(.56,145),(.64,144),(.74,141)], phase=4.2, width_scale=1.0, taper_end=False),
    dict(name='right front trunk', coords=[(.22,151),(.38,148),(.56,151),(.75,150),(.90,153),(.995,151)], phase=3.1, width_scale=1.10),
    dict(name='right front tributary', coords=[(.56,158),(.62,156),(.69,154),(.75,150)], phase=5.3, width_scale=1.0, taper_end=False),
    dict(name='outer slope trunk', coords=[(.20,166),(.36,167),(.55,163),(.74,168),(.90,167),(.995,171)], phase=5.0, width_scale=1.15),
    dict(name='outer slope tributary', coords=[(.50,178),(.58,175),(.66,171),(.74,168)], phase=.1, width_scale=1.0, taper_end=False),
]


def _sample_grid(grid, t, angle256):
    t = np.asarray(t); a = np.asarray(angle256) % 256.
    nr, na = grid.shape[0] - 1, grid.shape[1]
    r = np.clip(t, 0., 1.) * nr
    ir = np.minimum(np.floor(r).astype(int), nr - 1)
    fr = r - ir
    aa = a * na / 256.
    ia = np.floor(aa).astype(int) % na
    fa = aa - np.floor(aa)
    j = (ia + 1) % na
    p0 = grid[ir, ia] * (1. - fa[..., None]) + grid[ir, j] * fa[..., None]
    p1 = grid[ir + 1, ia] * (1. - fa[..., None]) + grid[ir + 1, j] * fa[..., None]
    return p0 * (1. - fr[..., None]) + p1 * fr[..., None]


def _smooth_chart_path(coords, samples_per_segment=24):
    """Nonuniform cubic Hermite interpolation; exact endpoints/merge coordinates."""
    q = np.asarray(coords, dtype=float)
    u = np.r_[0., np.cumsum(np.linalg.norm(np.diff(q, axis=0) * [1., 1./256.], axis=1))]
    derivative = np.empty_like(q)
    derivative[0] = (q[1] - q[0]) / (u[1] - u[0])
    derivative[-1] = (q[-1] - q[-2]) / (u[-1] - u[-2])
    derivative[1:-1] = (q[2:] - q[:-2]) / (u[2:] - u[:-2])[:, None]
    out = []
    for i in range(len(q) - 1):
        f = np.linspace(0., 1., samples_per_segment, endpoint=False)[:, None]
        du = u[i + 1] - u[i]
        out.append((2*f**3-3*f**2+1)*q[i] + (f**3-2*f**2+f)*du*derivative[i]
                   + (-2*f**3+3*f**2)*q[i+1] + (f**3-f**2)*du*derivative[i+1])
    return np.vstack(out + [q[-1:]])


def evaluate_membrane_curvature(outer_grid_bu, normals_grid, *, pin_ribs=True):
    grid = np.asarray(outer_grid_bu, dtype=float) * MPU
    normals = np.asarray(normals_grid, dtype=float)
    assert grid.shape == normals.shape and grid.ndim == 3 and grid.shape[-1] == 3
    nr, na = grid.shape[0] - 1, grid.shape[1]
    tt, aa = np.meshgrid(np.linspace(0., 1., nr + 1), np.arange(na)*256./na, indexing='ij')
    flat = grid.reshape(-1, 3)
    crown_dist = np.linalg.norm(grid - grid[0, :1], axis=-1)
    rim_dist = np.linalg.norm(grid - grid[-1:, :, :], axis=-1)
    taper = _smoothstep((crown_dist - .012)/.015) * _smoothstep(rim_dist/.015)
    # World-height and physical upward-normal gate, no camera, pixel or UV mask.
    # Upper actual roof gets full field, lower transparent panels retain their form.
    taper *= _smoothstep((grid[..., 2] - .385)/.065)
    taper *= _smoothstep((normals[..., 2] - .38)/.20)
    if pin_ribs:
        nearest_rib_a = np.round(aa/32.)*32.
        rib = _sample_grid(grid, tt, nearest_rib_a)
        rib_distance = np.linalg.norm(grid - rib, axis=-1)
        taper *= _smoothstep(rib_distance/.012)
    active = taper.reshape(-1) > 1e-8
    paths = []
    for spec in PATHS:
        chart = _smooth_chart_path(spec['coords'])
        p = _sample_grid(grid, chart[:, 0], chart[:, 1])
        # Re-sample to <=1 mm polyline edges, limiting distance approximation error.
        arc = np.r_[0., np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
        at = np.linspace(0., arc[-1], max(2, int(np.ceil(arc[-1]/.001)) + 1))
        p = np.stack([np.interp(at, arc, p[:, j]) for j in range(3)], axis=-1)
        paths.append(dict(points=p, phase=spec['phase'], width_scale=spec['width_scale'],
                          taper_start=True, taper_end=spec.get('taper_end', False)))
    h = np.zeros(len(flat))
    # Only upper surface support is evaluated; peak memory remains bounded.
    h[active] = connected_height(flat[active], paths, taper.reshape(-1)[active])
    # Support is geometric displacement support, not opacity or shader mixing.
    support = (np.abs(h) > 1e-8).astype(float)
    info = dict(method='connected signed PVC membrane ridges with compact C2 support',
                amplitude_parameter_mm=1.5, narrow_halfwidth_mm=7., broad_halfwidth_mm=24.,
                base_profile_range_mm=[-.414159,.975], base_profile_max_normal_rotation_deg=19.371,
                thickness_mm=.20, position_units='input Blender units, output height metres',
                mpu=MPU, grid_shape=list(grid.shape), active_vertices=int(active.sum()),
                support_vertices=int(support.sum()), height_min_mm=float(h.min()*1000),
                height_max_mm=float(h.max()*1000), pin_ribs=bool(pin_ribs),
                world_height_gate_m=[.385,.450], upward_normal_z_gate=[.38,.58])
    return h.reshape(nr+1,na), support.reshape(nr+1,na), info
