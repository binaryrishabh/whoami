import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** the toys are pre-rendered from signed distance fields (see README); all live in public/toys */
export const toySrc = (name: string) => `/toys/${name}.webp`;

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A toy floating on the page. It bobs, drifts a little with the mouse (by `depth`), can be picked up and
 * thrown (it springs home), and when clicked it squashes and says one of its lines.
 */
export function FloatToy({ name, size, style, depth = 1, delay = 0, tilt = 0, says = [], alt = '', far = false }: {
  name: string; size: number; style: CSSProperties; depth?: number; delay?: number; tilt?: number; says?: string[]; alt?: string;
  /** further from the camera: smaller in parallax, slightly out of focus */
  far?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [squash, setSquash] = useState(0);
  const said = useRef(0);

  useEffect(() => {
    const el = wrap.current!;
    let x = 0, y = 0, vx = 0, vy = 0, raf = 0, dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = 0, lastX = 0, lastT = 0;
    const apply = () => { el.style.setProperty('--dx', `${x.toFixed(1)}px`); el.style.setProperty('--dy', `${y.toFixed(1)}px`); el.style.setProperty('--dr', `${(vx * 0.02).toFixed(2)}deg`); };
    const spring = () => {
      // home again, with a little overshoot
      const k = 170, c = 13, dt = 1 / 60;
      vx += (-k * x - c * vx) * dt; vy += (-k * y - c * vy) * dt; x += vx * dt; y += vy * dt;
      apply();
      if (Math.abs(x) + Math.abs(y) + Math.abs(vx) + Math.abs(vy) > 0.3) raf = requestAnimationFrame(spring);
      else { x = y = vx = vy = 0; apply(); el.classList.remove('is-held'); }
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      cancelAnimationFrame(raf); dragging = true; moved = 0;
      sx = e.clientX; sy = e.clientY; ox = x; oy = y; lastX = e.clientX; lastT = performance.now();
      el.setPointerCapture(e.pointerId); el.classList.add('is-held');
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      x = ox + e.clientX - sx; y = oy + e.clientY - sy; moved = Math.max(moved, Math.hypot(e.clientX - sx, e.clientY - sy));
      const now = performance.now(); vx = ((e.clientX - lastX) / Math.max(1, now - lastT)) * 1000; vy = 0; lastX = e.clientX; lastT = now;
      apply();
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      if (moved < 5) { el.classList.remove('is-held'); x = ox; y = oy; poke(); return; }
      vx *= 0.35; raf = requestAnimationFrame(spring);
    };
    const poke = () => {
      setSquash(s => s + 1);
      if (says.length) { setBubble({ text: says[said.current % says.length], key: Date.now() }); said.current++; }
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } };
    el.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('keydown', key); };
  }, [says]);

  useEffect(() => { if (!bubble) return; const t = setTimeout(() => setBubble(null), 1900); return () => clearTimeout(t); }, [bubble]);

  return (
    <div
      ref={wrap} className="ftoy" role="button" tabIndex={0} aria-label={alt || name}
      data-name={name} data-far={far || undefined}
      style={{ ...style, '--w': `${size}px`, '--depth': depth, '--delay': `${delay}s`, '--tilt': `${tilt}deg` } as CSSProperties}
    >
      <div className="ftoy-par">
        <div className="ftoy-bob" style={reduced() ? { animation: 'none' } : undefined}>
          <img key={squash} className={squash ? 'is-squash' : ''} src={toySrc(name)} alt="" draggable={false} />
        </div>
        <span className="ftoy-shadow" aria-hidden="true" />
      </div>
      {bubble && <span className="ftoy-say" key={bubble.key}>{bubble.text}</span>}
    </div>
  );
}
