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

/* ── InfraForge: a miniature of the editor. A cache is dragged in from the palette and the simulation answers ── */
type Card = { id: string; toy: string; x: number; y: number; name: string; kind: string };
const CW = 138, CH = 50;            // card size
const CARDS: Card[] = [
  { id: 'alb', toy: 'router', x: 214, y: 196, name: 'alb', kind: 'load balancer' },
  { id: 'a', toy: 'server', x: 390, y: 126, name: 'api-a', kind: 'ec2 · t3.small' },
  { id: 'b', toy: 'server', x: 390, y: 266, name: 'api-b', kind: 'ec2 · t3.small' },
  { id: 'db', toy: 'database', x: 560, y: 266, name: 'rds', kind: 'postgres' },
];
const REDIS: Card = { id: 'c', toy: 'cache', x: 560, y: 126, name: 'redis', kind: 'cache · 1 GB' };
const PALETTE = [['router', 'Load balancer'], ['server', 'Server'], ['cache', 'Cache'], ['database', 'Database'], ['queue', 'Queue']] as const;
const PAL_Y = (i: number) => 92 + i * 44;
/** an orthogonal wire from the right edge of one card to the left edge of another, corners rounded */
function link(a: Card, b: Card, shift = 0) {
  const x0 = a.x + CW / 2, x1 = b.x - CW / 2, y0 = a.y, y1 = b.y, m = Math.round((x0 + x1) / 2) + shift, r = 10;
  if (y0 === y1) return `M${x0},${y0} H${x1}`;
  const s = Math.sign(y1 - y0);
  return `M${x0},${y0} H${m - r} Q${m},${y0} ${m},${y0 + s * r} V${y1 - s * r} Q${m},${y1} ${m + r},${y1} H${x1}`;
}
const [ALB, A, B, DB] = CARDS;
const BASE_LINKS = [link(ALB, A), link(ALB, B), link(A, DB, -7), link(B, DB)];

function CardG({ c, cls = '' }: { c: Card; cls?: string }) {
  return (
    <g className={`ifc-card ${cls}`} transform={`translate(${c.x - CW / 2},${c.y - CH / 2})`}>
      <rect width={CW} height={CH} rx="11" />
      <rect className="ifc-ico" x="7" y="7" width="36" height="36" rx="8" />
      <image href={toySrc(c.toy)} x="10" y="10" width="30" height="30" />
      <text x="51" y="22" className="ifc-name">{c.name}</text>
      <text x="51" y="36" className="ifc-kind">{c.kind}</text>
      <circle cx="0" cy={CH / 2} r="3.5" className="ifc-port" /><circle cx={CW} cy={CH / 2} r="3.5" className="ifc-port" />
    </g>
  );
}

export function InfraCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const run = useLoop(ref, 9000);
  const [phase, setPhase] = useState(0); // 0 as built, 1 dragging a cache in, 2 placed and simulated
  useEffect(() => {
    if (!run) return;
    setPhase(0);
    const a = window.setTimeout(() => setPhase(1), 1500), b = window.setTimeout(() => setPhase(2), 3400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [run]);
  const placed = phase === 2;
  const links = placed ? [...BASE_LINKS, link(A, REDIS), link(B, REDIS, 7)] : BASE_LINKS;
  const stats = placed ? [['Cost', '$214/mo'], ['p99', '31 ms'], ['DB load', '38%']] : [['Cost', '$186/mo'], ['p99', '84 ms'], ['DB load', '81%']];
  return (
    <div className="vis vis-canvas" ref={ref}>
      <svg viewBox="0 0 640 420" className="ifc" role="img" aria-label="The InfraForge editor: adding a cache lowers latency and database load">
        <defs><pattern id="ifc-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className="ifc-dot" /></pattern></defs>
        {/* app bar */}
        <rect x="0" y="0" width="640" height="40" className="ifc-bar" />
        {[16, 30, 44].map(x => <circle key={x} cx={x} cy="20" r="4.5" className="ifc-win" />)}
        <text x="66" y="24.5" className="ifc-title">infraforge</text>
        <text x="146" y="24.5" className="ifc-crumb">/ checkout-service</text>
        <g className={`ifc-run${placed ? ' is-on' : ''}`} transform="translate(540,9)"><rect width="88" height="22" rx="11" /><text x="44" y="15">{placed ? '● simulating' : '▶ Simulate'}</text></g>
        {/* palette */}
        <rect x="0" y="40" width="132" height="340" className="ifc-pal" />
        <text x="16" y="66" className="ifc-pal-k">COMPONENTS</text>
        {PALETTE.map(([toy, name], i) => (
          <g key={toy} className={`ifc-pal-item${toy === 'cache' && phase === 1 ? ' is-picked' : ''}`} transform={`translate(10,${PAL_Y(i) - 17})`}>
            <rect width="112" height="34" rx="9" />
            <image href={toySrc(toy)} x="7" y="5" width="24" height="24" />
            <text x="38" y="21">{name}</text>
          </g>
        ))}
        {/* canvas */}
        <rect x="132" y="40" width="508" height="340" fill="url(#ifc-dots)" />
        {links.map((d, i) => (
          <g key={`${run}-${i}`}>
            <path d={d} className={`ifc-wire${i >= 4 ? ' is-new' : ''}`} />
            <circle r="3.2" className="ifc-pkt"><animateMotion dur={`${1.8 + (i % 3) * 0.3}s`} begin={`${i * 0.3}s`} repeatCount="indefinite" path={d} /></circle>
          </g>
        ))}
        {CARDS.map(c => <CardG key={c.id} c={c} cls={c.id === 'db' && !placed ? 'is-hot' : ''} />)}
        {placed && <CardG c={REDIS} cls="is-new" />}
        {phase === 1 && <g className="ifc-drag"><CardG c={REDIS} cls="is-ghost" /></g>}
        {phase === 1 && <path className="ifc-cursor" d="M0,0 L0,17 L4.6,12.8 L7.8,19.8 L10.6,18.5 L7.5,11.7 L13.5,11.7 Z" />}
        {!placed && <g className="ifc-flag" transform={`translate(${DB.x - 52},${DB.y + CH / 2 + 12})`}><rect width="104" height="20" rx="10" /><text x="52" y="14">bottleneck · 81%</text></g>}
        {/* status bar */}
        <rect x="0" y="380" width="640" height="40" className="ifc-bar" />
        <text x="16" y="405" className="ifc-k">SIMULATION · 1 Hz</text>
        {stats.map(([k, val], i) => (
          <g key={k} transform={`translate(${152 + i * 112},405)`}>
            <text className="ifc-k">{k.toUpperCase()}</text>
            <text x={k === 'DB load' ? 58 : k === 'p99' ? 30 : 38} className={`ifc-v${placed ? ' is-good' : ''}`} key={val}>{val}</text>
          </g>
        ))}
        <g className={`ifc-chip${placed ? ' is-good' : ''}`} transform="translate(492,391)"><rect width="136" height="20" rx="10" /><text x="68" y="14">{placed ? '5 nodes · in budget' : 'db is the bottleneck'}</text></g>
      </svg>
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
