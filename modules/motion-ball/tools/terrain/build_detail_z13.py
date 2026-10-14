# Detail map (normals + concavity) for the Fuji area from z13 tiles (~15.6 m), 4096 px wide.
import math, subprocess, sys, array
D = '/tmp/claude-504/assets/dem13'
Z = 13
X0, X1, Y0, Y1 = map(int, open(f'{D}/range.txt').read().split())
T = 256; W = (X1 - X0 + 1) * T; H = (Y1 - Y0 + 1) * T
hm = array.array('f', bytes(4 * W * H))
for tx in range(X0, X1 + 1):
    for ty in range(Y0, Y1 + 1):
        raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', f'{D}/t_{tx}_{ty}.png', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
        ox, oy = (tx - X0) * T, (ty - Y0) * T
        for y in range(T):
            row = (oy + y) * W + ox; k = y * T * 3
            for x in range(T):
                hm[row + x] = raw[k] * 256 + raw[k + 1] + raw[k + 2] / 256 - 32768; k += 3
fixed = 0
for y in range(3, H - 3):
    row = y * W
    for x in range(3, W - 3):
        c = hm[row + x]
        m4 = (hm[row + x - 2] + hm[row + x + 2] + hm[row - 2 * W + x] + hm[row + 2 * W + x]) * 0.25
        if abs(c - m4) < 60: continue
        nb = sorted(hm[(y + j) * W + x + i] for j in range(-2, 3) for i in range(-2, 3))
        if abs(c - nb[12]) > 100: hm[row + x] = nb[12]; fixed += 1
print('mosaic', W, H, 'despiked', fixed, file=sys.stderr)

def dem(lat, lon):
    n = 2 ** Z
    fx = ((lon + 180) / 360 * n - X0) * T - 0.5
    la = math.radians(lat)
    fy = ((1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n - Y0) * T - 0.5
    x0 = int(fx); y0 = int(fy)
    if x0 < 0 or y0 < 0 or x0 + 1 >= W or y0 + 1 >= H: return None
    tx, ty = fx - x0, fy - y0; i = y0 * W + x0
    return (hm[i] * (1 - tx) + hm[i + 1] * tx) * (1 - ty) + (hm[i + W] * (1 - tx) + hm[i + W + 1] * tx) * ty

LAT0, LON0 = 35.5235, 138.7370; FLAT, FLON = 35.3606, 138.7274
LAKE = 833.0; MLAT = 110574.0; MLON = 111320.0 * math.cos(math.radians(LAT0))
fe, fn = (FLON - LON0) * MLON, (FLAT - LAT0) * MLAT
FB = math.atan2(fe, fn); FD = math.hypot(fe, fn); AF = 0.2; K = 6800.0 / FD; VEX = 1.1; REFF = 6371000.0 / 0.87
def scene_h(xs, zs):
    r = math.hypot(xs, zs) / K; a = math.atan2(xs, -zs); b = FB + (a - AF)
    h = dem(LAT0 + math.cos(b) * r / MLAT, LON0 + math.sin(b) * r / MLON)
    return -40.0 if h is None else (h - LAKE - r * r / (2 * REFF)) * K * VEX

DX0, DX1, DZ0, DZ1 = -9500.0, 12500.0, -15000.0, -1500.0
NW = 4096; NH = int(round(NW * (DZ1 - DZ0) / (DX1 - DX0)))
sx = (DX1 - DX0) / NW; sz = (DZ1 - DZ0) / NH
g = array.array('f', bytes(4 * NW * NH))
for v in range(NH):
    zs = DZ0 + (v + 0.5) * sz; o = v * NW
    for u in range(NW): g[o + u] = scene_h(DX0 + (u + 0.5) * sx, zs)
print('grid', NW, NH, 'texel %.2f m' % sx, file=sys.stderr)
def G(u, v): return g[min(NH - 1, max(0, v)) * NW + min(NW - 1, max(0, u))]
rgb = bytearray(NW * NH * 3); laps = array.array('f', bytes(4 * NW * NH))
R = 8   # concavity at the same physical scale as the z12 map (~43 m scene)
for v in range(NH):
    for u in range(NW):
        dx = (G(u + 1, v) - G(u - 1, v)) / (2 * sx); dz = (G(u, v + 1) - G(u, v - 1)) / (2 * sz)
        L = math.sqrt(dx * dx + 1 + dz * dz)
        k = (v * NW + u) * 3
        rgb[k] = max(0, min(255, int(round((-dx / L * 0.5 + 0.5) * 255))))
        rgb[k + 1] = max(0, min(255, int(round((-dz / L * 0.5 + 0.5) * 255))))
        laps[v * NW + u] = (G(u - R, v) + G(u + R, v) + G(u, v - R) + G(u, v + R)) / 4 - G(u, v)
s = sorted(abs(laps[i]) for i in range(0, len(laps), 13)); scale = s[int(len(s) * 0.98)] or 1
for i in range(len(laps)): rgb[i * 3 + 2] = max(0, min(255, int(round(128 + 127 * laps[i] / scale))))
open(f'{D}/detail.rgb', 'wb').write(rgb)
print('done', NW, NH, 'lapscale', scale, file=sys.stderr)
