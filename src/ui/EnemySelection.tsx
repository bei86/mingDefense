import type { Ref } from 'react';
import type { EnemyFilter, EnemySelectionModel, EnemyStatusFilter } from './enemy-selection';
import { enemySortLabel, enemySortOptions, type EnemySort } from './enemy-sorting';
import { InspectionNavigation } from './InspectionNavigation';

type Props = {
  selection: EnemySelectionModel;
  onKind: (kind: EnemyFilter) => void;
  onStatus: (status: EnemyStatusFilter) => void;
  onOrder: (order: EnemySort) => void;
  onSelect: (id: number) => void;
  selectRef?: Ref<HTMLSelectElement>;
  autoFocus?: boolean;
};

export function EnemySelection({
  selection,
  onKind,
  onStatus,
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
        敌人状态
        <select
          aria-label="敌人状态"
          value={selection.status}
          onChange={(event) => onStatus(event.target.value as EnemyStatusFilter)}
        >
          <option value="all">全部状态 · {selection.counts.all}只</option>
          <option value="frozen">冻结 · {selection.counts.frozen}只</option>
          <option value="slowed">霜尾缓行 · {selection.counts.slowed}只</option>
          <option value="vulnerable">易伤 · {selection.counts.vulnerable}只</option>
          <option value="unaffected">无局部状态 · {selection.counts.unaffected}只</option>
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
        当前显示 {selection.enemies.length} / {selection.total}{' '}
        只存活敌人；状态数量按当前种类统计，未出场队列见“后续敌袭”。
      </p>
      {selection.status !== 'all' && (
        <p className="inspection-note">
          状态可重叠，各组数量不能相加；全场迟滞天赋不计入局部状态。“无局部状态”仅指没有有效冻结、霜尾缓行或易伤。
        </p>
      )}
      {selection.order !== 'default' && (
        <p className="inspection-note">
          生命比例按详情所示生命与上限计算，上限未记录排最后；同值按编号。排序保留当前敌人，不改变攻击目标。
        </p>
      )}
      {selection.enemies.length > 0 ? (
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
      ) : (
        <p role="status">当前筛选下没有存活敌人，请调整种类或状态。</p>
      )}
      <InspectionNavigation
        entries={selection.enemies}
        selectedId={selection.selectedId}
        subject="敌人"
        onSelect={onSelect}
      />
    </>
  );
}
