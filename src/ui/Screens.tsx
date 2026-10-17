import { useEffect, useState } from 'react';
import { site, type Island } from '../site.config';
import { useUI } from '../store';
import { PLACED } from '../world/layout';

/** the small gold mark: an island floating, with a tree on it */
export function Mark({ className = 'mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 12.5h24M7 12.5l4.5 6.5 2.5-2 2 6 2.5-3.5 2 2.5 4.5-9.5M14 12.5V8.5l2-3 2 3v4" />
    </svg>
  );
}

/** a length of twisted rope, the same cord the bridges are made of */
export function Rope({ className = 'rope' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 4000 8" preserveAspectRatio="xMinYMid slice" aria-hidden="true">
      <defs><pattern id="ui-ply" width="12" height="8" patternUnits="userSpaceOnUse"><g fill="none" strokeWidth="2.4" strokeLinecap="round">
        <path d="M-3 6.2C0 6.2 3 1.8 6 1.8M9 6.2C12 6.2 15 1.8 18 1.8" stroke="#7a5233" />
        <path d="M0 1.8C3 1.8 6 6.2 9 6.2" stroke="rgba(10,8,6,0.55)" strokeWidth="3.2" />
        <path d="M0 1.8C3 1.8 6 6.2 9 6.2M-12 1.8C-9 1.8 -6 6.2 -3 6.2M12 1.8C15 1.8 18 6.2 21 6.2" stroke="#c99a5e" />
      </g></pattern></defs>
      <rect width="4000" height="8" fill="url(#ui-ply)" />
    </svg>
  );
}

/* ── the title, over the live world once the opening shot has landed ── */
export function Title({ onBegin }: { onBegin: () => void }) {
  // any key that is not a flight key, or a click that is not a drag, takes off
  useEffect(() => {
    const flight = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'e', 'q', 'm', 'tab', 'control', 'alt', 'meta'];
    const key = (e: KeyboardEvent) => { if (!flight.includes(e.key.toLowerCase())) { e.preventDefault(); onBegin(); } };
    let down: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('button, a, .bar')) down = { x: e.clientX, y: e.clientY }; };
    const pu = (e: PointerEvent) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) onBegin(); down = null; };
    addEventListener('keydown', key); addEventListener('pointerdown', pd); addEventListener('pointerup', pu);
    return () => { removeEventListener('keydown', key); removeEventListener('pointerdown', pd); removeEventListener('pointerup', pu); };
  }, [onBegin]);
  return (
    <section className="title" aria-label="Introduction">
      <div className="t-top">
        <p className="t-kicker"><Mark className="t-mark" />{site.role}</p>
        <h1 className="t-name" aria-label={site.name}>
          {site.name.split(' ').map((w, wi) => (
            <span className="t-word" key={wi}>{[...w].map((ch, i) => <span key={i} style={{ animationDelay: `${0.25 + (wi * 6 + i) * 0.045}s` }}>{ch}</span>)}</span>
          ))}
        </h1>
        <p className="t-tag">{site.tagline}</p>
      </div>
      <div className="t-foot">
        <div className="t-row">
          <button className="t-begin" onClick={onBegin}><span className="t-dash" />Press any key to take off</button>
          <p className="t-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly <span>·</span> <kbd>Space</kbd><kbd>Shift</kbd> rise and sink <span>·</span> <kbd>M</kbd> map <span>·</span> drag to look</p>
        </div>
        <Rope className="t-rope" />
      </div>
    </section>
  );
}

/* ── when the camera settles on an island: its name, large, and one line under it ── */
const DEFAULT_TAGLINE: Record<Island['kind'], string> = {
  about: 'Where the journey starts',
  experience: 'Where the work happens',
  project: 'Something I built',
  skills: 'One stone for every tool',
  stats: 'Towers that grow with the numbers',
  github: 'A year, one stone a day',
  education: 'Where it started',
  contact: 'The light is always on',
};

export function Arrival() {
  const arrived = useUI(s => s.arrived);
  const overview = useUI(s => s.overview);
  const [card, setCard] = useState<{ i: number; key: number } | null>(null);
  useEffect(() => {
    if (arrived < 0) return;
    setCard({ i: arrived, key: Date.now() });
    const t = setTimeout(() => setCard(null), 4800);
    return () => clearTimeout(t);
  }, [arrived]);
  if (!card || overview) return null;
  const island = PLACED[card.i].island;
  const title = island.kind === 'about' ? site.name : island.title;
  const kicker = island.kind === 'project' ? 'Project' : island.kind === 'about' ? 'Home' : `${String(card.i + 1).padStart(2, '0')}`;
  return (
    <div className="arrival" key={card.key} aria-hidden="true">
      <p className="a-kicker">{kicker}</p>
      <div className="a-rule"><span /><Mark className="a-mark" /><span /></div>
      <h2 className="a-title">{title}</h2>
      <p className="a-tag">{island.tagline ?? DEFAULT_TAGLINE[island.kind]}</p>
    </div>
  );
}

/* ── too small a window for the world: say so, beautifully, and still give every way to get in touch ── */
export const MIN_W = 960, MIN_H = 560;
export function useRoomy() {
  const fits = () => innerWidth >= MIN_W && innerHeight >= MIN_H;
  const [roomy, setRoomy] = useState(fits);
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const r = () => { setRoomy(fits()); setSize({ w: innerWidth, h: innerHeight }); };
    addEventListener('resize', r);
    return () => removeEventListener('resize', r);
  }, []);
  return { roomy, size };
}

export function RoomScreen({ size }: { size: { w: number; h: number } }) {
  const needW = size.w < MIN_W, needH = size.h < MIN_H;
  const mail = `mailto:${site.email}`;
  return (
    <main className="room" aria-labelledby="room-h">
      <div className="room-art" aria-hidden="true" />
      <div className="room-shade" aria-hidden="true" />
      <header className="room-mark"><Mark className="room-glyph" /><span>{site.name.toUpperCase()}</span></header>
      <section className="room-body">
        <div className="room-frame" aria-hidden="true"><i /><b /><b /></div>
        <p className="room-kicker">{site.role}</p>
        <h1 id="room-h">This world needs a little more room.</h1>
        <p className="room-lead">The portfolio is a small world of floating islands you fly between, and it is built for a wider screen. {needW && needH ? 'Make the window wider and taller' : needW ? 'Make the window wider' : 'Make the window taller'}, or open it on a laptop or desktop.</p>
        <p className="room-size"><span>This window</span> {size.w} × {size.h} <span>· needs</span> {MIN_W} × {MIN_H}</p>
        <Rope className="room-rope" />
        <p className="room-meanwhile">Meanwhile</p>
        <p className="room-links">
          <a href={mail}>{site.email}</a>
          {site.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noopener">{l.label} ↗</a>)}
        </p>
      </section>
    </main>
  );
}
