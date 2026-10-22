import { useEffect, useRef, useState } from 'react';
import { appearances, config, enemyCount, stages, stageNames, type Point } from '../game/content';
import { unitAt, type Source } from '../game/session';
import { GameClock } from '../game/clock';
import { startGameLoop } from './game-loop';
import { Battlefield } from '../render/Battlefield';
import { useModalFocus } from './useModalFocus';
import { BuffJournal, ExperienceBar, ResultModal, TalentModal, timeLabel } from './CampaignPanels';
import { PreparationPanel, type Confirmation } from './PreparationPanel';
import { loadBrowserSession, useSessionStorage } from './useSessionStorage';
import { boardDrop } from './board-drop';
import { ArtImage } from './ArtImage';
import { CombatControls, CombatHeader, CombatStatus, EnemyIntel, PauseMenu } from './CombatPanels';
import { FirstBattleGuide } from './FirstBattleGuide';
import { DefeatAdvice } from './DefeatAdvice';
import { defeatRecap, type DefeatRecap } from './defeat-advice';
import { SpiritHandbook } from './SpiritHandbook';

export function App() {
  const [boot] = useState(loadBrowserSession);
  const session = boot.session;
  const [clock] = useState(() => new GameClock(session));
  const [, render] = useState(0);
  const [selected, setSelected] = useState<Source | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [message, setMessage] = useState(
    boot.recovered ? '进度已恢复，可继续调整阵容。' : '免费招募已备好，先选灵兽，再点亮起的空格。',
  );
  const [dialog, setDialog] = useState<Confirmation | null>(null);
  const [help, setHelp] = useState(false);
  const [journal, setJournal] = useState(false);
  const [handbook, setHandbook] = useState(false);
  const [lastDefeat, setLastDefeat] = useState<DefeatRecap | null>(null);
  const storage = useSessionStorage(session, boot.blocked, boot.message);
  useModalFocus(
    Boolean(
      dialog ||
        help ||
        journal ||
        handbook ||
        session.hasChoices ||
        (session.phase === 'combat' && session.paused) ||
        session.phase === 'victory' ||
        session.phase === 'defeat',
    ),
    `${dialog?.title}:${help}:${journal}:${handbook}:${session.hasChoices}:${session.battle?.pendingChoices}:${session.phase}:${session.paused}`,
  );
  const drag = useRef<{
    source: Source;
    x: number;
    y: number;
    moving: boolean;
    offset: Point;
  } | null>(null);
  const ignoreClickUntil = useRef(0);
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
    if (session.phase !== 'prepare') return;
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
    const stopLoop = startGameLoop(clock, repaint);
    const stopHeld = () => {
      session.held = false;
    };
    const suspend = () => {
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
      if (!d) return;
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
      stopHeld();
      const d = drag.current;
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
    const cancelPointer = () => {
      stopHeld();
      drag.current = null;
      setDragOffset(null);
      setHover(null);
    };
    window.addEventListener('blur', suspend);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pointermove', pointerMove, { passive: false });
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', cancelPointer);
    return () => {
      stopLoop();
      window.removeEventListener('blur', suspend);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', cancelPointer);
    };
  }, [clock, session]);
  const dragStart = (e: React.PointerEvent, source: Source, grabbedCell?: Point) => {
    if (session.phase === 'prepare' && e.button === 0) {
      const position =
        source.type === 'unit'
          ? session.preparation.units.find((u) => u.id === source.id)?.position
          : null;
      const offset =
        position && grabbedCell
          ? { x: grabbedCell.x - position.x, y: grabbedCell.y - position.y }
          : { x: 0, y: 0 };
      drag.current = { source, x: e.clientX, y: e.clientY, moving: false, offset };
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
      title: '重新开始四十关挑战',
      body: '清空本轮阵容、修行和灵钱，回到第 1 关。',
      label: '重新开始',
      action: () => {
        session.reset();
        setLastDefeat(null);
        clock.reset();
        setSelected(null);
        setMessage('新一轮免费招募已备好。');
        repaint();
      },
    });
  };
  const p = session.preparation;
  const battle = session.battle;
  const preparing = session.phase === 'prepare';
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
    window.scrollTo({ top: 0, behavior: 'instant' });
    document
      .querySelector<HTMLElement>(preparing ? '.titlebar h1' : '.combat-heading')
      ?.focus({ preventScroll: true });
  }, [preparing, battle, session]);
  const resume = () => {
    session.pause(false);
    clock.reset();
    repaint();
  };
  return (
    <main className={`app-shell ${preparing ? 'preparation-view' : 'combat-view'}`}>
      {preparing ? (
        <header className="titlebar">
          <div className="brand-mark">林</div>
          <div>
            <span className="eyebrow">MING DEFENSE · 四十关原型</span>
            <h1 tabIndex={-1}>灵林守阵</h1>
          </div>
          <div className="titlebar-tools">
            <button
              className="handbook-button"
              aria-label="灵兽图鉴"
              onClick={() => setHandbook(true)}
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
      {preparing && <EnemyIntel stageId={p.stageId} />}
      {preparing && lastDefeat && <DefeatAdvice session={session} recap={lastDefeat} preparing />}
      {preparing && p.stageId === 1 && !lastDefeat && (
        <FirstBattleGuide session={session} selected={selected} choose={choose} />
      )}
      <section className="field-panel">
        <Battlefield
          session={session}
          selected={selected}
          hover={hover}
          dragOffset={dragOffset}
          onCell={(point) => {
            if (performance.now() >= ignoreClickUntil.current) place(point);
          }}
          onDragStart={dragStart}
          onHover={setHover}
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
            onStart={() => {
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
          <span>四十关原型 · 临时数值待校准 · 自动保存检查点</span>
          <button className="text-button" onClick={reset}>
            重新开始
          </button>
        </footer>
      )}
      {session.hasChoices && (
        <TalentModal
          session={session}
          onChoose={(id) => {
            clock.reset();
            run(session.chooseBuff(id), '已领悟新天赋。');
          }}
        />
      )}
      {(session.phase === 'victory' || session.phase === 'defeat') && !session.hasChoices && (
        <ResultModal
          session={session}
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
        !handbook && (
          <PauseMenu
            session={session}
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
            onHandbook={() => setHandbook(true)}
            onReset={reset}
          />
        )}
      {journal && <BuffJournal session={session} onClose={() => setJournal(false)} />}
      {handbook && <SpiritHandbook onClose={() => setHandbook(false)} />}
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
            <h2 id="help-title">守过四十境，灵林长安</h2>
            <ol>
              <li>点招募再点空格部署，或拖动放置。同种同阶叠放合成，最高六阶；3/5阶会解锁技能。</li>
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
                第5关古木之灵、第10关鸣咒统领、第15关岩铠领主、第20关霜咒祭司、第25关岩咒督军、第30关玄羽妖帅、第35关赤角战魁、第40关玄甲咒尊是首领关。玄甲咒尊为远程护甲首领，射程2.2格、减伤15%，每12秒横扫（2秒预警），每14秒召2只咒影，半血后每次4只、上限10只、攻速提高35%。赤角战魁为近战，减伤15%，每10秒横扫（2秒预警），每16秒召唤，半血后攻速提高35%、每次召唤由2只增至4只，上限8只。玄羽妖帅远程攻击，仍先清前排，半血强化召唤。岩咒督军兼有15%护甲和半血强化召唤，横扫预警2秒。岩铠领主常驻15%减伤，横扫有1.8秒预警；霜咒祭司横扫预警2秒，半血后每次召唤由2只增加至4只，上限8只。第11–39关的普通关为既有敌人的混合攻势。第6关起加入远程怪、二阶招募和狼的狂暴，第8/9关加入召唤与分裂怪；清空全部敌人才获胜。
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
    </main>
  );
}
