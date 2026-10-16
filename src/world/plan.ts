import * as THREE from 'three';
import { PLACED, toLocal, type Placed } from './layout';
import { mulberry32 } from '../lib/noise';

/**
 * The ground plan of every island, in island-local coordinates (+z faces out of the ring, towards the
 * camera): where the bridges land, the stone paths from each landing to the forecourt, the buildings'
 * footprint, an optional spring and stream that spills off the rim as a waterfall, and what is left
 * for trees.
 */
export type Circle = { x: number; z: number; r: number };
export type IslandPlan = {
  ends: THREE.Vector2[];
  forecourt: THREE.Vector2;
  paths: THREE.Vector2[][];
  footprint: Circle[];
  stream: { spring: THREE.Vector2; points: THREE.Vector2[]; angle: number } | null;
  keep: Circle[];
};

/** the drone parks here, in front of the building, where the camera can see it */
export function parking(p: Placed) {
  const R = p.geo.radius;
  return new THREE.Vector2(p.island.kind === 'about' ? 0 : -R * 0.12, p.island.kind === 'about' ? 4.6 : R * 0.58);
}

function footprintFor(p: Placed): Circle[] {
  const R = p.geo.radius;
  switch (p.island.kind) {
    case 'about': return [{ x: 0, z: -3.2, r: 7.4 }, { x: 0, z: 3.4, r: 2.6 }];
    case 'github': return [{ x: 0, z: 0, r: 6.2 }];
    case 'skills': return [{ x: 0, z: -0.4, r: 5.6 }];
    case 'stats': return [{ x: 0, z: -0.6, r: 4.4 }];
    case 'contact': return [{ x: 0, z: -0.6, r: 2.8 }];
    case 'education': return [{ x: 0, z: -0.8, r: 4.8 }];
    default: return [{ x: 0, z: -R * 0.08, r: Math.min(4.8, R * 0.62) }];
  }
}

function bezier(a: THREE.Vector2, c: THREE.Vector2, b: THREE.Vector2, step: number) {
  const len = a.distanceTo(c) + c.distanceTo(b), n = Math.max(2, Math.ceil(len / step));
  const out: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push(new THREE.Vector2(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y));
  }
  return out;
}

/** the rim point (local) facing a neighbouring island */
function landing(p: Placed, q: Placed) {
  const d = new THREE.Vector3().subVectors(q.pos, p.pos).setY(0).normalize();
  const [lx, lz] = toLocal(p, d.x, d.z);
  const a = Math.atan2(lz, lx), e = p.geo.edge(a) * 0.9;
  return new THREE.Vector2(Math.cos(a) * e, Math.sin(a) * e);
}

function planFor(p: Placed): IslandPlan {
  const n = PLACED.length, R = p.geo.radius;
  const ends = [landing(p, PLACED[(p.index + n - 1) % n]), landing(p, PLACED[(p.index + 1) % n])];
  const foot = footprintFor(p);
  const forecourt = p.island.kind === 'about' ? new THREE.Vector2(0, 3.4) : new THREE.Vector2(0, foot[0].z + foot[0].r + 0.9);
  // each path bows out round the front of the building to the forecourt
  const paths = ends.map(e => {
    const c = new THREE.Vector2(e.x * 0.55, Math.max(e.y, forecourt.y) * 0.9 + R * 0.12);
    return bezier(e, c, forecourt, 0.42);
  });

  // a spring and a stream, on the bigger islands, running out to the rim on the side the camera sees
  let stream: IslandPlan['stream'] = null;
  if (R >= 8.4) {
    const camA = Math.atan2(Math.cos(0.38), Math.sin(0.38)); // the camera's side, as a local rim angle
    const endAngles = ends.map(e => Math.atan2(e.y, e.x));
    const far = (a: number) => Math.min(...endAngles.map(b => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))));
    const options = [camA + 0.95, camA - 0.95, camA + 1.4, camA - 1.4];
    const angle = options.find(a => far(a) > 0.7) ?? options[0];
    const e = p.geo.edge(angle);
    const spring = new THREE.Vector2(Math.cos(angle) * e * 0.58, Math.sin(angle) * e * 0.58);
    const mouth = new THREE.Vector2(Math.cos(angle) * e * 0.995, Math.sin(angle) * e * 0.995);
    const side = new THREE.Vector2(-Math.sin(angle), Math.cos(angle)).multiplyScalar(e * 0.08);
    const ctrl = spring.clone().lerp(mouth, 0.5).add(side);
    stream = { spring, points: bezier(spring, ctrl, mouth, 0.25), angle };
  }

  const keep: Circle[] = [...foot, { x: forecourt.x, z: forecourt.y, r: 1.6 }];
  const pk = parking(p); keep.push({ x: pk.x, z: pk.y, r: 1.3 });
  for (const path of paths) for (const q of path) keep.push({ x: q.x, z: q.y, r: 0.75 });
  if (stream) { keep.push({ x: stream.spring.x, z: stream.spring.y, r: 1.3 }); for (const q of stream.points) keep.push({ x: q.x, z: q.y, r: 0.6 }); }
  return { ends, forecourt, paths, footprint: foot, stream, keep };
}

export const PLANS: IslandPlan[] = PLACED.map(planFor);

/** tree spots on an island: clumps that thicken towards the rim, clear of everything planned */
export function treeSpots(p: Placed) {
  const rnd = mulberry32(p.seed * 3 + 1);
  const R = p.geo.radius, keep = PLANS[p.index].keep;
  const pts: { x: number; z: number; s: number; kind: number }[] = [];
  const want = Math.round(R * R * 0.26);
  for (let tries = 0; tries < 2400 && pts.length < want; tries++) {
    const a = rnd() * Math.PI * 2, d = (0.4 + 0.6 * Math.sqrt(rnd())) * p.geo.edge(a) * 0.9;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (keep.some(c => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
    const s = 0.75 + rnd() * 0.65;
    if (pts.some(q => Math.hypot(q.x - x, q.z - z) < 0.55 * (s + q.s))) continue;
    pts.push({ x, z, s, kind: rnd() });
  }
  return pts;
}
