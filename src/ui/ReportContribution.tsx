import { reportMetrics, type ReportMetric } from './report-unit-sort';
import { contributionShare, type ReportContributionModel } from './report-contribution';

type Props = { model: ReportContributionModel; metric: ReportMetric };

export function ReportContributionTotal({ model, metric }: Props) {
  const label = reportMetrics.find((entry) => entry.key === metric)!.label;
  if (model.total === null) {
    return (
      <p className="report-contribution-total">
        全队{label}未完整记录 · 缺{model.missing}只记录，不计算占比。
      </p>
    );
  }
  return (
    <p className="report-contribution-total">
      全队{label}合计 <strong>{model.total}</strong>
      <small>
        {model.total === 0
          ? '本项合计为0，不计算占比。'
          : '占比以本项合计计算，含重伤者；四舍五入后不保证合计100%。'}
      </small>
    </p>
  );
}

export function ReportContributionShare({
  model,
  metric,
  value,
}: Props & { value: number | null }) {
  const share = contributionShare(value, model);
  if (!share) return <small className="report-contribution-unavailable">占比未计算</small>;
  const label = reportMetrics.find((entry) => entry.key === metric)!.label;
  return (
    <small className="report-contribution-share">
      <span>
        {label}占比 {share.label}
      </span>
      <span className="report-contribution-track" aria-hidden="true">
        <span style={{ width: `${share.percent}%` }} />
      </span>
    </small>
  );
}
