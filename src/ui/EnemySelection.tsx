import type { Ref } from 'react';
import type { EnemyFilter, EnemySelectionModel } from './enemy-selection';
import { enemySortLabel, enemySortOptions, type EnemySort } from './enemy-sorting';

type Props = {
  selection: EnemySelectionModel;
  onKind: (kind: EnemyFilter) => void;
  onOrder: (order: EnemySort) => void;
  onSelect: (id: number) => void;
  selectRef?: Ref<HTMLSelectElement>;
  autoFocus?: boolean;
};

export function EnemySelection({
  selection,
  onKind,
  onOrder,
  onSelect,
  selectRef,
  autoFocus,
}: Props) {
  return (
    <>
      <label className="inspection-select">
        敌人种类
        <select
          aria-label="敌人种类"
          value={selection.kind}
          onChange={(event) => onKind(event.target.value as EnemyFilter)}
        >
          <option value="all">全部 · {selection.total}只</option>
          {selection.kinds.map((entry) => (
            <option key={entry.kind} value={entry.kind}>
              {entry.name} · {entry.count}只
            </option>
          ))}
        </select>
      </label>
      <label className="inspection-select">
        敌人排序
        <select
          aria-label="敌人排序"
          value={selection.order}
          onChange={(event) => onOrder(event.target.value as EnemySort)}
        >
          {enemySortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="inspection-note">
        当前显示 {selection.enemies.length} / {selection.total} 只存活敌人；未出场队列见“后续敌袭”。
      </p>
      {selection.order !== 'default' && (
        <p className="inspection-note">
          生命比例按详情所示生命与上限计算，上限未记录排最后；同值按编号。排序保留当前敌人，不改变攻击目标。
        </p>
      )}
      <label className="inspection-select">
        查看敌人
        <select
          aria-label="查看敌人"
          ref={selectRef}
          autoFocus={autoFocus}
          value={selection.selectedId}
          onChange={(event) => onSelect(Number(event.target.value))}
        >
          {selection.enemies.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · #{entry.id} · 生命 {entry.hp}
              {selection.order === 'health' && ` · ${enemySortLabel(entry, selection.order)}`}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
