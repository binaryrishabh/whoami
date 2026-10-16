import { create } from 'zustand';
import * as THREE from 'three';
import { sound } from './audio';

/** live drone state, written every frame by the drone and read by the camera and the UI */
export const drone = {
  pos: new THREE.Vector3(0.6, 3.6, 7.5),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  /** autopilot target (world point to hover over), or null */
  target: null as THREE.Vector3 | null,
  /** true while a key or the joystick is steering */
  input: false,
};

export type UIState = {
  active: number;          // island the drone is over, -1 for open sky
  loaded: boolean;
  started: boolean;        // the intro has been dismissed
  sound: boolean;
  overview: boolean;        // the whole world from high up, every island labelled
  flown: boolean;           // the visitor has steered at least once
  set: (p: Partial<UIState>) => void;
};

export const useUI = create<UIState>(set => ({
  active: 0,
  loaded: false,
  started: false,
  sound: sound.enabled,
  overview: false,
  flown: false,
  set: p => set(p),
}));
