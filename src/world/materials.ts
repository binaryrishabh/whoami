import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

/**
 * Every surface in the world, from real scanned materials (Poly Haven and ambientCG, CC0):
 * layered cliff rock under the islands, meadow grass on top, board-marked concrete and cedar cladding
 * for the buildings, photographed leaves for the trees. One palette, tuned for a low warm sun.
 */
const T = '/assets/tex/';
export const TEXTURES = {
  rock: `${T}cliff_side_diff.webp`, rockN: `${T}cliff_side_nor_gl.webp`, rockA: `${T}cliff_side_arm.webp`,
  turf: `${T}grass_ground_diff.webp`, turfN: `${T}grass_ground_nor_gl.webp`, turfA: `${T}grass_ground_arm.webp`,
  conc: `${T}concrete_wall_008_diff.webp`, concN: `${T}concrete_wall_008_nor_gl.webp`, concA: `${T}concrete_wall_008_arm.webp`,
  cedar: `${T}japanese_cedar_planks_diff.webp`, cedarN: `${T}japanese_cedar_planks_nor_gl.webp`, cedarA: `${T}japanese_cedar_planks_arm.webp`,
  leaf: `${T}leaf_broad.webp`, needle: `${T}leaf_needle.webp`,
};

/** shared wind clock for foliage and water */
export const wind = { value: 0 };

export type Mats = ReturnType<typeof useMaterials>;

export function useMaterials() {
  const t = useTexture(TEXTURES);
  return useMemo(() => {
    for (const k of Object.keys(t) as (keyof typeof t)[]) {
      t[k].wrapS = t[k].wrapT = THREE.RepeatWrapping;
      t[k].anisotropy = 8;
    }
    for (const k of ['rock', 'turf', 'conc', 'cedar', 'leaf', 'needle'] as const) t[k].colorSpace = THREE.SRGBColorSpace;
    t.leaf.wrapS = t.leaf.wrapT = t.needle.wrapS = t.needle.wrapT = THREE.ClampToEdgeWrapping;

    const rock = new THREE.MeshStandardMaterial({ map: t.rock, normalMap: t.rockN, roughnessMap: t.rockA, aoMap: t.rockA, vertexColors: true, color: '#e9dccb', normalScale: new THREE.Vector2(1.3, 1.3) });
    const turf = new THREE.MeshStandardMaterial({ map: t.turf, normalMap: t.turfN, roughnessMap: t.turfA, vertexColors: true, color: '#ffffff', normalScale: new THREE.Vector2(0.9, 0.9) });
    const concrete = new THREE.MeshStandardMaterial({ map: t.conc, normalMap: t.concN, roughnessMap: t.concA, color: '#fbfaf7', normalScale: new THREE.Vector2(0.6, 0.6) });
    const concreteDark = new THREE.MeshStandardMaterial({ map: t.conc, normalMap: t.concN, roughnessMap: t.concA, color: '#9d9890', normalScale: new THREE.Vector2(0.6, 0.6) });
    const cedar = new THREE.MeshStandardMaterial({ map: t.cedar, normalMap: t.cedarN, roughnessMap: t.cedarA, color: '#cbb8a6', normalScale: new THREE.Vector2(0.8, 0.8) });
    const plaster = new THREE.MeshStandardMaterial({ color: '#efebe4', roughness: 0.72 });
    const glass = new THREE.MeshStandardMaterial({ color: '#1d2a33', roughness: 0.04, metalness: 0.2, envMapIntensity: 1.6 });
    const lantern = new THREE.MeshStandardMaterial({ color: '#cfe3ea', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false });
    const gravel = new THREE.MeshStandardMaterial({ map: t.conc, color: '#eef0f5', roughness: 0.95, normalMap: t.concN, normalScale: new THREE.Vector2(1.2, 1.2) });
    const steel = new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.42, metalness: 0.55 });
    const brass = new THREE.MeshStandardMaterial({ color: '#c09a5b', roughness: 0.28, metalness: 1 });
    const warm = new THREE.MeshStandardMaterial({ color: '#ffe0b5', emissive: '#ffb35a', emissiveIntensity: 1.8, roughness: 0.6 });
    const lampGlow = new THREE.MeshStandardMaterial({ color: '#fff1d8', emissive: '#ffc77a', emissiveIntensity: 3.2 });
    const bark = new THREE.MeshStandardMaterial({ color: '#5b4838', roughness: 0.95 });
    const wood = new THREE.MeshStandardMaterial({ map: t.cedar, color: '#8f8173', roughness: 0.85 });
    const rope = new THREE.MeshStandardMaterial({ color: '#4a4036', roughness: 1 });

    const foliage = (map: THREE.Texture) => {
      const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.78, color: '#ffffff' });
      m.onBeforeCompile = s => {
        s.uniforms.uWind = wind;
        s.vertexShader = s.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uWind;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
              vec3 ip = instanceMatrix[3].xyz;
            #else
              vec3 ip = vec3(0.0);
            #endif
            float ph = dot(ip, vec3(0.37, 0.0, 0.61));
            float sway = max(0.0, position.y - 0.25);
            transformed.x += sin(uWind * 1.3 + ph + position.y * 3.0) * 0.022 * sway;
            transformed.z += cos(uWind * 1.1 + ph * 1.7 + position.x * 4.0) * 0.018 * sway;`);
      };
      m.customProgramCacheKey = () => 'foliage';
      return m;
    };
    const leaves = foliage(t.leaf);
    const needles = foliage(t.needle);
    return { rock, turf, concrete, concreteDark, cedar, plaster, glass, lantern, gravel, steel, brass, warm, lampGlow, bark, wood, rope, leaves, needles };
  }, [t]);
}
