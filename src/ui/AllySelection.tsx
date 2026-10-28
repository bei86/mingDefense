import type { Ref } from 'react';
import { appearances } from '../game/content';
import type { AllyKindFilter, AllySelectionModel, AllyStatusFilter } from './ally-selection';

type Props = {
  selection: AllySelectionModel;
  onKind: (kind: AllyKindFilter) => void;
  onStatus: (status: AllyStatusFilter) => void;
  onSelect: (id: number) => void;
  selectRef?: Ref<HTMLSelectElement>;
  autoFocus?: boolean;
};

export function AllySelection({
  selection,
  onKind,
  onStatus,
  onSelect,
  selectRef,
  autoFocus,
}: Props) {
  return (
    <>
      <label className="inspection-select">
        灵兽种类
        <select
          aria-label="灵兽种类"
          value={selection.kind}
          onChange={(event) => onKind(event.target.value as AllyKindFilter)}
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
        灵兽状态
        <select
          aria-label="灵兽状态"
          value={selection.status}
          onChange={(event) => onStatus(event.target.value as AllyStatusFilter)}
        >
          <option value="all">全部状态 · {selection.counts.all}只</option>
          <option value="alive">存活 · {selection.counts.alive}只</option>
          <option value="fallen">已倒下 · {selection.counts.fallen}只</option>
        </select>
      </label>
      <p className="inspection-note">
        当前显示 {selection.allies.length} / {selection.total}{' '}
        只上阵灵兽；状态数量按当前种类统计，备战席不计入。
      </p>
      {selection.allies.length > 0 ? (
        <label className="inspection-select">
          查看灵兽
          <select
            aria-label="查看灵兽"
            ref={selectRef}
            autoFocus={autoFocus}
            value={selection.selectedId}
            onChange={(event) => onSelect(Number(event.target.value))}
          >
            {selection.allies.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {appearances[entry.kind].name} · {entry.rank}阶 · {entry.position.x + 1}列
                {entry.position.y + 1}行 · {entry.alive ? '存活' : '已倒下'}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p role="status">当前筛选下没有上阵灵兽，请调整种类或状态。</p>
      )}
    </>
  );
}
