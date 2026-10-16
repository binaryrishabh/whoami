import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SUN_DIR } from './light';

/**
 * The sea of cloud far below the islands: a sheet of cumulus domes (spheres scattered on a cell grid,
 * two sizes, like cauliflower tops), lit by the low sun, with soft lilac-grey valleys and bright edges
 * where the light comes through. Heights are built once on the CPU; the sheet drifts slowly.
 */
function hash(ix: number, iy: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number) { let s = 0, a = 0.5; for (let i = 0; i < 4; i++) { s += a * vnoise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.3; a *= 0.5; } return s; }
function domes(x: number, y: number, salt: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  let h = 0;
  for (let gy = -1; gy <= 1; gy++) for (let gx = -1; gx <= 1; gx++) {
    const ox = hash(ix + gx + salt, iy + gy), oy = hash(iy + gy - salt, ix + gx + 7);
    const r = 0.55 + 0.45 * oy, dx = gx + 0.15 + 0.7 * ox - fx, dy = gy + 0.15 + 0.7 * oy - fy;
    const k = r * r - dx * dx - dy * dy;
    if (k > 0) h = Math.max(h, Math.sqrt(k));
  }
  return h;
}
function cloudH(x: number, z: number) {
  const cover = THREE.MathUtils.smoothstep(fbm(x * 0.004, z * 0.004), 0.22, 0.62);
  const big = domes(x * 0.021, z * 0.021, 0), small = domes(x * 0.068 + 3.7, z * 0.068, 91);
  return cover * (0.6 * big + 0.4 * small * (0.4 + 0.6 * big)) + 0.07 * fbm(x * 0.03, z * 0.03);
}

const SIZE = 1800, SEG = 300;

export function CloudSea({ y = -46, amp = 18 }: { y?: number; amp?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const hs = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const h = cloudH(pos.getX(i), pos.getZ(i) - 40);
      hs[i] = h; pos.setY(i, h * amp);
    }
    g.setAttribute('aH', new THREE.BufferAttribute(hs, 1));
    g.computeVertexNormals();
    return g;
  }, [amp]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uSun: { value: SUN_DIR.clone() },
      uLit: { value: new THREE.Color('#fff0dc') },
      uShade: { value: new THREE.Color('#aab3cb') },
      uDeep: { value: new THREE.Color('#8c95b2') },
      uRim: { value: new THREE.Color('#ffcf98') },
      uHorizon: { value: new THREE.Color('#e6dccf') },
    },
    vertexShader: /* glsl */ `
      attribute float aH;
      varying vec3 vW; varying vec3 vN; varying float vH;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal); vH = aH; vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun, uLit, uShade, uDeep, uRim, uHorizon;
      varying vec3 vW; varying vec3 vN; varying float vH;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
      float fbm3(vec2 p) { return 0.5 * vn(p) + 0.25 * vn(p * 2.03 + 7.1) + 0.125 * vn(p * 4.1 + 3.3); }
      void main() {
        vec2 q = vW.xz * 0.22;
        vec3 n = normalize(vN + vec3(fbm3(q) - 0.44, 0.0, fbm3(q.yx + 5.0) - 0.44) * 0.5);
        float wrap = clamp((dot(n, uSun) + 0.5) / 1.5, 0.0, 1.0);
        vec3 col = mix(uShade, uLit, smoothstep(0.0, 1.0, wrap));
        col = mix(uDeep, col, smoothstep(0.02, 0.4, vH));
        vec3 v = normalize(vW - cameraPosition);
        col += uRim * pow(clamp(dot(v, uSun), 0.0, 1.0), 5.0) * (1.0 - wrap) * 0.5;
        col *= 0.95 + 0.08 * fbm3(vW.xz * 0.05);
        float dist = length(vW.xz - cameraPosition.xz);
        col = mix(col, uHorizon, smoothstep(160.0, 760.0, dist) * 0.7);
        gl_FragColor = vec4(col, 1.0 - smoothstep(560.0, 860.0, dist));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), []);
  const mesh = useMemo(() => new THREE.Mesh(geo, mat), [geo, mat]);
  useFrame((_, dt) => { mesh.position.x += dt * 0.12; }); // a slow drift; the sheet is wide enough for a long visit
  return <primitive object={mesh} position={[0, y, -40]} frustumCulled={false} renderOrder={-1} />;
}
