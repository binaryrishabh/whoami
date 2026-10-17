import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Clouds, Cloud, Html, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, N8AO, ToneMapping, Bloom, Vignette, Noise, SMAA, BrightnessContrast } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import { MiniatureBlurEffect } from './world/MiniatureBlur';
import { World } from './world/World';
import { Drone, flyTo } from './world/Drone';
import { CameraRig, cam } from './world/CameraRig';
import { CloudSea } from './world/CloudSea';
import { Birds } from './world/Birds';
import { SUN_COLOUR, SUN_DIR } from './world/light';
import { PLACED, RING, onIsland } from './world/layout';
import { drone, useUI } from './store';
import { Overlay } from './ui/Overlay';
import { Loader } from './ui/Loader';
import { RoomScreen, useRoomy } from './ui/Screens';
import { sound } from './audio';
import { FALLS } from './world/Features';

const params = new URLSearchParams(location.search);
const SKY = (import.meta.env.DEV && params.get('sky')) || 'sky';
/** dev only: ?off=ao,dof,bloom,sea,puffs,shadows switches parts off to measure what they cost */
const TM = import.meta.env.DEV && params.get('tm') === 'agx' ? ToneMappingMode.AGX : ToneMappingMode.ACES_FILMIC;
const OFF = new Set(import.meta.env.DEV ? (params.get('off') || '').split(',') : []);

/** the low sun: its shadow box travels with the camera's subject so shadows stay sharp wherever you are */
function Sun() {
  const light = useRef<THREE.DirectionalLight>(null!);
  const gl = useThree(s => s.gl);
  const last = useRef(new THREE.Vector3(1e9, 0, 0));
  const frame = useRef(0);
  // the world barely moves, so the shadow map is redrawn only when the light's box moves (and now and then for the islets)
  useEffect(() => { gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true; if (import.meta.env.DEV) (window as any).__gl = gl; }, [gl]);
  useFrame(() => {
    const l = light.current;
    const c = cam.mode === 'chase' ? drone.pos : cam.focus;
    l.position.copy(c).addScaledVector(SUN_DIR, 60);
    l.target.position.copy(c);
    l.target.updateMatrixWorld();
    if (last.current.distanceToSquared(c) > 0.004 || ++frame.current % 24 === 0) { gl.shadowMap.needsUpdate = true; last.current.copy(c); }
  });
  return (
    <directionalLight ref={light} color={SUN_COLOUR} intensity={4.6} castShadow
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.035}
      shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={1} shadow-camera-far={140} />
  );
}

function Labels() {
  const active = useUI(s => s.active);
  const started = useUI(s => s.started);
  const overview = useUI(s => s.overview);
  const near = useNearest(4);
  const spots = useMemo(() => PLACED.map(p => onIsland(p, 0, 0, p.island.kind === 'about' ? 7.5 : 8)), []);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const v = useMemo(() => new THREE.Vector3(), []);
  // a name that would sit at the very edge of the screen, under a card or under the top-left buttons stays hidden
  useFrame(({ camera, size }) => {
    const ui = useUI.getState(), panel = ui.started && ui.active >= 0 && !ui.overview;
    spots.forEach((at, i) => {
      const el = refs.current[i];
      if (!el) return;
      v.copy(at).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width, y = (-v.y * 0.5 + 0.5) * size.height;
      const clear = v.z < 1 && x > 90 && x < size.width - 90 && y > 70 && y < size.height - 60
        && !(panel && x > size.width - 500) && !(x < 300 && y < 100) && !(ui.overview && x - el.offsetWidth / 2 < 360);
      el.dataset.clear = clear ? '1' : '0';
    });
  });
  return (
    <>
      {PLACED.map(p => {
        const show = overview || (started && near.includes(p.index) && active !== p.index);
        return (
          <Html key={p.index} position={spots[p.index]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none', opacity: show ? 1 : 0, transition: 'opacity .6s ease' }}>
            <button ref={el => { refs.current[p.index] = el; }} className="tag" tabIndex={show ? 0 : -1} style={{ pointerEvents: show ? 'auto' : 'none' }} onClick={() => { sound.tap(); useUI.getState().set({ started: true, overview: false }); flyTo(p.index); }}>
              <span className="tag-n">{String(p.index + 1).padStart(2, '0')}</span>{p.island.kind === 'about' ? 'Home' : p.island.title}
            </button>
          </Html>
        );
      })}
    </>
  );
}

/** the n islands closest to the drone, refreshed a few times a second */
function useNearest(n: number) {
  const [near, setNear] = useState<number[]>([0]);
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.4) return;
    last.current = clock.elapsedTime;
    const list = [...PLACED].sort((a, b) => a.pos.distanceTo(drone.pos) - b.pos.distanceTo(drone.pos)).slice(0, n).map(p => p.index).sort();
    setNear(prev => (prev.join() === list.join() ? prev : list));
  });
  return near;
}

/** cumulus towers rising out of the cloud sea between the islands, and thin wisps drifting at island height */
function Sky() {
  const puffs = useMemo(() => {
    const out: { p: [number, number, number]; b: [number, number, number]; s: number; v: number; o: number }[] = [];
    // between neighbouring islands, low, so they rise past the gaps rather than over the islands
    for (let i = 0; i < PLACED.length; i += 2) {
      const a = PLACED[i].pos, b = PLACED[(i + 1) % PLACED.length].pos;
      const mid = new THREE.Vector3().lerpVectors(a, b, 0.5), dir = new THREE.Vector3(mid.x - RING.x, 0, mid.z - RING.z).normalize();
      const side = i % 4 === 0 ? 1 : -1;
      out.push({ p: [mid.x + dir.x * 14 * side, -30, mid.z + dir.z * 14 * side], b: [14, 5, 14], s: 18, v: 14, o: 0.95 });
    }
    return out;
  }, []);
  return (
    <Clouds material={THREE.MeshLambertMaterial} limit={320}>
      {puffs.map((c, i) => <Cloud key={i} seed={i * 7 + 3} position={c.p} bounds={c.b} segments={c.s} volume={c.v} color="#f7efe4" opacity={c.o} growth={6} speed={0.04} />)}
      <Cloud seed={41} position={[-14, -6, 18]} bounds={[14, 1.5, 6]} segments={10} volume={6} color="#ffffff" opacity={0.42} growth={3} speed={0.06} />
      <Cloud seed={42} position={[30, -2, -70]} bounds={[18, 1.5, 6]} segments={10} volume={7} color="#ffffff" opacity={0.4} growth={3} speed={0.06} />
      <Cloud seed={43} position={[-48, 0, -40]} bounds={[14, 1.5, 6]} segments={10} volume={6} color="#ffffff" opacity={0.4} growth={3} speed={0.06} />
    </Clouds>
  );
}

function Post({ low }: { low: boolean }) {
  const blur = useMemo(() => new MiniatureBlurEffect(), []);
  useFrame(({ camera }) => {
    blur.focus = camera.position.distanceTo(cam.focus);
    blur.range = cam.range;
  });
  return (
    <EffectComposer multisampling={0}>
      {!OFF.has('ao') && !low && <N8AO aoRadius={1.4} intensity={2.4} distanceFalloff={0.8} halfRes quality="performance" />}
      {!OFF.has('dof') ? <primitive object={blur} /> : <></>}
      {!OFF.has('bloom') && <Bloom luminanceThreshold={1.05} intensity={0.4} mipmapBlur />}
      <ToneMapping mode={TM} />
      <BrightnessContrast contrast={0.06} />
      <Vignette darkness={0.32} offset={0.3} />
      <Noise opacity={0.025} blendFunction={BlendFunction.OVERLAY} />
      <SMAA />
    </EffectComposer>
  );
}

function Scene({ low }: { low: boolean }) {
  return (
    <>
      <color attach="background" args={['#c9cfd8']} />
      <fog attach="fog" args={['#d8d3cc', 130, 480]} />
      <Environment files={`/assets/${SKY}.hdr`} background backgroundBlurriness={0} environmentIntensity={0.6} backgroundIntensity={1} />
      <hemisphereLight args={['#dfe4f0', '#6d5d4b', 0.32]} />
      <Sun />
      <World off={OFF} />
      <Drone />
      {!OFF.has('birds') && <Birds />}
      {!OFF.has('sea') && <CloudSea />}
      {!OFF.has('puffs') && <Sky />}
      {!OFF.has('labels') && <Labels />}
      <CameraRig />
      <SoundDriver />
      <Post low={low} />
    </>
  );
}

function SoundDriver() {
  useFrame(({ camera }) => sound.update(camera, drone.pos, drone.vel.length(), FALLS));
  return null;
}

export default function App() {
  // start with everything; if the frame rate can't keep up, drop ambient occlusion, then the pixel ratio
  const [dpr, setDpr] = useState(() => Math.min(1.5, window.devicePixelRatio || 1));
  const [low, setLow] = useState(false);
  // too small a window: the world pauses (and keeps loading) behind a screen that asks for more room
  const { roomy, size } = useRoomy();
  return (
    <>
      <Canvas className="stage" frameloop={roomy ? 'always' : 'never'} shadows={!OFF.has('shadows')} dpr={dpr} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ fov: 40, near: 0.3, far: 1200, position: [0, 16, 46] }}>
        <PerformanceMonitor flipflops={3} bounds={r => [Math.min(55, r * 0.9), r + 1]} onDecline={() => { if (!low) setLow(true); else if (dpr > 1) setDpr(1); }} onFallback={() => { setDpr(1); setLow(true); }} />
        <Suspense fallback={null}>
          <Scene low={low} />
        </Suspense>
      </Canvas>
      <Loader />
      <Overlay />
      {!roomy && <RoomScreen size={size} />}
      <Analytics />
    </>
  );
}
