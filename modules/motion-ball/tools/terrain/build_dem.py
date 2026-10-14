# Build the backdrop terrain from AWS Terrain Tiles (z12, terrarium): the view south from the north
# shore of Lake Kawaguchi, scaled into the scene so Mt Fuji stands 6.8 km away at azimuth +0.2 rad.
import math, struct, subprocess, os, sys
D = '/tmp/claude-504/assets/dem12'
Z = 12; X0, X1, Y0, Y1 = 3618, 3634, 1615, 1623
T = 256
W = (X1 - X0 + 1) * T; H = (Y1 - Y0 + 1) * T
# ---- mosaic (metres)
hm = [0.0] * (W * H)
for tx in range(X0, X1 + 1):
    for ty in range(Y0, Y1 + 1):
        f = f'{D}/t_{tx}_{ty}.png'
        raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', f, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
        ox, oy = (tx - X0) * T, (ty - Y0) * T
        for y in range(T):
            row = (oy + y) * W + ox
            for x in range(T):
                k = (y * T + x) * 3
                hm[row + x] = raw[k] * 256 + raw[k + 1] + raw[k + 2] / 256 - 32768
print('mosaic', W, H, file=sys.stderr)
# despike: the tiles carry a few bad samples (narrow towers of hundreds of metres); replace any
# sample far above or below its 5x5 neighbourhood median
fixed = 0
for it in range(2):
    for y in range(3, H - 3):
        row = y * W
        for x in range(3, W - 3):
            c = hm[row + x]
            m4 = (hm[row + x - 2] + hm[row + x + 2] + hm[row - 2 * W + x] + hm[row + 2 * W + x]) * 0.25
            if abs(c - m4) < 60: continue
            nb = sorted(hm[(y + j) * W + x + i] for j in range(-2, 3) for i in range(-2, 3))
            med = nb[12]
            if abs(c - med) > 100:
                hm[row + x] = med; fixed += 1
print('despiked', fixed, file=sys.stderr)

def px_of(lat, lon):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    la = math.radians(lat)
    y = (1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n
    return (x - X0) * T, (y - Y0) * T

def dem(lat, lon):
    fx, fy = px_of(lat, lon)
    fx -= 0.5; fy -= 0.5
    x0 = int(math.floor(fx)); y0 = int(math.floor(fy))
    if x0 < 0 or y0 < 0 or x0 + 1 >= W or y0 + 1 >= H: return None
    tx, ty = fx - x0, fy - y0
    a = hm[y0 * W + x0]; b = hm[y0 * W + x0 + 1]; c = hm[(y0 + 1) * W + x0]; d = hm[(y0 + 1) * W + x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty

LAT0, LON0 = 35.5235, 138.7370          # viewpoint: north shore of Lake Kawaguchi
FLAT, FLON = 35.3606, 138.7274          # Kengamine, the summit of Mt Fuji
LAKE = 833.0
MLAT = 110574.0; MLON = 111320.0 * math.cos(math.radians(LAT0))
fe, fn = (FLON - LON0) * MLON, (FLAT - LAT0) * MLAT
FB = math.atan2(fe, fn); FD = math.hypot(fe, fn)
AF = 0.2; FUJI_SCENE = 6800.0
K = FUJI_SCENE / FD                      # scene metres per real metre
VEX = 1.1                                # gentle vertical exaggeration
REFF = 6371000.0 / 0.87                  # earth curvature with standard refraction
print('fuji bearing %.2f deg, %.0f m, scale %.4f' % (math.degrees(FB), FD, K), file=sys.stderr)

def scene_h(xs, zs):
    """Scene height at scene (x, z) (camera at the origin looking -z), or None outside the DEM."""
    r = math.hypot(xs, zs) / K
    a = math.atan2(xs, -zs)
    b = FB + (a - AF)
    e, n = math.sin(b) * r, math.cos(b) * r
    h = dem(LAT0 + n / MLAT, LON0 + e / MLON)
    if h is None: return None
    return (h - LAKE - r * r / (2 * REFF)) * K * VEX

# ---- polar grid for the mesh (same parametrisation as Terrain.buildGeometry)
AZ, RAD, R0, R1, A0, A1 = 1100, 320, 650.0, 25000.0, -1.5, 1.5
out = bytearray()
lo = 1e9; hi = -1e9; miss = 0
for j in range(RAD + 1):
    r = R0 * (R1 / R0) ** (j / RAD)
    for i in range(AZ + 1):
        a = A0 + (A1 - A0) * i / AZ
        h = scene_h(math.sin(a) * r, -math.cos(a) * r)
        if h is None: h = -40.0; miss += 1
        lo = min(lo, h); hi = max(hi, h)
        out += struct.pack('<H', max(0, min(65535, int(round((h + 50.0) * 20.0)))))
open(f'{D}/polar.u16', 'wb').write(out)
print('polar', AZ + 1, RAD + 1, 'h range %.0f..%.0f' % (lo, hi), 'missing', miss, file=sys.stderr)

# ---- detail map in scene x/z: normals (RG) + concavity (B)
DX0, DX1, DZ0, DZ1 = -9500.0, 12500.0, -15000.0, -1500.0
NW = 2048; NH = int(round(NW * (DZ1 - DZ0) / (DX1 - DX0)))
sx = (DX1 - DX0) / NW; sz = (DZ1 - DZ0) / NH
g = [0.0] * (NW * NH)
for v in range(NH):
    zs = DZ0 + (v + 0.5) * sz          # image row 0 (top) = farthest z
    for u in range(NW):
        h = scene_h(DX0 + (u + 0.5) * sx, zs)
        g[v * NW + u] = -40.0 if h is None else h
print('detail grid', NW, NH, 'texel %.1f m' % sx, file=sys.stderr)
def G(u, v): return g[min(NH - 1, max(0, v)) * NW + min(NW - 1, max(0, u))]
rgb = bytearray(NW * NH * 3)
laps = []
for v in range(NH):
    for u in range(NW):
        dx = (G(u + 1, v) - G(u - 1, v)) / (2 * sx)
        dz = (G(u, v + 1) - G(u, v - 1)) / (2 * sz)
        L = math.sqrt(dx * dx + 1 + dz * dz)
        nx, nz = -dx / L, -dz / L
        # concavity at ~100 m (scene ~40 m): + in gullies and hollows, - on ridges
        lap = (G(u - 4, v) + G(u + 4, v) + G(u, v - 4) + G(u, v + 4)) / 4 - G(u, v)
        k = (v * NW + u) * 3
        rgb[k] = max(0, min(255, int(round((nx * 0.5 + 0.5) * 255))))
        rgb[k + 1] = max(0, min(255, int(round((nz * 0.5 + 0.5) * 255))))
        laps.append(lap)
s = sorted(abs(x) for x in laps[::7]); scale = s[int(len(s) * 0.98)] or 1
for i, lap in enumerate(laps):
    rgb[i * 3 + 2] = max(0, min(255, int(round(128 + 127 * lap / scale))))
open(f'{D}/detail.rgb', 'wb').write(rgb)
open(f'{D}/meta.txt', 'w').write(f'polar {AZ} {RAD} {R0} {R1}\ndetail {NW} {NH} {DX0} {DX1} {DZ0} {DZ1}\nlapscale {scale}\nK {K}\nVEX {VEX}\nLAKE {LAKE}\nREFF {REFF}\n')
print('lap scale (scene m)', scale, file=sys.stderr)
