export type MouseMotion = { action: 'idle' | 'attack' | 'hurt' | 'fallen'; frame: number };

type State = {
  time: number;
  dead: boolean;
  hitAt: number;
  deadAt: number;
  attacking: boolean;
  attackFrame: number;
  reducedMotion: boolean;
};

/** Pure presentation arbitration; attack timing remains owned by the existing tracker. */
export function selectMouseMotion(state: State): MouseMotion {
  if (state.dead) {
    const age = Math.max(0, state.time - state.deadAt);
    const frame = state.reducedMotion ? 4 : Math.min(4, Math.floor(age / 80));
    return { action: 'fallen', frame };
  }
  if (state.reducedMotion) return { action: 'idle', frame: 0 };
  const hitAge = state.time - state.hitAt;
  if (hitAge >= 0 && hitAge < 180) return { action: 'hurt', frame: Math.floor(hitAge / 60) };
  if (state.attacking) return { action: 'attack', frame: state.attackFrame };
  return { action: 'idle', frame: Math.floor(state.time / 200) % 4 };
}
