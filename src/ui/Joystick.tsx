import { useRef, useState } from 'react';
import { joystick } from '../world/Drone';
import { useUI } from '../store';
import { sound } from '../audio';

/** touch controls: a stick to fly and turn, and two buttons to rise and sink */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);

  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    setKnob({ x, y });
    joystick.x = Math.abs(x) > 0.12 ? x : 0;
    joystick.y = Math.abs(y) > 0.12 ? -y : 0;
  };
  const end = () => { id.current = null; setKnob({ x: 0, y: 0 }); joystick.x = 0; joystick.y = 0; };
  const hold = (v: number) => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); joystick.up = v; useUI.getState().set({ started: true }); void sound.start(); },
    onPointerUp: () => { joystick.up = 0; }, onPointerCancel: () => { joystick.up = 0; },
  });

  return (
    <div className="joy">
      <div
        ref={base} className="joy-base" aria-label="Fly: drag to move and turn" role="application"
        onPointerDown={e => { id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); useUI.getState().set({ started: true }); void sound.start(); move(e); }}
        onPointerMove={e => { if (id.current === e.pointerId) move(e); }}
        onPointerUp={end} onPointerCancel={end}
      >
        <span className="joy-knob" style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
      </div>
      <div className="joy-lift">
        <button aria-label="Rise" {...hold(1)}>↑</button>
        <button aria-label="Sink" {...hold(-1)}>↓</button>
      </div>
    </div>
  );
}
