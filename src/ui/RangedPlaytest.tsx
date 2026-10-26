import {
  rangedCases,
  rangedPlaytestUrl,
  type RangedPlaytest,
} from '../game/fixtures/ranged-playtest';

export function RangedPlaytestPanel({ trial }: { trial: RangedPlaytest }) {
  const source = rangedCases[trial.caseId];
  const candidate = trial.variant === 'candidate';
  return (
    <details className="ranged-playtest">
      <summary>
        第8关对照试玩 · {candidate ? '远程减少' : '原方案'} · {source.label}
      </summary>
      <label>
        固定开局
        <select
          aria-label="选择对照案例"
          value={trial.caseId}
          onChange={(event) => {
            const caseId = event.target.value as RangedPlaytest['caseId'];
            window.location.assign(rangedPlaytestUrl({ ...trial, caseId }));
          }}
        >
          {Object.entries(rangedCases).map(([id, item]) => (
            <option key={id} value={id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        每波翎羽客 {candidate ? 3 : 4} 只、狼 {candidate ? 5 : 4}{' '}
        只，共3波。远程减少方案每波以1只狼替换1只翎羽客，基础击杀经验合计少9。
      </p>
      <nav aria-label="切换对照方案">
        <a
          aria-current={!candidate ? 'page' : undefined}
          href={rangedPlaytestUrl({ ...trial, variant: 'baseline' })}
        >
          原方案
        </a>
        <a
          aria-current={candidate ? 'page' : undefined}
          href={rangedPlaytestUrl({ ...trial, variant: 'candidate' })}
        >
          远程减少
        </a>
        <a href={rangedPlaytestUrl(trial)}>重置本方案</a>
      </nav>
      <p>
        切换或重置会丢弃本次试玩进度，恢复同一开局；仅试玩第8关，不读写正式进度。比较时请保持相同布阵、天赋和聚灵操作。
      </p>
      <small>
        已观察的脚本案例：{source.policy === 'control' ? '控制' : '强攻'}领取路线，
        {source.boost ? '使用聚灵' : '不使用聚灵'}
        。手动结果可能不同。
        {trial.caseId === 'carryover' && '后续退步来自先前完整路线实验，本入口不运行后续关卡。'}
      </small>
    </details>
  );
}
