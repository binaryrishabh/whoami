import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toySrc } from './Toy';

/**
 * A small distributed system, running in the page, with the console you'd watch it through.
 * Requests leave "you", pass a load balancer, land on one of three API servers, and read from the cache or
 * Postgres; now and then a server hands a job to the queue and its worker. The toolbar breaks things on
 * purpose: kill a server (the balancer retries, drops it from the pool, the autoscaler replaces it), flush
 * the cache, send a traffic spike, slow the database. Every number is measured from the simulation itself.
 */
type Id = 'client' | 'lb' | 's1' | 's2' | 's3' | 'cache' | 'db' | 'queue' | 'worker';
type Pt = [number, number];
type Layout = { w: number; h: number; dir: 'h' | 'v'; size: Record<Id, number>; pos: Record<Id, Pt>; bus: [number, number] };
type Srv = 's1' | 's2' | 's3';
const SERVERS: Srv[] = ['s1', 's2', 's3'];
const sname = (s: string) => s.replace('s', 'api-');

const NODES: { id: Id; toy: string; label: string; hint: string }[] = [
  { id: 'client', toy: 'phone', label: 'you', hint: 'Send a burst of requests' },
  { id: 'lb', toy: 'router', label: 'load balancer', hint: 'The load balancer' },
  { id: 's1', toy: 'server', label: 'api-1', hint: 'Kill api-1' },
  { id: 's2', toy: 'server', label: 'api-2', hint: 'Kill api-2' },
  { id: 's3', toy: 'server', label: 'api-3', hint: 'Kill api-3' },
  { id: 'cache', toy: 'cache', label: 'redis', hint: 'Flush the cache' },
  { id: 'queue', toy: 'queue', label: 'queue', hint: 'Enqueue a batch of jobs' },
  { id: 'db', toy: 'database', label: 'postgres', hint: 'Slow the database down' },
  { id: 'worker', toy: 'gear', label: 'worker', hint: 'The worker' },
];

const WIDE: Layout = {
  w: 820, h: 440, dir: 'h', bus: [262, 492],
  size: { client: 62, lb: 78, s1: 66, s2: 66, s3: 66, cache: 54, queue: 92, db: 70, worker: 62 },
  pos: { client: [58, 220], lb: [180, 220], s1: [372, 92], s2: [372, 220], s3: [372, 348], cache: [600, 92], queue: [600, 220], db: [600, 348], worker: [760, 220] },
};
const TALL: Layout = {
  w: 360, h: 720, dir: 'v', bus: [234, 436],
  size: { client: 56, lb: 70, s1: 62, s2: 62, s3: 62, cache: 50, queue: 80, db: 62, worker: 54 },
  pos: { client: [180, 52], lb: [180, 158], s1: [66, 330], s2: [180, 330], s3: [294, 330], cache: [66, 520], queue: [180, 520], db: [294, 520], worker: [180, 660] },
};

/* routes: right-angled, with rounded corners, sampled to a polyline so packets can ride them */
function routePoints(L: Layout, a: Id, b: Id): Pt[] {
  const [ax, ay] = L.pos[a], [bx, by] = L.pos[b], sa = L.size[a] * 0.5, sb = L.size[b] * 0.5;
  if (L.dir === 'h') {
    const x0 = ax + sa, x1 = bx - sb;
    const mid = a === 'lb' ? L.bus[0] : (b === 'cache' || b === 'db' || b === 'queue') && a.startsWith('s') ? L.bus[1] : (x0 + x1) / 2;
    return [[x0, ay], [mid, ay], [mid, by], [x1, by]];
  }
  const y0 = ay + sa + 16, y1 = by - sb;
  const mid = a === 'lb' ? L.bus[0] : a.startsWith('s') ? L.bus[1] : (y0 + y1) / 2;
  return [[ax, y0], [ax, mid], [bx, mid], [bx, y1]];
}
function rounded(pts: Pt[], r: number) {
  const poly: Pt[] = [pts[0]];
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
    if (l1 < 0.5 || l2 < 0.5) continue;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = cx - ((cx - px) / l1) * rr, ay = cy - ((cy - py) / l1) * rr, bx = cx + ((nx - cx) / l2) * rr, by = cy + ((ny - cy) / l2) * rr;
    d += ` L${ax},${ay} Q${cx},${cy} ${bx},${by}`;
    poly.push([ax, ay]);
    for (let t = 0.2; t < 1; t += 0.2) { const u = 1 - t; poly.push([u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]); }
    poly.push([bx, by]);
  }
  const e = pts[pts.length - 1];
  d += ` L${e[0]},${e[1]}`;
  poly.push(e);
  const acc = [0];
  for (let i = 1; i < poly.length; i++) acc.push(acc[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  return { d, poly, acc, len: acc[acc.length - 1] };
}
type Route = ReturnType<typeof rounded>;
function at(r: Route, t: number): Pt {
  const s = t * r.len;
  let i = 1;
  while (i < r.acc.length - 1 && r.acc[i] < s) i++;
  const k = (s - r.acc[i - 1]) / Math.max(1e-6, r.acc[i] - r.acc[i - 1]);
  return [r.poly[i - 1][0] + (r.poly[i][0] - r.poly[i - 1][0]) * k, r.poly[i - 1][1] + (r.poly[i][1] - r.poly[i - 1][1]) * k];
}
const EDGES: [Id, Id][] = [['client', 'lb'], ['lb', 's1'], ['lb', 's2'], ['lb', 's3'], ...SERVERS.flatMap(s => (['cache', 'queue', 'db'] as Id[]).map(t => [s, t] as [Id, Id])), ['queue', 'worker']];
function routesFor(L: Layout) {
  const out: Record<string, Route> = {};
  for (const [a, b] of EDGES) out[`${a}>${b}`] = rounded(routePoints(L, a, b), 14);
  return out;
}

const PATHS = ['/projects', '/experience', '/skills', '/github', '/contact', '/'];
const JOBS = ['send-email', 'resize-image', 'build-index', 'sync-github', 'warm-cache'];
const clock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
type Tone = 'ok' | 'warn' | 'bad' | 'info';
type Log = { k: number; t: string; text: string; tone: Tone };
type SrvView = { state: 'up' | 'down' | 'out' | 'boot'; rps: number; cpu: number; served: number };
type View = {
  served: number; rps: number; p50: number; p99: number; hit: number; healthy: number; jobs: number; depth: number; conns: number; errors: number;
  srv: Record<Srv, SrvView>; rpsSeries: number[]; p99Series: number[]; p50Series: number[];
};
const EMPTY: View = {
  served: 0, rps: 0, p50: 0, p99: 0, hit: 0, healthy: 3, jobs: 0, depth: 0, conns: 0, errors: 0,
  srv: { s1: { state: 'up', rps: 0, cpu: 0, served: 0 }, s2: { state: 'up', rps: 0, cpu: 0, served: 0 }, s3: { state: 'up', rps: 0, cpu: 0, served: 0 } },
  rpsSeries: [], p99Series: [], p50Series: [],
};
type Mode = { spike: boolean; slowdb: boolean; cold: boolean };

/** a little line chart: the last 40 seconds */
function Spark({ series, max, tone = 'blue', fill = true }: { series: number[]; max: number; tone?: 'blue' | 'ink' | 'red'; fill?: boolean }) {
  const W = 220, H = 46, n = 40;
  const pts = series.slice(-n).map((v, i, a) => [W - (a.length - 1 - i) * (W / (n - 1)), H - 3 - Math.min(1, v / Math.max(1, max)) * (H - 8)] as Pt);
  if (pts.length < 2) return <svg className="spark" viewBox={`0 0 ${W} ${H}`} />;
  const d = 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' L');
  return (
    <svg className={`spark is-${tone}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {fill && <path className="spark-fill" d={`${d} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`} />}
      <path className="spark-line" d={d} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" className="spark-dot" />
    </svg>
  );
}

export function System() {
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<Layout>(WIDE);
  const [scale, setScale] = useState(1);
  const routes = useRef(routesFor(WIDE));
  const nodeEls = useRef<Partial<Record<Id, HTMLButtonElement | null>>>({});
  const [logs, setLogs] = useState<Log[]>([]);
  const [view, setView] = useState<View>(EMPTY);
  const [mode, setMode] = useState<Mode>({ spike: false, slowdb: false, cold: false });
  const [uptime, setUptime] = useState(0);
  const sim = useRef({ visible: false, act: (_a: string) => {} });

  // fit the board to its column: the wide layout on desktops, the tall one on phones
  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, next = w < 560 ? TALL : WIDE;
      setL(prev => (prev === next ? prev : next));
      setScale(w / next.w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  routes.current = routesFor(L);

  useEffect(() => {
    const lay = layer.current!;
    const pool: HTMLImageElement[] = [];
    const take = (job = false) => {
      const el = pool.pop() || Object.assign(document.createElement('img'), { alt: '', draggable: false });
      el.className = `pk${job ? ' pk-job' : ''}`; el.src = toySrc('packet');
      lay.appendChild(el);
      return el;
    };
    const give = (el: HTMLImageElement) => { el.remove(); el.className = 'pk'; pool.push(el); };
    type Move = { el: HTMLImageElement; r: Route; t0: number; dur: number; done: () => void; back: boolean };
    const moves: Move[] = [];
    const go = (el: HTMLImageElement, key: string, dur: number, done: () => void, back = false) => { const r = routes.current[key]; if (!r) { done(); return; } moves.push({ el, r, t0: performance.now(), dur, done, back }); };
    const pulse = (id: Id, cls = 'is-pulse') => { const n = nodeEls.current[id]; if (!n) return; n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls); };

    const S = {
      state: { s1: 'up', s2: 'up', s3: 'up' } as Record<Srv, SrvView['state']>,
      inflight: { s1: 0, s2: 0, s3: 0 } as Record<Srv, number>,
      served: { s1: 0, s2: 0, s3: 0 } as Record<Srv, number>,
      hits: [] as number[], done: [] as { t: number; ms: number; s: Srv }[],
      rr: 0, coldUntil: 0, spikeUntil: 0, slowUntil: 0, total: 0, hitN: 0, missN: 0, jobs: 0, depth: 0, dbConns: 0, errors: 0, logN: 0, t0: performance.now(),
      rpsSeries: [] as number[], p50Series: [] as number[], p99Series: [] as number[],
    };
    let logK = 0;
    const log = (text: string, tone: Tone = 'ok') => setLogs(l => [...l.slice(-6), { k: ++logK, t: clock(), text, tone }]);
    const inPool = (s: Srv) => S.state[s] === 'up' || S.state[s] === 'down';
    const pick = (): Srv | null => {
      // round robin over the pool, skipping the busiest server when there is a choice
      for (let i = 0; i < 3; i++) { const s = SERVERS[(S.rr + i) % 3]; if (inPool(s)) { S.rr = (S.rr + i + 1) % 3; return s; } }
      return null;
    };

    const request = () => {
      const el = take();
      const path = PATHS[Math.floor(Math.random() * PATHS.length)];
      let retries = 0;
      const atLb = () => {
        pulse('lb');
        const s = pick();
        if (!s) { el.classList.add('pk-bad'); S.errors++; log(`GET ${path} 503 · no healthy upstream`, 'bad'); setTimeout(() => give(el), 300); return; }
        go(el, `lb>${s}`, 480, () => atServer(s));
      };
      const atServer = (s: Srv) => {
        if (S.state[s] !== 'up') {
          retries++; pulse(s, 'is-refuse');
          if (retries === 1) log(`lb: ${sname(s)} refused the connection · retrying`, 'warn');
          el.classList.add('pk-bad');
          go(el, `lb>${s}`, 280, () => { el.classList.remove('pk-bad'); atLb(); }, true);
          return;
        }
        pulse(s); S.inflight[s]++;
        if (Math.random() < 0.15) job(s);
        const hit = performance.now() > S.coldUntil && Math.random() < 0.72;
        const slow = !hit && performance.now() < S.slowUntil;
        if (!hit) S.dbConns++;
        go(el, `${s}>${hit ? 'cache' : 'db'}`, hit ? 420 : slow ? 1300 : 520, () => {
          pulse(hit ? 'cache' : 'db', slow ? 'is-slow' : 'is-pulse');
          if (!hit) S.dbConns--;
          S.inflight[s]--; S.served[s]++;
          const busy = S.inflight.s1 + S.inflight.s2 + S.inflight.s3;
          const ms = Math.round((hit ? 1.5 + Math.random() * 4 : slow ? 140 + Math.random() * 120 : 12 + Math.random() * 24) + retries * 38 + busy * 1.5);
          S.done.push({ t: performance.now(), ms, s }); S.total++;
          if (hit) S.hitN++; else S.missN++;
          if (++S.logN % 6 === 0 || retries || (slow && S.logN % 3 === 0)) log(`GET ${path} 200 · ${hit ? 'redis hit' : 'postgres'} · ${ms} ms`, retries || slow ? 'warn' : 'ok');
          give(el);
        });
      };
      go(el, 'client>lb', 420, atLb);
    };
    const job = (s: string) => {
      const el = take(true);
      const name = JOBS[Math.floor(Math.random() * JOBS.length)];
      S.depth++;
      go(el, `${s}>queue`, 500, () => {
        pulse('queue');
        setTimeout(() => go(el, 'queue>worker', 540, () => { S.depth--; pulse('worker'); S.jobs++; give(el); if (Math.random() < 0.3) log(`worker: ${name} done`, 'info'); }), 300 + Math.random() * 600 + S.depth * 120);
      });
    };

    const kill = (s: Srv) => {
      if (S.state[s] !== 'up') return;
      S.state[s] = 'down';
      log(`${sname(s)}: process killed (SIGKILL)`, 'bad');
      setTimeout(() => { S.state[s] = 'out'; log(`lb: ${sname(s)} failed 2 health checks · removed from pool`, 'warn'); }, 900);
      setTimeout(() => log(`autoscaler: launching a replacement for ${sname(s)}`, 'info'), 2200);
      setTimeout(() => { S.state[s] = 'boot'; }, 3400);
      setTimeout(() => { S.state[s] = 'up'; pulse(s, 'is-boot'); log(`${sname(s)}: healthy · back in the pool`, 'ok'); }, 5200);
    };
    const flags = () => setMode({ spike: performance.now() < S.spikeUntil, slowdb: performance.now() < S.slowUntil, cold: performance.now() < S.coldUntil });
    sim.current.act = (a: string) => {
      if (a === 's1' || a === 's2' || a === 's3') kill(a);
      else if (a === 'kill') { const up = SERVERS.filter(s => S.state[s] === 'up'); if (up.length) kill(up[Math.floor(Math.random() * up.length)]); else log('every server is already down', 'warn'); }
      else if (a === 'cache' || a === 'flush') { S.coldUntil = performance.now() + 6000; pulse('cache', 'is-poke'); log('redis: FLUSHALL · every read goes to postgres', 'warn'); setTimeout(() => log('redis: warm again', 'ok'), 6000); }
      else if (a === 'client' || a === 'burst') { pulse('client', 'is-poke'); log('you: a burst of 10 requests', 'info'); for (let i = 0; i < 10; i++) setTimeout(request, i * 70); }
      else if (a === 'spike') { S.spikeUntil = performance.now() + 7000; log('traffic: spike, about 4× normal for 7 s', 'warn'); setTimeout(() => log('traffic: back to normal', 'ok'), 7000); }
      else if (a === 'db' || a === 'slowdb') { S.slowUntil = performance.now() + 6000; pulse('db', 'is-poke'); log('postgres: lock contention · queries slow for 6 s', 'warn'); setTimeout(() => log('postgres: locks released', 'ok'), 6000); }
      else if (a === 'queue') { pulse('queue', 'is-poke'); log('queue: 6 jobs enqueued', 'info'); for (let i = 0; i < 6; i++) setTimeout(() => job(SERVERS[i % 3]), i * 160); }
      else if (a === 'lb') { pulse('lb', 'is-poke'); log(`lb: round robin · ${SERVERS.filter(inPool).length} of 3 in pool`, 'info'); }
      else if (a === 'worker') { pulse('worker', 'is-poke'); log(`worker: ${S.jobs} jobs done so far`, 'info'); }
      else if (a === 'reset') { S.coldUntil = S.spikeUntil = S.slowUntil = 0; for (const s of SERVERS) if (S.state[s] !== 'up') { S.state[s] = 'up'; pulse(s, 'is-boot'); } log('reset: all healthy, normal traffic', 'ok'); }
      flags();
    };

    // the clock: packets move, requests arrive, numbers update, only while the board is on screen
    let raf = 0, nextReq = 0, nextView = 0, nextSec = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!sim.current.visible || document.hidden) return;
      const spike = now < S.spikeUntil;
      if (now > nextReq) { request(); nextReq = now + (spike ? 70 + Math.random() * 90 : 300 + Math.random() * 380); }
      for (let i = moves.length - 1; i >= 0; i--) {
        const m = moves[i], t = Math.min(1, (now - m.t0) / m.dur);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        const [x, y] = at(m.r, m.back ? 1 - e : e);
        m.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        if (t >= 1) { moves.splice(i, 1); m.done(); }
      }
      S.done = S.done.filter(d => now - d.t < 10000);
      const last = (ms: number) => S.done.filter(d => now - d.t < ms);
      if (now > nextSec) {
        // one point a second for the charts
        nextSec = now + 1000;
        const sec = last(1000), lat = sec.map(d => d.ms).sort((a, b) => a - b);
        S.rpsSeries.push(sec.length); S.p50Series.push(lat[Math.floor(lat.length / 2)] ?? 0); S.p99Series.push(lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.99))] ?? 0);
        for (const k of ['rpsSeries', 'p50Series', 'p99Series'] as const) if (S[k].length > 60) S[k].shift();
        flags();
      }
      if (now > nextView) {
        nextView = now + 350;
        const win = last(5000), lat = win.map(d => d.ms).sort((a, b) => a - b), q = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : 0);
        const srv = {} as Record<Srv, SrvView>;
        for (const s of SERVERS) {
          const rps = win.filter(d => d.s === s).length / 5;
          srv[s] = { state: S.state[s], rps, served: S.served[s], cpu: S.state[s] === 'up' ? Math.min(0.98, 0.08 + rps * 0.09 + S.inflight[s] * 0.07 + Math.random() * 0.03) : 0 };
        }
        setView({
          served: S.total, rps: win.length / 5, p50: q(0.5), p99: q(0.99), errors: S.errors,
          hit: S.hitN + S.missN ? Math.round((100 * S.hitN) / (S.hitN + S.missN)) : 0,
          healthy: SERVERS.filter(s => S.state[s] === 'up').length, jobs: S.jobs, depth: S.depth, conns: S.dbConns + 2,
          srv, rpsSeries: [...S.rpsSeries], p50Series: [...S.p50Series], p99Series: [...S.p99Series],
        });
        setUptime(Math.floor((now - S.t0) / 1000));
      }
    };
    raf = requestAnimationFrame(tick);
    log('cluster up · 3 of 3 api servers healthy', 'ok');
    const io = new IntersectionObserver(([e]) => { sim.current.visible = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(box.current!);
    return () => { cancelAnimationFrame(raf); io.disconnect(); moves.length = 0; lay.querySelectorAll('.pk').forEach(n => n.remove()); };
  }, []);

  const rs = routes.current, v = view;
  const metric = (id: Id): string | null => {
    if (id === 'client') return `${v.rps.toFixed(1)} req/s`;
    if (id === 'lb') return `${v.healthy}/3 in pool`;
    if (id === 's1' || id === 's2' || id === 's3') { const s = v.srv[id]; return s.state === 'up' ? `${Math.round(s.cpu * 100)}% cpu` : s.state === 'boot' ? 'booting' : s.state === 'down' ? 'killed' : 'out of pool'; }
    if (id === 'cache') return mode.cold ? 'cold' : `${v.hit}% hits`;
    if (id === 'queue') return `depth ${v.depth}`;
    if (id === 'db') return mode.slowdb ? 'slow · locks' : `${v.conns} conns`;
    if (id === 'worker') return `${v.jobs} done`;
    return null;
  };
  const mm = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  const pipeDead = (k: string) => { const [a, b] = k.split('>'); return [a, b].some(x => (x === 's1' || x === 's2' || x === 's3') && v.srv[x].state !== 'up'); };

  return (
    <figure className="sys" aria-label="A small distributed system running live, with controls to break it">
      <figcaption className="sys-bar">
        <span className="sys-live"><i /> live</span>
        <span className="sys-env">prod · ap-south-1</span>
        <span className="sys-up">up {mm(uptime)}</span>
        <span className={`sys-status${v.healthy < 3 || mode.slowdb || mode.cold ? ' is-warn' : ''}`}>
          {v.healthy < 3 ? `degraded · ${3 - v.healthy} server${3 - v.healthy > 1 ? 's' : ''} down` : mode.slowdb ? 'degraded · slow database' : mode.cold ? 'degraded · cold cache' : mode.spike ? 'under load' : 'all systems normal'}
        </span>
      </figcaption>

      <div className="sys-tools" role="toolbar" aria-label="Break something">
        <span className="sys-tools-k">Break something</span>
        <button onClick={() => sim.current.act('kill')}><img src={toySrc('server')} alt="" />Kill a server</button>
        <button onClick={() => sim.current.act('flush')} className={mode.cold ? 'is-on' : ''}><img src={toySrc('cache')} alt="" />Flush the cache</button>
        <button onClick={() => sim.current.act('spike')} className={mode.spike ? 'is-on' : ''}><img src={toySrc('globe')} alt="" />Traffic spike</button>
        <button onClick={() => sim.current.act('slowdb')} className={mode.slowdb ? 'is-on' : ''}><img src={toySrc('database')} alt="" />Slow the database</button>
        <button onClick={() => sim.current.act('reset')} className="sys-reset">Reset</button>
      </div>

      <div className="sys-main">
        <div className="sys-board" ref={box} style={{ height: L.h * scale }}>
          <div className="sys-stage" style={{ width: L.w, height: L.h, transform: `scale(${scale})` }}>
            <svg className="sys-pipes" width={L.w} height={L.h} aria-hidden="true">
              {Object.entries(rs).map(([k, r]) => <path key={k} d={r.d} className={pipeDead(k) ? 'is-dead' : ''} />)}
            </svg>
            <div ref={layer} className="sys-packets" />
            {NODES.map(n => {
              const [x, y] = L.pos[n.id], s = L.size[n.id];
              const srv = n.id === 's1' || n.id === 's2' || n.id === 's3' ? v.srv[n.id].state : 'up';
              const warn = (n.id === 'cache' && mode.cold) || (n.id === 'db' && mode.slowdb) || (n.id === 'queue' && v.depth > 4);
              return (
                <button
                  key={n.id} ref={el => { nodeEls.current[n.id] = el; }}
                  className={`sys-node sys-${n.id.replace(/\d/, '')}${srv === 'down' || srv === 'out' ? ' is-down' : ''}${srv === 'boot' ? ' is-booting' : ''}${n.id === 'cache' && mode.cold ? ' is-cold' : ''}${warn ? ' is-warn' : ''}`}
                  style={{ left: x, top: y, width: s, height: s }}
                  onClick={() => sim.current.act(n.id)} aria-label={n.hint} title={n.hint}
                >
                  <img src={toySrc(n.toy)} alt="" draggable={false} />
                  <span className="sys-tag"><i />{n.label}</span>
                  <span className="sys-metric">{metric(n.id)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="sys-side" aria-label="Metrics">
          <div className="sys-card">
            <p className="sys-k">Throughput <b>{v.rps.toFixed(1)}<small> req/s</small></b></p>
            <Spark series={v.rpsSeries} max={Math.max(8, ...v.rpsSeries)} />
          </div>
          <div className="sys-card">
            <p className="sys-k">Latency <b>{v.p99}<small> ms p99</small></b></p>
            <Spark series={v.p99Series} max={Math.max(60, ...v.p99Series)} tone={v.p99 > 120 ? 'red' : 'ink'} />
            <p className="sys-sub"><span>p50 <b>{v.p50} ms</b></span><span>redis hits <b>{v.hit}%</b></span></p>
          </div>
          <div className="sys-card">
            <p className="sys-k">API servers <b>{v.healthy}<small>/3 healthy</small></b></p>
            <ul className="sys-srv">
              {SERVERS.map(s => {
                const x = v.srv[s];
                return (
                  <li key={s} className={`is-${x.state}`}>
                    <span className="sys-srv-n"><i />{sname(s)}</span>
                    <span className="sys-cpu"><i style={{ width: `${Math.round(x.cpu * 100)}%` }} /></span>
                    <span className="sys-srv-v">{x.state === 'up' ? `${x.rps.toFixed(1)}/s` : x.state === 'boot' ? 'boot' : 'down'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="sys-card sys-totals">
            <p><b>{v.served.toLocaleString('en-US')}</b><span>served</span></p>
            <p><b>{v.jobs}</b><span>jobs run</span></p>
            <p className={v.errors ? 'is-bad' : ''}><b>{v.errors}</b><span>errors</span></p>
          </div>
        </aside>
      </div>

      <div className="sys-foot">
        <ol className="sys-log" aria-live="polite">
          {logs.map(l => <li key={l.k} className={`is-${l.tone}`}><time>{l.t}</time><span className="lvl">{l.tone === 'bad' ? 'ERR' : l.tone === 'warn' ? 'WRN' : l.tone === 'info' ? 'INF' : 'OK '}</span>{l.text}</li>)}
        </ol>
      </div>
    </figure>
  );
}
