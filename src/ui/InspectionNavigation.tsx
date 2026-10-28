import { inspectionNeighbors } from './inspection-navigation';

type Props = {
  entries: readonly { id: number }[];
  selectedId: number | undefined;
  subject: '灵兽' | '敌人';
  onSelect: (id: number) => void;
};

export function InspectionNavigation({ entries, selectedId, subject, onSelect }: Props) {
  const model = inspectionNeighbors(entries, selectedId);
  if (!model) return null;
  return (
    <div className="inspection-navigation" role="group" aria-label={`逐只查看${subject}`}>
      <button
        type="button"
        className="secondary"
        aria-label={`上一只${subject}`}
        disabled={model.previousId === undefined}
        onClick={() => {
          if (model.previousId !== undefined) onSelect(model.previousId);
        }}
      >
        上一只
      </button>
      <span role="status">
        第 {model.position} / {model.total} 只
      </span>
      <button
        type="button"
        className="secondary"
        aria-label={`下一只${subject}`}
        disabled={model.nextId === undefined}
        onClick={() => {
          if (model.nextId !== undefined) onSelect(model.nextId);
        }}
      >
        下一只
      </button>
    </div>
  );
}
