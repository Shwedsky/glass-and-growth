import Phaser from 'phaser';
import { GameSceneV4 } from './GameSceneV4';
import { isUnlocked, type GameState } from './model';
import type { NodeId } from './content';
import { uiText } from '../uiText';

interface AmbientDot {
  object: Phaser.GameObjects.Arc | Phaser.GameObjects.Text;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  phase: number;
  kind: 'water' | 'pollen' | 'firefly' | 'life';
}

const STAGE_TEXTURES = Array.from({ length: 8 }, (_, i) => `greenhouse-stage-${i}`);

export class GameSceneV5 extends GameSceneV4 {
  private ambientDots: AmbientDot[] = [];
  private ambientClock = 0;

  constructor() {
    super();
    // GameSceneV4 keeps renderWorld private, but the runtime method is still
    // dispatched dynamically. Replace it on the instance so the stable V4
    // tree/HUD logic remains intact while the world presentation advances.
    (this as unknown as { renderWorld: () => void }).renderWorld = () => this.renderProgressiveWorld();
  }

  preload(): void {
    super.preload();
    for (let i = 0; i < STAGE_TEXTURES.length; i += 1) {
      this.load.image(STAGE_TEXTURES[i], `/art/stages/stage-${i}.jpg`);
    }
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if ((this as unknown as { treeOpen: boolean }).treeOpen) return;
    this.animateAmbient(delta / 1000);
  }

  private renderProgressiveWorld(): void {
    const self = this as unknown as {
      state: GameState;
      worldLayer: Phaser.GameObjects.Container;
      locale: 'ru' | 'en';
    };
    const { state, worldLayer } = self;
    const w = this.scale.width;
    const h = this.scale.height;
    const stage = this.getVisualStage(state);
    const background = this.add.image(w / 2, h / 2, STAGE_TEXTURES[stage]);
    this.cover(background, w, h);
    worldLayer.add(background);

    this.ambientDots = [];
    this.addAmbientMotion(stage, state, worldLayer);

    if (state.unlocked.length < 2) {
      const hint = this.add.text(w * 0.5, h * 0.84, uiText(self.locale, 'tap_tree_hint'), {
        fontFamily: 'Georgia, serif',
        fontSize: `${Math.max(18, Math.min(28, w / 65))}px`,
        color: '#ffe9a7',
        stroke: '#1a1008',
        strokeThickness: 5,
        shadow: { color: '#000000', fill: true, blur: 8, offsetX: 0, offsetY: 2 },
        align: 'center',
        wordWrap: { width: w * 0.42 },
      }).setOrigin(0.5).setDepth(10);
      worldLayer.add(hint);
    }

    const stageLabel = this.add.text(w / 2, h - 18, this.visualStageLabel(stage, self.locale), {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(11, Math.min(15, w / 105))}px`,
      color: '#f7e4aa',
      backgroundColor: '#07140ecc',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 1).setAlpha(0.88);
    worldLayer.add(stageLabel);
  }

  private getVisualStage(state: GameState): number {
    const has = (id: NodeId) => isUnlocked(state, id);
    if (has('final_bloom')) return 7;
    if (has('central_bud') || has('open_roof')) return 6;
    if (has('ecosystem') || has('birds') || has('climate') || has('roof_drive') || state.unlocked.length >= 25) return 5;
    if (has('pond') || has('filter') || has('auto_valves') || has('humidity') || state.unlocked.length >= 19) return 4;
    if (has('bees') || has('butterflies') || has('vines') || has('orchid') || state.unlocked.length >= 13) return 3;
    if (has('flowers') || has('gutters') || has('glass') || has('herbs') || has('gears') || state.unlocked.length >= 8) return 2;
    if (has('sprout') || has('pump') || has('bed') || state.unlocked.length >= 1) return 1;
    return 0;
  }

  private visualStageLabel(stage: number, locale: 'ru' | 'en'): string {
    const ru = [
      'Оранжерея спит',
      'Первые системы оживают',
      'Появляются вода и растения',
      'Возвращается жизнь',
      'Формируется экосистема',
      'Оранжерея почти восстановлена',
      'Сердце готовится к цветению',
      'Оранжерея восстановлена',
    ];
    const en = [
      'The greenhouse sleeps',
      'The first systems awaken',
      'Water and plants return',
      'Life returns',
      'The ecosystem takes shape',
      'The greenhouse is nearly restored',
      'The heart prepares to bloom',
      'The greenhouse is restored',
    ];
    return (locale === 'ru' ? ru : en)[stage];
  }

  private addAmbientMotion(stage: number, state: GameState, layer: Phaser.GameObjects.Container): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const has = (id: NodeId) => isUnlocked(state, id);

    if (stage >= 1 || has('pump')) {
      for (let i = 0; i < 8; i += 1) {
        const x = w * (0.10 + Math.random() * 0.12);
        const y = h * (0.42 + Math.random() * 0.34);
        const dot = this.add.circle(x, y, 1.5 + Math.random() * 2.2, 0xbbeeff, 0.28 + Math.random() * 0.26)
          .setBlendMode(Phaser.BlendModes.ADD);
        layer.add(dot);
        this.ambientDots.push({ object: dot, vx: 0, vy: 28 + Math.random() * 38, baseX: x, baseY: y, phase: Math.random() * Math.PI * 2, kind: 'water' });
      }
    }

    if (stage >= 2 || has('flowers')) {
      for (let i = 0; i < 10; i += 1) {
        const x = w * (0.34 + Math.random() * 0.48);
        const y = h * (0.30 + Math.random() * 0.48);
        const dot = this.add.circle(x, y, 1.2 + Math.random() * 1.8, 0xffd979, 0.22 + Math.random() * 0.28)
          .setBlendMode(Phaser.BlendModes.ADD);
        layer.add(dot);
        this.ambientDots.push({ object: dot, vx: (Math.random() - 0.5) * 9, vy: -(5 + Math.random() * 10), baseX: x, baseY: y, phase: Math.random() * Math.PI * 2, kind: 'pollen' });
      }
    }

    if (has('bees') || stage >= 3) {
      const count = stage >= 5 ? 4 : 2;
      for (let i = 0; i < count; i += 1) {
        const x = w * (0.62 + Math.random() * 0.24);
        const y = h * (0.34 + Math.random() * 0.30);
        const bee = this.add.text(x, y, '•', {
          fontFamily: 'serif',
          fontSize: `${Math.max(16, Math.min(25, w / 70))}px`,
          color: '#ffd34d',
          stroke: '#4a2b08',
          strokeThickness: 3,
        }).setOrigin(0.5).setAlpha(0.78);
        layer.add(bee);
        this.ambientDots.push({ object: bee, vx: 8 + Math.random() * 11, vy: (Math.random() - 0.5) * 7, baseX: x, baseY: y, phase: Math.random() * Math.PI * 2, kind: 'life' });
      }
    }

    if (has('ecosystem') || stage >= 5) {
      for (let i = 0; i < 14; i += 1) {
        const x = w * (0.20 + Math.random() * 0.64);
        const y = h * (0.20 + Math.random() * 0.58);
        const dot = this.add.circle(x, y, 1.5 + Math.random() * 2, 0xeaff91, 0.12 + Math.random() * 0.32)
          .setBlendMode(Phaser.BlendModes.ADD);
        layer.add(dot);
        this.ambientDots.push({ object: dot, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 5, baseX: x, baseY: y, phase: Math.random() * Math.PI * 2, kind: 'firefly' });
      }
    }
  }

  private animateAmbient(dt: number): void {
    this.ambientClock += dt;
    const w = this.scale.width;
    const h = this.scale.height;
    for (const item of this.ambientDots) {
      const o = item.object;
      if (!o.active) continue;
      if (item.kind === 'water') {
        o.y += item.vy * dt;
        o.x = item.baseX + Math.sin(this.ambientClock * 2.1 + item.phase) * 3;
        if (o.y > h * 0.82) o.y = h * 0.42;
      } else if (item.kind === 'pollen') {
        o.y += item.vy * dt;
        o.x += item.vx * dt + Math.sin(this.ambientClock * 1.4 + item.phase) * 0.15;
        o.setAlpha(0.18 + (Math.sin(this.ambientClock * 2 + item.phase) + 1) * 0.14);
        if (o.y < h * 0.20) o.y = h * 0.76;
      } else if (item.kind === 'life') {
        o.x += item.vx * dt;
        o.y = item.baseY + Math.sin(this.ambientClock * 2.6 + item.phase) * 16;
        if (o.x > w * 0.90) o.x = w * 0.60;
      } else {
        o.x += item.vx * dt;
        o.y += item.vy * dt;
        o.setAlpha(0.10 + (Math.sin(this.ambientClock * 3.2 + item.phase) + 1) * 0.22);
        if (o.x < w * 0.16 || o.x > w * 0.88 || o.y < h * 0.16 || o.y > h * 0.84) {
          o.x = item.baseX;
          o.y = item.baseY;
        }
      }
    }
  }

  private cover(image: Phaser.GameObjects.Image, width: number, height: number): void {
    const source = image.texture.getSourceImage() as HTMLImageElement;
    const scale = Math.max(width / source.width, height / source.height);
    image.setDisplaySize(source.width * scale, source.height * scale);
  }
}
