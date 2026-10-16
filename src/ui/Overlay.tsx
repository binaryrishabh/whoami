import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { site, type Island } from '../site.config';
import github from '../data/github.json';
import { useUI } from '../store';
import { flyTo } from '../world/Drone';
import { PLACED } from '../world/layout';
import { openingSeconds } from '../world/CameraRig';
import { sound } from '../audio';
import { Joystick } from './Joystick';

const ext = { target: '_blank', rel: 'noopener' } as const;

function Links({ items }: { items: { label: string; url: string }[] }) {
  if (!items.length) return null;
  return <p className="p-links">{items.map(l => <a key={l.url} href={l.url} {...ext}>{l.label}<span aria-hidden="true"> ↗</span></a>)}</p>;
}

function Content({ island }: { island: Island }) {
  switch (island.kind) {
    case 'about':
      return (<>
        <h2 className="p-title">{site.name}</h2>
        <p className="p-meta">{site.role} · {site.location}</p>
        <p className="p-lead">{site.summary}</p>
        <Links items={[...site.links, { label: 'Email', url: `mailto:${site.email}` }]} />
      </>);
    case 'experience':
      return (<>
        <p className="p-kind">{island.title}</p>
        {island.roles.map(r => (
          <div key={r.org} className="p-block">
            <h2 className="p-title">{r.role}</h2>
            <p className="p-meta">{r.url ? <a href={r.url} {...ext}>{r.org}</a> : r.org} · {r.period} · {r.place}</p>
            <p className="p-stack">{r.stack}</p>
            <ul className="p-list">{r.points.map((pt, i) => <li key={i}>{pt}</li>)}</ul>
          </div>
        ))}
      </>);
    case 'project':
      return (<>
        <p className="p-kind">Project</p>
        <h2 className="p-title">{island.title}</h2>
        <p className="p-stack">{island.stack}</p>
        <ul className="p-list">{island.points.map((pt, i) => <li key={i}>{pt}</li>)}</ul>
        <Links items={island.links} />
      </>);
    case 'skills':
      return (<>
        <h2 className="p-title">{island.title}</h2>
        <dl className="p-skills">{island.groups.map(g => <div key={g.name}><dt>{g.name}</dt><dd>{g.items.join(' · ')}</dd></div>)}</dl>
      </>);
    case 'stats':
      return (<>
        <h2 className="p-title">{island.title}</h2>
        <ul className="p-stats">{island.items.map(s => <li key={s.label}><span className="p-num">{s.display}</span><span><a href={s.url} {...ext}>{s.label}</a><small>{s.note}</small></span></li>)}</ul>
      </>);
    case 'github': {
      const busiest = github.days.reduce((a, d) => (d.count > a.count ? d : a), github.days[0]);
      const active = github.days.filter(d => d.count > 0).length;
      return (<>
        <h2 className="p-title">{island.title}</h2>
        <p className="p-lead">{github.total} contributions over the last year, on {active} different days. The dial on this island is that year: a spoke for every week, a stone for every day, taller and greener on busier days.</p>
        <p className="p-meta">Busiest day: {new Date(busiest.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}, {busiest.count} contributions</p>
        <Links items={[{ label: `github.com/${island.user}`, url: `https://github.com/${island.user}` }]} />
      </>);
    }
    case 'education':
      return (<>
        <p className="p-kind">{island.title}</p>
        <h2 className="p-title">{island.school}</h2>
        <p className="p-lead">{island.degree}</p>
        <p className="p-meta">{island.period} · {island.place}</p>
      </>);
    case 'contact':
      return (<>
        <h2 className="p-title">{island.title}</h2>
        <p className="p-lead">The quickest way to reach me is email.</p>
        <p className="p-mail"><a href={`mailto:${site.email}`}>{site.email}</a></p>
        <Links items={site.links} />
        <p className="p-credits">Made with three.js. Rock, grass, concrete and timber from Poly Haven; leaves from ambientCG; sounds recorded by Freesound members. All CC0, see <a href="/audio/credits.json" {...ext}>credits</a>.</p>
      </>);
  }
}

const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const nameOf = (i: number) => (PLACED[i].island.kind === 'about' ? 'Home' : PLACED[i].island.title);

export function Overlay() {
  const { active, loaded, started, sound: soundOn, overview, flown, set } = useUI();
  const { progress } = useProgress();
  const [shown, setShown] = useState(-1);
  const [sheetOpen, setSheetOpen] = useState(true);
  // keep the last island's card up briefly while flying between islands
  useEffect(() => {
    if (active >= 0) { setShown(active); setSheetOpen(true); sound.tap(0.25); return; }
    const t = setTimeout(() => setShown(-1), 900);
    return () => clearTimeout(t);
  }, [active]);
  // the intro card waits for the opening shot to settle
  const [introReady, setIntroReady] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setIntroReady(true), openingSeconds * 1000 * 0.72);
    return () => clearTimeout(t);
  }, [loaded]);
  // sound can only start after the visitor touches the page
  useEffect(() => {
    const go = () => { void sound.start(); };
    addEventListener('pointerdown', go, { once: true }); addEventListener('keydown', go, { once: true });
    const keys = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
      if (e.key.toLowerCase() === 'm') { useUI.getState().set({ overview: !useUI.getState().overview, started: true }); sound.tap(0.3); }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'e', 'q'].includes(e.key.toLowerCase())) useUI.getState().set({ overview: false, flown: true });
    };
    addEventListener('keydown', keys);
    return () => { removeEventListener('pointerdown', go); removeEventListener('keydown', go); removeEventListener('keydown', keys); };
  }, []);
  // the controls hint fades once the visitor has flown a little
  const [hintGone, setHintGone] = useState(false);
  useEffect(() => { if (!flown) return; const t = setTimeout(() => setHintGone(true), 6000); return () => clearTimeout(t); }, [flown]);

  const go = (i: number) => { sound.tap(); set({ started: true, overview: false }); flyTo(i); };
  const island = shown >= 0 ? PLACED[shown]?.island : null;
  const n = PLACED.length;
  const toggleSound = () => { const on = !soundOn; void sound.start(); sound.setEnabled(on); set({ sound: on }); };

  return (
    <>
      <div className={`loader${loaded ? ' is-done' : ''}`} aria-hidden={loaded}>
        <div className="loader-in">
          <h2>{site.name}</h2>
          <p>Raising the islands…</p>
          <div className="loader-bar"><i style={{ width: `${Math.round(progress)}%` }} /></div>
        </div>
      </div>

      {loaded && (
        <nav className="bar" aria-label="World">
          <button className={`chip${overview ? ' is-on' : ''}`} onClick={() => { sound.tap(0.3); set({ overview: !overview, started: true }); }} aria-pressed={overview}>Map</button>
          <button className="chip" onClick={toggleSound} aria-pressed={soundOn}>{soundOn ? 'Sound on' : 'Sound off'}</button>
        </nav>
      )}

      {!started && loaded && introReady && (
        <section className="intro" aria-label="Introduction">
          <h1>{site.name}</h1>
          <p>{site.role}. This portfolio is a small world of floating islands, one for each part of my work.</p>
          {touch ? (
            <ul className="keys">
              <li>Drag the stick to fly, the arrows to rise and sink</li>
              <li>Or tap any island’s name to fly there</li>
            </ul>
          ) : (
            <ul className="keys">
              <li><kbd>W</kbd><kbd>S</kbd> or <kbd>↑</kbd><kbd>↓</kbd> fly forward and back</li>
              <li><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd> turn</li>
              <li><kbd>Space</kbd> rise · <kbd>Shift</kbd> sink · drag to look around</li>
              <li><kbd>M</kbd> map · or click any island’s name to fly there</li>
            </ul>
          )}
          <button className="go" onClick={() => { void sound.start(); go(1); }}>Take off</button>
        </section>
      )}

      {started && island && !overview && (
        <aside className={`panel${active >= 0 ? ' is-open' : ''}${sheetOpen ? '' : ' is-folded'}`} key={shown} aria-live="polite">
          {touch && <button className="p-fold" onClick={() => setSheetOpen(o => !o)} aria-expanded={sheetOpen}>{sheetOpen ? 'Hide' : nameOf(shown)}</button>}
          <div className="p-body"><Content island={island} /></div>
          <div className="p-nav">
            <button onClick={() => go((shown + n - 1) % n)}>← {nameOf((shown + n - 1) % n)}</button>
            <button onClick={() => go((shown + 1) % n)}>{nameOf((shown + 1) % n)} →</button>
          </div>
        </aside>
      )}

      {started && touch && !(island && sheetOpen && active >= 0) && <Joystick />}

      {started && !touch && !hintGone && <p className="hint" aria-hidden="true">W A S D or arrows to fly · Space / Shift up and down · drag to look · M for the map</p>}
    </>
  );
}
