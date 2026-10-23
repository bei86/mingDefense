import { describe, expect, it } from 'vitest';
import { appearances, clone, config } from '../game/content';
import type { BattleReport, UnitBattleStats } from '../game/combat-model';
import { Session } from '../game/session';
import { battleReportDocument } from './battle-report-export';
import { fallTimeline } from './fall-timeline';

function completedBattle(reserve = false) {
  const s = new Session();
  expect(s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 })).toBeNull();
  expect(s.transfer({ type: 'offer', id: 2 }, reserve ? 'reserve' : { merge: 5 })).toBeNull();
  expect(s.transfer({ type: 'offer', id: 3 }, { x: 2, y: 3 })).toBeNull();
  expect(s.transfer({ type: 'offer', id: 4 }, { x: 3, y: 4 })).toBeNull();
  expect(s.start()).toBeNull();
  for (let i = 0; i < 10000 && (s.phase === 'combat' || s.hasChoices); i++) {
    if (s.hasChoices) expect(s.chooseBuff(s.battle!.choices[0])).toBeNull();
    else s.tick();
  }
  expect(s.phase).toBe('victory');
  expect(s.settled).toBe(true);
  return s;
}

describe('结算战报导出', () => {
  it('正常完整战斗导出的总计、逐兽、站位与已结算收入一致，读取无副作用', () => {
    const s = completedBattle();
    const before = clone(s);
    const saved = s.exportSave();
    const document = battleReportDocument(s, false)!;
    expect(document.fileName).toBe('ming-defense-report-stage-1-victory.md');
    expect(document.text).toContain(config.contentVersion);
    expect(document.text).toContain('来源：正常游戏');
    expect(document.text).toContain('第1关 · 林间初袭');
    expect(document.text).toContain('结果：胜利');
    expect(document.text).toContain(`击退：${s.battle!.kills}`);
    expect(document.text).toContain(`造成伤害：${s.battle!.damageDone}`);
    expect(document.text).toContain(`承受伤害：${s.battle!.damageTaken}`);
    expect(document.text).toContain(`剩余参战生命：${s.totalHealth()}`);
    expect(document.text).toContain(`实际入账：${s.lastReward + s.lastIncome + s.lastBonus}`);
    expect(document.text).toContain(
      `通关 ${s.lastReward} · 产钱/转化 ${s.lastIncome} · 天赋 ${s.lastBonus}`,
    );
    for (const ally of s.battle!.allies) {
      const entry = s.battle!.report!.units.find((unit) => unit.id === ally.id)!;
      expect(document.text).toContain(
        `${appearances[ally.kind].name} ${ally.rank}阶 | ${ally.position.x + 1}列${ally.position.y + 1}行`,
      );
      expect(document.text).toContain(
        `| ${entry.damageDone} | ${entry.damageTaken} | ${entry.shieldGiven} | ${entry.shieldAbsorbed} | ${entry.income} |`,
      );
    }
    expect(s).toEqual(before);
    expect(s.exportSave()).toEqual(saved);
    const timeline = fallTimeline(s.battle!)!;
    expect(document.text).toContain('## 重伤时间线');
    if (timeline.length) {
      for (const line of timeline) expect(document.text).toContain(`- ${line}`);
    } else expect(document.text).toContain('本关无灵兽重伤。');
  });

  it('胜利存档恢复后多次导出一致，不调用结算或再次入账', () => {
    const s = completedBattle();
    const restored = Session.restore(s.exportSave());
    const before = clone(restored);
    const first = battleReportDocument(restored, false);
    expect(first).toEqual(battleReportDocument(s, false));
    expect(battleReportDocument(restored, false)).toEqual(first);
    expect(restored).toEqual(before);
  });

  it('开发隔离试玩明确标记，不标成正常通关', () => {
    const s = completedBattle();
    const text = battleReportDocument(s, true)!.text;
    expect(text).toContain('来源：开发隔离试玩');
    expect(text).not.toContain('来源：正常游戏');
    expect(text).toContain('当前原型参数');
    expect(text).toContain('不是存档');
    expect(text).not.toContain(String(s.seed));
    expect(text).not.toContain('combatRng');
  });

  it('备战单列不参战，不能混入逐兽或剩余参战生命', () => {
    const s = completedBattle(true);
    const text = battleReportDocument(s, false)!.text;
    expect(text).toContain('备战席（不参战）');
    expect(text).toContain('- 烬灵鼠 1阶');
    expect(text.match(/\| 烬灵鼠 1阶 \|/g)).toHaveLength(1);
    expect(text).toContain(`剩余参战生命：${s.totalHealth()}`);
  });

  it('真实失败不导出旧last收入，并说明本关产钱与成长不保留', () => {
    const s = new Session();
    s.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    s.start();
    for (let i = 0; i < 10000 && s.phase === 'combat'; i++) {
      if (s.hasChoices) s.chooseBuff(s.battle!.choices[0]);
      else s.tick();
    }
    expect(s.phase).toBe('defeat');
    const falls = s.battle!.report!.falls!;
    expect(falls.length).toBeGreaterThan(0);
    expect(falls.at(-1)!.at).toBe(s.battle!.time);
    s.lastReward = 987;
    s.lastIncome = 654;
    s.lastBonus = 321;
    const before = clone(s);
    const document = battleReportDocument(s, false)!;
    expect(document.fileName).toBe('ming-defense-report-stage-1-defeat.md');
    expect(document.text).toContain('结果：失败');
    expect(document.text).toContain('实际入账：0');
    expect(document.text).toContain(
      `本关产钱 ${s.battle!.income} · 转化 ${s.battle!.fallbackIncome}`,
    );
    expect(document.text).toContain('本关产钱、转化和成长不保留');
    expect(document.text).not.toContain('987');
    for (const line of fallTimeline(s.battle!)!) expect(document.text).toContain(`- ${line}`);
    expect(document.text).toContain('同一批灵兽不区分重伤先后');
    expect(s).toEqual(before);
  });

  it('旧战报没有逐兽数据时所有字段和聚灵标为未记录，仍有阵容', () => {
    const s = completedBattle();
    delete s.battle!.report;
    const text = battleReportDocument(s, false)!.text;
    expect(text).toContain('旧战报未记录逐兽数据');
    expect(text).toContain('聚灵实际生效：未记录');
    expect(text).toContain('这份旧战报未记录重伤时间。');
    expect(text).toContain('| 未记录 | 未记录 | 未记录 | 未记录 | 未记录 |');
    expect(text).toContain('烬灵鼠 2阶 | 2列4行');
  });

  it('旧逐兽报告缺时间线明确未记录，不冒充无重伤', () => {
    const s = completedBattle();
    delete s.battle!.report!.falls;
    const text = battleReportDocument(s, false)!.text;
    expect(text).toContain('这份旧战报未记录重伤时间。');
    expect(text).not.toContain('本关无灵兽重伤。');
  });

  it('旧逐兽缺盾和缺整行分别显示未记录，真实0保留为0', () => {
    const s = completedBattle();
    const report = s.battle!.report!;
    delete (report as Partial<BattleReport>).boostedMs;
    delete (report.units[0] as Partial<UnitBattleStats>).shieldGiven;
    delete (report.units[0] as Partial<UnitBattleStats>).shieldAbsorbed;
    report.units.splice(1, 1);
    const text = battleReportDocument(s, false)!.text;
    expect(text).toContain('| 未记录 | 未记录 | 0 |');
    expect(text).toContain('| 未记录 | 未记录 | 未记录 | 未记录 | 未记录 |');
    expect(text).toContain('聚灵实际生效：未记录');
  });

  it('累计天赋与模拟用时/聚灵单位清晰，保留重伤单位', () => {
    const s = completedBattle();
    s.battle!.progression.buffs = { attack: 2, health: 0, fox_shield: 1 };
    s.battle!.time = 31250;
    s.battle!.report!.boostedMs = 1250;
    s.battle!.allies[0].hp = 0;
    const text = battleReportDocument(s, false)!.text;
    expect(text).toContain('用时：31.25 秒');
    expect(text).toContain('聚灵实际生效：1.25 秒');
    expect(text).toContain('结束时累计天赋');
    expect(text).toContain('2层');
    expect(text).toContain('1层');
    expect(text).not.toContain('0层');
    expect(text).toContain('重伤');
  });

  it('没有天赋时明确未选择，m1模式明确标注', () => {
    const s = completedBattle();
    s.battle!.progression.buffs = {};
    const restored = Session.restore({ ...s.exportSave(), mode: 'm1' });
    const text = battleReportDocument(restored, false)!.text;
    expect(text).toContain('模式：初始验证模式');
    expect(text).toContain('未选择天赋');
  });

  it('未结束、缺战斗、结果不匹配、未结算和待选择均不生成', () => {
    const fresh = new Session();
    expect(battleReportDocument(fresh, false)).toBeNull();
    fresh.transfer({ type: 'offer', id: 1 }, { x: 1, y: 3 });
    fresh.start();
    expect(battleReportDocument(fresh, false)).toBeNull();
    const s = completedBattle();
    s.settled = false;
    expect(battleReportDocument(s, false)).toBeNull();
    s.settled = true;
    s.battle!.choices = ['attack'];
    expect(battleReportDocument(s, false)).toBeNull();
    s.battle!.choices = [];
    s.battle!.result = 'defeat';
    expect(battleReportDocument(s, false)).toBeNull();
    s.battle = null;
    expect(battleReportDocument(s, false)).toBeNull();
  });
});
