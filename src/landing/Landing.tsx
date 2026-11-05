import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { site, type Island } from '../site.config';
import github from '../data/github.json';
import { FloatToy, toySrc } from './Toy';
import { System } from './System';
import { Blueprint, InfraCanvas, RecipeDiff, ToyGroup } from './Visuals';

const WORLD = '/world/';
const ext = { target: '_blank', rel: 'noopener' } as const;
type Of<K extends Island['kind']> = Extract<Island, { kind: K }>;
const of = <K extends Island['kind']>(k: K) => site.islands.filter(i => i.kind === k) as Of<K>[];

/** *stars* become the accent colour; with `rise`, every word lifts into place one after another */
function rich(text: string, rise = false) {
  let n = 0;
  return text.split(/(\*[^*]+\*)/).filter(Boolean).map((part, i) => {
    const hot = part.startsWith('*'), body = hot ? part.slice(1, -1) : part;
    const words = body.split(/(\s+)/).map((w, j) => (w === '/' ? <br key={j} /> : /^\s+$/.test(w) || !rise ? <Fragment key={j}>{w}</Fragment>
      : <span key={j} className="w"><span style={{ animationDelay: `${0.12 + n++ * 0.07}s` }}>{w}</span></span>));
    return hot ? <em key={i}>{words}</em> : <Fragment key={i}>{words}</Fragment>;
  });
}

/** adds .is-in to anything with data-reveal as it scrolls into view */
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
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
      <a className="brand" href="#top" aria-label={`${site.name}, back to top`}><i>{site.name[0]}</i><span>{site.name}</span></a>
      <nav className="links" aria-label="Sections">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className={here === id ? 'is-here' : ''} onClick={() => setOpen(false)}>{label}</a>)}
      </nav>
      <a className="btn btn-dark btn-nav" href={WORLD}><span className="blip" />3D world <span aria-hidden="true">↗</span></a>
      <button className="menu" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(o => !o)}><i /><i /></button>
    </header>
  );
}

/* ── hero: the claim on the left, the proof on the right ── */
function Hero() {
  const [first] = site.location.split(' · ');
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="kick"><span className="dot" />{site.role} · {first}</p>
        <h1 className="hero-h">{rich(site.page.headline, true)}</h1>
        <p className="hero-intro">{site.page.intro}</p>
        <div className="hero-cta">
          <a className="btn btn-dark" href="#work">See my work <span aria-hidden="true">↓</span></a>
          <a className="btn btn-light" href={WORLD}>Enter the 3D world <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <ol className="proofs" aria-label="Before and after">
        {site.page.proofs.map((p, i) => (
          <li key={p.label} className="proof" style={{ '--i': i } as CSSProperties}>
            <p className="label">{p.label}</p>
            <p className="ba"><s>{p.from}</s><span className="arr" aria-label="to">→</span><b>{p.to}</b></p>
            <img src={toySrc(p.toy)} alt="" draggable={false} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Head({ n, k, title, lead, center }: { n: string; k: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <div className={`head${center ? ' is-center' : ''}`} data-reveal>
      <p className="label"><span className="num">{n}</span>{k}</p>
      <h2 className="h2">{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}
const Stack = ({ items }: { items: string[] }) => <ul className="stack">{items.map(s => <li key={s}>{s}</li>)}</ul>;

/* ── the live system ── */
function Live() {
  return (
    <section className="sec" id="live">
      <div className="live-toys">
        <FloatToy name="cloud" size={128} style={{ right: '2%', top: 6 }} depth={1.2} delay={0.1} tilt={-4} says={['multi-AZ, obviously', 'it’s someone else’s computer', 'scaling to zero…']} alt="A toy cloud" />
      </div>
      <Head n="01" k="Live" title={<>Go on, <em>break something.</em></>} lead="A small system is running in your browser right now. Kill a server and the load balancer routes around it. Flush the cache and watch latency climb." />
      <div data-reveal><System /></div>
    </section>
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
      <Head n="02" k="Work" title={<>Things I’ve <em>built.</em></>} lead="Each one comes with a small moving sketch of what the code actually does." />
      <div className="work">
        {projects.map((p, i) => (
          <article key={p.title} className={`proj${i % 2 ? ' is-flip' : ''}`} data-reveal>
            <div className="proj-vis"><Visual p={p} /></div>
            <div className="proj-text">
              <p className="label">Project {String(i + 1).padStart(2, '0')}</p>
              <h3 className="h3">{p.title}</h3>
              <Stack items={p.stack.split(', ')} />
              <ul className="points">{p.points.map((pt, j) => <li key={j}>{pt}</li>)}</ul>
              {p.links.length > 0 && <p className="row">{p.links.map(l => <a key={l.url} href={l.url} {...ext} className="btn btn-light btn-sm">{l.label} <span aria-hidden="true">↗</span></a>)}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── about: a short note, the GitHub year, the toolbox ── */
const LEVELS = [0, 1, 2, 3, 4];
type Cal = { total: number; updated: string; days: { date: string; week: number; weekday: number; level: number; count: number }[] };
/** the live calendar from /api/github; until it arrives (or if it can't), the snapshot saved at build time */
function useGithub(user: string) {
  const [data, setData] = useState<Cal & { live: boolean }>({ ...(github as Cal), live: false });
  useEffect(() => {
    let gone = false;
    fetch(`/api/github?user=${encodeURIComponent(user)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Cal) => { if (!gone && d.days?.length) setData({ ...d, live: true }); })
      .catch(() => {});
    return () => { gone = true; };
  }, [user]);
  return data;
}
function Calendar() {
  const user = of('github')[0]?.user ?? 'binaryrishabh';
  const gh = useGithub(user);
  const days = gh.days;
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
  return (
    <div className="panel cal" data-reveal>
      <div className="panel-head">
        <div>
          <p className="label">A year on GitHub {gh.live && <span className="live"><i />live</span>}</p>
          <p className="cal-total"><b>{gh.total.toLocaleString('en-US')}</b> contributions on <b>{active}</b> days</p>
        </div>
        <a href={`https://github.com/${user}`} {...ext} className="btn btn-light btn-sm">github.com/{user} <span aria-hidden="true">↗</span></a>
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
      <div className="about">
        <Head n="03" k="About" title={<>Where the backend <em>meets the screen.</em></>} />
        <div className="about-body" data-reveal>
          {site.page.about.map((p, i) => <p key={i} className={i ? '' : 'big'}>{p}</p>)}
        </div>
      </div>
      <Calendar />
      {skills && (
        <div className="panel kit" data-reveal>
          <p className="label">The toolbox</p>
          {skills.groups.map(g => (
            <div key={g.name} className="kit-row">
              <img src={toySrc(g.toy ?? 'gear')} alt="" />
              <p className="kit-name">{g.name}</p>
              <Stack items={g.items} />
            </div>
          ))}
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
      <Head n="04" k="Experience" title={<>Where I’ve <em>worked.</em></>} />
      <ol className="tl">
        {roles.map(r => (
          <li key={r.org + r.role} className="panel tl-item" data-reveal>
            <div className="tl-side"><img src={toySrc('terminal')} alt="" /><p className="when">{r.period}</p><p className="where">{r.place}</p></div>
            <div>
              <h3 className="h3">{r.role}, {r.url ? <a href={r.url} {...ext}>{r.org}</a> : r.org}</h3>
              <Stack items={r.stack.split(', ')} />
              <ul className="points">{r.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          </li>
        ))}
        {edu.map(e => (
          <li key={e.school} className="panel tl-item" data-reveal>
            <div className="tl-side"><img src={toySrc('globe')} alt="" /><p className="when">{e.period ?? 'Education'}</p><p className="where">{e.place}</p></div>
            <div><h3 className="h3">{e.school}</h3><p className="tl-p">{e.degree}</p></div>
          </li>
        ))}
      </ol>
      {stats.map(s => (
        <div key={s.title} className="cp" data-reveal>
          <p className="label">{s.title}</p>
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
    <section className="sec">
      <a className="portal" href={WORLD} data-reveal>
        <div className="portal-art" aria-hidden="true"><img src="/loading/art-01.webp" alt="" /></div>
        <div className="portal-text">
          <p className="label"><span className="num">05</span>The 3D world</p>
          <h2 className="h2">Rather explore? <em>Fly through it.</em></h2>
          <p>Every section of this page is also a floating island. Fly a drone between them, cross the rope bridges and find the lighthouse.</p>
          <span className="btn btn-light">Enter the 3D world <span aria-hidden="true">↗</span></span>
          <p className="note">Best on a laptop or desktop, with sound on.</p>
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
      <FloatToy name="envelope" size={130} style={{ left: '3%', top: 90 }} depth={1.4} tilt={-12} says={['POST /contact 201', 'delivered, at least once']} alt="A toy envelope" />
      <FloatToy name="router" size={120} style={{ right: '4%', top: 150 }} depth={1.8} delay={0.3} tilt={9} says={['200 OK', 'routing you to my inbox']} alt="A toy router" />
      <p className="label is-center" data-reveal><span className="num">06</span>Contact</p>
      <h2 className="contact-h" data-reveal>{rich(site.page.contact)}</h2>
      <p className="lead is-center" data-reveal>Send it over. The quickest way to reach me is email.</p>
      <div className="row is-center" data-reveal>
        <button className={`mail${copied ? ' is-copied' : ''}`} onClick={copy}>
          <span>{site.email}</span><span className="mail-act">{copied ? 'Copied ✓' : 'Copy'}</span>
        </button>
        {site.links.map(l => <a key={l.url} className="btn btn-light" href={l.url} {...ext}>{l.label} <span aria-hidden="true">↗</span></a>)}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="foot">
      <p className="ok"><span className="dot" />All systems operational</p>
      <p>© {new Date().getFullYear()} {site.name}</p>
      <p><a href={WORLD}>The 3D world ↗</a></p>
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
        <Live />
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
