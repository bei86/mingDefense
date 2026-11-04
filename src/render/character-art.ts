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

export function mouseAttackUrl(): string {
  return `${import.meta.env.BASE_URL}${mouseAttackArt.file}`;
}
