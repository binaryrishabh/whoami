import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { drone, useUI } from '../store';
import { dockView, groundAt, PLACED, RING } from './layout';

/**
 * The camera has three jobs.
 *  intro  before take-off: a slow look at the first island, the name on it, the world behind.
 *  chase  while you fly: behind and above the drone.
 *  dock   when you arrive somewhere (or stop over an island): it frames the whole island from outside
 *         the ring, and slides the picture aside so the island sits beside its card, not under it.
 * Dragging orbits around whatever it is looking at; the wheel zooms.
 */
export const cam = {
  mode: 'intro' as 'intro' | 'chase' | 'dock' | 'overview',
  focus: new THREE.Vector3(),
  range: 10,
};
/** the opening shot: where it starts, the bend it passes through, and how long it takes (s) */
const OPENING = 7;
const OPEN_FROM = { pos: new THREE.Vector3(-70, 46, 150), look: new THREE.Vector3(-10, 4, -30) };
const OPEN_VIA = new THREE.Vector3(-46, 22, 70);
export const openingSeconds = OPENING;

export const orbit = { yaw: 0, pitch: 0, zoom: 1, drag: false, x: 0, y: 0 };
export function resetOrbit() { orbit.yaw = 0; orbit.pitch = 0; orbit.zoom = 1; }

/** dev only: pin the camera for art direction, e.g. __view([10, 8, 30], [0, 2, 0]) */
let pinned: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
if (import.meta.env.DEV) (window as any).__view = (p?: number[], l?: number[]) => { pinned = p && l ? { pos: new THREE.Vector3(...p), look: new THREE.Vector3(...l) } : null; };

export function CameraRig() {
  const { camera, size } = useThree();
  const pos = useRef(new THREE.Vector3(0, 16, 46));
  const look = useRef(new THREE.Vector3(0, 2, 0));
  const shift = useRef({ x: 0, y: 0 });
  const idle = useRef(0);
  const arrival = useRef(-1); // when the world finished loading: the opening sweep starts then
  if (import.meta.env.DEV) (window as any).__opening = () => { useUI.getState().set({ started: false }); arrival.current = -2; };
  const tmp = useRef({ want: new THREE.Vector3(), wantLook: new THREE.Vector3() });

  useEffect(() => {
    const isUI = (e: Event) => !!(e.target as HTMLElement)?.closest?.('button, a, .panel, .intro, .joy');
    const pd = (e: PointerEvent) => { if (e.button !== 0 || isUI(e)) return; orbit.drag = true; orbit.x = e.clientX; orbit.y = e.clientY; };
    const pm = (e: PointerEvent) => {
      if (!orbit.drag) return;
      if (!(e.buttons & 1)) { orbit.drag = false; return; }
      orbit.yaw -= (e.clientX - orbit.x) * 0.005;
      orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + (e.clientY - orbit.y) * 0.004, -0.4, 0.75);
      orbit.x = e.clientX; orbit.y = e.clientY;
    };
    const pu = () => { orbit.drag = false; };
    const wheel = (e: WheelEvent) => { if (isUI(e)) return; orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.45, 1.8); };
    addEventListener('pointerdown', pd); addEventListener('pointermove', pm); addEventListener('pointerup', pu);
    addEventListener('wheel', wheel, { passive: true });
    return () => { removeEventListener('pointerdown', pd); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu); removeEventListener('wheel', wheel); };
  }, []);

  useFrame((state, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const t = state.clock.elapsedTime;
    const ui = useUI.getState();
    const { want, wantLook } = tmp.current;
    if (drone.input || orbit.drag) idle.current = 0; else idle.current += dt;

    let rate = 2.4;
    const fit = THREE.MathUtils.clamp(1.25 / (size.width / size.height), 1, 2.1); // portrait phones need more distance to fit an island across
    if (!ui.started) {
      cam.mode = 'intro';
      const hero = PLACED[0];
      const v = dockView(hero, Math.sin(t * 0.07) * 0.32 - 0.38 + orbit.yaw, -0.06 + orbit.pitch, 1.18 * orbit.zoom * fit);
      want.copy(v.pos); wantLook.copy(v.look).add(new THREE.Vector3(0, 0.6, -1.2));
      cam.focus.copy(v.look); cam.range = hero.geo.radius * 1.3;
      rate = 1.6;
      // the opening: from high over the cloud sea, a long descending curve down to the first island
      if (!ui.loaded) arrival.current = -1;
      else if (arrival.current === -2) { arrival.current = t; pos.current.copy(OPEN_FROM.pos); look.current.copy(OPEN_FROM.look); }
      else if (arrival.current < 0) arrival.current = t;
      const k = arrival.current < 0 ? 0 : Math.min(1, (t - arrival.current) / OPENING);
      if (k < 1) {
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const a = OPEN_FROM.pos, c = OPEN_VIA, b = want, u = 1 - e;
        want.set(u * u * a.x + 2 * u * e * c.x + e * e * b.x, u * u * a.y + 2 * u * e * c.y + e * e * b.y, u * u * a.z + 2 * u * e * c.z + e * e * b.z);
        wantLook.lerpVectors(OPEN_FROM.look, wantLook, Math.min(1, e * 1.15));
        cam.focus.copy(wantLook); cam.range = 30 + 60 * (1 - e);
        rate = 60;
      }
    } else if (ui.overview) {
      // the whole ring from high over the cloud sea
      cam.mode = 'overview';
      const yaw = -0.32 + orbit.yaw, el = THREE.MathUtils.clamp(0.52 + orbit.pitch, 0.2, 1.3), dist = RING.r * 2.9 * orbit.zoom * fit;
      wantLook.set(RING.x, -3, RING.z + 4);
      want.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(dist).add(wantLook);
      cam.focus.copy(wantLook); cam.range = RING.r * 2.2;
      rate = 1.4;
    } else if (ui.active >= 0 && !drone.input && (drone.target ? drone.pos.distanceTo(drone.target) < 8 : idle.current > 1.2)) {
      cam.mode = 'dock';
      const p = PLACED[ui.active];
      const v = dockView(p, orbit.yaw, orbit.pitch, orbit.zoom * fit);
      want.copy(v.pos); wantLook.copy(v.look);
      cam.focus.copy(v.look); cam.range = p.geo.radius * 1.25;
      rate = 1.5;
    } else {
      cam.mode = 'chase';
      const yaw = drone.yaw + Math.PI + orbit.yaw;
      const el = 0.3 + orbit.pitch;
      const dist = 8 * orbit.zoom * Math.sqrt(fit);
      want.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(dist).add(drone.pos);
      wantLook.set(Math.sin(drone.yaw) * 3.5, -0.4, Math.cos(drone.yaw) * 3.5).add(drone.pos);
      cam.focus.copy(drone.pos); cam.range = 9;
      rate = 3;
    }
    if (pinned) { want.copy(pinned.pos); wantLook.copy(pinned.look); cam.focus.copy(pinned.look); rate = 50; }

    const g = groundAt(want.x, want.z);
    if (Number.isFinite(g.y)) want.y = Math.max(want.y, g.y + 1);
    const k = 1 - Math.exp(-dt * rate);
    pos.current.lerp(want, k);
    look.current.lerp(wantLook, 1 - Math.exp(-dt * rate * 1.6));
    camera.position.copy(pos.current);
    camera.lookAt(look.current);

    // keep the subject clear of the cards: the island slides left of the panel on desktop, up above the sheet on phones
    const desktop = size.width >= 900;
    const panel = ui.started && ui.active >= 0 && !ui.overview;
    const wx = !ui.started ? (desktop ? -Math.min(size.width * 0.13, 240) : 0) : panel && desktop ? Math.min(size.width * 0.16, 280) : 0;
    const wy = desktop ? 0 : (!ui.started || panel) ? size.height * 0.2 : 0;
    const s = shift.current, ks = 1 - Math.exp(-dt * 2.5);
    s.x += (wx - s.x) * ks; s.y += (wy - s.y) * ks;
    const pc = camera as THREE.PerspectiveCamera;
    pc.setViewOffset(size.width, size.height, s.x, s.y, size.width, size.height);
  });
  return null;
}
