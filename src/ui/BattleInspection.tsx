import { useRef, useState } from 'react';
import { appearances, type EnemyKind } from '../game/content';
import type { Session } from '../game/session';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { AllyThreats } from './AllyThreats';
import { AllySelection } from './AllySelection';
import { selectAllies, type AllyKindFilter, type AllyStatusFilter } from './ally-selection';
import { BattleStats } from './BattleStats';
import { InspectionFormation } from './InspectionFormation';
import { EnemyInspection } from './EnemyInspection';
import { UpcomingEnemies } from './UpcomingEnemies';
import { timeLabel } from './CampaignPanels';
import { battleInspection, type InspectedAlly } from './battle-inspection';
import { enemiesTargeting, enemyInspection } from './enemy-inspection';
import type { HandbookTarget } from './SpiritHandbook';
import type { BossWarningTarget } from './boss-warnings';
import './battle-inspection.css';

function AllyDetails({ unit }: { unit: InspectedAlly }) {
  const stats = [
    ['造成伤害', unit.stats?.damageDone],
    ['承受伤害', unit.stats?.damageTaken],
    ['提供护盾', unit.stats?.shieldGiven],
    ['护盾吸收', unit.stats?.shieldAbsorbed],
    ['产出灵钱', unit.stats?.income],
  ] as const;
  return (
    <article className={`inspection-unit ${unit.alive ? '' : 'fallen'}`}>
      <div className="inspection-profile">
        <ArtImage key={unit.kind} asset={heroArt[unit.kind]} />
        <div>
          <h3>
            {appearances[unit.kind].name} · {unit.rank}阶
          </h3>
          <p>
            {unit.position.x + 1}列{unit.position.y + 1}行 ·{' '}
            {unit.alive ? '正在守卫' : '已倒下，本关不再行动'}
          </p>
        </div>
      </div>
      <div className="inspection-health">
        <span>生命</span>
        <strong>
          {unit.hp} / {unit.maxHp}
        </strong>
      </div>
      <div
        className="health-track"
        role="progressbar"
        aria-label="所选灵兽生命"
        aria-valuenow={unit.hp}
        aria-valuemin={0}
        aria-valuemax={unit.maxHp}
      >
        <span style={{ width: `${Math.min(100, (unit.hp / unit.maxHp) * 100)}%` }} />
      </div>
      <div className="inspection-shield">
        <span>
          当前护盾 <strong>{unit.shield}</strong>
        </span>
        <small>{unit.shield > 0 ? `剩余 ${unit.shieldSeconds} 秒` : '无有效护盾'}</small>
      </div>
      <p className={`inspection-targets ${unit.targetedBy > 0 ? 'targeted' : ''}`}>
        {unit.alive ? `当前被 ${unit.targetedBy} 只敌人锁定` : '已退出阵线'}
      </p>
      <dl className="inspection-stats" aria-label="本关累计贡献">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value === undefined ? '未记录' : Math.floor(value)}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

type Props = {
  session: Session;
  onClose: () => void;
  onHandbook: (target: HandbookTarget) => void;
  suspended?: boolean;
  initialWarning?: BossWarningTarget;
  onIntel?: (kind: EnemyKind) => void;
};
type Side = 'ally' | 'enemy' | 'upcoming';

export function BattleInspection({
  session,
  onClose,
  onHandbook,
  suspended = false,
  initialWarning,
  onIntel,
}: Props) {
  const view = battleInspection(session.battle, session.preparation.units);
  const enemyView = enemyInspection(session.battle);
  const [unitId, setUnitId] = useState(view?.initialId);
  const [enemyId, setEnemyId] = useState(initialWarning?.source);
  const [side, setSide] = useState<Side>(initialWarning ? 'enemy' : 'ally');
  const [focusSide, setFocusSide] = useState<Side | null>(null);
  const [allyKind, setAllyKind] = useState<AllyKindFilter>('all');
  const [allyStatus, setAllyStatus] = useState<AllyStatusFilter>('all');
  const allySelect = useRef<HTMLSelectElement>(null);
  const selection = selectAllies(view?.allies ?? null, allyKind, allyStatus, unitId);
  const unit = selection.allies.find((entry) => entry.id === selection.selectedId);
  function changeSide(next: Side) {
    if (next === side) return;
    setFocusSide(null);
    setAllyKind('all');
    setAllyStatus('all');
    setSide(next);
  }
  function changeAllyFilter(kind: AllyKindFilter, status: AllyStatusFilter): void {
    const next = selectAllies(view?.allies ?? null, kind, status, selection.selectedId);
    setAllyKind(next.kind);
    setAllyStatus(next.status);
    if (next.selectedId !== undefined) setUnitId(next.selectedId);
  }
  function showEnemy(id: number) {
    if (!enemyView?.enemies.some((enemy) => enemy.id === id)) return;
    setEnemyId(id);
    setFocusSide('enemy');
    setSide('enemy');
  }
  function showAlly(id: number, allowFallen = false) {
    if (!view?.allies.some((ally) => ally.id === id && (allowFallen || ally.alive))) return;
    setAllyKind('all');
    setAllyStatus('all');
    setUnitId(id);
    setFocusSide('ally');
    setSide('ally');
    allySelect.current?.focus();
  }
  return (
    <div className="modal-backdrop top-modal" hidden={suspended}>
      <section
        className="modal inspection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspection-title"
      >
        <div className="inspection-heading">
          <div>
            <span className="eyebrow">战场已暂停 · 第 {session.preparation.stageId} 关</span>
            <h2 id="inspection-title">战场详情</h2>
          </div>
          <button className="icon-button" aria-label="关闭战场详情" onClick={onClose}>
            ×
          </button>
        </div>
        {view ? (
          <>
            <div className="inspection-summary">
              <span>
                已守 <strong>{timeLabel(view.time)}</strong>
              </span>
              <span>
                存活{' '}
                <strong>
                  {view.aliveCount}/{view.allies.length}
                </strong>
              </span>
              <span>
                场上敌人 <strong>{view.enemyCount}</strong>
              </span>
            </div>
            <div className="inspection-sides" role="group" aria-label="查看战场信息">
              <button aria-pressed={side === 'ally'} onClick={() => changeSide('ally')}>
                灵兽
              </button>
              <button aria-pressed={side === 'enemy'} onClick={() => changeSide('enemy')}>
                敌人
              </button>
              <button aria-pressed={side === 'upcoming'} onClick={() => changeSide('upcoming')}>
                后续敌袭
              </button>
            </div>
            {side === 'enemy' && (
              <EnemyInspection
                view={enemyView}
                stageId={session.battle?.stageId ?? session.preparation.stageId}
                selectedId={enemyId}
                onSelect={setEnemyId}
                onTarget={showAlly}
                autoFocus={focusSide === 'enemy'}
                initialWarning={initialWarning}
                onIntel={onIntel}
              />
            )}
            {side === 'upcoming' && <UpcomingEnemies battle={session.battle} />}
            {side === 'ally' && (
              <>
                <InspectionFormation
                  allies={view.allies}
                  selectedId={unit?.id}
                  onSelect={(id) => showAlly(id, true)}
                />
                {view.allies.length > 0 && (
                  <AllySelection
                    selection={selection}
                    onKind={(kind) => changeAllyFilter(kind, allyStatus)}
                    onStatus={(status) => changeAllyFilter(allyKind, status)}
                    onSelect={setUnitId}
                    selectRef={allySelect}
                    autoFocus={focusSide === 'ally'}
                  />
                )}
                {unit && (
                  <>
                    <AllyDetails unit={unit} />
                    <AllyThreats
                      key={`threats-${unit.id}`}
                      enemies={enemiesTargeting(enemyView, unit.id)}
                      onSelect={showEnemy}
                    />
                    <BattleStats key={unit.id} battle={session.battle} unitId={unit.id} />
                    <button
                      className="secondary inspection-handbook-button"
                      aria-label={`查看${appearances[unit.kind].name}${unit.rank}阶技能图鉴`}
                      onClick={() => onHandbook({ kind: unit.kind, rank: unit.rank })}
                    >
                      查看技能图鉴 ›
                    </button>
                  </>
                )}
                {view.allies.length === 0 && <p role="status">当前没有已上阵灵兽。</p>}
                {view.reserves.length > 0 && (
                  <p className="inspection-note">
                    备战席（不参战）：
                    {view.reserves
                      .map((entry) => `${appearances[entry.kind].name}${entry.rank}阶`)
                      .join('、')}
                    。
                  </p>
                )}
                <p className="inspection-note">
                  锁定包含正在接近的敌人，不代表下一击或首领横扫目标。累计贡献仅计本关；承伤不含护盾吸收，提供护盾不等于实际吸收。
                </p>
              </>
            )}
          </>
        ) : (
          <p role="status">暂无战斗数据，开战后可在暂停菜单查看。</p>
        )}
        <button className="secondary" onClick={onClose}>
          返回暂停菜单
        </button>
      </section>
    </div>
  );
}
