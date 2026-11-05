import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { mouseCombatPlaytest } from '../game/fixtures/mouse-combat-playtest';
import type { BrowserLoadResult } from './useSessionStorage';
import { App } from './App';

const { boot } = vi.hoisted(() => ({ boot: { current: null as BrowserLoadResult | null } }));
vi.mock('./useSessionStorage', async (original) => ({
  ...(await original<typeof import('./useSessionStorage')>()),
  loadBrowserSession: () => boot.current!,
}));
vi.mock('../render/Battlefield', () => ({ Battlefield: () => <div>战场占位</div> }));
afterEach(() => vi.unstubAllGlobals());

test.each(['victory', 'defeat'] as const)(
  '%s实际App仅对样板替换结算操作，正常战役仍可推进或重试',
  (phase) => {
    vi.stubGlobal('window', { location: { pathname: '/game/' } });
    const session = mouseCombatPlaytest();
    session.start();
    session.phase = phase;
    boot.current = {
      session,
      message: '',
      isolated: true,
      blocked: true,
      recovered: false,
      mouseCombatPlaytest: true,
    };
    const sample = renderToStaticMarkup(<App />);
    expect(sample).toContain('重置动作样板');
    expect(sample).not.toContain('前往第');
    expect(sample).not.toContain('免费重试');
    boot.current = { ...boot.current, mouseCombatPlaytest: undefined };
    const normal = renderToStaticMarkup(<App />);
    expect(normal).not.toContain('重置动作样板');
    expect(normal).toContain(phase === 'victory' ? '前往第' : '免费重试');
  },
);
