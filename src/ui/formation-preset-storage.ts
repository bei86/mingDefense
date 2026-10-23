import { clone } from '../game/content';
import { validFormation, type FormationPreset } from '../game/formation-presets';
import type { StoragePort } from '../game/persistence';

export const FORMATION_PRESETS_KEY = 'ming-defense:formation-presets';
export type FormationSlots = [
  FormationPreset | null,
  FormationPreset | null,
  FormationPreset | null,
];
export type FormationLibrary = { slots: FormationSlots; error: string | null };

export function emptyFormationSlots(): FormationSlots {
  return [null, null, null];
}

function cleanPreset(preset: FormationPreset): FormationPreset {
  return {
    units: preset.units.map(({ kind, rank, position }) => ({
      kind,
      rank,
      position: position ? { x: position.x, y: position.y } : null,
    })),
  };
}

export function readFormationLibrary(storage: StoragePort): FormationLibrary {
  try {
    const raw = storage.getItem(FORMATION_PRESETS_KEY);
    if (raw === null) return { slots: emptyFormationSlots(), error: null };
    if (raw.length > 32768 || new TextEncoder().encode(raw).length > 32768) throw new Error('size');
    const value = JSON.parse(raw);
    if (
      value?.schemaVersion !== 1 ||
      !Array.isArray(value.slots) ||
      value.slots.length !== 3 ||
      !value.slots.every((slot: unknown) => slot === null || validFormation(slot))
    )
      throw new Error('format');
    // Keep only the supported fields, never import unit ownership or other progress.
    const slots = value.slots.map(
      (slot: FormationPreset | null) => slot && cleanPreset(slot),
    ) as FormationSlots;
    return { slots, error: null };
  } catch {
    return { slots: emptyFormationSlots(), error: '阵型预设无法读取，原数据已保留；可重试读取。' };
  }
}

export function writeFormationSlot(
  storage: StoragePort,
  index: number,
  preset: FormationPreset | null,
): FormationLibrary {
  const current = readFormationLibrary(storage);
  if (current.error) return current;
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 3 ||
    (preset !== null && !validFormation(preset))
  )
    return { ...current, error: '阵型数据无效，未保存' };
  const slots = clone(current.slots);
  slots[index] = preset && cleanPreset(preset);
  try {
    storage.setItem(FORMATION_PRESETS_KEY, JSON.stringify({ schemaVersion: 1, slots }));
    return { slots, error: null };
  } catch {
    return { ...current, error: '保存失败，原预设未替换，请检查浏览器存储空间后重试。' };
  }
}
