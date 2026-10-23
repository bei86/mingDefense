import type { TalentPreviewModel } from './talent-preview';
import './talent-preview.css';

export function TalentPreview({ preview }: { preview: TalentPreviewModel }) {
  return (
    <span className="talent-preview">
      <span className="talent-preview-total">
        本天赋累计 {preview.before} → {preview.after}
      </span>
      <span>{preview.scope}</span>
      {preview.healthGain !== null && <span>此刻补足生命 +{preview.healthGain}</span>}
      <span className="talent-preview-condition">{preview.note}</span>
    </span>
  );
}
