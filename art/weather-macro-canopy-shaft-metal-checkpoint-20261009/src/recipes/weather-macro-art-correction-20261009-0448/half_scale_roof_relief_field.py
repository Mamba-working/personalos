"""One fixed continuous, surface-attached two-dimensional roof relief.

Pure NumPy. No scene mutation, material edits, file I/O or rendering.
API: evaluate_half_scale_roof_relief(grid_bu, normals) -> height_metres, support, info.
Input grid is (NR+1, NA, 3), with a duplicated crown row and cyclic angle.
The field is an isotropic world-space scalar restricted to the curved sheet,
not a UV texture, path network, set of finite islands or fluid simulation.
"""
import numpy as np

MPU = 15.0 / 88.0
SEED = 6100917
NORMAL_BUDGET_DEGREES = 20.0
CORRELATION_SCALE = 0.50
RETAINED_AMPLITUDE_NORMALIZATION = 0.7506888198306904
# (modes, shortest and longest spatial wavelength in mm, relative height RMS)
BANDS = ((24, 22.5, 35.0, .55),
         (72, 10.0, 22.5, 1.00),
         (40, 5.0, 8.0, .085))


def _smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x*x*x*(10.0 + x*(-15.0 + 6.0*x))


def _normals(p):
    dr = np.gradient(p, axis=0)
    da = .5*(np.roll(p, -1, axis=1)-np.roll(p, 1, axis=1))
    n = np.cross(dr, da)
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-15)
    n[0] = np.mean(n[1], axis=0)
    n[0] /= np.maximum(np.linalg.norm(n[0], axis=-1, keepdims=True), 1e-15)
    return n


def _wave_band(p, rng, count, shortest_mm, longest_mm):
    """Random-phase, non-lattice plane waves; isotropic local sheet restriction.

    A single full-grid temporary per mode keeps memory O(vertices), rather
    than allocating a vertices x modes tensor. No camera or view enters here.
    """
    directions = rng.normal(size=(count, 3))
    directions /= np.linalg.norm(directions, axis=1, keepdims=True)
    # Stratified logarithmic lengths ensure every physical band is represented.
    t = (np.arange(count)+rng.random(count))/count
    rng.shuffle(t)
    wavelengths = np.exp(np.log(shortest_mm) +
                         t*np.log(longest_mm/shortest_mm))*.001
    phase = rng.uniform(0.0, 2.0*np.pi, count)
    out = np.zeros(p.shape[:2], dtype=np.float64)
    for v, wave, ph in zip(directions, wavelengths, phase):
        arg = (p[...,0]*v[0]+p[...,1]*v[1]+p[...,2]*v[2])*(2*np.pi/wave)+ph
        out += np.cos(arg)
    return out*np.sqrt(2.0/count), wavelengths


def evaluate_half_scale_roof_relief(grid_bu, normals):
    p = np.asarray(grid_bu, dtype=np.float64)*MPU
    n = np.asarray(normals, dtype=np.float64)
    if p.ndim != 3 or p.shape[-1] != 3 or p.shape != n.shape:
        raise ValueError('Expected equal (NR+1, NA, 3) grid and normals')
    if p.shape[0] < 3 or p.shape[1] < 16 or not np.isfinite(p).all() or not np.isfinite(n).all():
        raise ValueError('Finite cyclic roof grid with at least three rows required')
    nr, na = p.shape[0]-1, p.shape[1]
    n = n/np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-15)

    # Crown, hem and eight structural ribs are fixed in actual metre distances.
    crown_distance = np.linalg.norm(p-p[0,:1], axis=-1)
    rim_distance = np.linalg.norm(p-p[-1:], axis=-1)
    aa = np.arange(na)*256.0/na
    rib_angle = (np.round(aa/32.0)*32.0)*na/256.0
    ri = np.floor(rib_angle).astype(np.int64)%na
    rf = (rib_angle-np.floor(rib_angle))[None,:,None]
    rib_point = p[:,ri]*(1.0-rf)+p[:,(ri+1)%na]*rf
    rib_distance = np.linalg.norm(p-rib_point, axis=-1)
    envelope = _smooth((crown_distance-.012)/.015)
    envelope *= _smooth(rim_distance/.018)
    envelope *= _smooth(rib_distance/.012)
    envelope *= _smooth((p[...,2]-.385)/.065)
    envelope *= _smooth((n[...,2]-.38)/.20)
    envelope[0] = 0.0
    envelope[-1] = 0.0

    rng = np.random.Generator(np.random.PCG64(SEED))
    # Broad smoothly varying quiet areas. Nonzero floor prevents a collection
    # of isolated relief bodies; genuine signed zero crossings remain natural.
    quiet_field, quiet_lengths = _wave_band(p, rng, 24, 32.5, 55.0)
    quiet = .06 + .94*_smooth((quiet_field+.55)/1.45)
    raw = np.zeros(p.shape[:2], dtype=np.float64)
    band_info = []
    for count, shortest, longest, amplitude in BANDS:
        wave, wavelengths = _wave_band(p, rng, count, shortest, longest)
        raw += amplitude*wave
        band_info.append(dict(modes=count, nominal_wavelength_mm=[shortest,longest],
                              realized_wavelength_mm=[float(wavelengths.min()*1000),float(wavelengths.max()*1000)],
                              relative_height_rms=amplitude))
    # Half the retained displacement together with every correlation length.
    # The retained scalar amplitude normalization is applied unchanged below.
    height = .0007*CORRELATION_SCALE*raw*quiet*envelope
    del raw, wave, quiet_field, rib_point
    base_normals = _normals(p)
    # Exactly one 0.50x spatial and displacement scaling. Retain the old scalar
    # amplitude normalization, rather than adding a new artistic gain fit.
    scale = RETAINED_AMPLITUDE_NORMALIZATION
    initial_normals = _normals(p+n*height[...,None])
    initial_max = float(np.rad2deg(np.arccos(np.clip(
        np.sum(base_normals*initial_normals,axis=-1),-1,1))).max())
    height *= scale
    final_normals = _normals(p+n*height[...,None])
    turn = np.rad2deg(np.arccos(np.clip(np.sum(base_normals*final_normals, axis=-1), -1, 1)))
    if float(turn.max()) > 20.05:
        raise RuntimeError('Half-scale field exceeds retained 20 degree safety limit')

    # Support removes only the old paired mesoscopic normal contribution.
    # It covers the continuous upper-sheet envelope, including quiet gaps;
    # it is never an opacity, roughness, light or reflection mask.
    support = _smooth(envelope/.15)
    active = envelope > .25
    info = dict(
        method='single half-scale refinement of the retained isotropic field; same phases, fixed structural envelope, proportional displacement',
        correlation_scale=CORRELATION_SCALE, displacement_scale=CORRELATION_SCALE, slope_preservation='Retained scalar amplitude normalization, no new peak-gain fit',
        seed=SEED, mpu=MPU, input_units='Blender world units', height_output_units='metres',
        grid_shape=list(p.shape), bands=band_info,
        quiet_envelope_wavelength_mm=[32.5,55.0],
        quiet_envelope_amplitude_range=[.06,1.0],
        wavelength_note='Lengths are world-space plane-wave wavelengths. Restriction to a tilted sheet can lengthen a mode but never shorten it; isotropic directions avoid a preferred tangent orientation.',
        physical_height_range_mm=[float(height.min()*1000),float(height.max()*1000)],
        height_mm_active_percentiles=np.percentile(height[active]*1000,[0,1,10,50,90,99,100]).tolist(),
        normal_turn_active_percentiles_degrees=np.percentile(turn[active],[0,10,50,90,99,100]).tolist(),
        normal_turn_max_degrees=float(turn.max()), geometric_normal_budget_degrees=NORMAL_BUDGET_DEGREES,
        starting_field_max_normal_turn_degrees=initial_max, geometric_scalar_normalization=float(scale),
        world_height_gate_m=[.385,.450], upward_normal_z_gate=[.38,.58],
        crown_zero_radius_mm=12.0,crown_full_radius_mm=27.0,
        rib_zero_at_center=True,rib_full_distance_mm=12.0,rim_full_distance_mm=18.0,
        envelope_vertices_over_quarter=int(active.sum()),
        quiet_fraction_of_active_envelope_below_025=float(np.mean(quiet[active]<.25)),
        support_vertices_over_half=int(np.count_nonzero(support>.5)),
        no_discrete_body_layout=True,no_narrow_path_skeleton=True,no_uv_or_camera_mask=True,
        no_scene_or_material_change=True,
        shell_instruction='Recompute displaced geometric normals, then inner=outer-normal*0.00020 metres, and stitch the rim. This helper creates no independent water or PVC interface.',
        modeling_disclosure='Shallow membrane/wet-film-like geometric relief, not a fluid or membrane-stress simulation')
    return height, support, info
