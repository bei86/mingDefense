import { appearances } from '../game/content';
import type { Combat } from '../game/combat-model';

export function BattleReport({ battle }: { battle: Combat }) {
  const report = battle.report;
  if (!report) return <p className="report-note">这份旧战报未记录逐兽数据，下次战斗起提供。</p>;
  return (
    <details className="unit-report">
      <summary>
        逐兽战报 <span>伤害 · 承伤 · 产钱</span>
      </summary>
      <div className="report-table-wrap">
        <table className="report-table">
          <caption>本关上阵灵兽表现</caption>
          <thead>
            <tr>
              <th scope="col">灵兽</th>
              <th scope="col">伤害</th>
              <th scope="col">承伤</th>
              <th scope="col">产钱</th>
            </tr>
          </thead>
          <tbody>
            {[...report.units]
              .sort((a, b) => b.damageDone - a.damageDone || a.id - b.id)
              .map((entry) => {
                const ally = battle.allies.find((u) => u.id === entry.id)!;
                const skin = appearances[ally.kind];
                return (
                  <tr key={entry.id}>
                    <th scope="row">
                      <strong style={{ color: skin.color }}>{skin.name}</strong>
                      <small>
                        {ally.rank}阶 · {ally.position.x + 1}列{ally.position.y + 1}行
                        {ally.hp <= 0 ? ' · 重伤' : ''}
                      </small>
                      {(entry.shieldGiven > 0 || entry.shieldAbsorbed > 0) && (
                        <small>
                          施盾 {entry.shieldGiven} · 吸收 {entry.shieldAbsorbed}
                        </small>
                      )}
                    </th>
                    <td>{entry.damageDone}</td>
                    <td>{entry.damageTaken}</td>
                    <td>{entry.income}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="report-note">
        伤害仅计实际扣血，承伤不含护盾吸收；产钱仅计桃的产出。 聚灵实际生效{' '}
        {(report.boostedMs / 1000).toFixed(1)} 秒。
        {battle.result === 'defeat' && '本关产钱与成长不保留。'}
      </p>
    </details>
  );
}
