import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { site, type Island } from '../site.config';
import github from '../data/github.json';
import { FloatToy, toySrc } from './Toy';
import { System } from './System';
import { Blueprint, InfraCanvas, RecipeDiff, ToyGroup } from './Visuals';

const WORLD = '/world/';
const ext = { target: '_blank', rel: 'noopener' } as const;
type Of<K extends Island['kind']> = Extract<Island, { kind: K }>;
const of = <K extends Island['kind']>(k: K) => site.islands.filter(i => i.kind === k) as Of<K>[];

/** *stars* become italics */
function rich(text: string) {
  return text.split(/(\*[^*]+\*)/).map((p, i) => (p.startsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>));
}

/** adds .is-in to anything with data-reveal as it scrolls into view */
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/** the island glyph, from the world's logo */
function Mark({ className = '' }: { className?: string }) {
  return <svg className={`mark ${className}`} viewBox="0 0 32 32" aria-hidden="true"><path d="M4 12.5h24M7 12.5l4.5 6.5 2.5-2 2 6 2.5-3.5 2 2.5 4.5-9.5M14 12.5V8.5l2-3 2 3v4" /></svg>;
}

/* ── nav ── */
const SECTIONS = [['work', 'Work'], ['about', 'About'], ['experience', 'Experience'], ['contact', 'Contact']] as const;
function Nav() {
  const [here, setHere] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => {
      setScrolled(scrollY > 12);
      let cur = '';
      for (const [id] of SECTIONS) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < innerHeight * 0.4) cur = id; }
      setHere(cur);
    };
    on(); addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`nav${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <a className="nav-brand" href="#top" aria-label={`${site.name}, back to top`}><Mark /><span>{site.name.split(' ')[0]}</span></a>
      <nav className="nav-links" aria-label="Sections">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className={here === id ? 'is-here' : ''} onClick={() => setOpen(false)}>{label}</a>)}
      </nav>
      <a className="nav-world" href={WORLD}><span className="nav-world-dot" /><span className="nw-long">Enter the </span>3D world<span aria-hidden="true">↗</span></a>
      <button className="nav-menu" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(o => !o)}><i /><i /></button>
    </header>
  );
}

/* ── hero ── */
const DECOR = [
  { name: 'cloud', size: 158, style: { left: '4%', top: 118 }, depth: 1.5, delay: 0.15, tilt: -4, says: ['it’s someone else’s computer', 'multi-AZ, obviously', 'scaling to zero…'] },
  { name: 'key', size: 116, style: { left: '7%', top: 336 }, depth: 2.2, delay: 0.35, tilt: -14, says: ['JWT verified · 200', 'token rotated', 'OAuth handshake ok'] },
  { name: 'envelope', size: 104, style: { left: '19%', top: 452 }, depth: 1.1, delay: 0.55, tilt: 8, says: ['POST /contact 201', 'delivered, at least once', 'idempotency key: ok'] },
  { name: 'lock', size: 98, style: { right: '7%', top: 112 }, depth: 1.8, delay: 0.25, tilt: 9, says: ['TLS 1.3 ✓', '401 · nice try', 'least privilege, always'] },
  { name: 'globe', size: 128, style: { right: '3.5%', top: 318 }, depth: 1.3, delay: 0.45, tilt: -6, says: ['edge hit · 12 ms', 'served from the nearest PoP', 'ap-south-1 says hi'] },
  { name: 'container', size: 118, style: { right: '18%', top: 458 }, depth: 2, delay: 0.65, tilt: 7, says: ['docker compose up', 'image: 41 MB', 'it works on my machine'] },
];

function Hero() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current!;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { el.style.setProperty('--px', ((e.clientX / innerWidth) * 2 - 1).toFixed(3)); el.style.setProperty('--py', ((e.clientY / innerHeight) * 2 - 1).toFixed(3)); });
    };
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, []);
  const [first] = site.location.split(' · ');
  return (
    <section className="hero" id="top" ref={ref}>
      <div className="hero-decor" aria-label="Toys from a server room: pick them up, or click them">
        {DECOR.map(d => <FloatToy key={d.name} {...d} alt={`A toy ${d.name}`} />)}
      </div>
      <div className="hero-copy">
        <p className="hero-k"><span className="dot" />{site.role} · {first}</p>
        <h1 className="hero-h">{rich(site.page.headline)}</h1>
        <p className="hero-intro">{site.page.intro}</p>
        <div className="hero-cta">
          <a className="btn btn-dark" href={WORLD}><Mark className="btn-mark" />Enter the 3D world</a>
          <a className="btn btn-line" href="#work">See my work <span aria-hidden="true">↓</span></a>
        </div>
      </div>
      <div className="hero-sys" data-reveal><System /></div>
    </section>
  );
}

function SecHead({ n, k, title, lead }: { n: string; k: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <div className="sec-head" data-reveal>
      <p className="sec-k"><span className="sec-n">{n}</span>{k}</p>
      <h2 className="sec-h">{title}</h2>
      {lead && <p className="sec-lead">{lead}</p>}
    </div>
  );
}

/* ── work ── */
function Visual({ p }: { p: Of<'project'> }) {
  if (p.visual === 'blueprint') return <Blueprint />;
  if (p.visual === 'canvas') return <InfraCanvas />;
  if (p.visual === 'diff') return <RecipeDiff />;
  return <ToyGroup toys={p.toys ?? []} />;
}
function Work() {
  // `rank` sets the order on this page only (the world keeps the config order)
  const projects = of('project').map((p, i) => ({ p, i })).sort((a, b) => (a.p.rank ?? 99) - (b.p.rank ?? 99) || a.i - b.i).map(x => x.p);
  return (
    <section className="sec" id="work">
      <SecHead n="01" k="Selected work" title={<>Things I’ve <em>built</em>, and how they work.</>} lead="Each one runs on its own below: a little moving sketch of what the code actually does." />
      <div className="work">
        {projects.map((p, i) => (
          <article key={p.title} className={`proj${i % 2 ? ' is-flip' : ''}`} data-reveal>
            <div className="proj-vis"><Visual p={p} /></div>
            <div className="proj-text">
              <p className="proj-k">Project {String(i + 1).padStart(2, '0')}</p>
              <h3 className="proj-h">{p.title}</h3>
              <ul className="chips">{p.stack.split(', ').map(s => <li key={s}>{s}</li>)}</ul>
              <ul className="proj-points">{p.points.map((pt, j) => <li key={j}>{pt}</li>)}</ul>
              {p.links.length > 0 && <p className="proj-links">{p.links.map(l => <a key={l.url} href={l.url} {...ext} className="btn btn-line btn-sm">{l.label} <span aria-hidden="true">↗</span></a>)}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── about ── */
function useCount(target: number, on: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) return;
    let raf = 0; const t0 = performance.now();
    const f = (t: number) => { const k = Math.min(1, (t - t0) / 1400); setV(Math.round(target * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [target, on]);
  return v;
}
function Big({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => { const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.6 }); io.observe(ref.current!); return () => io.disconnect(); }, []);
  const m = value.match(/^(\D*)(\d+)(.*)$/);
  const n = useCount(m ? Number(m[2]) : 0, on);
  return <span ref={ref}>{m ? `${m[1]}${n}${m[3]}` : value}</span>;
}

const LEVELS = [0, 1, 2, 3, 4];
function Calendar() {
  const days = github.days as { date: string; week: number; weekday: number; level: number; count: number }[];
  const weeks = Math.max(...days.map(d => d.week)) + 1;
  const [tip, setTip] = useState<{ d: (typeof days)[number]; x: number; y: number } | null>(null);
  const months = useMemo(() => {
    const out: { w: number; m: string }[] = [];
    let last = -1;
    for (const d of days) if (d.weekday === 0) { const mm = new Date(d.date).getMonth(); if (mm !== last) { out.push({ w: d.week, m: new Date(d.date).toLocaleString('en', { month: 'short' }) }); last = mm; } }
    return out;
  }, [days]);
  const active = days.filter(d => d.count > 0).length;
  const busiest = days.reduce((a, d) => (d.count > a.count ? d : a), days[0]);
  const user = of('github')[0]?.user ?? 'github';
  return (
    <div className="cal card" data-reveal>
      <div className="cal-head">
        <div><p className="card-k">A year on GitHub</p><p className="cal-total"><b>{github.total}</b> contributions on <b>{active}</b> days</p></div>
        <a href={`https://github.com/${user}`} {...ext} className="btn btn-line btn-sm">github.com/{user} <span aria-hidden="true">↗</span></a>
      </div>
      <div className="cal-scroll">
        <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} onMouseLeave={() => setTip(null)}>
          {months.map(m => <span key={`${m.w}${m.m}`} className="cal-m" style={{ gridColumn: m.w + 1 }}>{m.m}</span>)}
          {days.map(d => (
            <i key={d.date} className={`lv${d.level}`} style={{ gridColumn: d.week + 1, gridRow: d.weekday + 2 }}
              onMouseEnter={e => { const r = (e.target as HTMLElement).getBoundingClientRect(); setTip({ d, x: r.left + r.width / 2, y: r.top }); }} />
          ))}
        </div>
      </div>
      <div className="cal-foot">
        <span>Busiest day: {new Date(busiest.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, {busiest.count} contributions</span>
        <span className="cal-key">less {LEVELS.map(l => <i key={l} className={`lv${l}`} />)} more</span>
      </div>
      {tip && <p className="cal-tip" style={{ left: tip.x, top: tip.y }}>{tip.d.count || 'No'} contribution{tip.d.count === 1 ? '' : 's'} · {new Date(tip.d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>}
    </div>
  );
}

function About() {
  const skills = of('skills')[0];
  return (
    <section className="sec" id="about">
      <SecHead n="02" k="About" title={<>The backend, the interface, <em>and the wire between.</em></>} />
      <div className="about" data-reveal>
        <div className="about-text">{site.page.about.map((p, i) => <p key={i}>{p}</p>)}</div>
        <div className="about-desk" aria-hidden="true">
          <img src={toySrc('terminal')} alt="" className="desk desk-1" />
          <img src={toySrc('chip')} alt="" className="desk desk-2" />
          <img src={toySrc('server')} alt="" className="desk desk-3" />
          <span className="desk-note">my desk, roughly</span>
        </div>
      </div>
      <div className="nums">
        {site.page.highlights.map(h => (
          <div key={h.label} className="num" data-reveal>
            <p className="num-v"><Big value={h.value} /></p>
            <p className="num-l">{h.label}</p>
            <p className="num-n">{h.note}</p>
          </div>
        ))}
      </div>
      <Calendar />
      {skills && (
        <div className="kit">
          <p className="kit-k" data-reveal>The toolbox</p>
          <div className="kit-grid">
            {skills.groups.map(g => (
              <div key={g.name} className="kit-card card" data-reveal>
                <img src={toySrc(g.toy ?? 'gear')} alt="" className="kit-toy" />
                <p className="card-k">{g.name}</p>
                <ul className="chips">{g.items.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ── experience ── */
function Experience() {
  const roles = of('experience').flatMap(e => e.roles);
  const edu = of('education');
  const stats = of('stats');
  return (
    <section className="sec" id="experience">
      <SecHead n="03" k="Experience" title={<>Where I’ve been <em>building.</em></>} />
      <ol className="tl">
        {roles.map(r => (
          <li key={r.org + r.role} className="tl-item" data-reveal>
            <div className="tl-side"><img src={toySrc('terminal')} alt="" /><p className="tl-when">{r.period}</p></div>
            <div className="tl-body card">
              <p className="card-k">{r.place}</p>
              <h3 className="tl-h">{r.role} · {r.url ? <a href={r.url} {...ext}>{r.org}</a> : r.org}</h3>
              <ul className="chips">{r.stack.split(', ').map(s => <li key={s}>{s}</li>)}</ul>
              <ul className="proj-points">{r.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          </li>
        ))}
        {edu.map(e => (
          <li key={e.school} className="tl-item" data-reveal>
            <div className="tl-side"><img src={toySrc('globe')} alt="" /><p className="tl-when">{e.period ?? 'Education'}</p></div>
            <div className="tl-body card">
              <p className="card-k">{e.title} · {e.place}</p>
              <h3 className="tl-h">{e.school}</h3>
              <p className="tl-p">{e.degree}</p>
            </div>
          </li>
        ))}
      </ol>
      {stats.map(s => (
        <div key={s.title} className="cp card" data-reveal>
          <div className="cp-head"><img src={toySrc('chip')} alt="" /><div><p className="card-k">Practice</p><h3 className="tl-h">{s.title}</h3></div></div>
          <div className="cp-grid">
            {s.items.map(it => (
              <a key={it.label} href={it.url} {...ext} className="cp-item">
                <span className="cp-v">{it.display}</span>
                <span className="cp-l">{it.label} <span aria-hidden="true">↗</span></span>
                <span className="cp-n">{it.note}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ── the door into the world ── */
function Portal() {
  return (
    <section className="portal" aria-labelledby="portal-h">
      <a className="portal-card" href={WORLD} data-reveal>
        <div className="portal-art" aria-hidden="true"><img src="/loading/art-01.webp" alt="" /></div>
        <div className="portal-text">
          <p className="portal-k"><Mark />04 · The world</p>
          <h2 id="portal-h">Prefer to explore? <em>There’s a whole world.</em></h2>
          <p>Every part of this page is also a floating island. Fly a drone between them, follow the rope bridges, listen for the waterfalls and find the lighthouse.</p>
          <span className="btn btn-light">Enter the 3D world <span aria-hidden="true">↗</span></span>
          <p className="portal-note">Best on a laptop or desktop, with sound on.</p>
        </div>
      </a>
    </section>
  );
}

/* ── contact ── */
function Contact() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(site.email); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { location.href = `mailto:${site.email}`; }
  };
  return (
    <section className="sec contact" id="contact">
      <div className="contact-toys" aria-hidden="true">
        <img src={toySrc('envelope')} alt="" className="ct ct-1" /><img src={toySrc('packet')} alt="" className="ct ct-2" /><img src={toySrc('router')} alt="" className="ct ct-3" />
      </div>
      <p className="sec-k" data-reveal><span className="sec-n">05</span>Contact</p>
      <h2 className="contact-h" data-reveal>Let’s build something that <em>stays up.</em></h2>
      <p className="contact-lead" data-reveal>The quickest way to reach me is email.</p>
      <div className="contact-row" data-reveal>
        <button className={`mail${copied ? ' is-copied' : ''}`} onClick={copy}>
          <span className="mail-addr">{site.email}</span>
          <span className="mail-act">{copied ? 'Copied ✓' : 'Copy'}</span>
        </button>
        <a className="btn btn-line" href={`mailto:${site.email}`}>Write an email</a>
        {site.links.map(l => <a key={l.url} className="btn btn-line" href={l.url} {...ext}>{l.label} <span aria-hidden="true">↗</span></a>)}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="foot">
      <p className="foot-status"><span className="dot" />All systems operational</p>
      <p>© {new Date().getFullYear()} {site.name}</p>
      <p>Built by hand: React, TypeScript, and sixteen toys rendered from signed distance fields. <a href={WORLD}>The world ↗</a></p>
    </footer>
  );
}

export function Landing() {
  useReveal();
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Work />
        <About />
        <Experience />
        <Portal />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
