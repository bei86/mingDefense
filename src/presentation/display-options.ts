export const DISPLAY_OPTIONS_KEY = 'ming-defense:display:v1';
export type DisplayOptions = { numbers: boolean; motion: 'system' | 'reduced' };
export type DisplayEffects = { numbers: boolean; reducedMotion: boolean };
export const DEFAULT_DISPLAY_OPTIONS: Readonly<DisplayOptions> = {
  numbers: true,
  motion: 'system',
};
type PreferenceStore = Pick<Storage, 'getItem' | 'setItem'>;

export function readDisplayOptions(
  isolated = false,
  storage: () => PreferenceStore = () => localStorage,
): DisplayOptions {
  if (!isolated) {
    try {
      const raw = storage().getItem(DISPLAY_OPTIONS_KEY);
      const value: unknown = raw === null ? null : JSON.parse(raw);
      if (
        value !== null &&
        typeof value === 'object' &&
        'version' in value &&
        value.version === 1 &&
        'numbers' in value &&
        typeof value.numbers === 'boolean' &&
        'motion' in value &&
        (value.motion === 'system' || value.motion === 'reduced')
      )
        return { numbers: value.numbers, motion: value.motion };
    } catch {
      // Optional display preferences must not block play.
    }
  }
  return { ...DEFAULT_DISPLAY_OPTIONS };
}

export function saveDisplayOptions(
  options: DisplayOptions,
  isolated = false,
  storage: () => PreferenceStore = () => localStorage,
): boolean {
  if (isolated) return true;
  try {
    storage().setItem(DISPLAY_OPTIONS_KEY, JSON.stringify({ version: 1, ...options }));
    return true;
  } catch {
    return false;
  }
}

export function displayEffects(options: DisplayOptions, systemReduced: boolean): DisplayEffects {
  return { numbers: options.numbers, reducedMotion: systemReduced || options.motion === 'reduced' };
}
