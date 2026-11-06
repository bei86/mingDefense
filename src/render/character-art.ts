import type { MouseMotion } from '../presentation/mouse-motion';

/** Separate from the static-art converter: every frame keeps its shared canvas and anchor. */
export const mouseAttackArt = {
  key: 'ember_mouse_attack',
  file: 'assets/animations/ember_mouse/attack.webp',
  frameWidth: 256,
  frameHeight: 256,
  frames: 6,
  // First pose's reference body bounds; fixed for every frame, including extended hands.
  width: 168,
  height: 216,
  originX: 128 / 256,
  originY: 131 / 256,
} as const;

export const mouseMotionArt = {
  attack: mouseAttackArt,
  idle: {
    ...mouseAttackArt,
    key: 'ember_mouse_idle_motion',
    file: 'assets/animations/ember_mouse/idle.webp',
    frames: 4,
  },
  hurt: {
    ...mouseAttackArt,
    key: 'ember_mouse_hurt',
    file: 'assets/animations/ember_mouse/hurt.webp',
    frames: 3,
  },
  fallen: {
    ...mouseAttackArt,
    key: 'ember_mouse_fallen',
    file: 'assets/animations/ember_mouse/fallen.webp',
    frames: 5,
    // Canvas contact shifts +40px to fit the tail; origin shifts equally, preserving world position.
    originX: 168 / 256,
  },
} as const;

export const mouseAnimations = Object.values(mouseMotionArt);
export type MouseArtKey = (typeof mouseAnimations)[number]['key'];

export const boarAttackArt = {
  key: 'boar_attack',
  file: 'assets/animations/boar/attack.webp',
  frameWidth: 384,
  frameHeight: 288,
  frames: 6,
  // Fixed first-pose body size and center; every foot stays at canvas y=256.
  width: 308,
  height: 218,
  originX: 193 / 384,
  originY: 147 / 288,
} as const;

export const characterAnimations = [...mouseAnimations, boarAttackArt];
export type CharacterArtKey = (typeof characterAnimations)[number]['key'];

export function characterAnimationUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file}`;
}

export function mouseAnimationUrl(file: string): string {
  return characterAnimationUrl(file);
}

/** First pose remains the resting image, so attacks never jump between different drawings. */
export function resolveBoarArt(frame: number, exists: (key: string) => boolean) {
  return exists(boarAttackArt.key) ? { key: boarAttackArt.key, frame } : null;
}

/** Missing one strip must not hide the unit or disable the other available motions. */
export function resolveMouseArt(motion: MouseMotion, exists: (key: string) => boolean) {
  const desired = mouseMotionArt[motion.action];
  if (exists(desired.key)) return { key: desired.key, frame: motion.frame };
  for (const fallback of [mouseAttackArt, mouseMotionArt.idle])
    if (exists(fallback.key)) return { key: fallback.key, frame: 0 };
  return null;
}
