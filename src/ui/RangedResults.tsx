import { useEffect, useMemo, useRef, useState } from 'react';
import type { StoragePort } from '../game/persistence';
import type { RangedPlaytest, RangedSelection } from '../game/fixtures/ranged-playtest';
import { ReportText } from './ReportText';
import {
  clearRangedResults,
  rangedCapturedAt,
  rangedComparison,
  rangedComparisonNote,
  rangedResult,
  rangedResultsDocument,
  rangedSeconds,
  readRangedResults,
  saveRangedResult,
  type RangedResult,
  type RangedResults as Results,
} from './ranged-results';
import './ranged-results.css';

const browserTrialStorage: StoragePort = {
  getItem: (key) => window.sessionStorage.getItem(key),
  setItem: (key, value) => window.sessionStorage.setItem(key, value),
  removeItem: (key) => window.sessionStorage.removeItem(key),
};

const metrics: [string, (result: RangedResult) => string | number][] = [
  ['结果', (r) => (r.result === 'victory' ? '胜利' : '失败')],
  ['用时', (r) => rangedSeconds(r.time)],
  ['剩余生命', (r) => Math.floor(r.hp)],
  ['承受伤害', (r) => Math.floor(r.damageTaken)],
  ['击杀经验', (r) => r.xpEarned],
  ['聚灵生效', (r) => rangedSeconds(r.boostedMs)],
];
function matchLabel(value: boolean | null): string {
  if (value === null) return '尚未配齐';
  return value ? '相同' : '不同';
}

export function RangedResultsView({
  results,
  caseId,
  onClear,
  onRetry,
}: {
  results: Results;
  caseId: RangedSelection['caseId'];
  onClear: () => void;
  onRetry?: () => void;
}) {
  const pair = useMemo(() => rangedComparison(results.entries, caseId), [results.entries, caseId]);
  const report = useMemo(
    () => rangedResultsDocument(results.entries, caseId),
    [results.entries, caseId],
  );
  const hasResult = Boolean(pair.baseline || pair.candidate);
  return (
    <div className="report-export-content">
      <p>
        每个案例分别保留两种方案的最近一次完整战果；切换或刷新保留，通常关闭标签页后清空。浏览器恢复会话可能恢复。
      </p>
      {results.error && (
        <p role="status" className="report-export-notice">
          {results.error}
        </p>
      )}
      {!hasResult ? (
        <p>当前案例尚无完整战果。完成战斗与天赋选择后自动记录。</p>
      ) : (
        <>
          <table className="ranged-results-table">
            <caption>当前案例 · 最近完整战果</caption>
            <thead>
              <tr>
                <th scope="col">项目</th>
                <th scope="col">原方案</th>
                <th scope="col">远程减少</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{pair.baseline ? value(pair.baseline) : '未试玩'}</td>
                  <td>{pair.candidate ? value(pair.candidate) : '未试玩'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>用时为游戏内模拟时间。</p>
          <p>
            开战档{matchLabel(pair.openingSame)} · 结束累计天赋{matchLabel(pair.talentsSame)} ·
            聚灵时长{matchLabel(pair.boostSame)}
          </p>
          <p>{rangedComparisonNote}</p>
          {pair.baseline && (
            <small className="ranged-record-time">
              原方案记录：{rangedCapturedAt(pair.baseline.capturedAt)}
            </small>
          )}
          {pair.candidate && (
            <small className="ranged-record-time">
              远程减少记录：{rangedCapturedAt(pair.candidate.capturedAt)}
            </small>
          )}
          <ReportText report={report} label="试玩对照报告" />
        </>
      )}
      <div className="ranged-results-actions">
        {results.error && onRetry && (
          <button className="secondary" onClick={onRetry}>
            重试保存本次结果
          </button>
        )}
        <button
          className="secondary"
          disabled={!results.entries.length && !results.error}
          onClick={onClear}
        >
          清空本标签页试玩记录
        </button>
      </div>
    </div>
  );
}

export function RangedResults({
  trial,
  storage = browserTrialStorage,
}: {
  trial: RangedPlaytest;
  storage?: StoragePort;
}) {
  const [results, setResults] = useState(() => readRangedResults(storage));
  const [expanded, setExpanded] = useState(false);
  const battle = trial.session.battle;
  const recordedBattle = useRef<typeof battle>(null);
  const finished =
    (trial.session.phase === 'victory' || trial.session.phase === 'defeat') &&
    !trial.session.hasChoices &&
    (trial.session.phase === 'defeat' || trial.session.settled);
  useEffect(() => {
    if (!finished || !battle || recordedBattle.current === battle) return;
    const result = rangedResult(trial);
    if (!result) return;
    recordedBattle.current = battle;
    setResults(saveRangedResult(storage, result));
  }, [trial, battle, finished, storage]);

  return (
    <details
      className="report-export ranged-results"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        本标签页最近战果 <span>对照 · 导出</span>
      </summary>
      {expanded && (
        <RangedResultsView
          results={results}
          caseId={trial.caseId}
          onClear={() => {
            const cleared = clearRangedResults(storage);
            setResults((previous) =>
              cleared.error ? { ...previous, error: cleared.error } : cleared,
            );
          }}
          onRetry={
            finished
              ? () => {
                  const result = rangedResult(trial);
                  if (result) setResults(saveRangedResult(storage, result));
                }
              : undefined
          }
        />
      )}
    </details>
  );
}
