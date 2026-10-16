import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RING } from './layout';
import { wind } from './materials';

/**
 * Three small flocks wheeling round the ring of islands. Each bird is one instance of a tiny body and
 * two wings; the wings flap in the vertex shader, each bird on its own beat, gliding now and then.
 */
const FLOCKS = 3, PER = 11;

function birdGeometry() {
  // body along +z, wings out to ±x; `aWing` is 0 on the body and grows to 1 at the wing tips
  const p: number[] = [], w: number[] = [];
  const tri = (a: number[], b: number[], c: number[], wa: number, wb: number, wc: number) => { p.push(...a, ...b, ...c); w.push(wa, wb, wc); };
  // body: a slim diamond
  tri([0, 0, 0.22], [0.035, 0, 0], [0, 0.03, 0], 0, 0, 0);
  tri([0, 0, 0.22], [0, 0.03, 0], [-0.035, 0, 0], 0, 0, 0);
  tri([0, 0, -0.16], [0, 0.03, 0], [0.035, 0, 0], 0, 0, 0);
  tri([0, 0, -0.16], [-0.035, 0, 0], [0, 0.03, 0], 0, 0, 0);
  tri([0, 0, -0.16], [0.06, 0, -0.22], [-0.06, 0, -0.22], 0, 0, 0); // tail
  // wings: swept back, two segments each, tips furthest out
  for (const s of [1, -1]) {
    tri([0.03 * s, 0, 0.06], [0.03 * s, 0, -0.06], [0.16 * s, 0, 0.02], 0, 0, 0.45);
    tri([0.16 * s, 0, 0.02], [0.03 * s, 0, -0.06], [0.17 * s, 0, -0.07], 0.45, 0, 0.45);
    tri([0.16 * s, 0, 0.02], [0.17 * s, 0, -0.07], [0.32 * s, 0, -0.1], 0.45, 0.45, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(w, 1));
  g.computeVertexNormals();
  return g;
}

export function Birds() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(birdGeometry, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#34363a', roughness: 0.8, side: THREE.DoubleSide });
    m.onBeforeCompile = s => {
      s.uniforms.uTime = wind;
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aWing;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = dot(instanceMatrix[3].xyz, vec3(1.7, 3.1, 2.3));
          float beat = sin(uTime * 9.0 + ph);
          float glide = smoothstep(0.2, 0.7, sin(uTime * 0.6 + ph * 0.3));
          transformed.y += mix(beat * 0.22, 0.03, glide) * aWing;
          transformed.x *= 1.0 - 0.18 * abs(beat) * aWing * (1.0 - glide);`);
    };
    m.customProgramCacheKey = () => 'bird';
    return m;
  }, []);
  const birds = useMemo(() => Array.from({ length: FLOCKS * PER }, (_, i) => {
    const f = Math.floor(i / PER), k = i % PER;
    return { f, off: new THREE.Vector3(Math.sin(k * 2.39) * (0.6 + k * 0.28), Math.cos(k * 1.7) * 0.5, -Math.abs(Math.cos(k * 2.39)) * (0.5 + k * 0.32)), ph: k * 1.31 + f * 4.7 };
  }), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1) }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime, mesh = ref.current;
    if (!mesh) return;
    birds.forEach((b, i) => {
      // each flock rides its own wide, wandering circle round the ring
      const sp = 0.045 + b.f * 0.012, dirn = b.f === 1 ? -1 : 1;
      const a = dirn * t * sp + b.f * 2.1;
      const rad = RING.r + 12 + b.f * 9 + Math.sin(t * 0.07 + b.f) * 6;
      const y = 7 + b.f * 3.5 + Math.sin(t * 0.21 + b.f * 2) * 2.5;
      const head = a + dirn * Math.PI / 2; // tangent of the circle
      const cx = Math.cos(a) * rad, cz = RING.z + Math.sin(a) * rad;
      // the bird's own wander inside the flock
      const wx = b.off.x + Math.sin(t * 0.9 + b.ph) * 0.35, wy = b.off.y + Math.sin(t * 1.3 + b.ph * 1.7) * 0.25, wz = b.off.z + Math.cos(t * 0.7 + b.ph) * 0.3;
      const ch = Math.cos(head), sh = Math.sin(head);
      tmp.p.set(cx + wx * sh + wz * ch, y + wy, cz - wx * ch + wz * sh);
      const yaw = Math.atan2(ch, sh);
      tmp.e.set(Math.sin(t * 1.1 + b.ph) * 0.08, yaw, -dirn * 0.25 + Math.sin(t * 0.8 + b.ph) * 0.1);
      tmp.q.setFromEuler(tmp.e);
      tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(1.6));
      mesh.setMatrixAt(i, tmp.m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, birds.length]} frustumCulled={false} />;
}
