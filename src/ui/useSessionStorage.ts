import { useEffect, useRef, useState } from 'react';
import { loadSession, saveSession, validSave, type StoragePort } from '../game/persistence';
import { Session } from '../game/session';
import bossCheckpoint from '../game/fixtures/boss-checkpoint.json';
import { rosterPlaytest } from '../game/fixtures/roster-playtest';

const browserStorage: StoragePort = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
let initialLoad: ReturnType<typeof loadSession> | null = null;
export function loadBrowserSession() {
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('playtest') === 'roster'
  )
    return {
      session: rosterPlaytest(),
      message: '开发八灵技能验收场景：固定阵容，不写入存档。',
      recovered: false,
      blocked: true,
    };
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('playtest') === 'boss'
  ) {
    if (validSave(bossCheckpoint))
      return {
        session: Session.restore(bossCheckpoint),
        message: '开发验收场景：正常经济模拟的第五关检查点；不写入存档。',
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
