import { useEffect, useRef, useState } from 'react';
import { toySrc } from './Toy';

/** runs `step` every `ms` while the element is on screen; returns a counter that changes each loop */
function useLoop(ref: React.RefObject<Element | null>, ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let id = 0, on = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) { on = true; setN(x => x + 1); id = window.setInterval(() => setN(x => x + 1), ms); }
      if (!e.isIntersecting && on) { on = false; clearInterval(id); }
    }, { threshold: 0.25 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); clearInterval(id); };
  }, [ref, ms]);
  return n;
}

/* ── the door detector: a plan draws itself, a scan passes, each door swing is found ── */
const WALLS: [number, number, number, number][] = [
  [30, 30, 440, 30], [480, 30, 530, 30], [530, 30, 530, 350], [530, 350, 130, 350], [90, 350, 30, 350], [30, 350, 30, 30],
  [230, 30, 230, 150], [230, 190, 230, 350], [230, 200, 330, 200], [370, 200, 530, 200], [420, 200, 420, 260], [420, 300, 420, 350],
  [30, 230, 140, 230], [180, 230, 230, 230],
];
// hinge, closed angle, open angle (degrees, y down)
const DOORS: [number, number, number, number][] = [[230, 150, 90, 0], [330, 200, 0, 90], [420, 260, 90, 180], [90, 350, 0, -90], [440, 30, 0, 90], [140, 230, 0, -90]];
const R = 40, rad = (d: number) => (d * Math.PI) / 180;
const STEPS = ['chain segments', 'fit circle', 'check 90° span', 'validate leaf', 'count once'];

export function Blueprint() {
  const ref = useRef<SVGSVGElement>(null);
  const run = useLoop(ref, 9000);
  const [found, setFound] = useState(0);
  const [step, setStep] = useState(-1);
  const order = DOORS.map((d, i) => ({ i, x: d[0] })).sort((a, b) => a.x - b.x).map(o => o.i);
  useEffect(() => {
    if (!run) return;
    setFound(0); setStep(-1);
    const ts = order.map((_, k) => window.setTimeout(() => setFound(k + 1), 1500 + (DOORS[order[k]][0] / 560) * 3400));
    const ss = STEPS.map((_, k) => window.setTimeout(() => setStep(k), 900 + k * 900));
    return () => [...ts, ...ss].forEach(clearTimeout);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="vis vis-plan">
      <svg ref={ref} key={run} viewBox="0 0 560 380" className="plan" role="img" aria-label="A floor plan being scanned, with each door swing detected">
        <defs><pattern id="pg" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" className="plan-grid" /></pattern></defs>
        <rect width="560" height="380" fill="url(#pg)" />
        {WALLS.map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} className="plan-wall" style={{ animationDelay: `${i * 0.04}s` }} />)}
        <text x="130" y="135" className="plan-room">OFFICE</text><text x="105" y="295" className="plan-room">LOBBY</text>
        <text x="380" y="120" className="plan-room">STUDIO</text><text x="300" y="285" className="plan-room">STORE</text><text x="475" y="285" className="plan-room">WC</text>
        {DOORS.map(([hx, hy, a0, a1], i) => {
          const cx = hx + R * Math.cos(rad(a0)), cy = hy + R * Math.sin(rad(a0)), ox = hx + R * Math.cos(rad(a1)), oy = hy + R * Math.sin(rad(a1));
          const sweep = a1 > a0 ? 1 : 0, k = order.indexOf(i), hit = k < found;
          const x0 = Math.min(hx, cx, ox) - 7, y0 = Math.min(hy, cy, oy) - 7, w = Math.max(hx, cx, ox) - x0 + 7, h = Math.max(hy, cy, oy) - y0 + 7;
          return (
            <g key={i} className={`plan-door${hit ? ' is-hit' : ''}`}>
              <path d={`M${cx},${cy} A${R},${R} 0 0 ${sweep} ${ox},${oy}`} className="plan-arc" />
              <line x1={hx} y1={hy} x2={ox} y2={oy} className="plan-leaf" />
              <rect x={x0} y={y0} width={w} height={h} rx="6" className="plan-box" />
              <g className="plan-tag" transform={`translate(${x0},${y0 - 6})`}>
                <rect width="78" height="17" rx="4" y="-12" />
                <text x="6" y="0">D-{String(k + 1).padStart(2, '0')} · 0.{97 - (i % 3)}</text>
              </g>
            </g>
          );
        })}
        <line x1="0" y1="10" x2="0" y2="370" className="plan-scan" />
        <g className="plan-dim"><line x1="30" y1="368" x2="530" y2="368" /><text x="280" y="364">24.8 m</text></g>
      </svg>
      <div className="vis-strip">
        <span className="vis-count"><b>{found}</b> / {DOORS.length} doors</span>
        <ol className="plan-steps">{STEPS.map((s, k) => <li key={s} className={k <= step ? 'is-on' : ''}>{s}</li>)}</ol>
      </div>
    </div>
  );
}

/* ── InfraForge: a canvas of infrastructure; a cache is dropped in and the simulation answers ── */
type N = { id: string; toy: string; x: number; y: number; s: number; label: string };
const BASE: N[] = [
  { id: 'lb', toy: 'router', x: 86, y: 196, s: 74, label: 'alb' },
  { id: 'a', toy: 'server', x: 250, y: 112, s: 64, label: 'api-a' },
  { id: 'b', toy: 'server', x: 250, y: 280, s: 64, label: 'api-b' },
  { id: 'db', toy: 'database', x: 430, y: 280, s: 66, label: 'rds' },
];
const CACHE: N = { id: 'c', toy: 'cache', x: 430, y: 104, s: 56, label: 'redis' };
const wire = (a: N, b: N) => { const x0 = a.x + a.s * 0.45, x1 = b.x - b.s * 0.45, m = (x0 + x1) / 2; return `M${x0},${a.y} H${m - 10} Q${m},${a.y} ${m},${a.y + Math.sign(b.y - a.y) * 10} V${b.y - Math.sign(b.y - a.y) * 10} Q${m},${b.y} ${m + 10},${b.y} H${x1}`; };
const straight = (a: N, b: N) => `M${a.x + a.s * 0.45},${a.y} H${b.x - b.s * 0.45}`;

export function InfraCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const run = useLoop(ref, 9500);
  const [phase, setPhase] = useState(0); // 0 base, 1 cursor moving, 2 cache placed
  useEffect(() => {
    if (!run) return;
    setPhase(0);
    const a = window.setTimeout(() => setPhase(1), 1400), b = window.setTimeout(() => setPhase(2), 3300);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [run]);
  const [lb, a, b, db] = BASE;
  const wires = [wire(lb, a), wire(lb, b), wire(a, db), straight(b, db), ...(phase === 2 ? [straight(a, CACHE)] : [])];
  const rows = phase === 2 ? [['cost / month', '$214'], ['p99 latency', '31 ms'], ['db load', '38%']] : [['cost / month', '$186'], ['p99 latency', '84 ms'], ['db load', '81%']];
  return (
    <div className="vis vis-canvas" ref={ref}>
      <svg viewBox="0 0 560 380" className="ifc" role="img" aria-label="An infrastructure diagram: adding a cache lowers latency and database load">
        <defs><pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.3" className="ifc-dot" /></pattern></defs>
        <rect width="560" height="380" fill="url(#dots)" />
        {wires.map((d, i) => (
          <g key={`${run}-${i}`}>
            <path d={d} className={`ifc-wire${i === 4 ? ' is-new' : ''}`} />
            <circle r="4" className="ifc-pkt"><animateMotion dur={`${1.9 + (i % 3) * 0.35}s`} begin={`${i * 0.37}s`} repeatCount="indefinite" path={d} /></circle>
          </g>
        ))}
        {[...BASE, ...(phase === 2 ? [CACHE] : [])].map(n => (
          <g key={n.id} className={`ifc-node${n.id === 'c' ? ' is-new' : ''}`} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
            <image href={toySrc(n.toy)} x={n.x - n.s / 2} y={n.y - n.s / 2} width={n.s} height={n.s} />
            <text x={n.x} y={n.y + n.s / 2 + 14} className="ifc-label">{n.label}</text>
          </g>
        ))}
        {phase === 1 && <g className="ifc-ghost"><image href={toySrc('cache')} x={CACHE.x - 26} y={CACHE.y - 26} width="52" height="52" /></g>}
        <path className={`ifc-cursor${phase >= 1 ? ' is-go' : ''}`} key={`c${run}`} d="M0,0 L0,18 L5,13.5 L8.5,21 L11.5,19.6 L8.2,12.4 L14.4,12.4 Z" />
      </svg>
      <div className="ifc-panel">
        <p className="ifc-k">simulation · 1 Hz</p>
        {rows.map(([k, v]) => <p key={k} className="ifc-row"><span>{k}</span><b key={v}>{v}</b></p>)}
        <p className={`ifc-status${phase === 2 ? ' is-good' : ''}`}>{phase === 2 ? '5 nodes · within budget' : '4 nodes · db is the bottleneck'}</p>
      </div>
    </div>
  );
}

/* ── Allrecipes Tweaks: a recipe, and what the reviewers changed, as a word-level diff ── */
type Tok = [string, 0 | -1 | 1]; // same, deleted, inserted
const LINES: Tok[][] = [
  [['2 cups plain flour', 0]],
  [['1 cup ', 0], ['white', -1], ['brown', 1], [' sugar', 0]],
  [['2', -1], ['3', 1], [' ripe bananas, mashed', 0]],
  [['½ tsp cinnamon', 1]],
  [['Bake for ', 0], ['60', -1], ['55', 1], [' minutes at 175 °C', 0]],
];
export function RecipeDiff() {
  const ref = useRef<HTMLDivElement>(null);
  const run = useLoop(ref, 3400);
  const [manual, setManual] = useState<boolean | null>(null);
  const tweaked = manual ?? run % 2 === 0;
  return (
    <div className="vis vis-diff" ref={ref}>
      <div className="rd-card">
        <div className="rd-head">
          <div><p className="rd-k">recipe</p><h4>Banana bread</h4></div>
          <div className="rd-toggle" role="group" aria-label="Show the recipe">
            <button className={!tweaked ? 'is-on' : ''} onClick={() => setManual(false)}>Original</button>
            <button className={tweaked ? 'is-on' : ''} onClick={() => setManual(true)}>Tweaked</button>
          </div>
        </div>
        <p className="rd-meta"><span>50 reviews read</span><span>4 changes found</span><span>cached</span></p>
        <ul className="rd-lines">
          {LINES.map((line, i) => {
            const onlyNew = line.every(t => t[1] === 1);
            return (
              <li key={i} className={onlyNew && !tweaked ? 'is-gone' : onlyNew ? 'is-added' : ''}>
                {line.map(([text, k], j) => k === 0 ? <span key={j}>{text}</span>
                  : k === -1 ? (tweaked ? <del key={j}>{text}</del> : <span key={j}>{text}</span>)
                  : tweaked ? <ins key={j}>{text}</ins> : null)}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="rd-quotes" aria-hidden="true">
        <p className="rd-q q1">“Brown sugar makes it so much better.”</p>
        <p className="rd-q q2">“Needed a third banana, and a pinch of cinnamon.”</p>
      </div>
    </div>
  );
}

/* ── anything else: a few toys ── */
export function ToyGroup({ toys }: { toys: string[] }) {
  const t = toys.length ? toys.slice(0, 3) : ['server', 'database', 'cloud'];
  return (
    <div className="vis vis-toys">
      {t.map((n, i) => <img key={n} src={toySrc(n)} alt="" className={`vt vt-${i}`} draggable={false} />)}
    </div>
  );
}
