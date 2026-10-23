import { appearances, heroes } from '../game/content';
import type { Preparation, Source } from '../game/session';
import { heroArt } from '../render/art';
import { ArtImage } from './ArtImage';
import { foxSupport, type FoxSource } from './fox-support';
import './fox-support.css';

type Props = {
  preparation: Preparation;
  selected: Source | null;
  choose: (source: Source) => void;
  fieldReady: boolean;
};

function sourcesText(sources: FoxSource[]): string {
  return sources
    .map(
      (fox) => `狐${fox.rank}阶 · 编号${fox.id}（${fox.position.x + 1}列${fox.position.y + 1}行）`,
    )
    .join('、');
}

export function FoxSupportCheck({ preparation, selected, choose, fieldReady }: Props) {
  const model = foxSupport(preparation);
  const skill = heroes.shield_fox.skills;
  return (
    <section className="fox-support" aria-label="狐支援覆盖检查">
      <h3>狐支援覆盖</h3>
      {model.units.length === 0 ? (
        <p>先部署灵兽，再核对支援覆盖；备战席和待领招募不参战。</p>
      ) : (
        <>
          <dl className="fox-support-stats">
            <div>
              <dt>施盾可达</dt>
              <dd>
                {model.shieldReachableCount}/{model.units.length}只
              </dd>
            </div>
            <div>
              <dt>前排施盾可达</dt>
              <dd>
                {model.shieldReachableFrontCount}/{model.frontCount}只
              </dd>
            </div>
            <div>
              <dt>输出光环</dt>
              <dd>
                {model.auraAttackerCount}/{model.attackerCount}只
              </dd>
            </div>
          </dl>
          <p>
            当前前排：第{model.frontRow! + 1}行，按最上占格归排，多格灵兽计一只。
            {model.foxCount === 0
              ? '当前没有上阵月音狐；备战与待领不提供支援。'
              : `上阵月音狐${model.foxCount}只，其中${model.auraFoxCount}只已解锁攻击光环。`}
          </p>
          <details className="fox-support-details">
            <summary>查看逐兽覆盖 · {model.units.length}只</summary>
            <ul aria-label="逐兽支援覆盖">
              {model.units.map((unit) => {
                const name = appearances[unit.kind].name;
                const chosen = selected?.type === 'unit' && selected.id === unit.id;
                let auraText = '不计输出（产钱或施盾）。';
                if (unit.attacker)
                  auraText =
                    unit.auraSources.length > 0 ? sourcesText(unit.auraSources) : '当前无来源。';
                return (
                  <li key={unit.id}>
                    <div className="preparation-check-unit">
                      <ArtImage asset={heroArt[unit.kind]} />
                      <strong>
                        {name} · {unit.rank}阶
                        <small>
                          编号{unit.id}
                          {unit.front ? ' · 当前前排' : ''}
                        </small>
                      </strong>
                      <button
                        type="button"
                        aria-label={`查看覆盖${name}${unit.rank}阶编号${unit.id}`}
                        aria-pressed={chosen}
                        disabled={!fieldReady}
                        onClick={() => {
                          if (!chosen) choose({ type: 'unit', id: unit.id });
                        }}
                      >
                        {chosen ? '已选中' : '查看灵兽'}
                      </button>
                    </div>
                    <small>
                      完整占格：
                      {unit.cells.map((cell) => `${cell.x + 1}列${cell.y + 1}行`).join('、')}
                    </small>
                    <small>
                      施盾可达：
                      {unit.shieldSources.length > 0
                        ? sourcesText(unit.shieldSources)
                        : '当前无来源。'}
                    </small>
                    <small>攻击光环：{auraText}</small>
                  </li>
                );
              })}
            </ul>
          </details>
          <p>
            按灵兽中心距离检查。狐可给自己施盾，一次只为一个目标施盾，优先护盾占生命上限比例较低者；可达不代表已经有盾或下一次会获盾。
          </p>
          <p>
            {skill.auraFromRank}阶狐在固定{skill.auraRadiusCells}格内提供攻击光环 +
            {skill.auraAttackPercent}
            %，多个不叠加；桃和狐不计输出。射程天赋只扩大施盾范围。覆盖不预测存活或胜负。
          </p>
        </>
      )}
    </section>
  );
}
