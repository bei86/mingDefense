import { useEffect, useRef, useState } from 'react';
import {
  loadSession,
  saveSession,
  validSave,
  type StoragePort,
  type LoadResult,
} from '../game/persistence';
import { Session } from '../game/session';
import bossCheckpoint from '../game/fixtures/boss-checkpoint.json';
import { approachPlaytest, rosterPlaytest } from '../game/fixtures/roster-playtest';
import stage6Checkpoint from '../game/fixtures/stage-6-checkpoint.json';
import stage10Checkpoint from '../game/fixtures/stage-10-checkpoint.json';
import stage8Checkpoint from '../game/fixtures/stage-8-checkpoint.json';
import stage11Checkpoint from '../game/fixtures/stage-11-checkpoint.json';
import stage15Checkpoint from '../game/fixtures/stage-15-checkpoint.json';
import stage16Checkpoint from '../game/fixtures/stage-16-checkpoint.json';
import stage20Checkpoint from '../game/fixtures/stage-20-checkpoint.json';
import calibration20Checkpoint from '../game/fixtures/calibration-20-checkpoint.json';
import calibration25Checkpoint from '../game/fixtures/calibration-25-checkpoint.json';
import calibration30Checkpoint from '../game/fixtures/calibration-30-checkpoint.json';
import calibration35Checkpoint from '../game/fixtures/calibration-35-checkpoint.json';
import calibration40Checkpoint from '../game/fixtures/calibration-40-checkpoint.json';
import stage21Checkpoint from '../game/fixtures/stage-21-checkpoint.json';
import stage25Checkpoint from '../game/fixtures/stage-25-checkpoint.json';
import stage26Checkpoint from '../game/fixtures/stage-26-checkpoint.json';
import stage30Checkpoint from '../game/fixtures/stage-30-checkpoint.json';
import stage31Checkpoint from '../game/fixtures/stage-31-checkpoint.json';
import stage35Checkpoint from '../game/fixtures/stage-35-checkpoint.json';
import stage36Checkpoint from '../game/fixtures/stage-36-checkpoint.json';
import stage40Checkpoint from '../game/fixtures/stage-40-checkpoint.json';
import stage41Checkpoint from '../game/fixtures/stage-41-checkpoint.json';
import stage45Checkpoint from '../game/fixtures/stage-45-checkpoint.json';
import stage46Checkpoint from '../game/fixtures/stage-46-checkpoint.json';
import stage50Checkpoint from '../game/fixtures/stage-50-checkpoint.json';

export const browserStorage: StoragePort = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
let initialLoad: ReturnType<typeof loadSession> | null = null;
export function loadBrowserSession(): LoadResult {
  const playtest = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('playtest')
    : null;
  if (playtest === 'onboarding')
    return {
      session: new Session(),
      message: '开发首战试玩：独立新局，不读取或写入正式存档，刷新后重新开始。',
      recovered: false,
      blocked: true,
      isolated: true,
    };
  if (playtest === 'approach')
    return {
      session: approachPlaytest(),
      message: '开发三格接敌验收场景：固定满阵与第40关首领，不代表经济路线，不写入存档。',
      recovered: false,
      blocked: true,
      isolated: true,
    };
  if (playtest === 'roster')
    return {
      session: rosterPlaytest(),
      message: '开发八灵技能验收场景：固定阵容，不写入存档。',
      recovered: false,
      blocked: true,
      isolated: true,
    };
  if (
    playtest === 'calibration20' ||
    playtest === 'calibration25' ||
    playtest === 'calibration30' ||
    playtest === 'calibration35' ||
    playtest === 'calibration40' ||
    playtest === 'stage41' ||
    playtest === 'stage45' ||
    playtest === 'stage46' ||
    playtest === 'stage50'
  ) {
    const { checkpoint, source } = {
      calibration20: {
        checkpoint: calibration20Checkpoint,
        source: 'v18三格规则合法经济路线第20关',
      },
      calibration25: {
        checkpoint: calibration25Checkpoint,
        source: 'v19三格规则合法经济路线第25关',
      },
      calibration30: {
        checkpoint: calibration30Checkpoint,
        source: 'v20三格规则合法经济路线第30关',
      },
      calibration35: {
        checkpoint: calibration35Checkpoint,
        source: 'v21三格规则合法经济路线第35关',
      },
      calibration40: {
        checkpoint: calibration40Checkpoint,
        source: 'v22三格规则合法经济路线第40关',
      },
      stage41: {
        checkpoint: stage41Checkpoint,
        source: 'v23三格规则合法控制路线第41关',
      },
      stage45: {
        checkpoint: stage45Checkpoint,
        source: 'v23三格规则合法控制路线第45关',
      },
      stage46: {
        checkpoint: stage46Checkpoint,
        source: 'v24三格规则合法控制路线第46关',
      },
      stage50: {
        checkpoint: stage50Checkpoint,
        source: 'v24三格规则合法控制路线第50关',
      },
    }[playtest];
    const valid = validSave(checkpoint);
    return {
      session: valid ? Session.restore(checkpoint) : new Session(),
      message: valid
        ? `开发校准验收：${source}，未使用聚灵；不读取或写入正式存档。`
        : '开发检查点无效，已进入临时新局；不读取或写入正常存档。',
      recovered: false,
      blocked: true,
      isolated: true,
    };
  }
  if (
    playtest === 'boss' ||
    playtest === 'stage6' ||
    playtest === 'stage8' ||
    playtest === 'stage10' ||
    playtest === 'stage11' ||
    playtest === 'stage15' ||
    playtest === 'stage16' ||
    playtest === 'stage20' ||
    playtest === 'stage21' ||
    playtest === 'stage25' ||
    playtest === 'stage26' ||
    playtest === 'stage30' ||
    playtest === 'stage31' ||
    playtest === 'stage35' ||
    playtest === 'stage36' ||
    playtest === 'stage40'
  ) {
    const checkpoint = {
      boss: bossCheckpoint,
      stage6: stage6Checkpoint,
      stage8: stage8Checkpoint,
      stage10: stage10Checkpoint,
      stage11: stage11Checkpoint,
      stage15: stage15Checkpoint,
      stage16: stage16Checkpoint,
      stage20: stage20Checkpoint,
      stage21: stage21Checkpoint,
      stage25: stage25Checkpoint,
      stage26: stage26Checkpoint,
      stage30: stage30Checkpoint,
      stage31: stage31Checkpoint,
      stage35: stage35Checkpoint,
      stage36: stage36Checkpoint,
      stage40: stage40Checkpoint,
    }[playtest];
    const valid = validSave(checkpoint);
    return {
      session: valid ? Session.restore(checkpoint) : new Session(),
      message: valid
        ? `开发验收场景：历史1格规则经济路线的第${checkpoint.preparation.stageId}关检查点，当前按3格接敌；不写入存档。`
        : '开发检查点无效，已进入临时新局；不读取或写入正常存档。',
      recovered: false,
      blocked: true,
      isolated: true,
    };
  }
  return (initialLoad ??= loadSession(browserStorage));
}
export function useSessionStorage(session: Session, blocked: boolean, initialMessage: string) {
  const [message, setMessage] = useState(initialMessage);
  const [failed, setFailed] = useState(blocked);
  const savedRevision = useRef(-1);
  useEffect(() => {
    if (blocked || savedRevision.current === session.revision) return;
    const error = saveSession(browserStorage, session);
    savedRevision.current = session.revision;
    if (error) {
      setMessage(error);
      setFailed(true);
    }
  }, [session, session.revision, blocked]);
  useEffect(() => {
    const save = () => {
      if (!blocked) {
        const error = saveSession(browserStorage, session);
        if (error) {
          setMessage(error);
          setFailed(true);
        }
      }
    };
    window.addEventListener('pagehide', save);
    const hidden = () => {
      if (document.hidden) save();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [session, blocked]);
  return { message, failed, dismiss: () => setMessage('') };
}
