import * as THREE from 'three';
import { site, type Island } from '../site.config';
import { buildIsland, type IslandGeo } from './island';

/**
 * Where every island floats: a ring, so neighbours are close, nothing doubles back and the last island
 * sits beside the first. Each island turns to face outwards, so its buildings face a camera that looks
 * at it from outside the ring, with the rest of the world behind.
 */
export type Placed = {
  index: number; island: Island; pos: THREE.Vector3; geo: IslandGeo; seed: number;
  /** rotation about y: local +z points away from the ring's centre */
  rot: number;
};

const RADIUS: Record<Island['kind'], number> = { about: 11, experience: 8.5, project: 7.5, skills: 9, stats: 7.5, github: 10, education: 7.5, contact: 6.5 };

export const RING = (() => {
  const radii = site.islands.map(i => RADIUS[i.kind]);
  const gaps = radii.map((r, i) => r + radii[(i + 1) % radii.length] + 10);
  const total = gaps.reduce((a, b) => a + b, 0);
  const r = total / (Math.PI * 2);
  return { x: 0, z: -r, r, radii, gaps, total };
})();

export const PLACED: Placed[] = (() => {
  const out: Placed[] = [];
  let theta = Math.PI / 2; // the first island sits on the near side of the ring
  site.islands.forEach((island, i) => {
    const R = RING.radii[i];
    const pos = new THREE.Vector3(Math.cos(theta) * RING.r, Math.sin(i * 1.7) * 3.4 + (i % 2 ? -1.4 : 1), Math.sin(theta) * RING.r + RING.z);
    if (i === 0) pos.y = 0;
    const seed = 101 + i * 37;
    const rot = Math.atan2(pos.x - RING.x, pos.z - RING.z);
    out.push({ index: i, island, pos, geo: buildIsland(seed, R, R * 0.95), seed, rot });
    theta += (RING.gaps[i] / RING.total) * Math.PI * 2;
  });
  return out;
})();

/** world offset (from the island's centre) → island-local x, z */
export function toLocal(p: Placed, wx: number, wz: number): [number, number] {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [wx * c - wz * s, wx * s + wz * c];
}
/** island-local x, z → world offset from the island's centre */
export function toWorld(p: Placed, lx: number, lz: number): [number, number] {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [lx * c + lz * s, -lx * s + lz * c];
}
/** meadow height (relative to the island) under a world point, or NaN past the rim */
export function heightAtWorld(p: Placed, x: number, z: number) {
  const [lx, lz] = toLocal(p, x - p.pos.x, z - p.pos.z);
  return p.geo.heightAt(lx, lz);
}

/** world-space height of the ground under (x, z), and which island it belongs to */
export function groundAt(x: number, z: number): { y: number; island: Placed | null } {
  let best: { y: number; island: Placed | null } = { y: -Infinity, island: null };
  for (const p of PLACED) {
    const h = heightAtWorld(p, x, z);
    if (Number.isFinite(h) && p.pos.y + h > best.y) best = { y: p.pos.y + h, island: p };
  }
  return best;
}

/** the island whose airspace a point is in (within its rim, a little above its meadow) */
export function islandAt(p: THREE.Vector3): Placed | null {
  for (const pl of PLACED) {
    const dx = p.x - pl.pos.x, dz = p.z - pl.pos.z;
    if (Math.hypot(dx, dz) < pl.geo.radius * 1.12 && p.y > pl.pos.y - 3 && p.y < pl.pos.y + 16) return pl;
  }
  return null;
}

/** a world point on an island, from local coordinates, standing on the meadow plus `lift` */
export function onIsland(p: Placed, lx: number, lz: number, lift = 0) {
  const [wx, wz] = toWorld(p, lx, lz);
  const h = p.geo.heightAt(lx, lz);
  return new THREE.Vector3(p.pos.x + wx, p.pos.y + (Number.isFinite(h) ? h : 0) + lift, p.pos.z + wz);
}

/**
 * How the camera looks at an island when you arrive: from outside the ring, a little to one side,
 * high enough to see the whole meadow, close enough that the island fills the free part of the screen.
 */
export function dockView(p: Placed, orbitYaw = 0, orbitPitch = 0, zoom = 1) {
  const R = p.geo.radius;
  const yaw = p.rot + 0.38 + orbitYaw;
  const el = THREE.MathUtils.clamp(0.5 + orbitPitch, 0.12, 1.25);
  const dist = (R * 2.3 + 8) * zoom;
  const top = p.geo.heightAt(0, 0);
  const look = new THREE.Vector3(p.pos.x, p.pos.y + (Number.isFinite(top) ? top : 0) + 1.2, p.pos.z);
  const pos = look.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(dist));
  return { pos, look, dist };
}
