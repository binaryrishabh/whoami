import { useFrame } from '@react-three/fiber';
import { PLACED, type Placed } from './layout';
import { Structures } from './Structures';
import { Forest } from './Forest';
import { Grounds, Water, Debris, Bridges } from './Features';
import { useMaterials, wind, type Mats } from './materials';

function IslandBody({ placed, mats }: { placed: Placed; mats: Mats }) {
  return (
    <group position={placed.pos} rotation={[0, placed.rot, 0]}>
      <mesh geometry={placed.geo.top} material={mats.turf} receiveShadow castShadow />
      <mesh geometry={placed.geo.under} material={mats.rock} receiveShadow castShadow />
      <Structures placed={placed} mats={mats} />
    </group>
  );
}

/** the islands and everything on them; trees, paths and water are each one draw across the world */
export function World({ off = new Set<string>() }: { off?: Set<string> }) {
  const mats = useMaterials();
  useFrame((_, dt) => { wind.value += dt; });
  return (
    <group>
      {PLACED.map(p => <IslandBody key={p.index} placed={p} mats={mats} />)}
      {!off.has('trees') && <Forest mats={mats} />}
      {!off.has('grounds') && <Grounds mats={mats} />}
      {!off.has('water') && <Water />}
      {!off.has('islets') && <Debris mats={mats} />}
      <Bridges mats={mats} />
    </group>
  );
}
