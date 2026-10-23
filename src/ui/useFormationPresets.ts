import { useState } from 'react';
import { clone } from '../game/content';
import { validFormation, type FormationPreset } from '../game/formation-presets';
import { browserStorage } from './useSessionStorage';
import {
  emptyFormationSlots,
  readFormationLibrary,
  writeFormationSlot,
  type FormationLibrary,
} from './formation-preset-storage';

export function useFormationPresets(isolated: boolean) {
  const [library, setLibrary] = useState<FormationLibrary>(() =>
    isolated ? { slots: emptyFormationSlots(), error: null } : readFormationLibrary(browserStorage),
  );
  const update = (index: number, preset: FormationPreset | null): string | null => {
    if (isolated) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= 3 ||
        (preset !== null && !validFormation(preset))
      )
        return '阵型数据无效，未保存';
      const slots = clone(library.slots);
      slots[index] = clone(preset);
      setLibrary({ slots, error: null });
      return null;
    }
    const result = writeFormationSlot(browserStorage, index, preset);
    setLibrary(result);
    return result.error;
  };
  const reload = () => {
    if (!isolated) setLibrary(readFormationLibrary(browserStorage));
  };
  return { ...library, update, reload };
}
