import { useCallback, useEffect, useRef, useState } from 'react';
import { appearances, config, enemyCount, stages, stageNames, type Point } from '../game/content';
import { unitAt, type Source, type Session } from '../game/session';
import type { BrowserLoadResult } from './useSessionStorage';
import { RangedPlaytestPanel } from './RangedPlaytest';
import { GameClock } from '../game/clock';
import { startGameLoop } from './game-loop';
import { Battlefield } from '../render/Battlefield';
import { useModalFocus } from './useModalFocus';
import { ExperienceBar, ResultModal, TalentModal, timeLabel } from './CampaignPanels';
import { BuffJournal } from './BuffJournal';
import { PreparationPanel, type Confirmation } from './PreparationPanel';
import { browserStorage, loadBrowserSession, useSessionStorage } from './useSessionStorage';
import { boardDrop } from './board-drop';
import { ArtImage } from './ArtImage';
import { CombatControls, CombatHeader, CombatStatus, EnemyIntel, PauseMenu } from './CombatPanels';
import { FirstBattleGuide } from './FirstBattleGuide';
import { DefeatAdvice } from './DefeatAdvice';
import { defeatRecap, type DefeatRecap } from './defeat-advice';
import { SpiritHandbook, type HandbookTarget } from './SpiritHandbook';
import { CombatFeedback } from '../presentation/combat-feedback';
import { GameAudio } from '../presentation/game-audio';
import { GameMusic, musicMood } from '../presentation/game-music';
import { AudioVolume, MUSIC_VOLUME_KEY, SOUND_VOLUME_KEY } from '../presentation/audio-volume';
import { AudioSettings } from './AudioSettings';
import { SaveManager } from './SaveManager';
import { StageIntel } from './StageIntel';
import { CampaignProgress } from './CampaignProgress';
import { campaignChapter } from './campaign-progress';
import { FormationSwap } from './FormationSwap';
import { BattleInspection } from './BattleInspection';
import { FormationPresets } from './FormationPresets';
import { useFormationPresets } from './useFormationPresets';
import type { RendererRecoveryState } from '../render/renderer-recovery';
import { RendererRecoveryDialog } from './RendererRecovery';
import { MergePreview } from './MergePreview';
import { ReportCollection } from './ReportCollection';
import { temporaryReportStorage } from './report-collection';
import { DisplaySettings } from './DisplaySettings';
import { PlaytestLauncher } from './PlaytestLauncher';
import { useSystemReducedMotion } from './useSystemReducedMotion';
import { readDisplayOptions, saveDisplayOptions } from '../presentation/display-options';

export function App() {
  const [game, setGame] = useState(() => ({ boot: loadBrowserSession(), generation: 0 }));
  return (
    <GameApp
      key={game.generation}
      boot={game.boot}
      onRestore={(session) => {
        setGame((previous) => ({
          generation: previous.generation + 1,
          boot: {
            session,
            recovered: true,
            blocked: false,
            message: '备份已恢复并保存，可继续游戏。替换前进度可在存档中恢复。',
          },
        }));
      }}
    />
  );
}
function GameApp({
  boot,
  onRestore,
}: {
  boot: BrowserLoadResult;
  onRestore: (session: Session) => void;
}) {
  const session = boot.session;
  const trial = import.meta.env.DEV ? boot.rangedPlaytest : undefined;
  const [clock] = useState(() => new GameClock(session));
  const [feedback] = useState(() => new CombatFeedback());
  const [fieldReady, setFieldReady] = useState(false);
  const [rendererRecovery, setRendererRecovery] = useState<RendererRecoveryState>(null);
  const fieldReadyRef = useRef(false);
  const onFieldReady = useCallback(
    (ready: boolean) => {
      fieldReadyRef.current = ready;
      session.held = false;
      clock.reset();
      setFieldReady(ready);
    },
    [clock, session],
  );
  const audioRef = useRef<GameAudio | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => new GameAudio().enabled);
  const [musicEnabled, setMusicEnabled] = useState(() => new GameMusic().enabled);
  const [soundVolume, setSoundVolume] = useState(() => new AudioVolume(SOUND_VOLUME_KEY).value);
  const [musicVolume, setMusicVolume] = useState(() => new AudioVolume(MUSIC_VOLUME_KEY).value);
  const [audioSettings, setAudioSettings] = useState(false);
  const [displaySettings, setDisplaySettings] = useState(false);
  const [playtests, setPlaytests] = useState(false);
  const [displayOptions, setDisplayOptions] = useState(() => readDisplayOptions(boot.isolated));
  const [displaySaved, setDisplaySaved] = useState(true);
  const systemReducedMotion = useSystemReducedMotion();
  const displayRef = useRef(displayOptions);
  displayRef.current = displayOptions;
  const [, render] = useState(0);
  const [selected, setSelected] = useState<Source | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [message, setMessage] = useState(() => {
    if (trial) return '固定开局已备好，可直接守阵或调整阵容。';
    if (boot.recovered) return '进度已恢复，可继续调整阵容。';
    return '免费招募已备好，先选灵兽，再点亮起的空格。';
  });
  const [dialog, setDialog] = useState<Confirmation | null>(null);
  const [help, setHelp] = useState(false);
  const [journal, setJournal] = useState(false);
  const [handbook, setHandbook] = useState<HandbookTarget | null>(null);
  const [intel, setIntel] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ chapter: number } | null>(null);
  const [saves, setSaves] = useState(false);
  const [reports, setReports] = useState(false);
  const [reportStorage] = useState(() =>
    boot.isolated ? temporaryReportStorage() : browserStorage,
  );
  const [inspection, setInspection] = useState(false);
  const [presets, setPresets] = useState(false);
  const formationLibrary = useFormationPresets(boot.isolated ?? false);
  const [swapUnitId, setSwapUnitId] = useState<number | null>(null);
  const [mergeSource, setMergeSource] = useState<Source | null>(null);
  const [lastDefeat, setLastDefeat] = useState<DefeatRecap | null>(null);
  const storage = useSessionStorage(session, boot.blocked, boot.message);
  useModalFocus(
    Boolean(
      rendererRecovery ||
        dialog ||
        help ||
        journal ||
        handbook ||
        intel ||
        progress ||
        saves ||
        reports ||
        inspection ||
        presets ||
        audioSettings ||
        displaySettings ||
        playtests ||
        mergeSource ||
        swapUnitId !== null ||
        session.hasChoices ||
        (session.phase === 'combat' && session.paused) ||
        session.phase === 'victory' ||
        session.phase === 'defeat',
    ),
    `${rendererRecovery}:${dialog?.title}:${help}:${journal}:${handbook}:${intel}:${Boolean(progress)}:${saves}:${reports}:${inspection}:${presets}:${audioSettings}:${displaySettings}:${playtests}:${mergeSource?.type}:${mergeSource?.id}:${swapUnitId}:${session.hasChoices}:${session.battle?.pendingChoices}:${session.phase}:${session.paused}`,
  );
  const drag = useRef<{
    pointerId: number;
    source: Source;
    x: number;
    y: number;
    moving: boolean;
    offset: Point;
  } | null>(null);
  const ignoreClickUntil = useRef(0);
  const onFieldRecovery = useCallback(
    (state: RendererRecoveryState) => {
      if (state) {
        if (session.phase === 'combat') session.pause(true);
        session.held = false;
        drag.current = null;
        setDragOffset(null);
        setHover(null);
        clock.reset();
      }
      setRendererRecovery(state);
    },
    [clock, session],
  );
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const repaint = () => render((v) => v + 1);
  const run = (error: string | null, success: string) => {
    setMessage(error ?? success);
    if (!error) {
      setSelected(null);
      setHover(null);
    }
    repaint();
  };
  const place = (p: Point, source = selectedRef.current, offset?: Point) => {
    if (session.phase !== 'prepare' || !fieldReadyRef.current) return;
    const target = unitAt(session.preparation, p);
    if (!source) {
      if (target) {
        setSelected({ type: 'unit', id: target.id });
        setMessage('已选择，可移动、合成或送至备战席。');
      }
      return;
    }
    const offer =
      source.type === 'offer' ? session.preparation.offers.find((o) => o.id === source.id) : null;
    if (offer?.kind === 'cell') run(session.expand(source.id, p), '已解锁一格新阵地。');
    else if (!offset && target?.id === source.id && source.type === 'unit') setSelected(null);
    else {
      const destination = boardDrop(session.preparation, source, p, offset);
      run(
        session.transfer(source, destination),
        'merge' in destination ? '合成成功，灵兽升阶！' : '灵兽已部署，可继续布阵或开战。',
      );
    }
  };
  const placeRef = useRef(place);
  placeRef.current = place;
  useEffect(() => {
    const audio = new GameAudio();
    audioRef.current = audio;
    feedback.update(session, 0, !document.hidden, displayRef.current.numbers);
    let inactive = false;
    let musicActive = true;
    const stopLoop = startGameLoop(
      clock,
      repaint,
      (elapsed) => {
        const ready = fieldReadyRef.current;
        const blocked = !ready || (session.phase === 'combat' && !session.canAdvance);
        if (blocked && !inactive) audio.suspend();
        inactive = blocked;
        audio.playFeedback(
          feedback.update(session, elapsed, ready && !document.hidden, displayRef.current.numbers),
        );
        audio.updateMusic(musicActive && ready ? musicMood(session) : null);
      },
      () => fieldReadyRef.current,
    );
    const unlock = (e: Event) => {
      if (e instanceof KeyboardEvent && e.repeat) return;
      musicActive = true;
      audio.unlock();
    };
    const clickSound = (e: MouseEvent) => {
      const button = e.target instanceof Element ? e.target.closest('button') : null;
      if (button && !button.disabled && !button.hasAttribute('data-sound-toggle'))
        audio.play('click');
    };
    const stopHeld = () => {
      session.held = false;
    };
    const suspend = () => {
      musicActive = false;
      audio.suspend();
      if (session.phase === 'combat') session.pause(true);
      stopHeld();
      drag.current = null;
      setDragOffset(null);
      setHover(null);
      clock.reset();
      repaint();
    };
    const hidden = () => {
      if (document.hidden) suspend();
    };
    const pointerMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moving = true;
      if (!d.moving) return;
      setSelected(d.source);
      setDragOffset(d.offset);
      const cell = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>('[data-cell-x]');
      setHover(cell ? { x: Number(cell.dataset.cellX), y: Number(cell.dataset.cellY) } : null);
      e.preventDefault();
    };
    const pointerUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      stopHeld();
      const d = drag.current;
      if (d && e.pointerId !== d.pointerId) return;
      drag.current = null;
      setDragOffset(null);
      if (!d?.moving) return;
      ignoreClickUntil.current = performance.now() + 400;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest<HTMLElement>('[data-cell-x]');
      if (cell)
        placeRef.current(
          { x: Number(cell.dataset.cellX), y: Number(cell.dataset.cellY) },
          d.source,
          d.offset,
        );
      else if (el?.closest('[data-reserve]')) {
        const targetId = el.closest<HTMLElement>('[data-reserve-unit]')?.dataset.reserveUnit;
        run(
          session.transfer(d.source, targetId ? { merge: Number(targetId) } : 'reserve'),
          targetId ? '合成成功！' : '已送至备战席。',
        );
      } else {
        setHover(null);
        setMessage('未放入目标，原位置和招募保持不变。');
      }
      repaint();
    };
    const cancelPointer = (e: PointerEvent) => {
      if (!e.isPrimary || (drag.current && e.pointerId !== drag.current.pointerId)) return;
      stopHeld();
      drag.current = null;
      setDragOffset(null);
      setHover(null);
    };
    window.addEventListener('blur', suspend);
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('click', clickSound, true);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pointermove', pointerMove, { passive: false });
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', cancelPointer);
    return () => {
      stopLoop();
      audio.dispose();
      audioRef.current = null;
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('click', clickSound, true);
      window.removeEventListener('blur', suspend);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', cancelPointer);
    };
  }, [clock, session, feedback]);
  const dragStart = (e: React.PointerEvent, source: Source, grabbedCell?: Point) => {
    if (
      fieldReadyRef.current &&
      session.phase === 'prepare' &&
      e.isPrimary &&
      e.button === 0 &&
      !drag.current
    ) {
      const position =
        source.type === 'unit'
          ? session.preparation.units.find((u) => u.id === source.id)?.position
          : null;
      const offset =
        position && grabbedCell
          ? { x: grabbedCell.x - position.x, y: grabbedCell.y - position.y }
          : { x: 0, y: 0 };
      drag.current = {
        pointerId: e.pointerId,
        source,
        x: e.clientX,
        y: e.clientY,
        moving: false,
        offset,
      };
    }
  };
  const choose = (source: Source) => {
    if (performance.now() < ignoreClickUntil.current) return;
    setSelected(selected?.type === source.type && selected.id === source.id ? null : source);
    setMessage(
      source.type === 'offer' &&
        session.preparation.offers.find((o) => o.id === source.id)?.kind === 'cell'
        ? '选择与亮起区域相邻的未解锁格子。'
        : '点空格部署；点同种同阶灵兽合成；也可拖动。',
    );
  };
  const pauseForMenu = () => {
    if (session.phase === 'combat') {
      session.pause(true);
      clock.reset();
    }
  };
  const reset = () => {
    pauseForMenu();
    setDialog({
      title: trial ? '重置本方案' : '重新开始五十关挑战',
      body: trial
        ? '丢弃本次试玩进度，恢复当前案例的第8关原始开局。'
        : '清空本轮阵容、修行和灵钱，回到第 1 关。',
      label: '重新开始',
      action: () => {
        session.reset();
        setLastDefeat(null);
        clock.reset();
        setSelected(null);
        setMessage(trial ? '第8关原始开局已恢复。' : '新一轮免费招募已备好。');
        repaint();
      },
    });
  };
  const p = session.preparation;
  const battle = session.battle;
  const preparing = session.phase === 'prepare';
  let journalCloseLabel: string | undefined;
  if (session.hasChoices) journalCloseLabel = '返回天赋选择';
  else if (session.phase === 'victory' || session.phase === 'defeat')
    journalCloseLabel = '返回本关结算';
  const stage = session.stage;
  const previousView = useRef({ preparing, battle });
  useEffect(() => {
    if (previousView.current.preparing === preparing && previousView.current.battle === battle)
      return;
    previousView.current = { preparing, battle };
    session.held = false;
    drag.current = null;
    setSelected(null);
    setHover(null);
    setDragOffset(null);
    setMergeSource(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
    document
      .querySelector<HTMLElement>(preparing ? '.titlebar h1' : '.combat-heading')
      ?.focus({ preventScroll: true });
  }, [preparing, battle, session]);
  const resume = () => {
    if (!fieldReadyRef.current) return;
    session.pause(false);
    clock.reset();
    repaint();
  };
  const audioUnavailable = audioRef.current?.unavailable ?? false;
  const changeSoundEnabled = (enabled: boolean) => {
    audioRef.current?.setEnabled(enabled);
    if (enabled) {
      audioRef.current?.unlock();
      audioRef.current?.play('deploy');
    }
    setSoundEnabled(enabled);
  };
  const changeMusicEnabled = (enabled: boolean) => {
    audioRef.current?.setMusicEnabled(enabled);
    if (enabled) audioRef.current?.unlock();
    setMusicEnabled(enabled);
  };
  let soundLabel = soundEnabled ? '音效开' : '音效关';
  let musicLabel = musicEnabled ? '音乐开' : '音乐关';
  if (audioUnavailable) soundLabel = '音效不可用';
  if (audioUnavailable) musicLabel = '音乐不可用';
  const soundControl = (
    <div className="audio-controls" role="group" aria-label="游戏声音">
      <button
        className="sound-button"
        data-sound-toggle
        aria-label={audioUnavailable ? '音效不可用' : '游戏音效'}
        aria-pressed={soundEnabled && !audioUnavailable}
        disabled={audioUnavailable}
        onClick={() => changeSoundEnabled(!soundEnabled)}
      >
        {soundLabel}
      </button>
      <button
        className="sound-button"
        data-sound-toggle
        aria-label={audioUnavailable ? '音乐不可用' : '背景音乐'}
        aria-pressed={musicEnabled && !audioUnavailable}
        disabled={audioUnavailable}
        onClick={() => changeMusicEnabled(!musicEnabled)}
      >
        {musicLabel}
      </button>
      <button
        className="sound-button"
        data-sound-toggle
        aria-label="声音设置"
        onClick={() => {
          pauseForMenu();
          setAudioSettings(true);
        }}
      >
        音量
      </button>
    </div>
  );
  return (
    <main className={`app-shell ${preparing ? 'preparation-view' : 'combat-view'}`}>
      {preparing ? (
        <header className="titlebar">
          <div className="brand-mark">林</div>
          <div>
            <span className="eyebrow">MING DEFENSE · 五十关原型</span>
            <h1 tabIndex={-1}>灵林守阵</h1>
          </div>
          <div className="titlebar-tools">
            {soundControl}
            <button
              className="handbook-button"
              aria-label="灵兽图鉴"
              onClick={() => setHandbook({ kind: 'ember_mouse', rank: 1 })}
            >
              图鉴
            </button>
            <button
              className="icon-button"
              aria-label="玩法说明"
              onClick={() => {
                pauseForMenu();
                setHelp(true);
              }}
            >
              ?
            </button>
          </div>
        </header>
      ) : (
        <CombatHeader
          session={session}
          onPause={() => {
            pauseForMenu();
            repaint();
          }}
        />
      )}
      {storage.message && (preparing || storage.failed) && (
        <div className="save-notice" role="status">
          <span>{storage.message}</span>
          <button onClick={storage.dismiss} aria-label="关闭存档提示">
            ×
          </button>
        </div>
      )}
      {import.meta.env.DEV &&
        trial &&
        session.phase !== 'victory' &&
        session.phase !== 'defeat' && <RangedPlaytestPanel trial={trial} />}
      {preparing && (
        <section className="stage-strip">
          <div>
            <span className="chapter">
              {p.stageId <= 10
                ? ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'][p.stageId - 1]
                : p.stageId}
            </span>
            <div>
              <strong>{stageNames[p.stageId - 1]}</strong>
              <small>
                第 {p.stageId} / {stages.length} 关 · {stage.waves.length} 波敌袭
                {stage.bossId ? ' + 首领' : ` · ${enemyCount(p.stageId)} 只敌人`}
              </small>
            </div>
          </div>
          <span className="stage-tag">整备布阵</span>
        </section>
      )}
      <ExperienceBar
        session={session}
        onShowBuffs={() => {
          pauseForMenu();
          setJournal(true);
        }}
      />
      {preparing ? (
        <section className="resources" aria-label="整备资源">
          <div>
            <span className="resource-icon gold">
              <ArtImage asset="icon_currency" />
            </span>
            <span>
              <small>灵钱</small>
              <b>{p.currency}</b>
            </span>
          </div>
          <div>
            <span className="resource-icon mint">
              <ArtImage asset="icon_hp" />
            </span>
            <span>
              <small>阵容生命</small>
              <b>{session.totalHealth()}</b>
            </span>
          </div>
          <div>
            <span className="resource-icon">
              <ArtImage asset="icon_timer" />
            </span>
            <span>
              <small>守阵时限</small>
              <b>{timeLabel(config.runtime.stageLimitMs)}</b>
            </span>
          </div>
        </section>
      ) : (
        <CombatStatus session={session} />
      )}
      {!preparing && (
        <div className="battle-notice-slot" role="status">
          {feedback.notice ? (
            <div
              className={`battle-notice notice-${feedback.notice.kind}`}
              key={feedback.notice.id}
            >
              <strong>{feedback.notice.label}</strong>
              <span>{feedback.notice.detail}</span>
            </div>
          ) : (
            <span className="battle-notice-idle">守住阵线 · 灵兽自动迎敌</span>
          )}
        </div>
      )}
      {preparing && <EnemyIntel stageId={p.stageId} onDetails={() => setIntel(p.stageId)} />}
      {preparing && lastDefeat && <DefeatAdvice session={session} recap={lastDefeat} preparing />}
      {preparing && p.stageId === 1 && !lastDefeat && (
        <FirstBattleGuide session={session} selected={selected} choose={choose} />
      )}
      <section className="field-panel">
        <Battlefield
          session={session}
          feedback={feedback}
          displayOptions={displayOptions}
          systemReduced={systemReducedMotion}
          selected={selected}
          hover={hover}
          dragOffset={dragOffset}
          onCell={(point) => {
            if (performance.now() >= ignoreClickUntil.current) place(point);
          }}
          onDragStart={dragStart}
          onHover={setHover}
          onReadyChange={onFieldReady}
          onRecoveryChange={onFieldRecovery}
        />
      </section>
      <section
        className={preparing ? 'lower-panel' : 'combat-dock'}
        aria-label={preparing ? '整备操作' : '守卫操作'}
      >
        {preparing ? (
          <PreparationPanel
            session={session}
            selected={selected}
            message={message}
            choose={choose}
            dragStart={dragStart}
            run={run}
            confirm={setDialog}
            onSwap={setSwapUnitId}
            onPresets={() => setPresets(true)}
            onMergePreview={setMergeSource}
            onHandbook={setHandbook}
            fieldReady={fieldReady}
            onStart={() => {
              if (!fieldReadyRef.current) return;
              clock.reset();
              const error = session.start();
              if (!error) setLastDefeat(null);
              run(error, '守阵开始！');
            }}
            ignoreClick={() => performance.now() < ignoreClickUntil.current}
          />
        ) : (
          <CombatControls
            session={session}
            onSpeed={() => {
              session.speed = session.speed === 1 ? 2 : 1;
              repaint();
            }}
          />
        )}
      </section>
      {preparing && (
        <footer>
          <span>
            {trial
              ? '单关隔离试玩 · 刷新恢复原始开局 · 不保存进度'
              : '五十关原型 · 临时数值待校准 · 自动保存检查点'}
          </span>
          <div className="preparation-save-tools">
            <button
              className="text-button"
              onClick={() => setProgress({ chapter: campaignChapter(p.stageId) })}
            >
              战役进度
            </button>
            <button className="text-button" onClick={() => setReports(true)}>
              战报收藏
            </button>
            <button className="text-button" onClick={() => setSaves(true)}>
              存档
            </button>
            <button className="text-button" onClick={() => setDisplaySettings(true)}>
              画面设置
            </button>
            {import.meta.env.DEV && (
              <button className="text-button" onClick={() => setPlaytests(true)}>
                开发试玩
              </button>
            )}
            <button className="text-button" onClick={reset}>
              重新开始
            </button>
          </div>
        </footer>
      )}
      {session.hasChoices && (
        <TalentModal
          session={session}
          onBuffs={() => setJournal(true)}
          onChoose={(id) => {
            clock.reset();
            run(session.chooseBuff(id), '已领悟新天赋。');
          }}
        />
      )}
      {(session.phase === 'victory' || session.phase === 'defeat') && !session.hasChoices && (
        <ResultModal
          session={session}
          isolated={boot.isolated ?? false}
          reportStorage={reportStorage}
          trialActions={
            import.meta.env.DEV && trial ? <RangedPlaytestPanel trial={trial} /> : undefined
          }
          onReports={() => setReports(true)}
          onBuffs={() => setJournal(true)}
          onSaves={() => setSaves(true)}
          onProgress={() => setProgress({ chapter: campaignChapter(p.stageId) })}
          onPlaytests={import.meta.env.DEV ? () => setPlaytests(true) : undefined}
          onNext={() => {
            clock.reset();
            setLastDefeat(null);
            run(session.nextStage(), '全员恢复，已免费刷新本关招募。');
          }}
          onRetry={() => {
            clock.reset();
            setLastDefeat(null);
            run(session.retry(), '重新守阵。');
          }}
          onPrepare={() => {
            setLastDefeat(defeatRecap(session.battle));
            session.backToPreparation();
            setSelected(null);
            setMessage('已恢复阵容，可以继续调整布阵。');
            repaint();
          }}
          onReset={reset}
        />
      )}
      {session.phase === 'combat' &&
        session.paused &&
        !session.hasChoices &&
        !dialog &&
        !help &&
        !journal &&
        !handbook &&
        !intel &&
        !progress &&
        !inspection &&
        !reports &&
        !audioSettings &&
        !displaySettings &&
        !playtests &&
        !saves && (
          <PauseMenu
            resetLabel={trial ? '重置本方案' : undefined}
            session={session}
            soundControl={soundControl}
            onResume={resume}
            onPrepare={() =>
              setDialog({
                title: '返回布阵',
                body: '恢复开战前的完整检查点，本关产钱、经验和天赋不保留。',
                label: '返回布阵',
                action: () => {
                  session.backToPreparation();
                  setMessage('已恢复开战前阵容，可以继续调整布阵。');
                  repaint();
                },
              })
            }
            onHelp={() => setHelp(true)}
            onBuffs={() => setJournal(true)}
            onHandbook={() => setHandbook({ kind: 'ember_mouse', rank: 1 })}
            onIntel={() => setIntel(p.stageId)}
            onProgress={() => setProgress({ chapter: campaignChapter(p.stageId) })}
            onSaves={() => setSaves(true)}
            onInspect={() => setInspection(true)}
            onReports={() => setReports(true)}
            onDisplay={() => setDisplaySettings(true)}
            onPlaytests={import.meta.env.DEV ? () => setPlaytests(true) : undefined}
            onReset={reset}
          />
        )}
      {journal && (
        <BuffJournal
          session={session}
          onClose={() => setJournal(false)}
          closeLabel={journalCloseLabel}
        />
      )}
      {import.meta.env.DEV && playtests && (
        <PlaytestLauncher
          pathname={window.location.pathname}
          phase={session.phase}
          isolated={boot.isolated ?? false}
          onClose={() => setPlaytests(false)}
          onNavigate={(url) => window.location.assign(url)}
        />
      )}
      {displaySettings && (
        <DisplaySettings
          options={displayOptions}
          systemReduced={systemReducedMotion}
          isolated={boot.isolated ?? false}
          saved={displaySaved}
          paused={!preparing}
          onChange={(options) => {
            setDisplayOptions(options);
            setDisplaySaved(saveDisplayOptions(options, boot.isolated));
          }}
          onClose={() => setDisplaySettings(false)}
        />
      )}
      {reports && (
        <ReportCollection
          storage={reportStorage}
          isolated={boot.isolated ?? false}
          onClose={() => setReports(false)}
        />
      )}
      {audioSettings && (
        <AudioSettings
          sound={{
            enabled: soundEnabled,
            volume: soundVolume,
            onEnabled: changeSoundEnabled,
            onVolume: (value) => {
              audioRef.current?.setVolume(value);
              setSoundVolume(audioRef.current?.volume ?? soundVolume);
            },
          }}
          music={{
            enabled: musicEnabled,
            volume: musicVolume,
            onEnabled: changeMusicEnabled,
            onVolume: (value) => {
              audioRef.current?.setMusicVolume(value);
              setMusicVolume(audioRef.current?.music.volume ?? musicVolume);
            },
          }}
          unavailable={audioUnavailable}
          paused={!preparing}
          onPreview={(cue) => {
            audioRef.current?.unlock();
            audioRef.current?.play(cue);
          }}
          onClose={() => {
            audioRef.current?.stop();
            setAudioSettings(false);
          }}
        />
      )}
      {inspection && session.phase === 'combat' && session.paused && !session.hasChoices && (
        <BattleInspection
          session={session}
          onClose={() => setInspection(false)}
          onHandbook={setHandbook}
          suspended={Boolean(handbook)}
        />
      )}
      {preparing && swapUnitId !== null && (
        <FormationSwap
          session={session}
          sourceId={swapUnitId}
          onClose={() => setSwapUnitId(null)}
          onSwap={(targetId) => {
            const error = session.swap(swapUnitId, targetId);
            run(error, '两只灵兽已换位，可撤销上一步。');
            if (!error) setSwapUnitId(null);
          }}
        />
      )}
      {preparing && mergeSource && (
        <MergePreview
          session={session}
          source={mergeSource}
          fieldReady={fieldReady}
          onClose={() => setMergeSource(null)}
          onMerge={(targetId) => {
            if (!fieldReadyRef.current) return '战场尚未准备好，请稍候。';
            const error = session.transfer(mergeSource, { merge: targetId });
            run(error, '合成成功，灵兽升阶！可撤销本次合成。');
            if (!error) setMergeSource(null);
            return error;
          }}
        />
      )}
      {preparing && presets && (
        <FormationPresets
          session={session}
          library={formationLibrary}
          isolated={boot.isolated ?? false}
          onClose={() => setPresets(false)}
          onApply={(preset) => {
            const error = session.applyFormation(preset);
            run(error, '阵型已应用，可撤销上一步布阵。');
            if (!error) setPresets(false);
            return error;
          }}
        />
      )}
      {handbook && (
        <SpiritHandbook
          initialEntry={handbook}
          closeLabel={inspection ? '返回战场详情' : '收起图鉴'}
          onClose={() => setHandbook(null)}
        />
      )}
      {progress && intel === null && (
        <CampaignProgress
          session={session}
          isolated={boot.isolated ?? false}
          chapter={progress.chapter}
          onChapter={(chapter) => setProgress({ chapter })}
          onIntel={setIntel}
          onClose={() => setProgress(null)}
        />
      )}
      {intel !== null && (
        <StageIntel
          currentSpawns={trial?.spawns}
          currentStageId={p.stageId}
          initialStageId={intel}
          closeLabel={progress ? '返回战役进度' : undefined}
          onClose={() => setIntel(null)}
        />
      )}
      {saves && (
        <SaveManager
          session={session}
          isolated={boot.isolated ?? false}
          onClose={() => setSaves(false)}
          onRestore={onRestore}
        />
      )}
      {dialog && (
        <div className="modal-backdrop top-modal">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">{dialog.title}</h2>
            <p>{dialog.body}</p>
            <button
              className="primary"
              onClick={() => {
                dialog.action();
                setDialog(null);
              }}
            >
              {dialog.label}
            </button>
            <button className="secondary" onClick={() => setDialog(null)}>
              取消
            </button>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop top-modal">
          <section
            className="modal help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <span className="eyebrow">守阵手札</span>
            <h2 id="help-title">守过五十境，灵林长安</h2>
            <ol>
              <li>点招募再点空格部署，或拖动放置。同种同阶叠放合成，最高六阶；3/5阶会解锁技能。</li>
              <li>
                选中已有灵兽后点「换位」，可与其他上阵或备战席灵兽互换位置；多格放不下时会说明原因，成功后可撤销。
              </li>
              <li>
                八灵：
                {Object.values(appearances)
                  .map((a) => a.name)
                  .join(' / ')}
                。桃产钱，鱼减速/冰冻，狐提供护盾与光环，猴贯穿/易伤，熊散射/分裂。备战席最多两只，不参战。
              </li>
              <li>
                刷新15灵钱，三张招募；扩地令解锁边相邻的一格。格子全开后只抽英雄；第6关起英雄招募有15%概率为二阶。
              </li>
              <li>
                敌人先清最前一排，再攻击下一排；同排先攻击低阶灵兽，同阶按桃、狐、鼠、豚、熊、猴、鲤、隼的仇恨顺序选择，相同则选择距离更近的灵兽。
              </li>
              <li>击杀积累经验，升级暂停三选一。按住聚灵石提升攻速；切出页面或打开菜单会暂停。</li>
              <li>
                第5关古木之灵、第10关鸣咒统领、第15关岩铠领主、第20关霜咒祭司、第25关岩咒督军、第30关玄羽妖帅、第35关赤角战魁、第40关玄甲咒尊、第45关回锋妖将、第50关镇渊妖君是首领关。镇渊妖君为临时设计的近战护甲首领：减伤15%，每12秒双段横扫，2.4秒后首段、再隔1秒同排追击60%；每16秒召唤2只，半血后4只、上限10，攻速提高35%。回锋妖将为临时设计的近战双段首领，每14秒预警横扫当前前排，2.2秒后首段命中，0.9秒后同一行追击60%伤害，不越排；半血后攻速提高30%，每18秒召唤由2只增至4只，上限8只，无护甲。玄甲咒尊为远程护甲首领，射程2.2格、减伤15%，每12秒横扫（2秒预警），每14秒召2只咒影，半血后每次4只、上限10只、攻速提高35%。赤角战魁为近战，减伤15%，每10秒横扫（2秒预警），每16秒召唤，半血后攻速提高35%、每次召唤由2只增至4只，上限8只。玄羽妖帅远程攻击，仍先清前排，半血强化召唤。岩咒督军兼有15%护甲和半血强化召唤，横扫预警2秒。岩铠领主常驻15%减伤，横扫有1.8秒预警；霜咒祭司横扫预警2秒，半血后每次召唤由2只增加至4只，上限8只。第11–49关的普通关为既有敌人的混合攻势。第6关起加入远程怪、二阶招募和狼的狂暴，第8/9关加入召唤与分裂怪；清空全部敌人才获胜。
                鸣咒犬出生10秒后首次召2只咒影，之后每20秒再召2只，每只鸣咒犬最多保有6只咒影；冻结会推迟召唤，击杀父怪可阻止后续召唤。
              </li>
              <li>
                进入下一关时全员恢复，并免费刷新一轮招募。失败/返回/战斗中刷新，回到开战检查点；本关收益回滚。
              </li>
            </ol>
            <p>
              自动保存整备、关后天赋和完成状态。已知旧版先备份再迁移，无法兼容的旧档会提示新局。数值尚待原作实机校准；本地数据只保存在当前浏览器。
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              {preparing ? '返回布阵' : '返回暂停菜单'}
            </button>
          </section>
        </div>
      )}
      {rendererRecovery && (
        <RendererRecoveryDialog
          state={rendererRecovery}
          phase={session.phase}
          isolated={boot.isolated ?? false}
        />
      )}
    </main>
  );
}
