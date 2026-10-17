import { useEffect, useRef } from 'react';
import { drone, useUI } from '../store';
import { cam } from '../world/CameraRig';
import { PLACED } from '../world/layout';

/**
 * While you fly: a strip across the top with every island at its bearing from the drone's nose, and the
 * name of the one straight ahead. It shows only in flight, and draws itself without re-rendering React.
 */
const SPAN = Math.PI * 0.75; // the strip shows 135° either side of the nose
const W = 560;
const PX = W / 2 / SPAN;      // pixels per radian
const TICK = PX * (Math.PI / 12); // a tick every 15°
const name = (i: number) => (PLACED[i].island.kind === 'about' ? 'Home' : PLACED[i].island.title);

export function Compass() {
  const root = useRef<HTMLDivElement>(null);
  const marks = useRef<(HTMLSpanElement | null)[]>([]);
  const ticks = useRef<HTMLDivElement>(null);
  const ahead = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let raf = 0, lastAhead = -2;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = root.current;
      if (!el) return;
      const ui = useUI.getState();
      const on = ui.started && !ui.overview && cam.mode === 'chase';
      el.classList.toggle('is-on', on);
      if (!on) return;
      // the ticks slide with the heading
      if (ticks.current) ticks.current.style.backgroundPositionX = `${((drone.yaw * PX) % TICK).toFixed(1)}px`;
      let best = -1, bestA = 0.32;
      PLACED.forEach((p, i) => {
        const m = marks.current[i];
        if (!m) return;
        let a = Math.atan2(p.pos.x - drone.pos.x, p.pos.z - drone.pos.z) - drone.yaw;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        // turning left (A) raises yaw, so islands to the left have a positive angle: put them on the left
        const x = (-a / SPAN) * (W / 2);
        const vis = Math.abs(a) < SPAN;
        m.style.transform = `translateX(${x.toFixed(1)}px)`;
        m.style.opacity = vis ? String(1 - Math.max(0, Math.abs(a) / SPAN - 0.7) / 0.3) : '0';
        const d = Math.hypot(p.pos.x - drone.pos.x, p.pos.z - drone.pos.z);
        if (Math.abs(a) < bestA && d > p.geo.radius) { bestA = Math.abs(a); best = i; }
        m.classList.toggle('is-ahead', false);
      });
      if (best >= 0) marks.current[best]?.classList.add('is-ahead');
      if (best !== lastAhead && ahead.current) {
        lastAhead = best;
        ahead.current.textContent = best >= 0 ? `Ahead · ${String(best + 1).padStart(2, '0')} ${name(best)}` : '';
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={root} className="compass" aria-hidden="true">
      <div className="c-strip" style={{ width: W }}>
        <div ref={ticks} className="c-ticks" style={{ backgroundSize: `${TICK}px 100%` }} />
        <span className="c-nose" />
        {PLACED.map((p, i) => (
          <span key={i} ref={el => { marks.current[i] = el; }} className="c-mark"><b>{String(i + 1).padStart(2, '0')}</b></span>
        ))}
      </div>
      <p ref={ahead} className="c-ahead" />
    </div>
  );
}
