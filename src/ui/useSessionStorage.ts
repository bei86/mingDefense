import { useEffect, useRef, useState } from 'react';
import { loadSession, saveSession, validSave, type StoragePort } from '../game/persistence';
import { Session } from '../game/session';
import bossCheckpoint from '../game/fixtures/boss-checkpoint.json';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';
import stage6Checkpoint from '../game/fixtures/stage-6-checkpoint.json';
import stage10Checkpoint from '../game/fixtures/stage-10-checkpoint.json';
import stage8Checkpoint from '../game/fixtures/stage-8-checkpoint.json';
import stage11Checkpoint from '../game/fixtures/stage-11-checkpoint.json';
import stage15Checkpoint from '../game/fixtures/stage-15-checkpoint.json';

const browserStorage: StoragePort = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
let initialLoad: ReturnType<typeof loadSession> | null = null;
export function loadBrowserSession() {
  const playtest = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('playtest')
    : null;
  if (playtest === 'roster')
    return {
      session: rosterPlaytest(),
      message: '开发八灵技能验收场景：固定阵容，不写入存档。',
      recovered: false,
      blocked: true,
    };
  if (
    playtest === 'boss' ||
    playtest === 'stage6' ||
    playtest === 'stage8' ||
    playtest === 'stage10' ||
    playtest === 'stage11' ||
    playtest === 'stage15'
  ) {
    const checkpoint = {
      boss: bossCheckpoint,
      stage6: stage6Checkpoint,
      stage8: stage8Checkpoint,
      stage10: stage10Checkpoint,
      stage11: stage11Checkpoint,
      stage15: stage15Checkpoint,
    }[playtest];
    const valid = validSave(checkpoint);
    return {
      session: valid ? Session.restore(checkpoint) : new Session(),
      message: valid
        ? `开发验收场景：正常经济模拟的第${checkpoint.preparation.stageId}关检查点；不写入存档。`
        : '开发检查点无效，已进入临时新局；不读取或写入正常存档。',
      recovered: false,
      blocked: true,
    };
  }
  return (initialLoad ??= loadSession(browserStorage));
}
export function useSessionStorage(session: Session, blocked: boolean, initialMessage: string) {
  const [message, setMessage] = useState(initialMessage);
  const savedRevision = useRef(-1);
  useEffect(() => {
    if (blocked || savedRevision.current === session.revision) return;
    const error = saveSession(browserStorage, session);
    savedRevision.current = session.revision;
    if (error) setMessage(error);
  }, [session, session.revision, blocked]);
  useEffect(() => {
    const save = () => {
      if (!blocked) {
        const error = saveSession(browserStorage, session);
        if (error) setMessage(error);
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
  return { message, dismiss: () => setMessage('') };
}
