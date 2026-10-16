import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, smoothstep } from '../lib/noise';
import { PLACED } from './layout';
import { PLANS, treeSpots } from './plan';
import type { Mats } from './materials';

/**
 * Trees made the way model-makers and game artists make them: a light trunk and branches, and a crown
 * of a few hundred photographed leaves (or needle sprays) gathered into clumps. Leaf normals point out
 * from the middle of the crown and inner leaves are darker, so each crown shades like a soft volume.
 * Every tree of one shape is a single instanced draw across the whole world.
 */
type Variant = { leaves: THREE.BufferGeometry; wood: THREE.BufferGeometry | null };

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function cards(quads: { c: THREE.Vector3; ax: THREE.Vector3; ay: THREE.Vector3; uv: [number, number, number, number]; n: THREE.Vector3; shade: number }[]) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  quads.forEach((q, i) => {
    const [u0, v0, u1, v1] = q.uv;
    const corners: [number, number, number, number][] = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
    for (const [sx, sy, u, v] of corners) {
      const p = q.c.clone().addScaledVector(q.ax, sx).addScaledVector(q.ay, sy);
      pos.push(p.x, p.y, p.z); nor.push(q.n.x, q.n.y, q.n.z); uv.push(u, v); col.push(q.shade, q.shade, q.shade);
    }
    const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, 6, 1, true).translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q).translate(a.x, a.y, a.z);
  return g.index ? g.toNonIndexed() : g;
}

function randomUnit(rnd: () => number) {
  const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return v3(Math.cos(a) * s, u, Math.sin(a) * s);
}

/** a broadleaf: trunk, a few limbs, and clumps of leaves in an ellipsoid crown */
function broadleaf(seed: number, bush = false): Variant {
  const rnd = mulberry32(seed);
  const H = bush ? 0 : 0.5 + rnd() * 0.2;
  const C = v3((rnd() - 0.5) * 0.08, bush ? 0.24 : H + 0.42, (rnd() - 0.5) * 0.08);
  const rad = bush ? v3(0.4, 0.27, 0.4) : v3(0.5, 0.44, 0.5).multiplyScalar(0.9 + rnd() * 0.25);
  const quads: Parameters<typeof cards>[0] = [];
  const clusters = bush ? 8 : 13 + Math.floor(rnd() * 5);
  const centres: THREE.Vector3[] = [];
  for (let k = 0; k < clusters; k++) {
    const d = randomUnit(rnd); if (!bush) d.y = Math.abs(d.y) * 0.9 - 0.15;
    const cc = C.clone().add(d.normalize().multiply(rad).multiplyScalar(0.42 + rnd() * 0.38));
    centres.push(cc);
    const leaves = bush ? 15 : 20;
    for (let i = 0; i < leaves; i++) {
      const p = cc.clone().addScaledVector(randomUnit(rnd), (bush ? 0.13 : 0.19) * Math.cbrt(rnd()));
      const s = (bush ? 0.075 : 0.085) * (0.85 + rnd() * 0.4);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
      const ax = v3(s * 0.85, 0, 0).applyQuaternion(q), ay = v3(0, s, 0).applyQuaternion(q);
      const out = p.clone().sub(C).divide(rad);
      const n = out.clone().normalize().multiplyScalar(0.8).add(v3(0, 0.35, 0)).normalize();
      const depth = smoothstep(0.25, 1.0, out.length());
      const low = smoothstep(-1, 0.8, out.y);
      const cell = Math.floor(rnd() * 9), cu = (cell % 3) / 3, cv = Math.floor(cell / 3) / 3;
      quads.push({ c: p, ax, ay, uv: [cu + 0.01, cv + 0.01, cu + 1 / 3 - 0.01, cv + 1 / 3 - 0.01], n, shade: (0.42 + 0.58 * depth) * (0.72 + 0.28 * low) });
    }
  }
  let wood: THREE.BufferGeometry | null = null;
  if (!bush) {
    const base = v3(0, -0.05, 0), fork = v3((rnd() - 0.5) * 0.06, H, (rnd() - 0.5) * 0.06);
    const parts = [limb(base, fork, 0.05, 0.035)];
    for (let i = 0; i < 4; i++) parts.push(limb(fork, centres[i].clone().lerp(C, 0.25), 0.03, 0.012));
    wood = mergeGeometries(parts)!;
    wood.computeVertexNormals();
  }
  return { leaves: cards(quads), wood };
}

/** a fir: a slim trunk and whorls of drooping needle sprays, long at the bottom, short at the top */
function conifer(seed: number): Variant {
  const rnd = mulberry32(seed);
  const H = 1.75 + rnd() * 0.45, levels = 11;
  const quads: Parameters<typeof cards>[0] = [];
  const bands: [number, number, number, number][] = [[0.28, 0.74, 0.71, 0.93], [0.08, 0.39, 0.9, 0.69], [0.04, 0.03, 0.93, 0.36]];
  for (let l = 0; l < levels; l++) {
    const f = l / (levels - 1);
    const y = 0.22 + (H - 0.32) * Math.pow(f, 0.92);
    const L = 0.5 * Math.pow(1 - f, 0.85) + 0.09;
    const count = 7 + Math.floor(rnd() * 3);
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + l * 0.7 + rnd() * 0.4, droop = -0.32 - rnd() * 0.25;
      const dir = v3(Math.cos(a) * Math.cos(droop), Math.sin(droop), Math.sin(a) * Math.cos(droop));
      const c = v3(0, y, 0).addScaledVector(dir, L / 2);
      const side = v3(-Math.sin(a), 0, Math.cos(a));
      const [u0, v0, u1, v1] = bands[Math.floor(rnd() * 3)];
      for (const tilt of [-0.55, 0.55]) {
        const ay = side.clone().applyAxisAngle(dir, tilt).multiplyScalar(L * 0.2);
        const n = v3(Math.cos(a), 0.45, Math.sin(a)).normalize();
        const shade = (0.5 + 0.5 * smoothstep(0, 1, f * 0.6 + 0.4)) * (0.8 + 0.2 * rnd());
        // the stem end of each spray (u1) sits at the trunk, the tip (u0) points out
        quads.push({ c, ax: dir.clone().multiplyScalar(-L / 2), ay, uv: [u0, v0, u1, v1], n, shade });
      }
    }
  }
  // the leader at the top
  for (const r of [0, Math.PI / 2]) {
    const c = v3(0, H + 0.05, 0), ax = v3(0, 0.16, 0), ay = v3(Math.cos(r), 0, Math.sin(r)).multiplyScalar(0.05);
    quads.push({ c, ax, ay, uv: [0.28, 0.74, 0.71, 0.93], n: v3(0, 1, 0), shade: 1 });
  }
  const wood = limb(v3(0, -0.05, 0), v3(0, H, 0), 0.045, 0.01);
  wood.computeVertexNormals();
  return { leaves: cards(quads), wood };
}

/** a round, soft-edged spot, for contact shadows */
export function softSpot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const BROAD_TINTS = ['#f4f7ea', '#e4efd2', '#d8e6c0', '#eef0d4', '#cfdfb6', '#f6e7c8'];
const AUTUMN_TINTS = ['#f2c48a', '#e8a868', '#f0d49a'];
const FIR_TINTS = ['#c6d6bb', '#b8ccae', '#d2ddc4', '#aec3a6'];

export function Forest({ mats }: { mats: Mats }) {
  const meshes = useMemo(() => {
    const broad = [11, 23, 37, 51, 67].map(s => broadleaf(s));
    const firs = [7, 19, 31, 43].map(s => conifer(s));
    const bushes = [5, 17, 29].map(s => broadleaf(s, true));
    type Inst = { m: THREE.Matrix4; c: THREE.Color }[];
    const sets = { broad: broad.map(() => [] as Inst), firs: firs.map(() => [] as Inst), bushes: bushes.map(() => [] as Inst) };
    const rnd = mulberry32(4242);
    const blobs: THREE.Matrix4[] = [];
    const flat = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), -Math.PI / 2);
    const place = (pl: (typeof PLACED)[number], x: number, z: number, s: number, list: Inst, tint: string, shadow = 1.5) => {
      const h = pl.geo.heightAt(x, z);
      if (!Number.isFinite(h)) return;
      const island = new THREE.Matrix4().compose(pl.pos, new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), pl.rot), v3(1, 1, 1));
      const local = new THREE.Matrix4().compose(v3(x, h - 0.04, z), new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), rnd() * 6.28), v3(s, s * (0.9 + rnd() * 0.25), s));
      list.push({ m: island.clone().multiply(local), c: new THREE.Color(tint) });
      // a soft dark patch on the grass under every crown, where little sky light reaches
      blobs.push(island.multiply(new THREE.Matrix4().compose(v3(x, h + 0.05, z), flat, v3(s * shadow, s * shadow, 1))));
    };
    for (const pl of PLACED) {
      for (const t of treeSpots(pl)) {
        const conif = t.kind < 0.42;
        const s = t.s * (conif ? 1.05 : 1.25);
        if (conif) place(pl, t.x, t.z, s, sets.firs[Math.floor(rnd() * firs.length)], FIR_TINTS[Math.floor(rnd() * FIR_TINTS.length)]);
        else place(pl, t.x, t.z, s, sets.broad[Math.floor(rnd() * broad.length)], rnd() < 0.12 ? AUTUMN_TINTS[Math.floor(rnd() * 3)] : BROAD_TINTS[Math.floor(rnd() * BROAD_TINTS.length)]);
      }
      // shrubs along the paths and round the forecourt
      const plan = PLANS[pl.index];
      for (const path of plan.paths) for (let i = 2; i < path.length - 1; i += 3) {
        if (rnd() < 0.45) continue;
        const a = path[i], b = path[i + 1], d = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
        const side = rnd() < 0.5 ? -1 : 1, off = 0.75 + rnd() * 0.25;
        const x = a.x - d.y * off * side, z = a.y + d.x * off * side;
        if (plan.footprint.some(c => Math.hypot(x - c.x, z - c.z) < c.r - 0.2)) continue;
        place(pl, x, z, 0.9 + rnd() * 0.6, sets.bushes[Math.floor(rnd() * bushes.length)], BROAD_TINTS[Math.floor(rnd() * BROAD_TINTS.length)], 1.1);
      }
    }
    const out: THREE.InstancedMesh[] = [];
    const build = (v: Variant[], lists: Inst[], leafMat: THREE.Material) => v.forEach((variant, i) => {
      const list = lists[i];
      if (!list.length) return;
      const leaves = new THREE.InstancedMesh(variant.leaves, leafMat, list.length);
      list.forEach((it, k) => { leaves.setMatrixAt(k, it.m); leaves.setColorAt(k, it.c); });
      leaves.castShadow = true; leaves.receiveShadow = true;
      out.push(leaves);
      if (variant.wood) {
        const wood = new THREE.InstancedMesh(variant.wood, mats.bark, list.length);
        list.forEach((it, k) => wood.setMatrixAt(k, it.m));
        wood.castShadow = true; wood.receiveShadow = true;
        out.push(wood);
      }
    });
    build(broad, sets.broad, mats.leaves);
    build(firs, sets.firs, mats.needles);
    build(bushes, sets.bushes, mats.leaves);
    const blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softSpot(), color: '#18200f', transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), blobs.length);
    blobs.forEach((m, i) => blob.setMatrixAt(i, m));
    blob.renderOrder = 1;
    out.push(blob);
    for (const m of out) { m.computeBoundingSphere(); m.frustumCulled = false; }
    return out;
  }, [mats]);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}
