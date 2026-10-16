import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { drone, useUI } from '../store';
import { groundAt, islandAt, onIsland, PLACED } from './layout';
import { resetOrbit } from './CameraRig';
import { parking } from './plan';

/**
 * A small camera drone. W/S or ↑/↓ fly forward and back, A/D or ←/→ turn, Space/E rise, Shift/Q sink.
 * Clicking an island's name flies there on autopilot; touching the keys takes over again.
 */
const keys = new Set<string>();
export const joystick = { x: 0, y: 0, up: 0 };

export function flyTo(index: number) {
  const p = PLACED[index];
  if (!p) return;
  useUI.getState().set({ overview: false });
  const pk = parking(p);
  drone.target = onIsland(p, pk.x, pk.y, 2.4);
  resetOrbit();
}

if (import.meta.env.DEV) (window as any).__fly = (i: number) => { useUI.getState().set({ started: true }); flyTo(i); };
if (import.meta.env.DEV) (window as any).__jump = (i: number) => { useUI.getState().set({ started: true }); flyTo(i); drone.pos.copy(drone.target!); drone.vel.set(0, 0, 0); };

export function Drone() {
  const group = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const rotors = useRef<THREE.Group[]>([]);
  const shadow = useRef<THREE.Mesh>(null!);
  const set = useUI(s => s.set);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'e', 'q', 'shift'].includes(k)) {
        keys.add(k); drone.target = null; if (k.startsWith('arrow') || k === ' ') e.preventDefault();
        useUI.getState().set({ started: true });
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  }, []);

  const bladeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1a1b1d', transparent: true, opacity: 0.16, depthWrite: false }), []);
  const blobTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);

  const tmp = useMemo(() => ({ head: new THREE.Vector3(), acc: new THREE.Vector3(), want: new THREE.Vector3(), local: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const lastActive = useRef(-2);
  const roll = useRef(0), pitch = useRef(0), turnV = useRef(0);

  useFrame((state, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const t = state.clock.elapsedTime;
    const k = (n: string) => (keys.has(n) ? 1 : 0);
    const fwd = k('w') + k('arrowup') - k('s') - k('arrowdown') + joystick.y;
    const turn = k('a') + k('arrowleft') - k('d') - k('arrowright') - joystick.x;
    const lift = k(' ') + k('e') - k('shift') - k('q') + joystick.up;
    const { head, acc, want } = tmp;
    drone.input = !!(fwd || turn || lift);

    if (drone.target && drone.input) drone.target = null;
    acc.set(0, 0, 0);
    if (drone.target) {
      want.subVectors(drone.target, drone.pos);
      const d = want.length();
      want.normalize().multiplyScalar(Math.min(15, d * 1.1));
      acc.copy(want).sub(drone.vel).multiplyScalar(2.6);
      if (Math.hypot(drone.target.x - drone.pos.x, drone.target.z - drone.pos.z) > 1.5) {
        let dy = Math.atan2(drone.target.x - drone.pos.x, drone.target.z - drone.pos.z) - drone.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        turnV.current += (THREE.MathUtils.clamp(dy * 2.4, -2.2, 2.2) - turnV.current) * Math.min(1, dt * 4);
      } else turnV.current *= 0.9;
      if (d < 0.5 && drone.vel.length() < 0.5) drone.target = null;
    } else {
      turnV.current += (turn * 1.9 - turnV.current) * Math.min(1, dt * 5);
      head.set(Math.sin(drone.yaw), 0, Math.cos(drone.yaw));
      acc.addScaledVector(head, fwd * 20);
      acc.y += lift * 14;
    }
    drone.yaw += turnV.current * dt;
    drone.vel.addScaledVector(acc, dt);
    drone.vel.multiplyScalar(Math.exp(-(drone.target ? 1.2 : 1.7) * dt));
    if (drone.vel.length() > 16) drone.vel.setLength(16);
    drone.pos.addScaledVector(drone.vel, dt);

    // never below the meadow, never too far up or down
    const g = groundAt(drone.pos.x, drone.pos.z);
    const floor = Number.isFinite(g.y) ? g.y + 1.1 : -20;
    if (drone.pos.y < floor) { drone.pos.y += (floor - drone.pos.y) * Math.min(1, dt * 10); if (drone.vel.y < 0) drone.vel.y *= 0.3; }
    drone.pos.y = Math.min(drone.pos.y, 36);

    // body: hover bob, bank into turns, pitch into speed
    const local = tmp.local.copy(drone.vel).applyAxisAngle(tmp.up, -drone.yaw);
    roll.current += ((-turnV.current * 0.22 - local.x * 0.02) - roll.current) * Math.min(1, dt * 4);
    pitch.current += ((local.z * 0.035) - pitch.current) * Math.min(1, dt * 4);
    group.current.position.copy(drone.pos);
    group.current.position.y += Math.sin(t * 2.1) * 0.05;
    group.current.rotation.set(0, drone.yaw, 0);
    body.current.rotation.set(pitch.current, 0, roll.current);
    rotors.current.forEach((r, i) => { if (r) r.rotation.y += dt * (i % 2 ? 38 : -38); });

    // a soft shadow on whatever is below
    if (Number.isFinite(g.y)) {
      const hgt = drone.pos.y - g.y;
      shadow.current.visible = true;
      shadow.current.position.set(drone.pos.x, g.y + 0.04, drone.pos.z);
      const s = 0.9 + hgt * 0.12; shadow.current.scale.set(s, s, s);
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(1.2 - hgt * 0.12, 0, 1);
    } else shadow.current.visible = false;

    // which island are we over?
    const isl = islandAt(drone.pos);
    const idx = isl ? isl.index : -1;
    if (idx !== lastActive.current) { lastActive.current = idx; set({ active: idx }); }
  });

  const arms: [number, number][] = [[0.36, 0.3], [-0.36, 0.3], [0.36, -0.3], [-0.36, -0.3]];
  return (
    <>
      <group ref={group}>
        <group ref={body} scale={1.15}>
          <RoundedBox args={[0.34, 0.12, 0.5]} radius={0.05} smoothness={4} >
            <meshStandardMaterial color="#2b2d30" roughness={0.38} metalness={0.25} />
          </RoundedBox>
          <mesh position={[0, 0.07, 0.04]} ><sphereGeometry args={[0.13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#141517" roughness={0.12} metalness={0.4} /></mesh>
          <mesh position={[0, -0.06, 0.24]}><sphereGeometry args={[0.045, 16, 12]} /><meshStandardMaterial color="#0d0e10" roughness={0.05} metalness={0.6} /></mesh>
          {arms.map(([x, z], i) => (
            <group key={i}>
              <mesh position={[x / 2, 0, z / 2]} rotation={[0, Math.atan2(x, z), 0]} ><boxGeometry args={[0.035, 0.03, Math.hypot(x, z)]} /><meshStandardMaterial color="#232528" roughness={0.5} /></mesh>
              <mesh position={[x, 0.02, z]} ><cylinderGeometry args={[0.04, 0.045, 0.07, 16]} /><meshStandardMaterial color="#1c1d20" roughness={0.4} metalness={0.4} /></mesh>
              <group ref={el => { if (el) rotors.current[i] = el; }} position={[x, 0.066, z]}>
                <mesh><boxGeometry args={[0.4, 0.004, 0.03]} /><meshStandardMaterial color="#141517" roughness={0.4} /></mesh>
              </group>
              <mesh position={[x, 0.066, z]} material={bladeMat}><cylinderGeometry args={[0.2, 0.2, 0.002, 32]} /></mesh>
            </group>
          ))}
          <mesh position={[0.1, -0.02, 0.25]}><sphereGeometry args={[0.018, 8, 8]} /><meshStandardMaterial color="#fff2dc" emissive="#ffe2b8" emissiveIntensity={6} /></mesh>
          <mesh position={[-0.1, -0.02, 0.25]}><sphereGeometry args={[0.018, 8, 8]} /><meshStandardMaterial color="#fff2dc" emissive="#ffe2b8" emissiveIntensity={6} /></mesh>
          <mesh position={[0, 0, -0.25]}><sphereGeometry args={[0.016, 8, 8]} /><meshStandardMaterial color="#ff5a3c" emissive="#ff3b1f" emissiveIntensity={5} /></mesh>
        </group>
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshBasicMaterial map={blobTex} transparent depthWrite={false} />
      </mesh>
    </>
  );
}
