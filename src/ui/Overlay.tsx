import { useCallback, useEffect, useState } from 'react';
import { site, type Island } from '../site.config';
import github from '../data/github.json';
import { useUI } from '../store';
import { flyTo } from '../world/Drone';
import { PLACED } from '../world/layout';
import { openingSeconds } from '../world/CameraRig';
import { sound } from '../audio';
import { Joystick } from './Joystick';
import { Title, Arrival } from './Screens';

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
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const numberWord = (k: number) => WORDS[k] ?? String(k);
const nameOf = (i: number) => (PLACED[i].island.kind === 'about' ? 'Home' : PLACED[i].island.title);

export function Overlay() {
  const { active, loaded, started, sound: soundOn, overview, flown, set } = useUI();
  const [shown, setShown] = useState(-1);
  const [sheetOpen, setSheetOpen] = useState(true);
  // keep the last island's card up briefly while flying between islands
  useEffect(() => {
    if (active >= 0) { setShown(active); setSheetOpen(true); sound.tap(0.25); return; }
    const t = setTimeout(() => setShown(-1), 900);
    return () => clearTimeout(t);
  }, [active]);
  // the title waits for the opening shot to settle
  const [introReady, setIntroReady] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setIntroReady(true), openingSeconds * 1000 * 0.62);
    return () => clearTimeout(t);
  }, [loaded]);
  // sound can only start after the visitor touches the page
  useEffect(() => {
    const go = () => { void sound.start(); };
    addEventListener('pointerdown', go, { once: true }); addEventListener('keydown', go, { once: true });
    const keys = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
      if (e.key === 'Escape' && useUI.getState().overview) useUI.getState().set({ overview: false });
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
  const begin = useCallback(() => { void sound.start(); go(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const island = shown >= 0 ? PLACED[shown]?.island : null;
  const n = PLACED.length;
  const toggleSound = () => { const on = !soundOn; void sound.start(); sound.setEnabled(on); set({ sound: on }); };

  return (
    <>
      {loaded && (
        <nav className="bar" aria-label="World">
          <button className={`chip${overview ? ' is-on' : ''}`} onClick={() => { sound.tap(0.3); set({ overview: !overview, started: true }); }} aria-pressed={overview}><kbd>M</kbd>Map</button>
          <button className="chip" onClick={toggleSound} aria-pressed={soundOn}>{soundOn ? 'Sound on' : 'Sound off'}</button>
        </nav>
      )}

      {!started && loaded && introReady && <Title onBegin={begin} />}
      {started && <Arrival />}

      {overview && (
        <aside className="atlas" aria-label="All islands">
          <p className="at-kicker">The map</p>
          <h2 className="at-title">{numberWord(n)} islands</h2>
          <p className="at-lead">Click a name, here or over its island, and the drone flies you there.</p>
          <ol className="at-list">
            {PLACED.map((p, i) => (
              <li key={i}>
                <button className={i === active ? 'is-here' : ''} onClick={() => go(i)}>
                  <span className="at-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="at-name">{nameOf(i)}</span>
                  {i === active && <span className="at-here">You are here</span>}
                </button>
              </li>
            ))}
          </ol>
          <p className="at-keys"><kbd>M</kbd> or <kbd>Esc</kbd> to close <span>·</span> drag to turn the world</p>
        </aside>
      )}

      {started && island && !overview && (
        <aside className={`panel${active >= 0 ? ' is-open' : ''}${sheetOpen ? '' : ' is-folded'}`} key={shown} aria-live="polite">
          {touch && <button className="p-fold" onClick={() => setSheetOpen(o => !o)} aria-expanded={sheetOpen}>{sheetOpen ? 'Hide' : nameOf(shown)}</button>}
          <div className="p-body"><p className="p-count"><b>{String(shown + 1).padStart(2, '0')}</b> / {String(n).padStart(2, '0')}</p><Content island={island} /></div>
          <div className="p-nav">
            <button onClick={() => go((shown + n - 1) % n)}>← {nameOf((shown + n - 1) % n)}</button>
            <button onClick={() => go((shown + 1) % n)}>{nameOf((shown + 1) % n)} →</button>
          </div>
        </aside>
      )}

      {started && touch && !(island && sheetOpen && active >= 0) && <Joystick />}

      {started && !touch && !hintGone && !overview && (
        <p className="hint" aria-hidden="true"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><b>Fly</b><span>Space and Shift to rise and sink · drag to look</span></p>
      )}
    </>
  );
}
