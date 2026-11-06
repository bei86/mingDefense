import type { CharacterMotion } from '../presentation/character-motion';

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

export const boarMotionArt = {
  attack: boarAttackArt,
  idle: {
    ...boarAttackArt,
    key: 'boar_idle_motion',
    file: 'assets/animations/boar/idle.webp',
    frames: 4,
  },
  hurt: {
    ...boarAttackArt,
    key: 'boar_hurt',
    file: 'assets/animations/boar/hurt.webp',
    frames: 3,
  },
  fallen: {
    ...boarAttackArt,
    key: 'boar_fallen',
    file: 'assets/animations/boar/fallen.webp',
    frames: 5,
  },
} as const;

export const boarAnimations = Object.values(boarMotionArt);
export const swordEagleAttackArt = {
  key: 'sword_eagle_attack',
  file: 'assets/animations/sword_eagle/attack.webp',
  frameWidth: 448,
  frameHeight: 352,
  frames: 6,
  // Shared envelope contains the widest wingbeat; breast anchor stays fixed at (240,224).
  width: 348,
  height: 258,
  originX: 240 / 448,
  originY: 180 / 352,
} as const;

export const swordEagleMotionArt = {
  attack: swordEagleAttackArt,
  idle: {
    ...swordEagleAttackArt,
    key: 'sword_eagle_idle_motion',
    file: 'assets/animations/sword_eagle/idle.webp',
    frames: 4,
  },
  hurt: {
    ...swordEagleAttackArt,
    key: 'sword_eagle_hurt',
    file: 'assets/animations/sword_eagle/hurt.webp',
    frames: 3,
  },
  fallen: {
    ...swordEagleAttackArt,
    key: 'sword_eagle_fallen',
    file: 'assets/animations/sword_eagle/fallen.webp',
    frames: 5,
  },
} as const;

export const swordEagleAnimations = Object.values(swordEagleMotionArt);
export const characterAnimations = [...mouseAnimations, ...boarAnimations, ...swordEagleAnimations];
export type CharacterArtKey = (typeof characterAnimations)[number]['key'];

export function characterAnimationUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file}`;
}

export function mouseAnimationUrl(file: string): string {
  return characterAnimationUrl(file);
}

export function resolveBoarArt(motion: CharacterMotion, exists: (key: string) => boolean) {
  return resolveMotionArt(motion, boarMotionArt, exists);
}

export function resolveSwordEagleArt(motion: CharacterMotion, exists: (key: string) => boolean) {
  return resolveMotionArt(motion, swordEagleMotionArt, exists);
}

/** Missing one strip must not hide the unit or disable the other available motions. */
export function resolveMouseArt(motion: CharacterMotion, exists: (key: string) => boolean) {
  return resolveMotionArt(motion, mouseMotionArt, exists);
}

function resolveMotionArt<K extends string>(
  motion: CharacterMotion,
  art: Record<CharacterMotion['action'], { key: K }>,
  exists: (key: string) => boolean,
) {
  const desired = art[motion.action];
  if (exists(desired.key)) return { key: desired.key, frame: motion.frame };
  for (const fallback of [art.attack, art.idle])
    if (exists(fallback.key)) return { key: fallback.key, frame: 0 };
  return null;
}
