import * as THREE from 'three';
import { createNoise2D, smoothstep } from '../lib/noise';

/**
 * A floating island: a gently domed meadow on top, and beneath it a hanging mass of layered rock
 * that narrows in ledges down to a few dripping points, like a piece of cliff lifted out of the ground.
 * A band of dark soil sits between grass and stone.
 */
export type IslandGeo = {
  top: THREE.BufferGeometry;
  under: THREE.BufferGeometry;
  /** local height of the meadow at (x, z), or -Infinity off the island */
  heightAt: (x: number, z: number) => number;
  /** edge radius in the direction of angle a (local, a = atan2(z, x)) */
  edge: (a: number) => number;
  radius: number;
};

// meadow colours: lush, sage and sun-dried grass, mixed in broad patches
const LUSH = new THREE.Color('#9cbf6a'), SAGE = new THREE.Color('#b5c48a'), DRY = new THREE.Color('#d6c991'), RIM = new THREE.Color('#7a7451');
const SOIL = new THREE.Color('#5d4a3a'), STONE = new THREE.Color('#ffffff'), DEEP = new THREE.Color('#b9a99a');

export function buildIsland(seed: number, R: number, depth: number): IslandGeo {
  const n1 = createNoise2D(seed), n2 = createNoise2D(seed + 17), n3 = createNoise2D(seed + 53), n4 = createNoise2D(seed + 91);
  const edge = (a: number) => R * (1 + 0.1 * n1(Math.cos(a) * 1.1, Math.sin(a) * 1.1) + 0.045 * n2(Math.cos(a) * 3.2, Math.sin(a) * 3.2));
  const meadow = (x: number, z: number) => 0.16 * n3(x * 0.11, z * 0.11) + 0.035 * n2(x * 0.38 + 7, z * 0.38 - 3);
  const lip = 0.5;
  const heightAt = (x: number, z: number) => {
    const r = Math.hypot(x, z), e = edge(Math.atan2(z, x));
    if (r > e) return -Infinity;
    const u = r / e;
    // flat enough in the middle to build on, rolling towards the rim
    return meadow(x, z) * (0.3 + 0.7 * smoothstep(0.3, 0.85, u)) + 0.22 * (1 - u * u) - lip * smoothstep(0.88, 1.0, u) ** 1.6;
  };

  // ── the meadow ──
  const NR = 34, NS = 144;
  const tp: number[] = [], tu: number[] = [], ti: number[] = [], tc: number[] = [];
  const tex = 2.6, c = new THREE.Color();
  for (let i = 0; i <= NR; i++) for (let j = 0; j <= NS; j++) {
    const a = (j / NS) * Math.PI * 2, u = i / NR;
    const e = edge(a) * Math.pow(u, 0.8);
    const x = Math.cos(a) * e, z = Math.sin(a) * e;
    const y = heightAt(x * 0.9999, z * 0.9999);
    tp.push(x, Number.isFinite(y) ? y : -lip, z);
    tu.push(x / tex, z / tex);
    const p1 = n4(x * 0.09, z * 0.09) * 0.5 + 0.5, p2 = n2(x * 0.21 + 3, z * 0.21 - 9) * 0.5 + 0.5;
    c.copy(LUSH).lerp(SAGE, smoothstep(0.35, 0.75, p1)).lerp(DRY, smoothstep(0.62, 0.9, p2) * 0.55);
    c.lerp(RIM, smoothstep(0.86, 1.0, Math.pow(u, 1.25)) * 0.7);
    tc.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) {
    const a = i * (NS + 1) + j, b = a + 1, cc = a + NS + 1, d = cc + 1;
    ti.push(a, b, cc, b, d, cc); // counter-clockwise seen from above, so the meadow faces up
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  top.setAttribute('uv', new THREE.Float32BufferAttribute(tu, 2));
  top.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
  top.setIndex(ti);
  top.computeVertexNormals();

  // ── the hanging rock ──
  const NK = 64;
  const up: number[] = [], uu: number[] = [], ui: number[] = [], uc: number[] = [];
  const around = Math.max(2, Math.round((Math.PI * 2 * R) / 7));
  for (let k = 0; k <= NK; k++) {
    const t = k / NK;
    for (let j = 0; j <= NS; j++) {
      const a = (j / NS) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // a narrowing profile with ledges; lobes grow with depth so the bottom splits into points
      const strata = 1 - 0.06 * smoothstep(0.3, 0.7, Math.sin(t * 26 + n2(ca * 0.7, sa * 0.7) * 2.4) * 0.5 + 0.5);
      const lobes = 1 + 0.46 * t * n1(ca * 1.6 + t * 2.2, sa * 1.6 - t * 1.4) + 0.12 * n3(ca * 4 + t * 6, sa * 4);
      const crag = 1 + 0.05 * n4(ca * 9 + t * 14, sa * 9 - t * 11) * smoothstep(0.02, 0.15, t);
      const f = Math.pow(1 - t, 0.58 + 0.3 * t) * Math.max(0.04, lobes) * strata * crag;
      const e0 = edge(a);
      // the first rings tuck under the meadow's own rim, so top and rock meet without a gap
      // never bulging out past the rim near the top, so water and bridges fall clear of the rock
      const r = e0 * (k === 0 ? 1 : k === 1 ? 0.995 : Math.min(f * 0.985, 0.99 - 0.35 * t));
      const rim = heightAt(ca * e0 * 0.9999, sa * e0 * 0.9999);
      const yTop = Number.isFinite(rim) ? rim : -lip;
      const sag = depth * (k === 1 ? 0.012 : t) * (1 + 0.36 * n2(ca * 1.3, sa * 1.3) * t);
      const y = yTop - sag;
      up.push(ca * r, y, sa * r);
      uu.push((j / NS) * around, y / 6);
      // soil just under the grass, stone below, a little darker towards the dripping points
      const below = yTop - y;
      c.copy(SOIL).lerp(STONE, smoothstep(0.25, 0.9, below)).lerp(DEEP, smoothstep(0.3, 1, t) * 0.8);
      uc.push(c.r, c.g, c.b);
    }
  }
  for (let k = 0; k < NK; k++) for (let j = 0; j < NS; j++) {
    const a = k * (NS + 1) + j, b = a + 1, cc = a + NS + 1, d = cc + 1;
    ui.push(a, b, cc, b, d, cc);
  }
  const under = new THREE.BufferGeometry();
  under.setAttribute('position', new THREE.Float32BufferAttribute(up, 3));
  under.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2));
  under.setAttribute('color', new THREE.Float32BufferAttribute(uc, 3));
  under.setIndex(ui);
  under.computeVertexNormals();

  return { top, under, heightAt, edge, radius: R };
}
