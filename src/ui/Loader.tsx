import { useEffect, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { useUI } from '../store';

/**
 * Takes over the loading screen that index.html painted: feeds it the real download progress (the rope pays
 * out, the digits roll), and once everything is in and the world has drawn its first frames, lets the stills
 * dissolve into the live opening shot.
 */
export function Loader() {
  const { progress, active } = useProgress();
  const shown = useRef(0);
  const finished = useRef(false);

  // the screen is ours now: it will not show the failure message unless we say so
  useEffect(() => { document.getElementById('loading')?.classList.add('live'); }, []);

  useEffect(() => {
    const L = document.getElementById('loading');
    if (!L) return;
    // never go backwards, and keep a little in hand until the world has really been built
    const target = Math.max(shown.current, Math.min(active ? 96 : 100, progress));
    shown.current = target;
    const p = Math.round(target);
    L.querySelector<HTMLElement>('.ld-line')?.style.setProperty('--p', String(Math.max(0.04, p / 100)));
    L.querySelector('.ld-line')?.setAttribute('aria-valuenow', String(p));
    const cols = L.querySelectorAll<HTMLElement>('.ld-pct .col b');
    if (cols.length === 2) {
      cols[0].style.transform = `translateY(${-Math.floor(p / 10) * 10}%)`;
      cols[1].style.transform = `translateY(${-(p % 10) * 10}%)`;
    }
    if (!active && progress >= 100 && !finished.current) {
      finished.current = true;
      // two frames for the first draw, a moment to read 100%, then the hand-off
      requestAnimationFrame(() => requestAnimationFrame(() => {
        L.classList.add('done');
        L.setAttribute('aria-busy', 'false');
        setTimeout(() => {
          useUI.getState().set({ loaded: true });
          L.classList.add('leaving');
          setTimeout(() => L.remove(), 1700);
        }, 650);
      }));
    }
  }, [progress, active]);

  return null;
}
