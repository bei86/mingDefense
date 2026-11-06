import type Phaser from 'phaser';
import { artManifest, type ArtKey } from './art';
import { characterAnimations, type CharacterArtKey } from './character-art';

/** View-only image pool. Simulation state never stores renderer objects. */
export class ArtLayer {
  private images: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(private scene: Phaser.Scene) {}

  get stats(): { active: number; pooled: number } {
    return { active: this.used, pooled: this.images.length };
  }

  begin(): void {
    this.used = 0;
  }

  draw(
    key: ArtKey | CharacterArtKey | undefined,
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    alpha = 1,
    tint = 0xffffff,
    rotation = 0,
    frame = 0,
  ): boolean {
    if (!key || !this.scene.textures.exists(key)) return false;
    const image = this.images[this.used] ?? this.scene.add.image(0, 0, key);
    this.images[this.used++] = image;
    const animated = characterAnimations.find((art) => art.key === key);
    const source = animated ?? artManifest[key as ArtKey];
    const scale = Math.min(width / source.width, height / source.height);
    image
      .setTexture(key, animated ? frame : undefined)
      .setOrigin(animated?.originX ?? 0.5, animated?.originY ?? 0.5)
      .setPosition(x, y)
      .setScale(scale)
      .setRotation(rotation)
      .setAlpha(alpha)
      .setTint(tint)
      .setDepth(depth)
      .setVisible(true);
    return true;
  }

  end(): void {
    for (let i = this.used; i < this.images.length; i++) this.images[i].setVisible(false);
  }
}
