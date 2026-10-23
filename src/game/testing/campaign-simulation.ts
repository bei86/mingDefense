import { Session, placementError, expansionError } from '../session';
import type { HeroId } from '../content';
import { protectPeaches } from './campaign-audit';
import { runPreparedBattle, type BattleSample, type SimulationOptions } from './campaign-battle';
export type { BattleSample, SimulationOptions, CampaignBattleAudit } from './campaign-battle';

export const orders: Record<string, HeroId[]> = {
  assault: [
    'ember_mouse',
    'boar',
    'piercing_monkey',
    'scatter_bear',
    'sword_eagle',
    'shield_fox',
    'ice_fish',
    'fortune_peach',
  ],
  control: [
    'ice_fish',
    'piercing_monkey',
    'ember_mouse',
    'sword_eagle',
    'shield_fox',
    'scatter_bear',
    'boar',
    'fortune_peach',
  ],
  economy: [
    'fortune_peach',
    'shield_fox',
    'ember_mouse',
    'boar',
    'scatter_bear',
    'piercing_monkey',
    'sword_eagle',
    'ice_fish',
  ],
};
function claim(s: Session, order: HeroId[]) {
  const points = s.preparation.unlocked
    .map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);
  for (const offer of [...s.preparation.offers]
    .filter((o) => !o.claimed)
    .sort((a, b) => order.indexOf(a.kind as HeroId) - order.indexOf(b.kind as HeroId))) {
    if (offer.kind === 'cell') {
      const locked = Array.from({ length: 36 }, (_, i) => ({
        x: i % 6,
        y: Math.floor(i / 6),
      })).sort(
        (a, b) =>
          Math.abs(a.x - 2.5) + Math.abs(a.y - 3.5) - Math.abs(b.x - 2.5) - Math.abs(b.y - 3.5),
      );
      const point = locked.find((p) => !expansionError(s.preparation, p));
      if (point) s.expand(offer.id, point);
      continue;
    }
    const target = s.preparation.units.find(
      (u) => u.kind === offer.kind && u.rank === (offer.rank ?? 1),
    );
    if (target) s.transfer({ type: 'offer', id: offer.id }, { merge: target.id });
    else {
      const point = points
        .filter((p) => order[0] !== 'ice_fish' || offer.kind === 'ice_fish' || p.x !== 1)
        .find((p) => !placementError(s.preparation, offer.kind as HeroId, p));
      if (point) s.transfer({ type: 'offer', id: offer.id }, point);
      else s.transfer({ type: 'offer', id: offer.id }, 'reserve');
    }
    let merged = true;
    while (merged) {
      merged = false;
      for (const unit of s.preparation.units) {
        const other = s.preparation.units.find(
          (u) =>
            u.id !== unit.id &&
            u.kind === unit.kind &&
            u.rank === unit.rank &&
            unit.rank < s.maxRank,
        );
        if (other) {
          s.transfer({ type: 'unit', id: other.id }, { merge: unit.id });
          merged = true;
          break;
        }
      }
    }
  }
  for (const unit of s.preparation.units.filter((u) => !u.position)) {
    const point = s.preparation.unlocked
      .map((k) => {
        const [x, y] = k.split(',').map(Number);
        return { x, y };
      })
      .find((p) => !placementError(s.preparation, unit.kind, p));
    if (point) s.transfer({ type: 'unit', id: unit.id }, point);
  }
}
export function simulate(
  seed: number,
  policy: string,
  boost = true,
  targetStage = 5,
  diagnostics = false,
  options: SimulationOptions = {},
) {
  const s = new Session(seed);
  s.transfer({ type: 'offer', id: 1 }, { x: policy === 'control' ? 4 : 1, y: 3 });
  s.transfer({ type: 'offer', id: 2 }, { merge: 5 });
  s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 });
  s.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 });
  const results: BattleSample[] = [];
  const checkpoints = [];
  for (let stage = 1; stage <= targetStage; stage++) {
    claim(s, orders[policy]);
    while (s.preparation.currency >= 15) {
      s.refresh(true);
      claim(s, orders[policy]);
    }
    const peachMoves = options.protectPeach ? protectPeaches(s) : 0;
    checkpoints.push(s.exportSave());
    results.push(runPreparedBattle(s, policy, boost, diagnostics, options, peachMoves));
    if (s.phase !== 'victory') break;
    if (stage < targetStage) s.nextStage();
  }
  return {
    seed,
    policy,
    complete: results.length === targetStage && s.phase === 'victory',
    results,
    checkpoints,
  };
}
