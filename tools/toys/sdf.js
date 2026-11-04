// Toy factory: each toy is a signed distance field built from rounded primitives with smooth unions, meshed
// with surface nets, projected onto the true surface, and baked with SDF ambient occlusion and soft shadow.
const { abs, max, min, sqrt, cos, sin, atan2, round, PI } = Math;
const l2 = (a, b) => sqrt(a * a + b * b);
const l3 = (a, b, c) => sqrt(a * a + b * b + c * c);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const rbox = (x, y, z, bx, by, bz, r) => { const qx = abs(x) - bx + r, qy = abs(y) - by + r, qz = abs(z) - bz + r; return l3(max(qx, 0), max(qy, 0), max(qz, 0)) + min(max(qx, qy, qz), 0) - r; };
export const sphere = (x, y, z, r) => l3(x, y, z) - r;
/** cylinder along y: radius ra, half height h, edge rounding r */
export const rcyl = (x, y, z, ra, h, r) => { const dx = l2(x, z) - ra + r, dy = abs(y) - h + r; return min(max(dx, dy), 0) + l2(max(dx, 0), max(dy, 0)) - r; };
/** ring in the x–z plane (axis y) */
export const torus = (x, y, z, R, r) => l2(l2(x, z) - R, y) - r;
export const capsule = (x, y, z, ax, ay, az, bx, by, bz, r) => {
  const px = x - ax, py = y - ay, pz = z - az, ex = bx - ax, ey = by - ay, ez = bz - az;
  const t = clamp((px * ex + py * ey + pz * ez) / (ex * ex + ey * ey + ez * ez), 0, 1);
  return l3(px - ex * t, py - ey * t, pz - ez * t) - r;
};
export const smin = (a, b, k) => { if (k <= 0) return min(a, b); const h = max(k - abs(a - b), 0) / k; return min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);
export function poly2(px, py, v) {
  let d = (px - v[0][0]) ** 2 + (py - v[0][1]) ** 2, s = 1;
  for (let i = 0, j = v.length - 1; i < v.length; j = i, i++) {
    const ex = v[j][0] - v[i][0], ey = v[j][1] - v[i][1], wx = px - v[i][0], wy = py - v[i][1];
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * t, by = wy - ey * t;
    d = min(d, bx * bx + by * by);
    const c1 = py >= v[i][1], c2 = py < v[j][1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * sqrt(d);
}
/** a 2D shape pushed out along z by ±h, every edge rounded by r */
export const extrude = (d2, z, h, r) => { const wx = d2 + r, wy = abs(z) - h + r; return min(max(wx, wy), 0) + l2(max(wx, 0), max(wy, 0)) - r; };

const add = (f, mat, k = 0) => ({ op: 'add', f, mat, k });
const sub = (f, k = 0) => ({ op: 'sub', f, k });
const paint = (f, mat) => ({ op: 'paint', f, mat });

/* ───────────────────────── the toys ───────────────────────── */
export const TOYS = {};

{ // a server: three bays, drive faces, status lights
  const parts = [add((x, y, z) => rbox(x, y - 0.86, z, 0.62, 0.86, 0.48, 0.24), 'cream')];
  for (const yy of [0.6, 1.12]) parts.push(sub((x, y, z) => rbox(x, y - yy, z - 0.48, 0.7, 0.024, 0.12, 0.02), 0.02));
  [0.33, 0.86, 1.39].forEach((yy, i) => {
    parts.push(paint((x, y, z) => rbox(x + 0.1, y - yy, z - 0.5, 0.33, 0.08, 0.1, 0.05), 'ink'));
    parts.push(add((x, y, z) => sphere(x - 0.42, y - yy, z - 0.46, 0.06), i === 1 ? 'ledO' : 'ledG', 0.015));
  });
  TOYS.server = { bounds: [[-0.85, -0.1, -0.7], [0.85, 1.85, 0.75]], pose: [0.05, -0.5, 0], parts };
}
{ // a database: three stacked discs
  const parts = [];
  [0.22, 0.68, 1.14].forEach((yc, i) => {
    parts.push(add((x, y, z) => rcyl(x, y - yc, z, 0.72, 0.2, 0.17), 'sage', 0.02));
    parts.push(add((x, y, z) => sphere(x - 0.3, y - yc, z - 0.645, 0.055), i === 2 ? 'ledG' : 'ledO', 0.012));
  });
  TOYS.database = { bounds: [[-0.85, -0.05, -0.85], [0.85, 1.45, 0.85]], pose: [0.14, 0.35, 0], parts };
}
{ // a cloud
  const S = [[0, 0.62, 0, 0.52], [-0.58, 0.45, 0.05, 0.4], [0.6, 0.47, 0, 0.42], [-0.22, 0.88, -0.05, 0.42], [0.28, 0.92, 0.04, 0.36]];
  const f = (x, y, z) => { let d = 1e9; for (const s of S) d = smin(d, sphere(x - s[0], y - s[1], (z - s[2]) * 1.15, s[3]), 0.32); return d; };
  TOYS.cloud = { bounds: [[-1.15, 0, -0.7], [1.15, 1.45, 0.7]], pose: [0.22, -0.25, 0], parts: [add(f, 'cloud'), sub((x, y) => y - 0.2, 0.22)] };
}
{ // a router: the load balancer, two antennas, status lights
  const parts = [add((x, y, z) => rbox(x, y - 0.36, z, 0.78, 0.3, 0.48, 0.25), 'ink')];
  for (const s of [-1, 1]) {
    parts.push(add((x, y, z) => capsule(x, y, z, s * 0.48, 0.55, -0.22, s * 0.62, 1.4, -0.26, 0.065), 'ink', 0.05));
    parts.push(add((x, y, z) => sphere(x - s * 0.62, y - 1.45, z + 0.26, 0.13), 'orange', 0.03));
  }
  [-0.36, -0.12, 0.12, 0.36].forEach((xx, i) => parts.push(add((x, y, z) => sphere(x - xx, y - 0.4, z - 0.46, 0.05), i % 2 ? 'ledO' : 'ledG', 0.012)));
  TOYS.router = { bounds: [[-1, -0.05, -0.65], [1, 1.7, 0.65]], pose: [0.1, -0.4, 0], parts };
}
{ // a queue: messages lined up on a rail
  const parts = [add((x, y, z) => rbox(x, y - 0.13, z, 1.2, 0.13, 0.4, 0.12), 'ink')];
  for (const xi of [-0.78, -0.26, 0.26, 0.78]) {
    const cap = (x, y, z) => capsule(x, y, z, xi, 0.47, -0.24, xi, 0.47, 0.24, 0.2);
    parts.push(add(cap, 'cream', 0.04));
    parts.push(paint((x, y, z) => max(cap(x, y, z) - 0.06, -z), 'orange'));
  }
  TOYS.queue = { bounds: [[-1.35, -0.05, -0.65], [1.35, 0.8, 0.65]], pose: [0.3, -0.35, 0], parts };
}
{ // a lightning bolt: the cache
  const P = [[-0.1, 1.05], [0.55, 1.05], [0.2, 0.3], [0.6, 0.3], [-0.35, -1.05], [-0.05, -0.15], [-0.5, -0.15]];
  TOYS.cache = { bounds: [[-0.8, -0.2, -0.45], [0.85, 2.3, 0.45]], pose: [0.1, -0.4, -0.12], parts: [add((x, y, z) => extrude(poly2(x, y - 1.05, P), z, 0.17, 0.11) - 0.07, 'butter')] };
}
{ // a key: auth
  const parts = [
    add((x, y, z) => l2(l2(x + 0.55, y) - 0.36, z * 0.85) - 0.17, 'orange'),
    add((x, y, z) => capsule(x, y, z, -0.2, 0, 0, 0.95, 0, 0, 0.15), 'orange', 0.08),
    add((x, y, z) => rbox(x - 0.62, y + 0.22, z, 0.09, 0.17, 0.13, 0.06), 'orange', 0.05),
    add((x, y, z) => rbox(x - 0.86, y + 0.19, z, 0.09, 0.14, 0.13, 0.06), 'orange', 0.05),
  ];
  TOYS.key = { bounds: [[-1.1, -0.6, -0.35], [1.15, 0.6, 0.35]], pose: [0.55, -0.55, 0.35], parts };
}
{ // a gear: a worker
  const S = (2 * PI) / 9;
  const teeth = (x, y, z) => { const a = round(atan2(y, x) / S) * S, u = x * cos(a) + y * sin(a), v = -x * sin(a) + y * cos(a); return rbox(u - 0.68, v, z, 0.17, 0.15, 0.16, 0.08); };
  TOYS.gear = { bounds: [[-1, -1, -0.35], [1, 1, 0.35]], pose: [0.4, -0.5, 0], parts: [add((x, y, z) => rcyl(x, z, y, 0.6, 0.18, 0.12), 'sky'), add(teeth, 'sky', 0.08), sub((x, y, z) => rcyl(x, z, y, 0.22, 0.6, 0), 0.06)] };
}
{ // a chip: compute
  const parts = [add((x, y, z) => rbox(x, y, z, 0.58, 0.11, 0.58, 0.1), 'ink')];
  for (const t of [-0.36, -0.12, 0.12, 0.36]) {
    parts.push(add((x, y, z) => rbox(x - 0.7, y + 0.02, z - t, 0.14, 0.035, 0.05, 0.03), 'silver', 0.02));
    parts.push(add((x, y, z) => rbox(x + 0.7, y + 0.02, z - t, 0.14, 0.035, 0.05, 0.03), 'silver', 0.02));
    parts.push(add((x, y, z) => rbox(x - t, y + 0.02, z - 0.7, 0.05, 0.035, 0.14, 0.03), 'silver', 0.02));
    parts.push(add((x, y, z) => rbox(x - t, y + 0.02, z + 0.7, 0.05, 0.035, 0.14, 0.03), 'silver', 0.02));
  }
  parts.push(add((x, y, z) => rbox(x, y - 0.12, z, 0.3, 0.045, 0.3, 0.04), 'orange', 0.02));
  TOYS.chip = { bounds: [[-0.95, -0.3, -0.95], [0.95, 0.35, 0.95]], pose: [0.55, 0.62, 0], parts };
}
{ // an envelope: a packet, with a wax seal
  const parts = [
    add((x, y, z) => rbox(x, y, z, 0.78, 0.52, 0.1, 0.1), 'cream'),
    add((x, y, z) => capsule(x, y, z, -0.64, 0.4, 0.09, 0, -0.06, 0.09, 0.04), 'cream', 0.04),
    add((x, y, z) => capsule(x, y, z, 0, -0.06, 0.09, 0.64, 0.4, 0.09, 0.04), 'cream', 0.04),
    add((x, y, z) => rcyl(x, z - 0.12, y + 0.06, 0.17, 0.05, 0.04), 'orange', 0.02),
  ];
  TOYS.envelope = { bounds: [[-0.95, -0.7, -0.3], [0.95, 0.7, 0.35]], pose: [0.15, -0.4, 0.1], parts };
}
{ // a padlock: security
  const ring = (x, y, z) => max(l2(l2(x, y - 0.88) - 0.33, z) - 0.085, 0.88 - y);
  const parts = [
    add((x, y, z) => rbox(x, y - 0.42, z, 0.52, 0.42, 0.3, 0.2), 'orange'),
    add(ring, 'silver', 0.02),
    add((x, y, z) => capsule(x, y, z, -0.33, 0.88, 0, -0.33, 0.7, 0, 0.085), 'silver', 0.02),
    add((x, y, z) => capsule(x, y, z, 0.33, 0.88, 0, 0.33, 0.7, 0, 0.085), 'silver', 0.02),
    paint((x, y, z) => max(min(l2(x, y - 0.5) - 0.075, rbox(x, y - 0.38, 0, 0.032, 0.11, 1, 0.02)), 0.18 - z), 'ink'),
  ];
  TOYS.lock = { bounds: [[-0.7, -0.05, -0.45], [0.7, 1.4, 0.45]], pose: [0.1, -0.4, 0], parts };
}
{ // a shipping container: containers
  const parts = [add((x, y, z) => rbox(x, y - 0.46, z, 1.0, 0.46, 0.46, 0.1), 'orange')];
  for (const zz of [0.46, -0.46]) parts.push(sub((x, y, z) => { const rx = x - 0.16 * round(x / 0.16); return max(rbox(rx, y - 0.46, z - zz, 0.022, 0.35, 0.035, 0.015), abs(x) - 0.84); }, 0.012));
  parts.push(sub((x, y, z) => { const rz = z - 0.16 * round(z / 0.16); return max(rbox(x - 1.0, y - 0.46, rz, 0.035, 0.35, 0.022, 0.015), abs(z) - 0.32); }, 0.012));
  TOYS.container = { bounds: [[-1.2, -0.05, -0.65], [1.2, 1.05, 0.65]], pose: [0.2, -0.6, 0], parts };
}
{ // a terminal window with a prompt
  const parts = [add((x, y, z) => rbox(x, y - 0.78, z, 0.88, 0.7, 0.15, 0.18), 'ink')];
  [['orange', -0.6], ['butter', -0.42], ['sage', -0.24]].forEach(([m, xx]) => parts.push(add((x, y, z) => sphere(x - xx, y - 1.25, z - 0.12, 0.06), m, 0.01)));
  parts.push(add((x, y, z) => capsule(x, y, z, -0.52, 0.98, 0.14, -0.3, 0.8, 0.14, 0.065), 'cream', 0.02));
  parts.push(add((x, y, z) => capsule(x, y, z, -0.3, 0.8, 0.14, -0.52, 0.62, 0.14, 0.065), 'cream', 0.02));
  parts.push(add((x, y, z) => capsule(x, y, z, -0.14, 0.6, 0.14, 0.2, 0.6, 0.14, 0.06), 'cream', 0.02));
  TOYS.terminal = { bounds: [[-1.05, -0.05, -0.4], [1.05, 1.6, 0.4]], pose: [0.08, -0.35, 0], parts };
}
{ // a globe with a pin: the edge
  const C = 0.78, parts = [add((x, y, z) => sphere(x, y - C, z, 0.7), 'sky')];
  for (const yl of [-0.4, 0, 0.4]) parts.push(sub((x, y, z) => torus(x, y - C - yl, z, sqrt(0.49 - yl * yl), 0.028), 0.02));
  for (const th of [0, PI / 3, (2 * PI) / 3]) parts.push(sub((x, y, z) => { const u = x * cos(th) + z * sin(th), w = -x * sin(th) + z * cos(th); return torus(u, w, y - C, 0.7, 0.028); }, 0.02));
  const n = [0.385, 0.825, 0.495], s = [n[0] * 0.7, C + n[1] * 0.7, n[2] * 0.7];
  parts.push(add((x, y, z) => capsule(x, y, z, s[0], s[1], s[2], s[0] + n[0] * 0.3, s[1] + n[1] * 0.3, s[2] + n[2] * 0.3, 0.045), 'ink', 0.03));
  parts.push(add((x, y, z) => sphere(x - (s[0] + n[0] * 0.4), y - (s[1] + n[1] * 0.4), z - (s[2] + n[2] * 0.4), 0.13), 'orange', 0.03));
  TOYS.globe = { bounds: [[-0.85, 0, -0.85], [0.95, 2.0, 1.0]], pose: [0.1, -0.3, 0], parts };
}
{ // a phone: the client
  const parts = [
    add((x, y, z) => rbox(x, y, z, 0.43, 0.84, 0.09, 0.13), 'ink'),
    paint((x, y, z) => rbox(x, y + 0.02, z - 0.09, 0.355, 0.72, 0.03, 0.09), 'cream'),
    paint((x, y, z) => rbox(x + 0.07, y + 0.3, z - 0.09, 0.2, 0.1, 0.05, 0.07), 'orange'),
    paint((x, y, z) => rbox(x - 0.07, y - 0.02, z - 0.09, 0.2, 0.1, 0.05, 0.07), 'sage'),
    paint((x, y, z) => rbox(x + 0.07, y - 0.34, z - 0.09, 0.2, 0.1, 0.05, 0.07), 'orange'),
  ];
  TOYS.phone = { bounds: [[-0.6, -1, -0.25], [0.6, 1, 0.25]], pose: [0.2, -0.45, 0.12], parts };
}
{ // a request in flight: a two-tone pill
  const cap = (x, y, z) => capsule(x, y, z, -0.32, 0, 0, 0.32, 0, 0, 0.3);
  TOYS.packet = { bounds: [[-0.7, -0.4, -0.4], [0.7, 0.4, 0.4]], pose: [0.3, -0.3, 0.2], parts: [add(cap, 'cream'), paint((x, y, z) => max(cap(x, y, z) - 0.06, -x), 'orange')] };
}

/* ───────────────────────── meshing and baking ───────────────────────── */
function fieldOf(toy) {
  const ps = toy.parts.filter(p => p.op !== 'paint');
  return (x, y, z) => {
    let d = 1e9;
    for (const p of ps) { const v = p.f(x, y, z); d = p.op === 'add' ? (d === 1e9 ? v : smin(d, v, p.k)) : smax(d, -v, p.k); }
    return d;
  };
}
function matOf(toy) {
  const adds = toy.parts.filter(p => p.op === 'add'), paints = toy.parts.filter(p => p.op === 'paint');
  return (x, y, z) => {
    let m = adds[0].mat, bd = 1e9;
    for (const p of adds) { const v = p.f(x, y, z); if (v < bd) { bd = v; m = p.mat; } }
    return m;
  };
}

/** returns { groups: { mat: { position, normal, color } } } in toy space; light is a unit vector in toy space */
export function build(toy, N, light, palette) {
  const F = fieldOf(toy), M = matOf(toy), paints = toy.parts.filter(p => p.op === 'paint');
  const [lo, hi] = toy.bounds;
  const ext = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), h = ext / N;
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const I = (i, j, k) => i + nx * (j + ny * k), C = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const v = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[I(i, j, k)] = F(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
  const cid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [];
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0;
    for (let c = 0; c < 8; c++) { cv[c] = v[I(i + CO[c][0], j + CO[c][1], k + CO[c][2])]; if (cv[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      sx += CO[a][0] + t * (CO[b][0] - CO[a][0]); sy += CO[a][1] + t * (CO[b][1] - CO[a][1]); sz += CO[a][2] + t * (CO[b][2] - CO[a][2]); n++;
    }
    cid[C(i, j, k)] = pos.length / 3;
    pos.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h);
  }
  const tri = [];
  const quad = (a, b, c, d) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; tri.push(a, b, c, a, c, d); };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = v[I(i, j, k)] < 0;
    if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1 && a !== (v[I(i + 1, j, k)] < 0)) quad(cid[C(i, j - 1, k - 1)], cid[C(i, j, k - 1)], cid[C(i, j, k)], cid[C(i, j - 1, k)]);
    if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1 && a !== (v[I(i, j + 1, k)] < 0)) quad(cid[C(i - 1, j, k - 1)], cid[C(i, j, k - 1)], cid[C(i, j, k)], cid[C(i - 1, j, k)]);
    if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1 && a !== (v[I(i, j, k + 1)] < 0)) quad(cid[C(i - 1, j - 1, k)], cid[C(i, j - 1, k)], cid[C(i, j, k)], cid[C(i - 1, j, k)]);
  }
  // onto the true surface, and normals from the field
  const e = h * 0.5, nv = pos.length / 3, nrm = new Float32Array(nv * 3);
  const grad = (x, y, z) => [F(x + e, y, z) - F(x - e, y, z), F(x, y + e, z) - F(x, y - e, z), F(x, y, z + e) - F(x, y, z - e)];
  for (let q = 0; q < nv; q++) {
    let x = pos[q * 3], y = pos[q * 3 + 1], z = pos[q * 3 + 2];
    for (let it = 0; it < 3; it++) { const d = F(x, y, z), g = grad(x, y, z), gg = (g[0] ** 2 + g[1] ** 2 + g[2] ** 2) / (4 * e * e) || 1; x -= (d * g[0]) / (2 * e) / gg; y -= (d * g[1]) / (2 * e) / gg; z -= (d * g[2]) / (2 * e) / gg; }
    pos[q * 3] = x; pos[q * 3 + 1] = y; pos[q * 3 + 2] = z;
    const g = grad(x, y, z), l = l3(g[0], g[1], g[2]) || 1;
    nrm[q * 3] = g[0] / l; nrm[q * 3 + 1] = g[1] / l; nrm[q * 3 + 2] = g[2] / l;
  }
  // light: ambient occlusion from the field, and a soft shadow marched towards the light
  const shade = new Float32Array(nv);
  const S = ext * 0.012;
  for (let q = 0; q < nv; q++) {
    const px = pos[q * 3], py = pos[q * 3 + 1], pz = pos[q * 3 + 2], nx_ = nrm[q * 3], ny_ = nrm[q * 3 + 1], nz_ = nrm[q * 3 + 2];
    let occ = 0, w = 1;
    for (let s = 1; s <= 5; s++) { const t = S * 2.2 * s; occ += (t - F(px + nx_ * t, py + ny_ * t, pz + nz_ * t)) * w; w *= 0.62; }
    const ao = clamp(1 - occ * (1.6 / (S * 2.2)) * 0.35, 0, 1);
    let res = 1, t = S * 2;
    for (let s = 0; s < 56 && t < ext * 1.5; s++) {
      const d = F(px + light[0] * t + nx_ * S, py + light[1] * t + ny_ * S, pz + light[2] * t + nz_ * S);
      if (d < 0.0005) { res = 0; break; }
      res = min(res, (7 * d) / t); t += clamp(d, S * 0.6, ext * 0.08);
    }
    const sh = clamp(res, 0, 1);
    shade[q] = (0.25 + 0.75 * ao ** 1.25) * (0.45 + 0.55 * sh * sh * (3 - 2 * sh));
  }
  // paint: a soft blend across about one cell, so painted edges stay crisp but never jagged
  const paintW = new Float32Array(nv), paintM = new Array(nv).fill(null);
  for (let q = 0; q < nv; q++) for (const p of paints) {
    const d = p.f(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]), w = clamp(0.5 - d / (h * 1.2), 0, 1);
    if (w > 0) { paintW[q] = w; paintM[q] = p.mat; }
  }
  // split by material (by triangle), keeping triangles facing outwards
  const groups = {};
  for (let t = 0; t < tri.length; t += 3) {
    let a = tri[t], b = tri[t + 1], c = tri[t + 2];
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az, wx = pos[c * 3] - ax, wy = pos[c * 3 + 1] - ay, wz = pos[c * 3 + 2] - az;
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    const mnx = nrm[a * 3] + nrm[b * 3] + nrm[c * 3], mny = nrm[a * 3 + 1] + nrm[b * 3 + 1] + nrm[c * 3 + 1], mnz = nrm[a * 3 + 2] + nrm[b * 3 + 2] + nrm[c * 3 + 2];
    if (fx * mnx + fy * mny + fz * mnz < 0) { const s = b; b = c; c = s; }
    const cx = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, cy = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, cz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
    const m = M(cx, cy, cz);
    const g = (groups[m] ||= { position: [], normal: [], color: [] });
    const base = palette[m];
    for (const vi of [a, b, c]) {
      g.position.push(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]); g.normal.push(nrm[vi * 3], nrm[vi * 3 + 1], nrm[vi * 3 + 2]);
      const pc = paintM[vi] ? palette[paintM[vi]] : base, w = paintW[vi], sh = shade[vi];
      g.color.push((base[0] + (pc[0] - base[0]) * w) * sh, (base[1] + (pc[1] - base[1]) * w) * sh, (base[2] + (pc[2] - base[2]) * w) * sh);
    }
  }
  return { groups, tris: tri.length / 3 };
}
