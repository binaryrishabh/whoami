import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toySrc } from './Toy';

/**
 * A small distributed system, running in the page: requests leave "you", pass a load balancer, land on one of
 * three servers, and go on to the cache or the database (and now and then a job to the queue and its worker).
 * Click a server to kill it: the balancer retries, takes it out of the pool, and the autoscaler brings it
 * back. Click the bolt to flush the cache, the phone to send a burst, the queue to enqueue a batch.
 * Every number on the board is measured from the simulation itself.
 */
type Id = 'client' | 'lb' | 's1' | 's2' | 's3' | 'cache' | 'db' | 'queue' | 'worker';
type Pt = [number, number];
type Layout = { w: number; h: number; dir: 'h' | 'v'; size: Record<Id, number>; pos: Record<Id, Pt>; bus: [number, number] };

const NODES: { id: Id; toy: string; label: string; hint: string }[] = [
  { id: 'client', toy: 'phone', label: 'you', hint: 'Send a burst of requests' },
  { id: 'lb', toy: 'router', label: 'load balancer', hint: 'The load balancer' },
  { id: 's1', toy: 'server', label: 'api-1', hint: 'Take api-1 down' },
  { id: 's2', toy: 'server', label: 'api-2', hint: 'Take api-2 down' },
  { id: 's3', toy: 'server', label: 'api-3', hint: 'Take api-3 down' },
  { id: 'cache', toy: 'cache', label: 'cache', hint: 'Flush the cache' },
  { id: 'queue', toy: 'queue', label: 'queue', hint: 'Enqueue a batch of jobs' },
  { id: 'db', toy: 'database', label: 'postgres', hint: 'The database' },
  { id: 'worker', toy: 'gear', label: 'worker', hint: 'The worker' },
];

const WIDE: Layout = {
  w: 1120, h: 430, dir: 'h', bus: [388, 650],
  size: { client: 84, lb: 104, s1: 88, s2: 88, s3: 88, cache: 72, queue: 128, db: 92, worker: 88 },
  pos: { client: [90, 215], lb: [272, 215], s1: [506, 92], s2: [506, 215], s3: [506, 338], cache: [790, 92], queue: [790, 215], db: [790, 338], worker: [1010, 215] },
};
const TALL: Layout = {
  w: 360, h: 640, dir: 'v', bus: [232, 418],
  size: { client: 66, lb: 84, s1: 74, s2: 74, s3: 74, cache: 58, queue: 96, db: 72, worker: 66 },
  pos: { client: [180, 50], lb: [180, 158], s1: [66, 320], s2: [180, 320], s3: [294, 320], cache: [66, 500], queue: [180, 500], db: [294, 500], worker: [180, 600] },
};

/* routes: right-angled, with rounded corners, sampled to a polyline so packets can ride them */
function routePoints(L: Layout, a: Id, b: Id): Pt[] {
  const [ax, ay] = L.pos[a], [bx, by] = L.pos[b], sa = L.size[a] * 0.46, sb = L.size[b] * 0.46;
  if (L.dir === 'h') {
    const x0 = ax + sa, x1 = bx - sb;
    const mid = a === 'lb' ? L.bus[0] : (b === 'cache' || b === 'db' || b === 'queue') && a.startsWith('s') ? L.bus[1] : (x0 + x1) / 2;
    return [[x0, ay], [mid, ay], [mid, by], [x1, by]];
  }
  const y0 = ay + sa * 0.95, y1 = by - sb * 0.95;
  const mid = a === 'lb' ? L.bus[0] : a.startsWith('s') ? L.bus[1] : (y0 + y1) / 2;
  return [[ax, y0], [ax, mid], [bx, mid], [bx, y1]];
}
function rounded(pts: Pt[], r: number) {
  // a path string and a dense polyline along it
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
const EDGES: [Id, Id][] = [['client', 'lb'], ['lb', 's1'], ['lb', 's2'], ['lb', 's3'], ...(['s1', 's2', 's3'] as Id[]).flatMap(s => (['cache', 'queue', 'db'] as Id[]).map(t => [s, t] as [Id, Id])), ['queue', 'worker']];
function routesFor(L: Layout) {
  const out: Record<string, Route> = {};
  for (const [a, b] of EDGES) out[`${a}>${b}`] = rounded(routePoints(L, a, b), 16);
  return out;
}

const PATHS = ['/projects', '/experience', '/skills', '/github', '/contact', '/'];
const JOBS = ['send-email', 'resize-image', 'build-index', 'sync-github', 'warm-cache'];
const clock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
type Log = { k: number; t: string; text: string; tone: 'ok' | 'warn' | 'bad' | 'info' };

export function System() {
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<Layout>(WIDE);
  const [scale, setScale] = useState(1);
  const routes = useRef(routesFor(WIDE));
  const nodeEls = useRef<Partial<Record<Id, HTMLButtonElement | null>>>({});
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState({ served: 0, p50: 0, p99: 0, hit: 0, healthy: 3, jobs: 0 });
  const [down, setDown] = useState<Record<string, 'down' | 'out' | null>>({});
  const [cold, setCold] = useState(false);
  const sim = useRef({ visible: false, act: (_id: Id) => {} });

  // fit the board to its column: the wide layout on desktops, the tall one on phones
  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, next = w < 700 ? TALL : WIDE;
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

    const S = { up: { s1: true, s2: true, s3: true } as Record<string, boolean>, inPool: { s1: true, s2: true, s3: true } as Record<string, boolean>, rr: 0, coldUntil: 0, served: 0, hits: 0, misses: 0, jobs: 0, lat: [] as number[], logN: 0 };
    let logK = 0;
    const log = (text: string, tone: Log['tone'] = 'ok') => setLogs(l => [...l.slice(-3), { k: ++logK, t: clock(), text, tone }]);
    const pick = () => { for (let i = 0; i < 3; i++) { const s = `s${((S.rr + i) % 3) + 1}`; if (S.inPool[s]) { S.rr = (S.rr + i + 1) % 3; return s; } } return null; };

    const request = () => {
      const el = take();
      const path = PATHS[Math.floor(Math.random() * PATHS.length)];
      let retries = 0;
      const atLb = () => {
        pulse('lb');
        const s = pick();
        if (!s) { el.classList.add('pk-bad'); log(`GET ${path} 503 · no healthy upstream`, 'bad'); setTimeout(() => give(el), 300); return; }
        go(el, `lb>${s}`, 520, () => atServer(s));
      };
      const atServer = (s: string) => {
        if (!S.up[s]) {
          // connection refused: retry on the next server, and the balancer will notice
          retries++; pulse(s as Id, 'is-refuse');
          if (retries === 1) log(`lb: ${s.replace('s', 'api-')} refused · retrying`, 'warn');
          el.classList.add('pk-bad');
          go(el, `lb>${s}`, 300, () => { el.classList.remove('pk-bad'); atLb(); }, true);
          return;
        }
        pulse(s as Id);
        if (Math.random() < 0.16) job(s);
        const hit = performance.now() > S.coldUntil && Math.random() < 0.7;
        go(el, `${s}>${hit ? 'cache' : 'db'}`, 460, () => {
          pulse(hit ? 'cache' : 'db');
          const ms = Math.round((hit ? 1.5 + Math.random() * 4 : 12 + Math.random() * 26) + retries * 38 + Math.random() * 3);
          S.lat.push(ms); if (S.lat.length > 80) S.lat.shift();
          S.served++; if (hit) S.hits++; else S.misses++;
          if (++S.logN % 5 === 0 || retries) log(`GET ${path} 200 · ${hit ? 'cache hit' : 'postgres'} · ${ms} ms`, retries ? 'warn' : 'ok');
          give(el);
        });
      };
      go(el, 'client>lb', 440, atLb);
    };
    const job = (s: string) => {
      const el = take(true);
      const name = JOBS[Math.floor(Math.random() * JOBS.length)];
      go(el, `${s}>queue`, 520, () => { pulse('queue'); setTimeout(() => go(el, 'queue>worker', 560, () => { pulse('worker'); S.jobs++; give(el); if (Math.random() < 0.35) log(`worker: ${name} done`, 'info'); }), 260 + Math.random() * 500); });
    };

    const kill = (s: string) => {
      if (!S.up[s]) return;
      const n = s.replace('s', 'api-');
      S.up[s] = false; setDown(d => ({ ...d, [s]: 'down' }));
      log(`${n}: process killed`, 'bad');
      setTimeout(() => { S.inPool[s] = false; setDown(d => ({ ...d, [s]: 'out' })); log(`lb: ${n} failed health check · out of pool`, 'warn'); }, 900);
      setTimeout(() => log(`autoscaler: starting a replacement for ${n}`, 'info'), 2600);
      setTimeout(() => { S.up[s] = true; S.inPool[s] = true; setDown(d => ({ ...d, [s]: null })); pulse(s as Id, 'is-boot'); log(`${n}: healthy · back in the pool`, 'ok'); }, 5200);
    };
    sim.current.act = (id: Id) => {
      if (id === 's1' || id === 's2' || id === 's3') kill(id);
      else if (id === 'cache') { S.coldUntil = performance.now() + 5000; setCold(true); pulse('cache', 'is-poke'); log('cache: FLUSHALL · every read goes to postgres', 'warn'); setTimeout(() => { setCold(false); log('cache: warm again', 'ok'); }, 5000); }
      else if (id === 'client') { pulse('client', 'is-poke'); log('you: a burst of 8 requests', 'info'); for (let i = 0; i < 8; i++) setTimeout(request, i * 90); }
      else if (id === 'queue') { pulse('queue', 'is-poke'); log('queue: 6 jobs enqueued', 'info'); for (let i = 0; i < 6; i++) setTimeout(() => { const el = take(true); go(el, 'queue>worker', 600, () => { pulse('worker'); S.jobs++; give(el); }); }, i * 220); }
      else if (id === 'db') { pulse('db', 'is-poke'); log('postgres: VACUUM ANALYZE · 0 dead rows', 'info'); }
      else if (id === 'lb') { pulse('lb', 'is-poke'); log(`lb: round robin · ${Object.values(S.inPool).filter(Boolean).length} in pool`, 'info'); }
      else if (id === 'worker') { pulse('worker', 'is-poke'); log(`worker: ${S.jobs} jobs done so far`, 'info'); }
    };

    // the clock: packets move, requests arrive, numbers update, only while the board is on screen
    let raf = 0, nextReq = 0, nextStat = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!sim.current.visible || document.hidden) return;
      if (now > nextReq) { request(); nextReq = now + 330 + Math.random() * 420; }
      for (let i = moves.length - 1; i >= 0; i--) {
        const m = moves[i], t = Math.min(1, (now - m.t0) / m.dur);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        const [x, y] = at(m.r, m.back ? 1 - e : e);
        m.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        if (t >= 1) { moves.splice(i, 1); m.done(); }
      }
      if (now > nextStat) {
        nextStat = now + 400;
        const s = [...S.lat].sort((a, b) => a - b), q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0);
        setStats({ served: S.served, p50: q(0.5), p99: q(0.99), hit: S.hits + S.misses ? Math.round((100 * S.hits) / (S.hits + S.misses)) : 0, healthy: Object.values(S.inPool).filter(Boolean).length, jobs: S.jobs });
      }
    };
    raf = requestAnimationFrame(tick);
    log('cluster up · 3 of 3 servers healthy', 'ok');
    const io = new IntersectionObserver(([e]) => { sim.current.visible = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(box.current!);
    return () => { cancelAnimationFrame(raf); io.disconnect(); moves.length = 0; lay.querySelectorAll('.pk').forEach(n => n.remove()); };
  }, []);

  const rs = routes.current;
  return (
    <figure className="sys" aria-label="A small distributed system running live: click its parts">
      <figcaption className="sys-bar">
        <span className="sys-live"><i /> live</span>
        <span className="sys-title">a tiny system, running in your browser</span>
        <span className="sys-stats" aria-live="off">
          <span><b>{stats.served.toLocaleString('en-US')}</b> served</span>
          <span><b>{stats.p50}</b> ms p50</span>
          <span><b>{stats.p99}</b> ms p99</span>
          <span><b>{stats.hit}%</b> cache hits</span>
          <span className={stats.healthy < 3 ? 'is-warn' : ''}><b>{stats.healthy}/3</b> healthy</span>
        </span>
      </figcaption>
      <div className="sys-board" ref={box} style={{ height: L.h * scale }}>
        <div className="sys-stage" style={{ width: L.w, height: L.h, transform: `scale(${scale})` }}>
          <svg className="sys-pipes" width={L.w} height={L.h} aria-hidden="true">
            {Object.entries(rs).map(([k, r]) => {
              const s = k.split('>')[0], t = k.split('>')[1];
              const dead = down[s] === 'out' || down[t] === 'out';
              return <path key={k} d={r.d} className={dead ? 'is-dead' : ''} />;
            })}
          </svg>
          <div ref={layer} className="sys-packets" />
          {NODES.map(n => {
            const [x, y] = L.pos[n.id], s = L.size[n.id], st = down[n.id];
            return (
              <button
                key={n.id} ref={el => { nodeEls.current[n.id] = el; }}
                className={`sys-node sys-${n.id.replace(/\d/, '')}${st ? ' is-down' : ''}${n.id === 'cache' && cold ? ' is-cold' : ''}`}
                style={{ left: x, top: y, width: s, height: s }}
                onClick={() => sim.current.act(n.id)} aria-label={n.hint} title={n.hint}
              >
                <img src={toySrc(n.toy)} alt="" draggable={false} />
                <span className="sys-label">{n.label}{st === 'down' ? ' · killed' : st === 'out' ? ' · rebooting' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="sys-foot">
        <ol className="sys-log" aria-live="polite">
          {logs.map(l => <li key={l.k} className={`is-${l.tone}`}><time>{l.t}</time>{l.text}</li>)}
        </ol>
        <p className="sys-hint">Try it: <b>click a server</b> to kill it, the <b>bolt</b> to flush the cache, <b>your phone</b> for a burst.</p>
      </div>
    </figure>
  );
}
