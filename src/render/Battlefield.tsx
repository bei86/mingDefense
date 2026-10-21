import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import {
  appearances,
  bossDefinition,
  config,
  cells,
  center,
  key,
  type HeroId,
  type EnemyKind,
  type Point,
} from '../game/content';
import { maxHeroHp } from '../game/combat-skills';
import { expansionError, placementError, unitAt, type Session, type Source } from '../game/session';
import { boardDrop } from '../ui/board-drop';
import { artUrl, battlefieldArt, bossArtKey, enemyArt, heroArt } from './art';
import { ArtLayer } from './ArtLayer';

const SIZE = 52;
const ORIGIN = { x: 24, y: 74 };
const pixel = (p: Point) => ({ x: ORIGIN.x + p.x * SIZE, y: ORIGIN.y + p.y * SIZE });
const enemyColors: Record<EnemyKind, number> = {
  ranged: 0xc2a5df,
  summoner: 0xddab7f,
  splitter: 0x8baca5,
  split_fragment: 0xb7c9ae,
  boss: 0x967b52,
  croc: 0x9bac70,
  runner: 0xceaa85,
  summoned_wolf: 0x82958a,
  wolf: 0xadb4a2,
};
type View = { selected: Source | null; hover: Point | null; dragOffset: Point | null };
type BattlefieldProps = View & {
  session: Session;
  onCell: (p: Point) => void;
  onDragStart: (e: React.PointerEvent, source: Source, grabbedCell?: Point) => void;
  onHover: (p: Point | null) => void;
};

function animal(g: Phaser.GameObjects.Graphics, kind: HeroId, x: number, y: number, dead: boolean) {
  const color = Phaser.Display.Color.HexStringToColor(appearances[kind].color).color;
  g.fillStyle(0x061812, 0.4).fillEllipse(x, y + 17, 43, 13);
  g.lineStyle(2, 0xe7f5d7, dead ? 0.12 : 0.75);
  g.fillStyle(color, dead ? 0.18 : 1);
  if (kind === 'ember_mouse') {
    g.fillCircle(x - 12, y - 12, 8)
      .fillCircle(x + 12, y - 12, 8)
      .fillEllipse(x, y, 29, 32);
    g.fillStyle(0xffedd0, dead ? 0.1 : 0.85).fillEllipse(x, y + 7, 16, 12);
    g.lineStyle(3, color, dead ? 0.1 : 1)
      .beginPath()
      .moveTo(x + 13, y + 8)
      .lineTo(x + 24, y + 4)
      .lineTo(x + 20, y - 6)
      .strokePath();
    g.fillStyle(0xffe391, dead ? 0.15 : 1).fillTriangle(
      x - 4,
      y - 17,
      x + 5,
      y - 17,
      x + 2,
      y - 29,
    );
  } else if (kind === 'boar') {
    g.fillTriangle(x - 21, y - 7, x - 23, y - 21, x - 9, y - 15).fillTriangle(
      x + 21,
      y - 7,
      x + 23,
      y - 21,
      x + 9,
      y - 15,
    );
    g.fillRoundedRect(x - 25, y - 15, 50, 34, 12);
    g.fillStyle(0xe4eac3, dead ? 0.1 : 1).fillEllipse(x, y + 9, 24, 15);
    g.fillStyle(0x6e8f56, dead ? 0.1 : 1).fillTriangle(x - 12, y - 12, x + 12, y - 12, x, y - 23);
  } else if (kind === 'fortune_peach') {
    g.fillCircle(x - 7, y, 13)
      .fillCircle(x + 7, y, 13)
      .fillTriangle(x - 17, y + 5, x + 17, y + 5, x, y + 22);
    g.fillStyle(0xa9d293, dead ? 0.1 : 1).fillEllipse(x + 9, y - 19, 23, 10);
    g.fillStyle(0xf8dea4, dead ? 0.1 : 1).fillCircle(x, y + 7, 6);
  } else if (kind === 'ice_fish') {
    g.fillEllipse(x, y, 25, 42).fillTriangle(x, y + 16, x - 14, y + 30, x + 14, y + 30);
    g.fillStyle(0xe1f4fa, dead ? 0.1 : 0.8)
      .fillTriangle(x - 10, y - 3, x - 24, y + 8, x - 9, y + 13)
      .fillTriangle(x + 10, y - 3, x + 24, y + 8, x + 9, y + 13);
  } else if (kind === 'shield_fox') {
    g.fillEllipse(x, y + 3, 30, 30)
      .fillTriangle(x - 14, y - 3, x - 15, y - 24, x - 2, y - 9)
      .fillTriangle(x + 14, y - 3, x + 15, y - 24, x + 2, y - 9);
    g.fillStyle(0xf2e5ef, dead ? 0.1 : 0.8).fillTriangle(x - 10, y + 3, x + 10, y + 3, x, y + 15);
  } else if (kind === 'piercing_monkey') {
    g.fillCircle(x - 17, y - 6, 8)
      .fillCircle(x + 17, y - 6, 8)
      .fillEllipse(x, y + 2, 32, 36);
    g.fillStyle(0xffe9bc, dead ? 0.1 : 0.9).fillEllipse(x, y, 24, 23);
    g.lineStyle(4, color, dead ? 0.1 : 1)
      .beginPath()
      .moveTo(x - 12, y + 12)
      .lineTo(x - 28, y + 16)
      .lineTo(x - 34, y + 6)
      .lineTo(x - 28, y)
      .strokePath();
    g.lineStyle(4, 0xf1d48d, dead ? 0.1 : 1).lineBetween(x - 48, y + 14, x + 48, y + 14);
    g.lineStyle(6, 0x9c7250, dead ? 0.1 : 1).lineBetween(x - 35, y + 14, x + 35, y + 14);
  } else if (kind === 'scatter_bear') {
    g.fillCircle(x - 14, y - 20, 9)
      .fillCircle(x + 14, y - 20, 9)
      .fillRoundedRect(x - 19, y - 17, 38, 44, 13)
      .fillCircle(x - 23, y + 7, 10)
      .fillCircle(x + 23, y + 7, 10);
    g.fillStyle(0xeff0e4, dead ? 0.1 : 0.9).fillEllipse(x, y + 3, 24, 19);
    g.lineStyle(3, 0x747e94, dead ? 0.1 : 1)
      .lineBetween(x - 28, y + 3, x - 19, y + 3)
      .lineBetween(x + 19, y + 3, x + 28, y + 3);
    g.fillStyle(0x53616d, dead ? 0.1 : 1).fillTriangle(x - 4, y, x + 4, y, x, y + 5);
  } else {
    g.fillTriangle(x - 6, y - 5, x - 34, y - 14, x - 23, y + 14).fillTriangle(
      x + 6,
      y - 5,
      x + 34,
      y - 14,
      x + 23,
      y + 14,
    );
    g.fillEllipse(x, y, 23, 34);
    g.fillStyle(0xf3e3a2, dead ? 0.1 : 1).fillTriangle(x - 4, y, x + 4, y, x, y + 8);
    g.lineStyle(3, 0xd8f3ee, dead ? 0.1 : 0.9).lineBetween(x + 30, y - 24, x + 23, y + 16);
    g.lineStyle(2, 0xe9d797, dead ? 0.1 : 1).lineBetween(x + 19, y + 7, x + 31, y + 10);
  }
  g.fillStyle(0x15352b, dead ? 0.1 : 1)
    .fillCircle(x - 6, y - 4, 2)
    .fillCircle(x + 6, y - 4, 2);
}

export function Battlefield({
  session,
  selected,
  hover,
  dragOffset,
  onCell,
  onDragStart,
  onHover,
}: BattlefieldProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ selected, hover, dragOffset });
  view.current = { selected, hover, dragOffset };
  useEffect(() => {
    if (!host.current) return;
    const samplingDensity = () =>
      Math.min(
        3,
        Math.max(
          1,
          Math.ceil((host.current!.getBoundingClientRect().width * window.devicePixelRatio) / 360),
        ),
      );
    let renderDensity = samplingDensity();
    class FieldScene extends Phaser.Scene {
      private drawing!: Phaser.GameObjects.Graphics;
      private overlay!: Phaser.GameObjects.Graphics;
      private art!: ArtLayer;
      private preparing: boolean | null = null;
      private density = 0;
      preload() {
        for (const key of battlefieldArt) this.load.image(key, artUrl(key));
      }
      create() {
        this.drawing = this.add.graphics();
        this.overlay = this.add.graphics().setDepth(10);
        this.art = new ArtLayer(this);
      }
      update() {
        if (!this.drawing) return;
        const g = this.drawing;
        g.clear();
        const overlay = this.overlay;
        overlay.clear();
        const preparing = session.phase === 'prepare';
        if (preparing !== this.preparing || renderDensity !== this.density) {
          this.preparing = preparing;
          this.density = renderDensity;
          this.scale.getParentBounds();
          this.scale.setGameSize(360 * renderDensity, (preparing ? 416 : 480) * renderDensity);
          this.cameras.main
            .setZoom((preparing ? 1 : 0.9) * renderDensity)
            .centerOn(180, preparing ? 208 : 150);
        }
        this.art.begin();
        this.art.draw(
          'battlefield_forest',
          180,
          preparing ? 208 : 150,
          preparing ? 360 : 420,
          preparing ? 540 : 630,
          -20,
        );
        g.fillStyle(0x102e28, 0.25).fillRect(-80, -240, 520, 720);
        if (!preparing) {
          // The approach area shares the simulation's coordinates and cannot be deployed into.
          g.fillStyle(0x99ad79, 0.07).fillRoundedRect(
            ORIGIN.x,
            ORIGIN.y + config.waves.spawnRow * SIZE,
            6 * SIZE,
            -config.waves.spawnRow * SIZE,
            26,
          );
          g.lineStyle(1.5, 0xcbd3a0, 0.3).lineBetween(ORIGIN.x, ORIGIN.y, 336, ORIGIN.y);
        }
        if (preparing) g.lineStyle(1, 0xc9d9b0, 0.25).strokeRoundedRect(16, 66, 328, 328, 14);
        const prep = session.preparation;
        if (preparing)
          for (let y = 0; y < 6; y++)
            for (let x = 0; x < 6; x++) {
              const p = pixel({ x, y });
              const unlocked = prep.unlocked.includes(key({ x, y }));
              g.fillStyle(unlocked ? 0x48604b : 0x1b4036, unlocked ? 0.85 : 0.7).fillRoundedRect(
                p.x + 2,
                p.y + 2,
                SIZE - 4,
                SIZE - 4,
                7,
              );
              g.lineStyle(
                1,
                unlocked ? 0xb3b895 : 0x6d9274,
                unlocked ? 0.32 : 0.16,
              ).strokeRoundedRect(p.x + 2, p.y + 2, SIZE - 4, SIZE - 4, 7);
              if (!unlocked) g.fillStyle(0x8eb095, 0.2).fillCircle(p.x + 26, p.y + 26, 2);
            }
        const units =
          session.battle?.allies ??
          prep.units
            .filter((u) => u.position)
            .map((u) => ({
              ...u,
              hp: maxHeroHp(u, prep.progression),
              maxHp: maxHeroHp(u, prep.progression),
              shield: 0,
            }));
        // In preparation, the full opaque footprint makes occupied cells unambiguous.
        if (preparing)
          for (const u of units) {
            if (!u.position) continue;
            const footprint = cells(u.kind, u.position);
            const left = Math.min(...footprint.map((c) => c.x));
            const top = Math.min(...footprint.map((c) => c.y));
            const width = Math.max(...footprint.map((c) => c.x)) - left + 1;
            const height = Math.max(...footprint.map((c) => c.y)) - top + 1;
            const p = pixel({ x: left, y: top });
            const color = Phaser.Display.Color.HexStringToColor(appearances[u.kind].color);
            const border = color.color;
            const fill = color.darken(u.hp > 0 ? 54 : 72).color;
            g.fillStyle(fill, 1).fillRoundedRect(
              p.x + 2,
              p.y + 2,
              width * SIZE - 4,
              height * SIZE - 4,
              7,
            );
            g.lineStyle(1, border, 1).strokeRoundedRect(
              p.x + 2,
              p.y + 2,
              width * SIZE - 4,
              height * SIZE - 4,
              7,
            );
          }
        const { selected: choice, hover: over, dragOffset: offset } = view.current;
        const chosen = choice?.type === 'unit' ? prep.units.find((u) => u.id === choice.id) : null;
        const offer = choice?.type === 'offer' ? prep.offers.find((o) => o.id === choice.id) : null;
        if (chosen?.position && session.phase === 'prepare')
          for (const c of cells(chosen.kind, chosen.position)) {
            const p = pixel(c);
            g.lineStyle(2, 0xf6d18b, 1).strokeRoundedRect(p.x + 3, p.y + 3, 46, 46, 7);
          }
        if (over && choice && session.phase === 'prepare') {
          const kind = chosen?.kind ?? offer?.kind;
          if (kind) {
            const destination = boardDrop(prep, choice, over, offset ?? undefined);
            const target =
              'merge' in destination ? prep.units.find((u) => u.id === destination.merge) : null;
            const rank = chosen?.rank ?? offer?.rank ?? 1;
            const merge =
              target &&
              target.id !== chosen?.id &&
              target.kind === kind &&
              target.rank === rank &&
              rank < session.maxRank;
            let valid: boolean;
            let preview: Point[];
            if (kind === 'cell') {
              valid = !expansionError(prep, over);
              preview = [over];
            } else if (merge) {
              valid = true;
              preview = cells(target.kind, target.position!);
            } else {
              const anchor = 'merge' in destination ? over : destination;
              valid = !placementError(prep, kind, anchor, chosen?.id);
              preview = cells(kind, anchor);
            }
            for (const c of preview) {
              const p = pixel(c);
              g.fillStyle(valid ? 0xc5e2a7 : 0xe48a76, 0.25).fillRoundedRect(
                p.x + 3,
                p.y + 3,
                46,
                46,
                7,
              );
            }
          }
        }
        for (const u of units) {
          if (!u.position) continue;
          const p = pixel(center(u.kind, u.position));
          const shape = cells(u.kind, u.position);
          const top = ORIGIN.y + Math.min(...shape.map((c) => c.y)) * SIZE;
          const bottom = ORIGIN.y + (Math.max(...shape.map((c) => c.y)) + 1) * SIZE;
          const width = (Math.max(...shape.map((c) => c.x)) - u.position.x + 1) * SIZE;
          const height = bottom - top;
          if (
            !this.art.draw(
              heroArt[u.kind],
              p.x,
              p.y,
              width - 10,
              height - 16,
              2,
              u.hp > 0 ? 1 : 0.28,
            )
          ) {
            animal(g, u.kind, p.x, p.y - 4, u.hp <= 0);
          }
          for (let i = 0; i < u.rank; i++)
            overlay
              .fillStyle(0xf3d892, u.hp > 0 ? 1 : 0.25)
              .fillCircle(p.x + (i - (u.rank - 1) / 2) * 6, bottom - 7, 1.8);
          if ((u.shield ?? 0) > 0 && u.hp > 0) {
            this.art.draw(
              'fx_shield',
              p.x,
              p.y,
              Math.min(width + 6, 92),
              Math.min(height + 4, 96),
              6,
              0.55,
            );
            overlay
              .fillStyle(0xddc5f3, 0.9)
              .fillRect(p.x - 17, top + 10, Math.min(34, ((u.shield ?? 0) / u.maxHp) * 85), 2);
          }
          if (session.battle) {
            overlay.fillStyle(0x092b23).fillRoundedRect(p.x - 18, top + 4, 36, 4, 2);
            overlay
              .fillStyle(0xc4dd98)
              .fillRoundedRect(p.x - 18, top + 4, 36 * Math.max(0, u.hp / u.maxHp), 4, 2);
          }
        }
        const battle = session.battle;
        if (!battle) {
          this.art.end();
          return;
        }
        for (const field of battle.fields) {
          const p = pixel(field);
          this.art.draw('fx_sword_field', p.x, p.y, SIZE * 2.3, SIZE * 1.8, 1, 0.55);
          g.lineStyle(1.5, 0xa6e1df, 0.5).strokeCircle(p.x, p.y, SIZE * 1.1);
          g.fillStyle(0x87d1cb, 0.08).fillCircle(p.x, p.y, SIZE * 1.1);
        }
        for (const warning of battle.warnings) {
          const g = overlay;
          const p = pixel({ x: 0, y: warning.row });
          g.fillStyle(0xf09c78, 0.18 + Math.sin(battle.time / 100) * 0.08).fillRect(
            ORIGIN.x,
            p.y,
            6 * SIZE,
            SIZE,
          );
          g.lineStyle(2, 0xf8b18a, 0.8).strokeRect(ORIGIN.x, p.y, 6 * SIZE, SIZE);
        }
        for (const e of battle.enemies) {
          const g = overlay;
          const p = pixel(e);
          const boss = e.kind === 'boss';
          const color = enemyColors[e.kind ?? 'wolf'];
          const picture = boss ? bossArtKey(battle.stageId) : enemyArt[e.kind ?? 'wolf'];
          const pictured = this.art.draw(
            picture,
            p.x,
            p.y,
            boss ? 84 : 38,
            boss ? 88 : 42,
            4,
            1,
            boss && e.phase2 ? 0xffc898 : 0xffffff,
          );
          if (pictured) {
            if (!boss) {
              g.fillStyle(0x133529).fillRect(p.x - 14, p.y - 25, 28, 3);
              g.fillStyle(0xe8a482).fillRect(
                p.x - 14,
                p.y - 25,
                28 * Math.max(0, e.hp / (e.maxHp ?? 220)),
                3,
              );
            }
          } else if (boss) {
            g.fillStyle(0x091e15, 0.5).fillEllipse(p.x, p.y + 29, 74, 24);
            g.fillStyle(color).fillRoundedRect(p.x - 25, p.y - 27, 50, 57, 12);
            g.lineStyle(5, 0xb1a47b, 0.9)
              .lineBetween(p.x - 18, p.y - 17, p.x - 35, p.y - 35)
              .lineBetween(p.x + 18, p.y - 17, p.x + 35, p.y - 35);
            g.fillStyle(0x79935c)
              .fillCircle(p.x - 29, p.y - 27, 13)
              .fillCircle(p.x + 29, p.y - 27, 13);
            const definition = bossDefinition(battle.stageId);
            if (definition.id === config.secondBoss.id) {
              g.lineStyle(3, 0xc9b0e0, 0.9).strokeCircle(p.x, p.y, 38);
              g.fillStyle(0xd7c1ee).fillTriangle(
                p.x - 13,
                p.y - 29,
                p.x + 13,
                p.y - 29,
                p.x,
                p.y - 44,
              );
            }
            if (definition.damageReductionPercent) {
              g.fillStyle(0x819b9d).fillRoundedRect(p.x - 24, p.y - 20, 48, 47, 6);
              g.lineStyle(3, 0xd7e3dc, 0.95)
                .strokeRoundedRect(p.x - 27, p.y - 23, 54, 53, 8)
                .lineBetween(p.x, p.y - 19, p.x, p.y + 26)
                .lineBetween(p.x - 22, p.y + 8, p.x + 22, p.y + 8);
              g.fillStyle(0xd7e3dc)
                .fillTriangle(p.x - 25, p.y - 19, p.x - 39, p.y - 38, p.x - 10, p.y - 19)
                .fillTriangle(p.x + 25, p.y - 19, p.x + 39, p.y - 38, p.x + 10, p.y - 19);
            }
            if (definition.id === config.fourthBoss.id) {
              g.fillStyle(0x738ba6).fillRoundedRect(p.x - 24, p.y - 25, 48, 55, 9);
              g.lineStyle(3, e.phase2 ? 0xe9b4d8 : 0xb4e5ed, 0.9)
                .strokeCircle(p.x, p.y, 37)
                .lineBetween(p.x + 35, p.y - 29, p.x + 35, p.y + 28);
              g.fillStyle(e.phase2 ? 0xe9b4d8 : 0xb4e5ed).fillCircle(p.x + 35, p.y - 31, 7);
              g.fillStyle(0xd9e7ef).fillTriangle(
                p.x - 22,
                p.y - 22,
                p.x + 22,
                p.y - 22,
                p.x,
                p.y - 46,
              );
            }
            if (definition.id === config.fifthBoss.id) {
              const rune = e.phase2 ? 0xff925b : 0xe4c378;
              g.fillStyle(0x4c6064).fillRoundedRect(p.x - 24, p.y - 24, 48, 53, 6);
              g.lineStyle(3, rune, 0.95)
                .strokeRoundedRect(p.x - 26, p.y - 26, 52, 57, 6)
                .strokeCircle(p.x, p.y, 39)
                .lineBetween(p.x, p.y - 20, p.x, p.y + 26)
                .lineBetween(p.x + 37, p.y - 38, p.x + 37, p.y + 31);
              g.fillStyle(rune)
                .fillTriangle(p.x + 29, p.y - 27, p.x + 45, p.y - 27, p.x + 37, p.y - 47)
                .fillTriangle(p.x - 18, p.y - 23, p.x - 12, p.y - 43, p.x - 5, p.y - 23)
                .fillTriangle(p.x + 5, p.y - 23, p.x + 12, p.y - 43, p.x + 18, p.y - 23);
            }
            if (definition.id === config.eighthBoss.id) {
              const jade = e.phase2 ? 0xffce86 : 0x9bd7c4;
              g.fillStyle(0x375653).fillRoundedRect(p.x - 24, p.y - 25, 48, 55, 8);
              g.lineStyle(3, jade, 0.95)
                .strokeRoundedRect(p.x - 26, p.y - 27, 52, 59, 8)
                .lineBetween(p.x - 15, p.y - 10, p.x + 15, p.y - 10)
                .lineBetween(p.x, p.y - 10, p.x, p.y + 24)
                .lineBetween(p.x + 36, p.y - 28, p.x + 36, p.y + 30)
                .strokeCircle(p.x + 36, p.y - 36, 10);
              g.fillStyle(jade)
                .fillRoundedRect(p.x - 15, p.y - 44, 9, 22, 2)
                .fillRoundedRect(p.x + 6, p.y - 44, 9, 22, 2)
                .fillTriangle(p.x - 5, p.y + 5, p.x + 5, p.y + 5, p.x, p.y + 15);
            }
            if (definition.id === config.seventhBoss.id) {
              const ember = e.phase2 ? 0xffcb78 : 0xdb825b;
              g.fillStyle(0x764d3f).fillRoundedRect(p.x - 24, p.y - 23, 48, 52, 8);
              g.lineStyle(3, ember, 0.95)
                .strokeRoundedRect(p.x - 26, p.y - 25, 52, 56, 8)
                .lineBetween(p.x - 35, p.y - 4, p.x - 35, p.y + 28)
                .lineBetween(p.x + 35, p.y - 4, p.x + 35, p.y + 28);
              g.fillStyle(ember)
                .fillTriangle(p.x - 20, p.y - 21, p.x - 28, p.y - 47, p.x - 6, p.y - 23)
                .fillTriangle(p.x + 6, p.y - 23, p.x + 28, p.y - 47, p.x + 20, p.y - 21)
                .fillRoundedRect(p.x - 47, p.y - 16, 24, 20, 4)
                .fillRoundedRect(p.x + 23, p.y - 16, 24, 20, 4);
            }
            if (definition.id === config.sixthBoss.id) {
              const feather = e.phase2 ? 0xffb27c : 0xb5dcf2;
              g.fillStyle(0x67679b).fillRoundedRect(p.x - 23, p.y - 24, 46, 53, 10);
              g.fillStyle(feather)
                .fillTriangle(p.x - 20, p.y - 12, p.x - 45, p.y - 30, p.x - 35, p.y + 18)
                .fillTriangle(p.x + 20, p.y - 12, p.x + 43, p.y - 30, p.x + 30, p.y + 18)
                .fillTriangle(p.x - 14, p.y - 24, p.x - 8, p.y - 45, p.x, p.y - 25)
                .fillTriangle(p.x, p.y - 25, p.x + 8, p.y - 45, p.x + 14, p.y - 24);
              g.lineStyle(3, feather, 0.95)
                .strokeEllipse(p.x + 32, p.y, 22, 65)
                .lineBetween(p.x + 27, p.y - 30, p.x + 27, p.y + 30)
                .lineBetween(p.x + 19, p.y, p.x + 47, p.y);
            }
            g.fillStyle(e.phase2 ? 0xffb18a : 0xe4d9a1)
              .fillCircle(p.x - 10, p.y - 4, 4)
              .fillCircle(p.x + 10, p.y - 4, 4);
          } else {
            g.fillStyle(0x17271e, 0.4).fillEllipse(p.x, p.y + 10, 28, 9);
            g.fillStyle(color)
              .fillTriangle(p.x - 11, p.y - 4, p.x - 12, p.y - 19, p.x - 2, p.y - 9)
              .fillTriangle(p.x + 11, p.y - 4, p.x + 12, p.y - 19, p.x + 2, p.y - 9)
              .fillEllipse(p.x, p.y, e.kind === 'croc' ? 34 : 23, 24);
            g.fillStyle(0xe9ad89)
              .fillCircle(p.x - 5, p.y - 3, 2)
              .fillCircle(p.x + 5, p.y - 3, 2);
            if (e.kind === 'ranged') {
              g.fillStyle(color)
                .fillTriangle(p.x - 8, p.y, p.x - 24, p.y - 14, p.x - 19, p.y + 10)
                .fillTriangle(p.x + 8, p.y, p.x + 24, p.y - 14, p.x + 19, p.y + 10);
              g.lineStyle(2, 0xe4d2f2).lineBetween(p.x + 18, p.y - 16, p.x + 18, p.y + 17);
            } else if (e.kind === 'summoner') {
              g.lineStyle(2, 0xf0c591).strokeCircle(p.x, p.y, 18);
              g.fillStyle(0xf0c591).fillTriangle(
                p.x - 6,
                p.y - 12,
                p.x + 6,
                p.y - 12,
                p.x,
                p.y - 25,
              );
            } else if (e.kind === 'splitter') {
              g.fillStyle(color).fillRoundedRect(p.x - 18, p.y - 8, 36, 26, 5);
              g.fillStyle(0xe1e4c4).fillTriangle(p.x - 5, p.y - 5, p.x + 5, p.y - 5, p.x, p.y - 24);
              g.lineStyle(2, 0x4f6f67)
                .lineBetween(p.x - 5, p.y + 2, p.x + 1, p.y + 7)
                .lineBetween(p.x + 1, p.y + 7, p.x - 3, p.y + 15);
            } else if (e.kind === 'split_fragment') {
              g.fillStyle(0xe1e4c4).fillTriangle(p.x - 9, p.y + 9, p.x + 9, p.y + 9, p.x, p.y - 9);
            }
            g.fillStyle(0x133529).fillRect(p.x - 12, p.y - 24, 24, 3);
            g.fillStyle(0xe8a482).fillRect(p.x - 12, p.y - 24, (24 * e.hp) / (e.maxHp ?? 220), 3);
          }
          if ((e.frozenUntil ?? 0) > battle.time) {
            this.art.draw('fx_freeze', p.x, p.y, boss ? 90 : 48, boss ? 94 : 54, 7, 0.4);
            g.lineStyle(2, 0xbae9f4, 0.95).strokeRoundedRect(p.x - 19, p.y - 24, 38, 44, 5);
          } else if ((e.slowUntil ?? 0) > battle.time) {
            if (!this.art.draw('fx_slow', p.x, p.y, boss ? 90 : 44, boss ? 86 : 40, 6, 0.6))
              g.lineStyle(2, 0x9bdde9, 0.7).strokeCircle(p.x, p.y + 10, 19);
          }
          if ((e.vulnerabilityUntil ?? 0) > battle.time) {
            g.lineStyle(2, 0xf4c879, 0.95).strokeTriangle(
              p.x - 5,
              p.y - 31,
              p.x + 5,
              p.y - 31,
              p.x,
              p.y - 23,
            );
          }
        }
        for (const f of battle.flashes) {
          const g = overlay;
          const from = pixel(f.from);
          const to = pixel(f.to);
          if (f.kind === 'boar')
            this.art.draw(
              'fx_heavy_hit',
              to.x,
              to.y,
              44,
              38,
              8,
              Math.max(0, 1 - (battle.time - f.at) / 300),
            );
          const color =
            f.team === 'enemy'
              ? 0xeb947e
              : Phaser.Display.Color.HexStringToColor(appearances[f.kind!].color).color;
          g.lineStyle(
            f.kind === 'sword_eagle' || f.kind === 'piercing_monkey' ? 3 : 2,
            color,
            Math.max(0, 1 - (battle.time - f.at) / 300),
          ).lineBetween(from.x, from.y, to.x, to.y);
          g.lineStyle(2, color, 0.7).strokeCircle(to.x, to.y, 8 + (battle.time - f.at) / 20);
        }
        this.art.end();
      }
    }
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: 360 * renderDensity,
      height: 416 * renderDensity,
      backgroundColor: '#14372f',
      scene: FieldScene,
      render: { antialias: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      audio: { noAudio: true },
      input: { mouse: false, touch: false },
      banner: false,
    });
    const resizeField = () => {
      renderDensity = samplingDensity();
      if (game.isBooted) {
        game.scale.getParentBounds();
        game.scale.refresh();
      }
    };
    const resize = new ResizeObserver(resizeField);
    resize.observe(host.current!);
    window.addEventListener('resize', resizeField);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', resizeField);
      game.destroy(true);
    };
  }, [session]);
  return (
    <div className={`battlefield ${session.phase === 'prepare' ? '' : 'approach-field'}`}>
      <div ref={host} className="canvas-host" aria-hidden="true" />
      <div className={`forest-sign ${session.phase === 'prepare' ? '' : 'enemy-entry'}`}>
        {session.phase === 'prepare'
          ? '选择灵兽 · 布下守阵'
          : `敌袭入口 · 接敌距离${-config.waves.spawnRow}格 ↓`}
      </div>
      {session.phase === 'prepare' && (
        <div className="board-input" role="group" aria-label="六乘六布阵棋盘">
          {Array.from({ length: 36 }, (_, i) => {
            const p = { x: i % 6, y: Math.floor(i / 6) };
            const u = unitAt(session.preparation, p);
            const open = session.preparation.unlocked.includes(key(p));
            return (
              <button
                key={i}
                data-cell-x={p.x}
                data-cell-y={p.y}
                className="board-cell"
                disabled={session.phase !== 'prepare'}
                aria-label={`${p.x + 1}列${p.y + 1}行，${u ? `${appearances[u.kind].name}${u.rank}阶` : open ? '空地' : '未解锁'}`}
                onClick={() => onCell(p)}
                onPointerDown={(e) => {
                  if (u) onDragStart(e, { type: 'unit', id: u.id }, p);
                }}
                onPointerEnter={() => onHover(p)}
                onPointerLeave={() => onHover(null)}
              />
            );
          })}
        </div>
      )}
      {session.battle?.warnings.length ? (
        <div className="cleave-alert" role="status">
          横扫预警 · 第 {session.battle.warnings[0].row + 1} 行
        </div>
      ) : null}
      <div className="board-caption">
        {session.phase === 'prepare'
          ? '同种同阶叠放合成 · 灵兽不自动换位'
          : session.paused
            ? '已暂停 · 继续后重新按住聚灵石'
            : session.battle?.boosted
              ? '聚灵加速中 · 攻速 +50%'
              : '灵兽自动攻击 · 按住聚灵石加速'}
      </div>
    </div>
  );
}
