import { AttackFrames } from './attack-frames';

/** Keep the original mouse projection API while sharing six-frame event tracking. */
export class MouseAttackFrames extends AttackFrames {
  constructor() {
    super('ember_mouse');
  }
}
