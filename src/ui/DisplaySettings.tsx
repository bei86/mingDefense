import type { DisplayOptions } from '../presentation/display-options';
import './display-settings.css';

type Props = {
  options: DisplayOptions;
  systemReduced: boolean;
  isolated: boolean;
  saved: boolean;
  paused: boolean;
  onChange: (options: DisplayOptions) => void;
  onClose: () => void;
};

export function DisplaySettings({
  options,
  systemReduced,
  isolated,
  saved,
  paused,
  onChange,
  onClose,
}: Props) {
  let persistenceNote = '画面偏好记在当前浏览器地址，新局保留，不包含在战役备份中。';
  if (isolated) persistenceNote = '开发试玩：仅本页生效，刷新恢复默认，不读取或写入正式画面偏好。';
  else if (!saved) persistenceNote = '本页已生效，但浏览器未能记住；刷新后可能恢复默认。';
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal display-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="display-title"
      >
        <span className="eyebrow">看清阵线 · 从容守卫</span>
        <h2 id="display-title">画面设置</h2>
        <label className="display-toggle">
          <span>伤害飘字</span>
          <input
            type="checkbox"
            checked={options.numbers}
            aria-describedby="display-numbers-note"
            onChange={(event) => onChange({ ...options, numbers: event.currentTarget.checked })}
          />
        </label>
        <p id="display-numbers-note">
          显示生命伤害和护盾吸收数字。关闭后仍可在战报中查看累计表现。
        </p>
        <label className="display-motion" htmlFor="display-motion">
          角色动态
        </label>
        <select
          id="display-motion"
          value={options.motion}
          aria-describedby="display-motion-note"
          onChange={(event) =>
            onChange({
              ...options,
              motion: event.currentTarget.value === 'reduced' ? 'reduced' : 'system',
            })
          }
        >
          <option value="system">跟随系统</option>
          <option value="reduced">减少动态</option>
        </select>
        <p id="display-motion-note">减少角色弹动、受击摇摆和飘字上浮。技能轨迹与危险预警保留。</p>
        {systemReduced && <p role="status">系统已开启减少动态，始终按减少动态显示。</p>}
        <p className="display-note">设置立即生效，棋盘清晰度和战斗计算不变。</p>
        <p role="status">{persistenceNote}</p>
        <button className="primary" onClick={onClose}>
          {paused ? '返回暂停菜单' : '返回布阵'}
        </button>
      </section>
    </div>
  );
}
