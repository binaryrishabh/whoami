import * as THREE from 'three';

/**
 * Sound, all of it real recordings (Freesound, CC0; see public/audio/credits.json):
 *  - meadow wind, always there, quietly
 *  - the drone's rotors (a DJI Mavic Mini recorded hovering), louder and higher as it speeds up
 *  - waterfalls, louder as you near one and placed left or right of you
 *  - a soft tap for the interface
 * Nothing plays until the visitor has touched the page, and the choice to mute is remembered.
 */
type Loop = { src: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode };

const FILES = { wind: '/audio/meadow-wind.mp3', drone: '/audio/drone.mp3', water: '/audio/waterfall.mp3', tap: '/audio/tap.mp3' };
const KEY = 'sky.sound';

function readPref() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
function writePref(on: boolean) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode: fine */ } }

class Sound {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  buffers: Partial<Record<keyof typeof FILES, AudioBuffer>> = {};
  loops: Partial<Record<'wind' | 'drone' | 'water', Loop>> = {};
  enabled = readPref();
  private starting: Promise<void> | null = null;

  /** call from a user gesture */
  start() {
    if (this.ctx) { if (this.enabled) void this.ctx.resume(); return this.starting ?? Promise.resolve(); }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return Promise.resolve();
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.starting = (async () => {
      await Promise.all((Object.keys(FILES) as (keyof typeof FILES)[]).map(async k => {
        try { this.buffers[k] = await ctx.decodeAudioData(await (await fetch(FILES[k])).arrayBuffer()); } catch { /* a missing sound is not worth breaking the page for */ }
      }));
      for (const k of ['wind', 'drone', 'water'] as const) {
        const b = this.buffers[k];
        if (!b) continue;
        const src = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
        src.buffer = b; src.loop = true;
        // skip the encoder's silent padding at either end so the loop has no gap
        src.loopStart = Math.min(0.08, b.duration / 4); src.loopEnd = b.duration - Math.min(0.08, b.duration / 4);
        gain.gain.value = 0;
        src.connect(gain).connect(pan).connect(this.master!);
        src.start(0, src.loopStart);
        this.loops[k] = { src, gain, pan };
      }
      this.setEnabled(this.enabled);
    })();
    return this.starting;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    writePref(on);
    if (!this.ctx || !this.master) return;
    if (on) void this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.35);
  }

  tap(level = 0.5) {
    const b = this.buffers.tap;
    if (!this.ctx || !b || !this.enabled) return;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = b; src.playbackRate.value = 0.9 + Math.random() * 0.2;
    g.gain.value = level;
    src.connect(g).connect(this.master!);
    src.start();
  }

  private v = new THREE.Vector3();
  private right = new THREE.Vector3();
  /** once a frame: where the listener is, where the drone is and how fast it goes, where the falls are */
  update(camera: THREE.Camera, dronePos: THREE.Vector3, droneSpeed: number, falls: { top: THREE.Vector3; bottom: THREE.Vector3 }[]) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const { wind, drone, water } = this.loops;
    if (wind) wind.gain.gain.setTargetAtTime(0.42, t, 0.5);
    if (drone) {
      const d = camera.position.distanceTo(dronePos);
      const near = THREE.MathUtils.clamp(14 / Math.max(d, 1), 0.15, 1.2);
      drone.gain.gain.setTargetAtTime((1.4 + droneSpeed * 0.18) * near, t, 0.15);
      drone.src.playbackRate.setTargetAtTime(0.9 + Math.min(droneSpeed, 16) * 0.022, t, 0.2);
    }
    if (water) {
      // the nearest point on any fall, and which side of us it is
      let best = Infinity;
      const near = this.v;
      for (const f of falls) {
        const y = THREE.MathUtils.clamp(camera.position.y, f.bottom.y, f.top.y);
        const k = (f.top.y - y) / Math.max(1e-3, f.top.y - f.bottom.y);
        const px = f.top.x + (f.bottom.x - f.top.x) * k, pz = f.top.z + (f.bottom.z - f.top.z) * k;
        const d = Math.hypot(camera.position.x - px, camera.position.y - y, camera.position.z - pz);
        if (d < best) { best = d; near.set(px, y, pz); }
      }
      const g = THREE.MathUtils.clamp(1 - best / 46, 0, 1);
      water.gain.gain.setTargetAtTime(g * g * 0.55, t, 0.3);
      this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const dir = near.sub(camera.position).normalize();
      water.pan.pan.setTargetAtTime(THREE.MathUtils.clamp(dir.dot(this.right) * 0.8, -0.8, 0.8), t, 0.3);
    }
  }
}

export const sound = new Sound();
