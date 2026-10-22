import {
  appearances,
  cells,
  clone,
  config,
  heroIds,
  m1HeroIds,
  stages,
  key,
  type HeroId,
  type Point,
} from './content';
import { createCombat, stepCombat, chooseCombatBuff, type Combat } from './combat';
import { initialProgression, bonus } from './progression';
import { maxHeroHp } from './combat-skills';
import { random } from './random';
import type { BuffId, Progression, Unit } from './model';
export type { Unit } from './model';

export type Offer = { id: number; kind: HeroId | 'cell'; claimed: boolean; rank?: number };
export type Preparation = {
  currency: number;
  unlocked: string[];
  units: Unit[];
  offers: Offer[];
  rng: number;
  nextId: number;
  stageId: number;
  progression: Progression;
  combatRng: number;
  rewardedStages: number[];
};
export type Phase = 'prepare' | 'combat' | 'victory' | 'defeat';
export type Source = { type: 'unit' | 'offer'; id: number };
export type Destination = Point | 'reserve' | { merge: number };

export function initialPreparation(seed: number): Preparation {
  return {
    currency: config.shop.initialCurrency,
    unlocked: config.board.initialUnlocked.map(([x, y]) => key({ x, y })),
    units: [],
    offers: config.shop.freeTutorialUnits.map((kind, i) => ({
      id: i + 1,
      kind: kind as HeroId,
      claimed: false,
    })),
    rng: seed >>> 0 || 1,
    nextId: 5,
    stageId: 1,
    progression: initialProgression(seed),
    combatRng: (seed ^ 0xc8013ea4) >>> 0 || 1,
    rewardedStages: [],
  };
}
export function unitAt(p: Preparation, point: Point): Unit | undefined {
  return p.units.find(
    (u) => u.position && cells(u.kind, u.position).some((c) => key(c) === key(point)),
  );
}
export function placementError(
  p: Preparation,
  kind: HeroId,
  point: Point,
  ignoreId?: number,
): string | null {
  for (const c of cells(kind, point)) {
    if (!p.unlocked.includes(key(c))) return '需要已解锁的连续空格';
    const occupied = unitAt(p, c);
    if (occupied && occupied.id !== ignoreId) return '这里已有灵兽，可尝试同阶合成';
  }
  return null;
}
export function expansionError(p: Preparation, point: Point): string | null {
  if (
    point.x < 0 ||
    point.x >= config.board.columns ||
    point.y < 0 ||
    point.y >= config.board.rows ||
    p.unlocked.includes(key(point))
  )
    return '请选择尚未解锁的格子';
  const adjacent = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  if (!adjacent.some((d) => p.unlocked.includes(key({ x: point.x + d.x, y: point.y + d.y }))))
    return '新格子需要与已解锁区域相邻';
  return null;
}

export function swapError(p: Preparation, sourceId: number, targetId: number): string | null {
  const source = p.units.find((u) => u.id === sourceId);
  const target = p.units.find((u) => u.id === targetId);
  if (!source || !target) return '灵兽不存在，请重新选择';
  if (sourceId === targetId) return '请选择另一只灵兽';
  if (!source.position && !target.position) return '两只灵兽均在备战席，无需换位';
  // Validate both complete shapes in the final layout, without mutating the preparation.
  const next = {
    ...p,
    units: p.units.map((u) => {
      if (u.id === sourceId) return { ...u, position: target.position };
      if (u.id === targetId) return { ...u, position: source.position };
      return u;
    }),
  };
  for (const id of [sourceId, targetId]) {
    const unit = next.units.find((u) => u.id === id)!;
    if (!unit.position) continue;
    const withoutSelf = { ...next, units: next.units.filter((u) => u.id !== id) };
    const error = placementError(withoutSelf, unit.kind, unit.position);
    if (error) {
      const reason = error === '这里已有灵兽，可尝试同阶合成' ? '与其他灵兽占格重叠' : error;
      return `${appearances[unit.kind].name}换位后放不下：${reason}`;
    }
  }
  return null;
}

export class Session {
  preparation: Preparation;
  phase: Phase = 'prepare';
  battle: Combat | null = null;
  paused = false;
  held = false;
  speed: 1 | 2 = 1;
  rewardPaid = false;
  lastReward = 0;
  lastIncome = 0;
  lastBonus = 0;
  revision = 0;
  settled = false;
  private undoState: Preparation | null = null;
  private checkpoint: Preparation | null = null;

  constructor(
    readonly seed = 20261014,
    readonly mode: 'm1' | 'campaign' = 'campaign',
  ) {
    this.preparation = initialPreparation(seed);
  }
  get stage() {
    return stages[this.preparation.stageId - 1];
  }
  get maxRank() {
    return this.mode === 'm1' ? config.scope.M1.maxRank : config.scope.M2M3.maxRank;
  }
  get heroPool() {
    return this.mode === 'm1' ? m1HeroIds : heroIds;
  }
  get hasChoices() {
    return Boolean(this.battle?.choices.length);
  }
  get canAdvance() {
    return this.phase === 'combat' && !this.paused && !this.hasChoices;
  }
  get complete() {
    return this.phase === 'victory' && this.preparation.stageId === stages.length && this.settled;
  }
  get canUndo() {
    return this.phase === 'prepare' && this.undoState !== null;
  }

  // Validate on a draft. Rejected commands never consume offers, RNG, or currency.
  private edit(change: (draft: Preparation) => string | null): string | null {
    if (this.phase !== 'prepare') return '战斗期间无法调整阵容';
    const next = clone(this.preparation);
    const error = change(next);
    if (error) return error;
    this.undoState = clone(this.preparation);
    this.preparation = next;
    this.revision++;
    return null;
  }
  transfer(source: Source, destination: Destination): string | null {
    return this.edit((p) => {
      const offer =
        source.type === 'offer'
          ? p.offers.find((o) => o.id === source.id && !o.claimed)
          : undefined;
      const existing = source.type === 'unit' ? p.units.find((u) => u.id === source.id) : undefined;
      if (!existing && (!offer || offer.kind === 'cell')) return '请先选择一只灵兽';
      const unit: Unit = existing ?? {
        id: p.nextId,
        kind: offer!.kind as HeroId,
        rank: offer?.rank ?? 1,
        position: null,
      };
      if (typeof destination === 'object' && 'merge' in destination) {
        const target = p.units.find((u) => u.id === destination.merge);
        if (
          !target ||
          target.id === unit.id ||
          target.kind !== unit.kind ||
          target.rank !== unit.rank
        )
          return '只有同种、同阶灵兽可以合成';
        if (target.rank >= this.maxRank) return `本模式最高为 ${this.maxRank} 阶`;
        target.rank++;
        p.units = p.units.filter((u) => u.id !== unit.id);
      } else if (destination === 'reserve') {
        if (unit.position === null && existing) return '这只灵兽已经在备战席';
        if (p.units.filter((u) => !u.position).length >= config.board.reserveUnitLimit)
          return '备战席已满，可直接放上棋盘或合成';
        unit.position = null;
        if (!existing) p.units.push(unit);
      } else {
        const error = placementError(p, unit.kind, destination, unit.id);
        if (error) return error;
        unit.position = clone(destination);
        if (!existing) p.units.push(unit);
      }
      if (offer) {
        offer.claimed = true;
        p.nextId++;
      }
      return null;
    });
  }
  swap(sourceId: number, targetId: number): string | null {
    return this.edit((p) => {
      const error = swapError(p, sourceId, targetId);
      if (error) return error;
      const source = p.units.find((u) => u.id === sourceId)!;
      const target = p.units.find((u) => u.id === targetId)!;
      [source.position, target.position] = [target.position, source.position];
      return null;
    });
  }
  expand(offerId: number, point: Point): string | null {
    return this.edit((p) => {
      const offer = p.offers.find((o) => o.id === offerId && o.kind === 'cell' && !o.claimed);
      if (!offer) return '扩地令已使用';
      const error = expansionError(p, point);
      if (error) return error;
      p.unlocked.push(key(point));
      offer.claimed = true;
      return null;
    });
  }
  refresh(abandon = false): string | null {
    if (this.preparation.offers.some((o) => !o.claimed) && !abandon)
      return '请确认放弃本轮未领取的招募';
    // Refresh is not a placement undo: prevent free rerolls through undo.
    const error = this.edit((p) => {
      if (p.currency < config.shop.refreshCost) return '灵钱不足';
      p.currency -= config.shop.refreshCost;
      this.rollOffers(p);
      return null;
    });
    if (!error) this.undoState = null;
    return error;
  }
  private rollOffers(p: Preparation): void {
    p.offers = Array.from({ length: config.shop.offerCount }, () => {
      const cell =
        random(p) <
        (p.unlocked.length < config.board.columns * config.board.rows
          ? config.board.cellExpansionWeight / 100
          : 0);
      const kind = cell ? 'cell' : this.heroPool[Math.floor(random(p) * this.heroPool.length)];
      const rank =
        !cell &&
        p.stageId >= config.shop.rank2FromStage &&
        random(p) < config.shop.rank2ChancePercent / 100
          ? 2
          : 1;
      return {
        id: p.nextId++,
        kind,
        claimed: false,
        ...(!cell && p.stageId >= config.shop.rank2FromStage ? { rank } : {}),
      };
    });
  }
  discard(id: number): string | null {
    const error = this.edit((p) => {
      if (!p.units.some((u) => u.id === id)) return '灵兽不存在';
      p.units = p.units.filter((u) => u.id !== id);
      return null;
    });
    if (!error) this.undoState = null;
    return error;
  }
  undo(): string | null {
    if (!this.canUndo) return '没有可以撤销的布阵操作';
    this.preparation = this.undoState!;
    this.undoState = null;
    this.revision++;
    return null;
  }
  start(): string | null {
    if (this.phase !== 'prepare') return '本场战斗尚未结束';
    if (!this.preparation.units.some((u) => u.position)) return '请至少部署一只灵兽';
    this.checkpoint = clone(this.preparation);
    this.battle = createCombat(this.preparation.units, {
      stageId: this.preparation.stageId,
      progression: this.preparation.progression,
      progressionEnabled: this.mode === 'campaign',
      rng: this.preparation.combatRng,
    });
    this.phase = 'combat';
    this.paused = false;
    this.held = false;
    this.undoState = null;
    this.lastReward = 0;
    this.lastIncome = 0;
    this.lastBonus = 0;
    this.settled = false;
    this.revision++;
    return null;
  }
  tick(): void {
    if (!this.canAdvance || !this.battle) return;
    stepCombat(this.battle, this.held);
    if (this.hasChoices) {
      this.held = false;
      this.battle.boosted = false;
      this.revision++;
    }
    if (this.battle.result) {
      this.phase = this.battle.result;
      this.held = false;
      if (this.phase === 'victory' && !this.hasChoices) this.settleVictory();
      this.revision++;
    }
  }
  private settleVictory(): void {
    if (this.settled || !this.battle || this.phase !== 'victory') return;
    const p = this.preparation;
    if (!p.rewardedStages.includes(p.stageId)) {
      this.lastReward = this.stage.reward;
      this.lastIncome = this.battle.income + this.battle.fallbackIncome;
      this.lastBonus = bonus(this.battle.progression, 'reward');
      p.currency += this.lastReward + this.lastIncome + this.lastBonus;
      p.rewardedStages.push(p.stageId);
      p.progression = clone(this.battle.progression);
      p.combatRng = this.battle.rng;
    }
    this.rewardPaid = p.rewardedStages.includes(p.stageId);
    this.settled = true;
    this.revision++;
  }
  chooseBuff(id: BuffId): string | null {
    if (!this.battle || !this.hasChoices || !['combat', 'victory'].includes(this.phase))
      return '当前没有待选天赋';
    const error = chooseCombatBuff(this.battle, id);
    if (error) return error;
    this.held = false;
    if (this.phase === 'victory' && !this.hasChoices) this.settleVictory();
    this.revision++;
    return null;
  }
  nextStage(): string | null {
    if (this.phase !== 'victory' || !this.settled || this.hasChoices)
      return '请先完成本关结算与天赋选择';
    if (this.preparation.stageId >= stages.length || this.mode === 'm1') return '本轮已经完成';
    this.preparation.stageId++;
    this.rollOffers(this.preparation);
    this.phase = 'prepare';
    this.battle = null;
    this.checkpoint = null;
    this.paused = false;
    this.held = false;
    this.rewardPaid = false;
    this.settled = false;
    this.undoState = null;
    this.revision++;
    return null;
  }
  pause(value: boolean): void {
    this.paused = value;
    this.held = false;
  }
  backToPreparation(): void {
    if (this.phase === 'prepare') return;
    if (this.phase === 'victory' && this.hasChoices) return;
    if (this.phase !== 'victory' && this.checkpoint) this.preparation = clone(this.checkpoint);
    this.phase = 'prepare';
    this.battle = null;
    this.paused = false;
    this.held = false;
    this.undoState = null;
    this.revision++;
  }
  retry(): string | null {
    if (this.hasChoices) return '请先完成天赋选择';
    this.backToPreparation();
    return this.start();
  }
  reset(): void {
    this.preparation = initialPreparation(this.seed);
    this.phase = 'prepare';
    this.battle = null;
    this.paused = false;
    this.held = false;
    this.rewardPaid = false;
    this.lastReward = 0;
    this.lastIncome = 0;
    this.lastBonus = 0;
    this.settled = false;
    this.speed = 1;
    this.undoState = null;
    this.checkpoint = null;
    this.revision++;
  }
  totalHealth(): number {
    if (this.battle) return this.battle.allies.reduce((n, u) => n + Math.max(0, u.hp), 0);
    return this.preparation.units
      .filter((u) => u.position)
      .reduce((n, u) => n + maxHeroHp(u, this.preparation.progression), 0);
  }
  exportSave(): SessionSave {
    const checkpointOnly = this.phase === 'combat' || this.phase === 'defeat';
    const battle = this.phase === 'victory' ? clone(this.battle) : null;
    if (battle) {
      // Victory has no remaining attacks. Omit transient render trails and spent spawns.
      battle.flashes = [];
      battle.spawns = [];
      battle.spawnIndex = 0;
      battle.boosted = false;
    }
    return {
      schemaVersion: 2,
      contentVersion: config.contentVersion,
      seed: this.seed,
      mode: this.mode,
      phase: this.phase === 'victory' ? 'victory' : 'prepare',
      preparation: clone(checkpointOnly ? (this.checkpoint ?? this.preparation) : this.preparation),
      battle,
      settled: checkpointOnly ? false : this.settled,
      lastReward: this.lastReward,
      lastIncome: this.lastIncome,
      lastBonus: this.lastBonus,
      speed: this.speed,
      recoveredBattle: checkpointOnly,
    };
  }
  static restore(save: SessionSave): Session {
    const session = new Session(save.seed, save.mode);
    session.preparation = clone(save.preparation);
    session.phase = save.phase;
    session.battle = clone(save.battle);
    session.settled = save.settled;
    session.lastReward = save.lastReward;
    session.lastIncome = save.lastIncome;
    session.lastBonus = save.lastBonus;
    session.speed = save.speed;
    session.rewardPaid = save.preparation.rewardedStages.includes(save.preparation.stageId);
    return session;
  }
}
export type SessionSave = {
  schemaVersion: 2;
  contentVersion: string;
  seed: number;
  mode: 'm1' | 'campaign';
  phase: 'prepare' | 'victory';
  preparation: Preparation;
  battle: Combat | null;
  settled: boolean;
  lastReward: number;
  lastIncome: number;
  lastBonus: number;
  speed: 1 | 2;
  recoveredBattle: boolean;
};
