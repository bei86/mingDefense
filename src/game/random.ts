export type RandomState = { rng: number };

export function random(state: RandomState): number {
  let n = state.rng || 1;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  state.rng = n >>> 0;
  return state.rng / 4294967296;
}
