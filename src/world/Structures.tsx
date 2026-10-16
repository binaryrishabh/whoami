import { use, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import opentype from 'opentype.js';
import fontUrl from '@fontsource/archivo/files/archivo-latin-800-normal.woff?url';
import github from '../data/github.json';
import { site } from '../site.config';
import type { Placed } from './layout';
import { PLANS } from './plan';
import { createNoise2D, mulberry32 } from '../lib/noise';
import type { Mats } from './materials';

/*
 * One piece of architecture per island, built like a presentation model: board-marked concrete,
 * cedar cladding, dark glass with a warm room behind it, brass details. Everything faces +z, where the
 * camera stands when you arrive.
 */

const fontPromise: Promise<opentype.Font> = fetch(fontUrl).then(r => r.arrayBuffer()).then(b => opentype.parse(b));

function textGeometry(font: opentype.Font, text: string, height: number, depth: number, spacing = 0) {
  const size = height / 0.72;
  const sp = new THREE.ShapePath();
  let x = 0;
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    const path = glyph.getPath(x, 0, size);
    for (const c of path.commands as any[]) {
      if (c.type === 'M') sp.moveTo(c.x, -c.y);
      else if (c.type === 'L') sp.lineTo(c.x, -c.y);
      else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
      else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    }
    x += (glyph.advanceWidth ?? 0) * (size / font.unitsPerEm) + spacing * height;
  }
  const g = new THREE.ExtrudeGeometry(sp.toShapes(), { depth, curveSegments: 10, bevelEnabled: true, bevelThickness: height * 0.015, bevelSize: height * 0.01, bevelSegments: 2 });
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -depth / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.4, uv.getY(i) * 0.4);
  return g;
}

/** a box whose texture keeps its real-world scale on every face (`s` world units per repeat) */
function tbox(w: number, h: number, d: number, s = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, (uv.getX(i) * dims[f][0]) / s, (uv.getY(i) * dims[f][1]) / s);
  }
  return g;
}

type V3 = [number, number, number];
function B({ m, p, s, r = 0, tex = 2, shadow = true }: { m: THREE.Material; p: V3; s: V3; r?: number; tex?: number; shadow?: boolean }) {
  const g = useMemo(() => tbox(s[0], s[1], s[2], tex), [s[0], s[1], s[2], tex]);
  return <mesh geometry={g} material={m} position={p} rotation={[0, r, 0]} castShadow={shadow} receiveShadow />;
}

const groundY = (p: Placed, x: number, z: number) => { const h = p.geo.heightAt(x, z); return Number.isFinite(h) ? h : 0; };
/** the lowest meadow point under a rectangle, so a podium never floats */
function seat(p: Placed, cx: number, cz: number, w: number, d: number) {
  let lo = Infinity;
  for (const sx of [-0.5, 0, 0.5]) for (const sz of [-0.5, 0, 0.5]) lo = Math.min(lo, groundY(p, cx + sx * w, cz + sz * d));
  return lo;
}

/** the highest meadow point under a disc, so a terrace covers the grass completely */
function seatMax(p: Placed, cx: number, cz: number, r: number) {
  let hi = -Infinity;
  for (let i = 0; i < 24; i++) for (const f of [0, 0.5, 1]) { const a = (i / 24) * Math.PI * 2; hi = Math.max(hi, groundY(p, cx + Math.cos(a) * r * f, cz + Math.sin(a) * r * f)); }
  return hi;
}

/* ── the name, in cast letters on a long concrete plinth, with the surname in brass along its face ── */
function Name({ p, mats }: { p: Placed; mats: Mats }) {
  const font = use(fontPromise);
  const [first, ...rest] = site.name.toUpperCase().split(' ');
  const big = useMemo(() => textGeometry(font, first, 2.2, 0.62, 0.02), [font, first]);
  const small = useMemo(() => textGeometry(font, rest.join(' '), 0.5, 0.05, 0.3), [font, rest.join(' ')]);
  big.computeBoundingBox();
  const W = big.boundingBox!.max.x - big.boundingBox!.min.x + 1.4, D = 1.5, H = 0.86, z = -3.6;
  const y = seat(p, 0, z, W, D) - 0.12;
  const pad = PLANS[p.index].forecourt;
  const py = groundY(p, pad.x, pad.y);
  return (
    <group>
      <B m={mats.concrete} p={[0, y + H / 2, z]} s={[W, H, D]} />
      <mesh geometry={big} material={mats.plaster} position={[0, y + H, z - 0.1]} castShadow receiveShadow />
      <mesh geometry={small} material={mats.brass} position={[0, y + H / 2 - 0.25, z + D / 2 + 0.025]} castShadow />
      {/* the landing pad: a round stone terrace with a brass ring */}
      <mesh material={mats.concrete} position={[pad.x, py + 0.04, pad.y]} receiveShadow castShadow><cylinderGeometry args={[1.45, 1.55, 0.14, 64]} /></mesh>
      <mesh material={mats.brass} position={[pad.x, py + 0.112, pad.y]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.0, 1.06, 64]} /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} material={mats.lampGlow} position={[pad.x + Math.cos(i * Math.PI / 2 + Math.PI / 4) * 1.28, py + 0.12, pad.y + Math.sin(i * Math.PI / 2 + Math.PI / 4) * 1.28]}><cylinderGeometry args={[0.05, 0.05, 0.02, 16]} /></mesh>)}
    </group>
  );
}

/* ── a house: concrete podium, a cedar volume behind a glass front, a floating roof, sometimes a study on top ── */
function House({ p, mats, w, d, h, sign }: { p: Placed; mats: Mats; w: number; d: number; h: number; sign?: string }) {
  const rnd = mulberry32(p.seed);
  const cz = PLANS[p.index].footprint[0].z;
  const y0 = seat(p, 0, cz, w + 1.6, d + 1.6) - 0.08;
  const upper = rnd() < 0.7;
  const flip = rnd() < 0.5 ? 1 : -1;
  const ph = 0.42; // podium height
  const top = y0 + ph;
  const lw = w * 0.6, lx = -flip * w * 0.2; // the closed cedar volume
  const cols: V3[] = [];
  for (const sx of [0.2, 0.5]) for (const sz of [-0.42, 0.42]) cols.push([flip * w * sx, top + h / 2, cz + sz * d]);
  return (
    <group>
      <B m={mats.concreteDark} p={[0, y0 + ph / 2, cz]} s={[w + 1.6, ph, d + 1.6]} />
      {/* steps down to the forecourt */}
      <B m={mats.concreteDark} p={[flip * w * 0.32, y0 + ph * 0.25, cz + d / 2 + 0.95]} s={[1.3, ph * 0.5, 0.36]} />
      {/* cedar deck in front of the glass */}
      <B m={mats.cedar} p={[lx, top + 0.03, cz + d / 2 + 0.38]} s={[lw + 0.4, 0.06, 0.7]} tex={1.2} />
      {/* the cedar volume, with a full-height glass front and a warm room behind */}
      <B m={mats.cedar} p={[lx, top + h / 2, cz - 0.1]} s={[lw, h, d - 0.2]} tex={1.2} />
      <B m={mats.glass} p={[lx, top + h * 0.46, cz + d / 2 - 0.18]} s={[lw * 0.86, h * 0.86, 0.04]} />
      <mesh material={mats.warm} position={[lx, top + h * 0.4, cz + d / 2 - 0.22]}><planeGeometry args={[lw * 0.7, h * 0.55]} /></mesh>
      {[-0.3, 0, 0.3].map(f => <B key={f} m={mats.steel} p={[lx + f * lw * 0.86, top + h * 0.46, cz + d / 2 - 0.15]} s={[0.025, h * 0.86, 0.03]} />)}
      {/* the open side: a terrace under the roof on slim steel columns */}
      {cols.map((c, i) => <B key={i} m={mats.steel} p={c} s={[0.07, h, 0.07]} />)}
      <B m={mats.concrete} p={[flip * w * 0.34, top + 0.03, cz]} s={[w * 0.36, 0.06, d]} />
      {/* the roof slab, cantilevered past the walls */}
      <B m={mats.plaster} p={[flip * 0.25, top + h + 0.09, cz + 0.12]} s={[w + 0.9, 0.18, d + 0.75]} />
      {upper && (
        <group>
          <B m={mats.concrete} p={[flip * w * 0.22, top + h + 0.18 + h * 0.36, cz - d * 0.12]} s={[w * 0.46, h * 0.72, d * 0.62]} />
          <B m={mats.glass} p={[flip * w * 0.22, top + h + 0.18 + h * 0.4, cz - d * 0.12 + d * 0.31 + 0.01]} s={[w * 0.4, h * 0.26, 0.03]} />
          <mesh material={mats.warm} position={[flip * w * 0.22, top + h + 0.18 + h * 0.38, cz - d * 0.12 + d * 0.31 - 0.01]}><planeGeometry args={[w * 0.32, h * 0.16]} /></mesh>
          <B m={mats.plaster} p={[flip * w * 0.22, top + h + 0.18 + h * 0.72 + 0.06, cz - d * 0.12]} s={[w * 0.52, 0.12, d * 0.7]} />
        </group>
      )}
      {sign && <Sign text={sign} mats={mats} p={[-flip * w * 0.18, y0 + ph * 0.5, cz + (d + 1.6) / 2 + 0.012]} />}
    </group>
  );
}

function Sign({ text, mats, p }: { text: string; mats: Mats; p: V3 }) {
  const font = use(fontPromise);
  const g = useMemo(() => textGeometry(font, text.toUpperCase(), 0.17, 0.03, 0.18), [font, text]);
  return <mesh geometry={g} material={mats.brass} position={[p[0], p[1] - 0.085, p[2]]} castShadow />;
}

/* ── a studio: one long cedar bar under a single sloping roof, glazed along the front ── */
function Studio({ p, mats }: { p: Placed; mats: Mats }) {
  const cz = PLANS[p.index].footprint[0].z, w = 5.6, d = 2.4, h = 1.25;
  const y0 = seat(p, 0, cz, w + 1.4, d + 1.6) - 0.08, top = y0 + 0.36;
  const roof = useMemo(() => {
    // a mono-pitch roof: high at the back, low over the glass, overhanging both ends
    const sh = new THREE.Shape([new THREE.Vector2(-(d / 2 + 0.5), 0), new THREE.Vector2(d / 2 + 0.6, 0), new THREE.Vector2(d / 2 + 0.6, 0.12), new THREE.Vector2(-(d / 2 + 0.5), 0.62), new THREE.Vector2(-(d / 2 + 0.5), 0.5)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: w + 0.8, bevelEnabled: false });
    g.translate(0, 0, -(w + 0.8) / 2); g.rotateY(Math.PI / 2);
    return g;
  }, []);
  return (
    <group>
      <B m={mats.concreteDark} p={[0, y0 + 0.18, cz]} s={[w + 1.4, 0.36, d + 1.6]} />
      <B m={mats.cedar} p={[0, top + h / 2, cz - 0.15]} s={[w, h, d - 0.3]} tex={1.2} />
      <B m={mats.glass} p={[0, top + h * 0.47, cz + d / 2 - 0.29]} s={[w * 0.9, h * 0.84, 0.04]} />
      <mesh material={mats.warm} position={[-w * 0.18, top + h * 0.42, cz + d / 2 - 0.33]}><planeGeometry args={[w * 0.4, h * 0.5]} /></mesh>
      {[-0.36, -0.12, 0.12, 0.36].map(f => <B key={f} m={mats.steel} p={[f * w, top + h * 0.47, cz + d / 2 - 0.26]} s={[0.03, h * 0.84, 0.03]} />)}
      <mesh geometry={roof} material={mats.plaster} position={[0, top + h, cz]} castShadow receiveShadow />
      <B m={mats.cedar} p={[0, top + 0.03, cz + d / 2 + 0.3]} s={[w * 0.7, 0.06, 0.6]} tex={1.2} />
    </group>
  );
}

/* ── a stacked house: a glass ground floor in a concrete frame, a cedar box turned across it above ── */
function Stacked({ p, mats }: { p: Placed; mats: Mats }) {
  const cz = PLANS[p.index].footprint[0].z;
  const y0 = seat(p, 0, cz, 5, 4) - 0.08, top = y0 + 0.32, h = 1.2;
  return (
    <group>
      <B m={mats.concreteDark} p={[0, y0 + 0.16, cz]} s={[5, 0.32, 4]} />
      {/* ground floor: concrete frame, glass all round, warm inside */}
      <B m={mats.glass} p={[0, top + h / 2, cz]} s={[3.0, h, 2.4]} />
      <mesh material={mats.warm} position={[0.2, top + h * 0.45, cz + 1.21]}><planeGeometry args={[2.0, h * 0.55]} /></mesh>
      <B m={mats.concrete} p={[0, top + h + 0.08, cz]} s={[3.3, 0.16, 2.7]} />
      {[[-1.55, -1.25], [1.55, -1.25], [-1.55, 1.25], [1.55, 1.25]].map(([x, z], i) => <B key={i} m={mats.concrete} p={[x, top + h / 2, cz + z]} s={[0.16, h, 0.16]} />)}
      {/* first floor: a cedar box turned across, cantilevered at both ends */}
      <B m={mats.cedar} p={[0.3, top + h + 0.16 + 0.6, cz - 0.1]} s={[2.0, 1.2, 4.0]} tex={1.2} />
      <B m={mats.glass} p={[0.3, top + h + 0.16 + 0.62, cz + 1.91]} s={[1.6, 0.7, 0.04]} />
      <mesh material={mats.warm} position={[0.3, top + h + 0.16 + 0.58, cz + 1.88]}><planeGeometry args={[1.3, 0.45]} /></mesh>
      <B m={mats.plaster} p={[0.3, top + h + 0.16 + 1.26, cz - 0.1]} s={[2.2, 0.12, 4.2]} />
    </group>
  );
}

/* ── a dark sculpture beside each project: a split monolith ── */
function Monolith({ p, mats }: { p: Placed; mats: Mats }) {
  const rnd = mulberry32(p.seed + 9);
  const R = p.geo.radius, x = (rnd() < 0.5 ? -1 : 1) * R * 0.52, z = R * 0.08;
  const y = groundY(p, x, z);
  return (
    <group position={[x, y, z]} rotation={[0, rnd() * 1.2 - 0.6, 0]}>
      <B m={mats.concreteDark} p={[0, 0.06, 0]} s={[1.3, 0.12, 1.3]} />
      <B m={mats.steel} p={[-0.13, 1.3, 0]} s={[0.22, 2.4, 0.8]} />
      <B m={mats.steel} p={[0.15, 1.05, 0]} s={[0.22, 1.9, 0.8]} />
      <B m={mats.brass} p={[0.01, 0.9, 0]} s={[0.04, 1.6, 0.6]} />
    </group>
  );
}

/* ── towers whose heights follow the numbers ── */
function Towers({ p, mats }: { p: Placed; mats: Mats }) {
  if (p.island.kind !== 'stats') return null;
  const items = p.island.items, max = Math.max(...items.map(i => i.value));
  const cz = PLANS[p.index].footprint[0].z, span = (items.length - 1) * 1.9;
  const y0 = seat(p, 0, cz, span + 2, 2.4) - 0.06;
  return (
    <group>
      <B m={mats.concreteDark} p={[0, y0 + 0.15, cz]} s={[span + 2.2, 0.3, 2.6]} />
      {items.map((it, i) => {
        const x = -span / 2 + i * 1.9, z = cz + (i % 2 ? -0.35 : 0.25), h = 1.8 + 5.6 * (it.value / max);
        const floors = Math.max(2, Math.round(h / 0.55));
        return (
          <group key={i} position={[x, y0 + 0.3, z]}>
            <B m={mats.concrete} p={[0, h / 2, 0]} s={[0.9, h, 0.9]} />
            {Array.from({ length: floors - 1 }, (_, f) => <B key={f} m={mats.glass} p={[0, 0.35 + f * (h - 0.5) / (floors - 1), 0]} s={[0.94, 0.14, 0.94]} shadow={false} />)}
            <B m={mats.brass} p={[0, h + 0.07, 0]} s={[1.0, 0.14, 1.0]} />
            <B m={mats.steel} p={[0, h + 0.45, 0]} s={[0.04, 0.62, 0.04]} />
          </group>
        );
      })}
    </group>
  );
}

/* ── a year of contributions as a stone dial: one spoke per week, one ring per weekday ── */
const LEVEL_COL = ['#d8d1c4', '#b8cf8c', '#8bb35e', '#5e8d40', '#3e6a2c'];
function YearDial({ p, mats }: { p: Placed; mats: Mats }) {
  const { mesh, outer } = useMemo(() => {
    const days = github.days, weeks = Math.max(...days.map(d => d.week)) + 1;
    const r0 = 2.0, dr = 0.5, outer = r0 + 7 * dr;
    const m = new THREE.InstancedMesh(tbox(1, 1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.55, color: '#ffffff' }), days.length);
    days.forEach((d, i) => {
      const a = Math.PI / 2 - ((d.week + 0.5) / weeks) * Math.PI * 2;
      const r = r0 + (d.weekday + 0.5) * dr;
      const h = d.level === 0 ? 0.05 : 0.12 + d.level * 0.15 + Math.min(d.count, 12) * 0.02;
      const tangential = ((r * Math.PI * 2) / weeks) * 0.82;
      m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, 0.34 + h / 2, -Math.sin(a) * r), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(dr * 0.82, h, tangential)));
      m.setColorAt(i, new THREE.Color(LEVEL_COL[d.level]));
    });
    m.castShadow = true; m.receiveShadow = true;
    return { mesh: m, outer };
  }, []);
  const y = seat(p, 0, 0, outer * 1.6, outer * 1.6) - 0.05;
  return (
    <group position={[0, y, 0]}>
      <mesh material={mats.concreteDark} position={[0, 0.15, 0]} castShadow receiveShadow><cylinderGeometry args={[outer + 0.45, outer + 0.6, 0.3, 96]} /></mesh>
      <mesh material={mats.brass} position={[0, 0.305, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[outer + 0.2, outer + 0.26, 96]} /></mesh>
      <primitive object={mesh} />
      {/* the gnomon: a dark fin over a brass disc */}
      <mesh material={mats.brass} position={[0, 0.36, 0]} castShadow><cylinderGeometry args={[1.2, 1.25, 0.08, 64]} /></mesh>
      <mesh material={mats.steel} position={[0, 0.4, 0]} castShadow>
        <extrudeGeometry args={[new THREE.Shape([new THREE.Vector2(-0.9, 0), new THREE.Vector2(0.9, 0), new THREE.Vector2(0.9, 0.12), new THREE.Vector2(-0.6, 1.9)]), { depth: 0.07, bevelEnabled: false }]} />
      </mesh>
    </group>
  );
}

/* ── a stone garden: raked gravel, and one standing stone per skill, gathered by group ── */
function StoneGarden({ p, mats }: { p: Placed; mats: Mats }) {
  const parts = useMemo(() => {
    if (p.island.kind !== 'skills') return null;
    const groups = p.island.groups, rnd = mulberry32(p.seed);
    const base = (seed: number) => {
      const g = new THREE.IcosahedronGeometry(1, 1); g.deleteAttribute('normal'); g.deleteAttribute('uv');
      const n = createNoise2D(seed), pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.multiplyScalar(1 + 0.3 * n(v.x * 1.3 + v.y, v.z * 1.3) + 0.12 * n(v.x * 3.4, v.y * 3.4 + v.z));
        if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3; // a flat foot
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      const m = mergeVertices(g); m.computeVertexNormals();
      const uv: number[] = [], col: number[] = [];
      const pp = m.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pp.count; i++) { uv.push(pp.getX(i) * 0.5 + pp.getZ(i) * 0.3, pp.getY(i) * 0.5); col.push(1, 1, 1); }
      m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return m;
    };
    const geo = base(5);
    const basalt = new THREE.MeshStandardMaterial({ color: '#4a4744', roughness: 0.62, vertexColors: true });
    const darkStones: THREE.Matrix4[] = [], lightStones: THREE.Matrix4[] = [];
    const rings: { x: number; z: number; r: number }[] = [];
    groups.forEach((g, gi) => {
      const a = Math.PI / 2 + ((gi + 0.5) / groups.length) * Math.PI * 2;
      const cx = Math.cos(a) * 3.2, cz = Math.sin(a) * 3.0 - 0.4;
      rings.push({ x: cx, z: cz, r: 0.55 + Math.sqrt(g.items.length) * 0.2 });
      g.items.forEach((_, k) => {
        const ang = k * 2.4 + rnd(), rr = k === 0 ? 0 : 0.2 + Math.sqrt(k) * 0.17;
        const x = cx + Math.cos(ang) * rr, z = cz + Math.sin(ang) * rr;
        const tall = k === 0 ? 0.42 + g.items.length * 0.035 : 0.1 + rnd() * 0.16;
        const wdt = k === 0 ? 0.38 : 0.12 + rnd() * 0.1;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, tall * 0.16, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.15, rnd() * 6, (rnd() - 0.5) * 0.15)), new THREE.Vector3(wdt, tall, wdt * (0.8 + rnd() * 0.3)));
        (k === 0 || k % 3 === 0 ? darkStones : lightStones).push(m);
      });
    });
    const mk = (mat: THREE.Material, list: THREE.Matrix4[]) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; return im; };
    const granite = new THREE.MeshStandardMaterial({ color: '#cfcac2', roughness: 0.85, vertexColors: true });
    return { dark: mk(basalt, darkStones), light: mk(granite, lightStones), rings };
  }, [p, mats]);
  if (!parts) return null;
  const y = seatMax(p, 0, -0.4, 5.2) + 0.04 - 0.16;
  return (
    <group>
      <mesh material={mats.gravel} position={[0, y + 0.16 - 0.45, -0.4]} receiveShadow><cylinderGeometry args={[5.1, 5.1, 0.9, 96]} /></mesh>
      <mesh material={mats.concreteDark} position={[0, y + 0.17, -0.4]} rotation={[Math.PI / 2, 0, 0]} receiveShadow castShadow><torusGeometry args={[5.15, 0.11, 8, 120]} /></mesh>
      {/* rake lines: rings round each cluster and round the whole garden */}
      {[1.2, 1.7, 2.2].map(r => <mesh key={r} material={mats.concrete} position={[0, y + 0.16, -0.4]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r, 0.012, 4, 96]} /></mesh>)}
      {parts.rings.flatMap(c => [c.r, c.r + 0.16].map(r => <mesh key={`${c.x}-${r}`} material={mats.concrete} position={[c.x, y + 0.16, c.z]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r, 0.012, 4, 48]} /></mesh>))}
      <group position={[0, y + 0.16, 0]}>
        <primitive object={parts.dark} />
        <primitive object={parts.light} />
      </group>
    </group>
  );
}

/* ── a lighthouse that never stops turning ── */
function Lighthouse({ p, mats }: { p: Placed; mats: Mats }) {
  const beam = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { beam.current.rotation.y += dt * 0.55; });
  const cz = PLANS[p.index].footprint[0].z;
  const y = seat(p, 0, cz, 3, 3) - 0.05;
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), []);
  return (
    <group position={[0, y, cz]}>
      <mesh material={mats.concreteDark} position={[0, 0.2, 0]} castShadow receiveShadow><cylinderGeometry args={[1.6, 1.8, 0.4, 48]} /></mesh>
      <mesh material={mats.plaster} position={[0, 2.8, 0]} castShadow receiveShadow><cylinderGeometry args={[0.52, 0.86, 4.8, 48]} /></mesh>
      {[1.4, 3.0].map(h => <mesh key={h} material={mats.cedar} position={[0, h, 0]} castShadow><cylinderGeometry args={[0.86 - (h - 0.4) * 0.071 + 0.01, 0.86 - (h - 0.4) * 0.071 + 0.03, 0.34, 48]} /></mesh>)}
      <mesh material={mats.steel} position={[0, 5.24, 0]} castShadow><cylinderGeometry args={[0.8, 0.8, 0.1, 48]} /></mesh>
      <mesh material={mats.steel} position={[0, 5.5, 0]}><torusGeometry args={[0.78, 0.015, 6, 48]} /></mesh>
      <mesh material={mats.lampGlow} position={[0, 5.66, 0]}><cylinderGeometry args={[0.26, 0.26, 0.5, 24]} /></mesh>
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} material={mats.steel} position={[Math.cos(i * Math.PI / 4) * 0.46, 5.68, Math.sin(i * Math.PI / 4) * 0.46]}><boxGeometry args={[0.03, 0.8, 0.03]} /></mesh>)}
      <mesh material={mats.lantern} position={[0, 5.68, 0]}><cylinderGeometry args={[0.46, 0.46, 0.8, 32, 1, true]} /></mesh>
      <mesh material={mats.steel} position={[0, 6.24, 0]} castShadow><sphereGeometry args={[0.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <mesh material={mats.brass} position={[0, 6.82, 0]}><coneGeometry args={[0.05, 0.3, 12]} /></mesh>
      <group ref={beam} position={[0, 5.66, 0]}>
        <mesh material={beamMat} position={[7, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[1.4, 14, 32, 1, true]} /></mesh>
        <mesh material={beamMat} position={[-7, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[1.4, 14, 32, 1, true]} /></mesh>
      </group>
      <pointLight position={[0, 5.66, 0]} color="#ffcf8a" intensity={5} distance={12} />
    </group>
  );
}

/* ── a small campus: two halls round a lawn, and a clock tower ── */
function Campus({ p, mats }: { p: Placed; mats: Mats }) {
  const cz = PLANS[p.index].footprint[0].z;
  const y = seat(p, 0, cz, 7, 5.6) - 0.06;
  return (
    <group position={[0, y, cz]}>
      <B m={mats.concreteDark} p={[0, 0.14, 0]} s={[7, 0.28, 5.4]} />
      {/* the long hall */}
      <B m={mats.cedar} p={[-2.25, 1.05, -0.2]} s={[1.7, 1.55, 4.4]} tex={1.2} />
      <B m={mats.glass} p={[-1.39, 1.0, -0.2]} s={[0.04, 1.1, 3.8]} />
      <mesh material={mats.warm} position={[-1.42, 0.95, -0.2]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[3.2, 0.7]} /></mesh>
      <B m={mats.plaster} p={[-2.25, 1.9, -0.2]} s={[2.0, 0.14, 4.7]} />
      {/* the library */}
      <B m={mats.concrete} p={[1.9, 0.85, -1.2]} s={[2.2, 1.15, 2.4]} />
      <B m={mats.glass} p={[1.9, 0.85, 0.01]} s={[1.9, 0.6, 0.04]} />
      <B m={mats.plaster} p={[1.9, 1.5, -1.2]} s={[2.5, 0.14, 2.7]} />
      {/* the lawn and a path across it */}
      <B m={mats.concrete} p={[0.2, 0.29, 1.2]} s={[0.7, 0.02, 2.4]} />
      {/* the clock tower */}
      <B m={mats.concrete} p={[2.2, 2.1, 1.5]} s={[0.8, 3.9, 0.8]} />
      <mesh material={mats.steel} position={[2.2, 3.4, 1.91]}><circleGeometry args={[0.27, 40]} /></mesh>
      <mesh material={mats.brass} position={[2.2, 3.4, 1.92]}><ringGeometry args={[0.24, 0.27, 40]} /></mesh>
      <mesh material={mats.brass} position={[2.2, 3.4, 1.93]} rotation={[0, 0, 0.6]}><planeGeometry args={[0.02, 0.2]} /></mesh>
      <mesh material={mats.brass} position={[2.2, 4.38, 1.5]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[0.6, 0.6, 4]} /></mesh>
    </group>
  );
}

export function Structures({ placed: p, mats }: { placed: Placed; mats: Mats }) {
  switch (p.island.kind) {
    case 'about': return <Name p={p} mats={mats} />;
    case 'experience': return <House p={p} mats={mats} w={5.4} d={3.6} h={1.5} sign={p.island.roles[0]?.org} />;
    case 'project': {
      // projects take turns between three kinds of building, so neighbours never look alike
      const nth = site.islands.slice(0, p.index).filter(i => i.kind === 'project').length % 3;
      return <>{nth === 0 ? <House p={p} mats={mats} w={4.4} d={3.0} h={1.35} /> : nth === 1 ? <Studio p={p} mats={mats} /> : <Stacked p={p} mats={mats} />}<Monolith p={p} mats={mats} /></>;
    }
    case 'skills': return <StoneGarden p={p} mats={mats} />;
    case 'stats': return <Towers p={p} mats={mats} />;
    case 'github': return <YearDial p={p} mats={mats} />;
    case 'education': return <Campus p={p} mats={mats} />;
    case 'contact': return <Lighthouse p={p} mats={mats} />;
  }
}
