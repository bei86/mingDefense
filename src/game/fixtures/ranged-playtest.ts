import { clone } from '../content';
import { waveSpawns } from '../combat';
import type { Spawn } from '../combat-model';
import { validSave } from '../persistence';
import { Session, type SessionSave } from '../session';
import { withRangedPressure } from '../testing/ranged-pressure';
import relief from './ranged8-relief-checkpoint.json';
import setback from './ranged8-setback-checkpoint.json';
import carryover from './ranged8-carryover-checkpoint.json';

export const rangedCases = {
  relief: {
    label: '减远程后获益',
    seed: 20270105,
    policy: 'assault',
    boost: false,
    checkpoint: relief,
  },
  setback: {
    label: '减远程后失败',
    seed: 20270115,
    policy: 'assault',
    boost: false,
    checkpoint: setback,
  },
  carryover: {
    label: '本关获益，后续退步',
    seed: 20270112,
    policy: 'control',
    boost: true,
    checkpoint: carryover,
  },
} as const;
export type RangedSelection = {
  caseId: keyof typeof rangedCases;
  variant: 'baseline' | 'candidate';
};
export type RangedPlaytest = RangedSelection & { session: RangedSession; spawns: Spawn[] };

export function parseRangedPlaytest(search: string): RangedSelection {
  const params = new URLSearchParams(search);
  const id = params.get('case');
  return {
    caseId: id === 'setback' || id === 'carryover' ? id : 'relief',
    variant: params.get('variant') === 'candidate' ? 'candidate' : 'baseline',
  };
}

export function rangedPlaytestUrl({ caseId, variant }: RangedSelection): string {
  return `?playtest=ranged8&case=${caseId}&variant=${variant}`;
}

class RangedSession extends Session {
  private readonly opening: SessionSave;
  private readonly schedule: Spawn[];
  private startedFrom: SessionSave | null = null;

  get battleOpening(): SessionSave | null {
    return clone(this.startedFrom);
  }

  constructor(opening: SessionSave, schedule: Spawn[]) {
    super(opening.seed, opening.mode);
    this.opening = clone(opening);
    this.schedule = clone(schedule);
    this.reset();
  }

  override start(): string | null {
    const opening = this.exportSave();
    const error = super.start();
    if (!error) {
      this.startedFrom = opening;
      this.battle!.spawns = clone(this.schedule);
    }
    return error;
  }

  override reset(): void {
    super.reset();
    this.startedFrom = null;
    this.preparation = clone(this.opening.preparation);
    this.lastReward = this.opening.lastReward;
    this.lastIncome = this.opening.lastIncome;
    this.lastBonus = this.opening.lastBonus;
    this.speed = this.opening.speed;
  }

  override retry(): string | null {
    if (this.hasChoices) return '请先完成天赋选择';
    this.reset();
    return this.start();
  }

  override backToPreparation(): void {
    if (this.phase === 'victory') {
      if (!this.hasChoices) this.reset();
      return;
    }
    super.backToPreparation();
  }

  override nextStage(): string {
    return '本试玩仅限第8关，请重置或切换方案对照';
  }
}

export function createRangedPlaytest(selection: RangedSelection): RangedPlaytest {
  const opening = rangedCases[selection.caseId].checkpoint;
  if (!validSave(opening) || opening.phase !== 'prepare' || opening.preparation.stageId !== 8)
    throw new Error('第8关试玩开局无效');
  const spawns = withRangedPressure(selection.variant === 'candidate' ? 'stage8' : 'baseline', () =>
    waveSpawns(8),
  );
  return { ...selection, spawns, session: new RangedSession(opening, spawns) };
}
