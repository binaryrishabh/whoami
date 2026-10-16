import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNoise2D, mulberry32 } from '../lib/noise';
import { PLACED, heightAtWorld, toLocal, type Placed } from './layout';
import { buildIsland } from './island';
import { PLANS } from './plan';
import { SUN_DIR } from './light';
import { wind, type Mats } from './materials';

/*
 * The small things that make the islands feel lived on: stepping-stone paths from each bridge to the
 * forecourt, lamps along them, a spring and stream on the bigger islands that runs off the rim as a
 * waterfall into the clouds, boulders, rock that has broken off and floats beside each island, and the
 * rope bridges themselves.
 */

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);

/** a world matrix for a local point on an island */
function islandMatrix(p: Placed, x: number, y: number, z: number, yaw = 0, s: THREE.Vector3 = v3(1, 1, 1)) {
  const island = new THREE.Matrix4().compose(p.pos, new THREE.Quaternion().setFromAxisAngle(UP, p.rot), v3(1, 1, 1));
  return island.multiply(new THREE.Matrix4().compose(v3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), s));
}
const ground = (p: Placed, x: number, z: number) => { const h = p.geo.heightAt(x, z); return Number.isFinite(h) ? h : -0.5; };

/** a lumpy stone: an icosahedron pushed about by noise, with a plain white colour channel for the rock material */
function stoneGeometry(seed: number, detail = 1, stretch = v3(1, 0.7, 1)) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const n = createNoise2D(seed), pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const p = v3().fromBufferAttribute(pos, i);
    const k = 1 + 0.22 * n(p.x * 1.7 + p.y, p.z * 1.7 - p.y) + 0.08 * n(p.x * 4, p.z * 4 + p.y * 3);
    p.multiplyScalar(k).multiply(stretch);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  const ng = mergeVertices(g);
  ng.computeVertexNormals();
  const uv: number[] = [], col: number[] = [];
  const pp = ng.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) { uv.push(pp.getX(i) * 0.35 + pp.getZ(i) * 0.2, pp.getY(i) * 0.35); col.push(1, 1, 1); }
  ng.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ng.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return ng;
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
  mats.forEach((x, i) => m.setMatrixAt(i, x));
  m.count = mats.length;
  m.castShadow = shadow; m.receiveShadow = true;
  m.computeBoundingSphere(); m.frustumCulled = false;
  return m;
}

/* ── paths, lamps, boulders ── */
export function Grounds({ mats }: { mats: Mats }) {
  const meshes = useMemo(() => {
    const rnd = mulberry32(777);
    const flag: THREE.Matrix4[] = [], posts: THREE.Matrix4[] = [], heads: THREE.Matrix4[] = [], stones: THREE.Matrix4[] = [];
    for (const p of PLACED) {
      const plan = PLANS[p.index];
      for (const path of plan.paths) {
        path.forEach((q, i) => {
          if (i === path.length - 1) return;
          const nx = path[Math.min(i + 1, path.length - 1)], d = new THREE.Vector2(nx.x - q.x, nx.y - q.y).normalize();
          const j = (rnd() - 0.5) * 0.14, x = q.x - d.y * j, z = q.y + d.x * j;
          flag.push(islandMatrix(p, x, ground(p, x, z) + 0.01, z, rnd() * 6.28, v3(0.85 + rnd() * 0.35, 1, 0.75 + rnd() * 0.3)));
          if (i % 6 === 3) {
            const side = (Math.floor(i / 6) % 2 ? 1 : -1) * 0.58, lx = q.x - d.y * side, lz = q.y + d.x * side;
            const y = ground(p, lx, lz);
            posts.push(islandMatrix(p, lx, y, lz));
            heads.push(islandMatrix(p, lx, y + 0.6, lz));
          }
        });
      }
      // a forecourt of larger slabs
      const fc = plan.forecourt;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, r = i === 0 ? 0 : 0.62;
        const x = fc.x + Math.cos(a) * r * (i ? 1 : 0), z = fc.y + Math.sin(a) * r * (i ? 1 : 0);
        flag.push(islandMatrix(p, x, ground(p, x, z) + 0.012, z, rnd() * 6.28, v3(1.25, 1, 1.15)));
      }
      // boulders near the rim, half sunk
      const nb = Math.round(p.geo.radius * 0.5);
      for (let i = 0; i < nb; i++) {
        const a = rnd() * Math.PI * 2, d = p.geo.edge(a) * (0.72 + rnd() * 0.2), x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (plan.keep.some(c => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
        const s = 0.18 + rnd() * 0.32;
        stones.push(islandMatrix(p, x, ground(p, x, z) - s * 0.25, z, rnd() * 6.28, v3(s, s, s)));
      }
      // stones round the spring
      if (plan.stream) {
        const sp = plan.stream.spring;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + rnd() * 0.3, x = sp.x + Math.cos(a) * 0.78, z = sp.y + Math.sin(a) * 0.78;
          const s = 0.12 + rnd() * 0.14;
          stones.push(islandMatrix(p, x, ground(p, x, z) - s * 0.2, z, rnd() * 6.28, v3(s, s, s)));
        }
      }
    }
    const flagGeo = new THREE.CylinderGeometry(0.19, 0.2, 0.05, 7);
    const postGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.6, 6).translate(0, 0.3, 0);
    const headGeo = new THREE.BoxGeometry(0.075, 0.1, 0.075).translate(0, 0.05, 0);
    return [
      instanced(flagGeo, mats.concrete, flag, false),
      instanced(postGeo, mats.steel, posts),
      instanced(headGeo, mats.lampGlow, heads, false),
      instanced(stoneGeometry(9, 1), mats.rock, stones),
    ];
  }, [mats]);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}

/* ── water: spring pools, streams and the falls ── */

/** each fall's lip and the point far below where it fades into the clouds, in world space (for sound) */
export const FALLS = PLACED.flatMap(p => {
  const st = PLANS[p.index].stream;
  if (!st) return [];
  const m = st.points[st.points.length - 1];
  const [wx, wz] = [m.x * Math.cos(p.rot) + m.y * Math.sin(p.rot), -m.x * Math.sin(p.rot) + m.y * Math.cos(p.rot)];
  const [dx, dz] = [Math.cos(st.angle) * Math.cos(p.rot) + Math.sin(st.angle) * Math.sin(p.rot), -Math.cos(st.angle) * Math.sin(p.rot) + Math.sin(st.angle) * Math.cos(p.rot)];
  const top = v3(p.pos.x + wx, p.pos.y + ground(p, m.x, m.y), p.pos.z + wz);
  return [{ top, bottom: top.clone().add(v3(dx * 4.8, -46, dz * 4.8)) }];
});
const waterMat = () => new THREE.MeshStandardMaterial({ color: '#7fa3ab', roughness: 0.08, metalness: 0.55, envMapIntensity: 1.25 });

function fallMaterial(opacity: number, scale: number) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: wind, uOpacity: { value: opacity }, uScale: { value: scale }, uSun: { value: SUN_DIR } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vLen; varying vec3 vW;
      attribute float aLen;
      void main() { vUv = uv; vLen = aLen; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity, uScale; uniform vec3 uSun;
      varying vec2 vUv; varying float vLen; varying vec3 vW;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
      void main() {
        float t = uTime;
        float s1 = vn(vec2(vUv.x * 7.0 * uScale, vLen * 1.1 - t * 3.2));
        float s2 = vn(vec2(vUv.x * 19.0 * uScale + 4.0, vLen * 2.6 - t * 5.0));
        float streak = smoothstep(0.3, 0.8, s1 * 0.6 + s2 * 0.4);
        float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
        float along = vUv.y;
        float a = mix(0.55, 1.0, streak) * edge;
        a *= 1.0 - smoothstep(0.35, 1.0, along) * (0.55 + 0.45 * (1.0 - streak));   // it frays as it falls
        a *= 1.0 - smoothstep(0.82, 1.0, along);
        vec3 col = mix(vec3(0.74, 0.82, 0.88), vec3(1.0, 0.98, 0.94), streak);
        col *= 0.9 + 0.25 * max(0.0, uSun.y);
        gl_FragColor = vec4(col, a * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** a strip along a polyline, `w(t)` wide, with uv.x across, uv.y along (0..1) and aLen in world units */
function ribbon(points: THREE.Vector3[], side: (i: number) => THREE.Vector3, w: (t: number) => number) {
  const pos: number[] = [], uv: number[] = [], len: number[] = [], idx: number[] = [];
  let L = 0;
  points.forEach((p, i) => {
    if (i) L += p.distanceTo(points[i - 1]);
    const t = i / (points.length - 1), s = side(i).clone().multiplyScalar(w(t) / 2);
    pos.push(p.x - s.x, p.y - s.y, p.z - s.z, p.x + s.x, p.y + s.y, p.z + s.z);
    uv.push(0, t, 1, t); len.push(L, L);
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aLen', new THREE.Float32BufferAttribute(len, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Water() {
  const parts = useMemo(() => {
    const water = waterMat();
    const core = fallMaterial(0.92, 1), veil = fallMaterial(0.32, 0.45);
    const out: THREE.Object3D[] = [];
    for (const p of PLACED) {
      const st = PLANS[p.index].stream;
      if (!st) continue;
      const grp = new THREE.Group();
      grp.position.copy(p.pos); grp.rotation.y = p.rot;
      // the spring: a still pool
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40).rotateX(-Math.PI / 2), water);
      pool.position.set(st.spring.x, ground(p, st.spring.x, st.spring.y) + 0.045, st.spring.y);
      pool.receiveShadow = true;
      grp.add(pool);
      // the stream, hugging the meadow
      const pts = st.points.map(q => v3(q.x, ground(p, q.x, q.y) + 0.035, q.y));
      const sides = pts.map((q, i) => { const n = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).setY(0).normalize(); return v3(-n.z, 0, n.x); });
      const stream = new THREE.Mesh(ribbon(pts, i => sides[i], t => 0.34 + 0.12 * t), water);
      stream.receiveShadow = true;
      grp.add(stream);
      // the fall: shoots out over the lip, then drops into the cloud sea
      const mouth = pts[pts.length - 1], dir = v3(Math.cos(st.angle), 0, Math.sin(st.angle)), side = v3(-dir.z, 0, dir.x);
      const fall: THREE.Vector3[] = [];
      for (let i = 0; i <= 70; i++) {
        const t = (i / 70) * 3.1;
        fall.push(mouth.clone().addScaledVector(dir, 0.25 + 1.5 * t).add(v3(0, -4.9 * t * t - 0.02, 0)));
      }
      grp.add(new THREE.Mesh(ribbon(fall, () => side, t => 0.5 + 2.4 * t), core));
      const mist = fall.map(q => q.clone().addScaledVector(dir, 0.12));
      grp.add(new THREE.Mesh(ribbon(mist, () => side, t => 1.1 + 5.5 * t), veil));
      out.push(grp);
    }
    return out;
  }, []);
  return <>{parts.map((o, i) => <primitive key={i} object={o} />)}</>;
}

/* ── islets: pieces that broke off, floating beside each island, each a tiny island of its own ── */
export function Debris({ mats }: { mats: Mats }) {
  const tops = useRef<THREE.InstancedMesh>(null!), unders = useRef<THREE.InstancedMesh>(null!);
  const { top, under, items } = useMemo(() => {
    const rnd = mulberry32(31337);
    const g = buildIsland(4711, 4, 5.5); // built at a real island's scale, then shrunk, so it keeps the proportions
    const items: { base: THREE.Vector3; s: number; yaw: number; ph: number; amp: number }[] = [];
    for (const p of PLACED) {
      const n = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = p.geo.radius * (1.18 + rnd() * 0.4);
        items.push({ base: v3(p.pos.x + Math.cos(a) * r, p.pos.y - 0.8 - rnd() * 4.5, p.pos.z + Math.sin(a) * r), s: (0.35 + Math.pow(rnd(), 1.5) * 0.9) * 0.3, yaw: rnd() * 6.28, ph: rnd() * 6.28, amp: 0.12 + rnd() * 0.2 });
      }
    }
    return { top: g.top, under: g.under, items };
  }, []);
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), pv = useMemo(() => v3(), []), sv = useMemo(() => v3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!tops.current || !unders.current) return;
    items.forEach((it, i) => {
      pv.copy(it.base); pv.y += Math.sin(t * 0.35 + it.ph) * it.amp;
      q.setFromAxisAngle(UP, it.yaw + t * 0.015);
      m4.compose(pv, q, sv.setScalar(it.s));
      tops.current.setMatrixAt(i, m4); unders.current.setMatrixAt(i, m4);
    });
    tops.current.instanceMatrix.needsUpdate = true; unders.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={tops} args={[top, mats.turf, items.length]} receiveShadow frustumCulled={false} />
      <instancedMesh ref={unders} args={[under, mats.rock, items.length]} castShadow receiveShadow frustumCulled={false} />
    </>
  );
}

/* ── slender rope bridges between neighbouring islands ── */
function Bridge({ a, b, mats }: { a: Placed; b: Placed; mats: Mats }) {
  const { planks, ropes, posts } = useMemo(() => {
    const dir = v3().subVectors(b.pos, a.pos).setY(0).normalize();
    const rim = (p: Placed, dx: number, dz: number) => { const [lx, lz] = toLocal(p, dx, dz); return p.geo.edge(Math.atan2(lz, lx)) * 0.9; };
    const ea = rim(a, dir.x, dir.z), eb = rim(b, -dir.x, -dir.z);
    const pa = v3(a.pos.x + dir.x * ea, 0, a.pos.z + dir.z * ea);
    const pb = v3(b.pos.x - dir.x * eb, 0, b.pos.z - dir.z * eb);
    pa.y = a.pos.y + heightAtWorld(a, pa.x, pa.z) + 0.05;
    pb.y = b.pos.y + heightAtWorld(b, pb.x, pb.z) + 0.05;
    if (!Number.isFinite(pa.y)) pa.y = a.pos.y;
    if (!Number.isFinite(pb.y)) pb.y = b.pos.y;
    const len = pa.distanceTo(pb), sag = Math.min(2.2, len * 0.07);
    const at = (t: number) => v3().lerpVectors(pa, pb, t).add(v3(0, -Math.sin(Math.PI * t) * sag, 0));
    const side = v3(-dir.z, 0, dir.x);
    const n = Math.floor(len / 0.3);
    const planks: THREE.Matrix4[] = [];
    const rnd = mulberry32(a.index * 13 + 5);
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = at(t), q = at(Math.min(1, t + 0.01));
      const m = new THREE.Matrix4().lookAt(p, q, UP);
      m.multiply(new THREE.Matrix4().makeRotationZ((rnd() - 0.5) * 0.05));
      m.setPosition(p);
      planks.push(m);
    }
    const ropes = [-0.42, 0.42].flatMap(o => [0.55, 0.1].map(h => new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => at(i / 23).add(side.clone().multiplyScalar(o)).add(v3(0, h, 0))))));
    const posts = [pa, pb].flatMap(p => [-0.42, 0.42].map(o => p.clone().add(side.clone().multiplyScalar(o))));
    return { planks, ropes, posts };
  }, [a, b]);
  const plankMesh = useMemo(() => instanced(new THREE.BoxGeometry(0.95, 0.045, 0.22), mats.wood, planks), [planks, mats]);
  return (
    <group>
      <primitive object={plankMesh} />
      {ropes.map((c, i) => <mesh key={i} material={mats.rope} castShadow><tubeGeometry args={[c, 64, i % 2 ? 0.012 : 0.02, 5, false]} /></mesh>)}
      {posts.map((p, i) => <mesh key={i} material={mats.wood} position={[p.x, p.y + 0.35, p.z]} castShadow><cylinderGeometry args={[0.045, 0.055, 0.8, 8]} /></mesh>)}
    </group>
  );
}

export function Bridges({ mats }: { mats: Mats }) {
  return <>{PLACED.map((p, i) => <Bridge key={i} a={p} b={PLACED[(i + 1) % PLACED.length]} mats={mats} />)}</>;
}
