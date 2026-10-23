import type { SoundCue } from '../presentation/sound-cues';
import './audio-settings.css';

type Channel = {
  enabled: boolean;
  volume: number;
  onEnabled: (enabled: boolean) => void;
  onVolume: (volume: number) => void;
};
type Props = {
  sound: Channel;
  music: Channel;
  unavailable: boolean;
  paused: boolean;
  onPreview: (cue: SoundCue) => void;
  onClose: () => void;
};

function VolumeChannel({
  id,
  label,
  channel,
  unavailable,
}: {
  id: string;
  label: string;
  channel: Channel;
  unavailable: boolean;
}) {
  return (
    <div className="volume-channel">
      <div className="volume-heading">
        <label htmlFor={id}>{label}音量</label>
        <button
          className="sound-button"
          data-sound-toggle
          aria-label={label}
          aria-pressed={channel.enabled && !unavailable}
          disabled={unavailable}
          onClick={() => channel.onEnabled(!channel.enabled)}
        >
          {channel.enabled ? '已开启' : '已关闭'}
        </button>
      </div>
      <div className="volume-slider">
        <input
          id={id}
          type="range"
          min="0"
          max="100"
          step="1"
          value={channel.volume}
          aria-valuetext={`${channel.volume}%`}
          aria-describedby={`${id}-status`}
          disabled={unavailable}
          onChange={(event) => channel.onVolume(Number(event.currentTarget.value))}
        />
        <output htmlFor={id}>{channel.volume}%</output>
      </div>
      <small id={`${id}-status`}>
        {channel.enabled ? '调到0即可静音，开关保持开启。' : '调节音量后仍保持关闭。'}
      </small>
    </div>
  );
}

export function AudioSettings({ sound, music, unavailable, paused, onPreview, onClose }: Props) {
  const canPreview = !unavailable && sound.enabled && sound.volume > 0;
  let status = '按当前音效音量播放；音乐音量单独调节。';
  if (!sound.enabled) status = '开启游戏音效后可试听。';
  else if (sound.volume === 0) status = '音效音量为0，调高后可试听。';
  if (unavailable) status = '当前设备音频不可用，游戏可继续。';
  return (
    <div className="modal-backdrop top-modal">
      <section
        className="modal audio-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-settings-title"
      >
        <span className="eyebrow">灵林声韵</span>
        <h2 id="audio-settings-title">声音设置</h2>
        <VolumeChannel
          id="sound-volume"
          label="游戏音效"
          channel={sound}
          unavailable={unavailable}
        />
        <VolumeChannel
          id="music-volume"
          label="背景音乐"
          channel={music}
          unavailable={unavailable}
        />
        <div
          className="sound-preview"
          role="group"
          aria-label="试听音效"
          aria-describedby="sound-preview-status"
        >
          <span>试听音效</span>
          <div className="sound-preview-buttons">
            <button
              data-sound-toggle
              disabled={!canPreview}
              onClick={() => onPreview('mouse_attack')}
            >
              鼠火弹
            </button>
            <button
              data-sound-toggle
              disabled={!canPreview}
              onClick={() => onPreview('fox_shield')}
            >
              狐护盾
            </button>
            <button data-sound-toggle disabled={!canPreview} onClick={() => onPreview('warning')}>
              横扫预警
            </button>
          </div>
          <small id="sound-preview-status" role="status">
            {status}
          </small>
        </div>
        <p className="audio-settings-note">
          {paused ? '暂停时音乐停播，继续守卫后可听到调整效果。' : '开启背景音乐后，在布阵时播放。'}
          音量和开关会分别记住。
        </p>
        <button className="primary" data-sound-toggle onClick={onClose}>
          {paused ? '返回暂停菜单' : '返回布阵'}
        </button>
      </section>
    </div>
  );
}
