import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Chunk = {
  file: string;
  name: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
};

describe.runIf(process.env.CHECK_STARTUP_BUILD === '1')('生产包启动依赖边界', () => {
  it('入口无需Phaser即可执行，游戏及引擎仅在动态入口加载', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('dist/.vite/manifest.json'), 'utf8'),
    ) as Record<string, Chunk>;
    const entry = manifest['index.html'];
    const game = manifest['src/ui/App.tsx'];
    expect(entry.isEntry).toBe(true);
    expect(game.isDynamicEntry).toBe(true);
    expect(
      Object.keys(manifest).some((key) =>
        /MotionPreview|mouse-preview-clock|motion-preview/.test(key),
      ),
    ).toBe(false);
    expect(entry.dynamicImports).toContain('src/ui/App.tsx');

    function staticDependencies(key: string, visited = new Set<string>()): Set<string> {
      if (visited.has(key)) return visited;
      visited.add(key);
      for (const dependency of manifest[key].imports ?? []) staticDependencies(dependency, visited);
      return visited;
    }
    const initial = [...staticDependencies('index.html')].map((key) => manifest[key]);
    const gameImports = [...staticDependencies('src/ui/App.tsx')].map((key) => manifest[key]);
    expect(initial.some((chunk) => chunk.name === 'phaser')).toBe(false);
    expect(initial).not.toContain(game);
    expect(gameImports.some((chunk) => chunk.name === 'phaser')).toBe(true);
    // Catches shared helper hoisting that silently pulls the engine back into initial execution.
    expect(
      initial.reduce((sum, chunk) => sum + statSync(resolve('dist', chunk.file)).size, 0),
    ).toBeLessThan(300_000);
    const html = readFileSync(resolve('dist/index.html'), 'utf8');
    expect(html).not.toMatch(/rel="modulepreload"[^>]*phaser/);
    const scripts = Object.values(manifest)
      .map((chunk) => readFileSync(resolve('dist', chunk.file), 'utf8'))
      .join('\n');
    expect(scripts).not.toMatch(/ranged8|本标签页最近战果|减远程后获益|20270105|20270115|20270112/);
    expect(scripts).not.toMatch(/mouse-motion|角色动作预览|烬灵鼠动作预览|动作画布初始化失败/);
    expect(
      scripts.match(
        /仅开发版 · 独立场景|选择试玩场景|进入所选试玩|首战 · 从零布阵|八灵 · 技能验收|返回正式战役|不会把试玩阵容带入正式战役/,
      )?.[0],
    ).toBeUndefined();
  });
});
