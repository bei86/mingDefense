import { validFormation, type FormationPreset } from '../game/formation-presets';

const format = 'ming-defense-formation';
const maxBytes = 8192;
export type FormationShareResult =
  | { ok: true; preset: FormationPreset }
  | { ok: false; error: string };

function clean(preset: FormationPreset): FormationPreset {
  return {
    units: preset.units.map(({ kind, rank, position }) => ({
      kind,
      rank,
      position: position ? { x: position.x, y: position.y } : null,
    })),
  };
}

export function createFormationShare(preset: FormationPreset): string {
  if (!validFormation(preset)) throw Error('阵型数据无效，无法生成分享码');
  return JSON.stringify({ format, version: 1, formation: clean(preset) });
}

export function inspectFormationShare(text: string): FormationShareResult {
  if (text.length > maxBytes || new TextEncoder().encode(text).length > maxBytes)
    return { ok: false, error: '分享码超过8KiB，请粘贴单套阵型的完整分享码。' };
  try {
    const value = JSON.parse(text);
    if (value?.format !== format || value.version !== 1)
      return { ok: false, error: '分享码格式或版本不支持，请使用本游戏的阵型分享码。' };
    if (!validFormation(value.formation))
      return { ok: false, error: '阵型数据无效，请检查灵兽、阶数、完整占格和备战席。' };
    return { ok: true, preset: clean(value.formation) };
  } catch {
    return { ok: false, error: '分享码无法解析，请粘贴完整文本。' };
  }
}
