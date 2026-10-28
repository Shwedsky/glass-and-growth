import Phaser from 'phaser';
import { GameSceneV7 } from './GameSceneV7';
import { createInitialState, grantGrowth, isUnlocked, loadState, saveState, type GameState } from './model';
import { advanceGeneration, getGenerationBonuses, loadP4Meta, registerManualTap, registerWorldEvent, type P4MetaState } from './p4Meta';

interface AnalyticsDetail {
  event?: string;
  payload?: Record<string, unknown>;
}

export class GameSceneP4 extends GameSceneV7 {
  private livingLayer!: Phaser.GameObjects.Container;
  private meta: P4MetaState = loadP4Meta();
  private overlayClock = 0;
  private lastCompleted = false;
  private worldReactionIndex = 0;
  private onAnalyticsBound = (event: Event) => this.onAnalytics(event as CustomEvent<AnalyticsDetail>);
  private onWorldEventBound = () => this.onWorldEvent();

  constructor() {
    super();
  }

  create(): void {
    super.create();
    this.meta = loadP4Meta();
    this.livingLayer = this.add.container(0, 0).setDepth(1450);
    window.addEventListener('gg-analytics', this.onAnalyticsBound as EventListener);
    window.addEventListener('gg-world-event', this.onWorldEventBound as EventListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detachLivingListeners());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.detachLivingListeners());
    this.renderLivingOverlay();
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.overlayClock += delta / 1000;
    if (this.overlayClock >= 0.25) {
      this.overlayClock = 0;
      this.meta = loadP4Meta();
      const state = this.parentState();
      if (state.completed !== this.lastCompleted) {
        this.lastCompleted = state.completed;
        this.renderLivingOverlay();
      } else {
        this.refreshLivingVisibility();
      }
    }
  }

  private parentState(): GameState {
    return (this as unknown as { state: GameState }).state ?? loadState();
  }

  private parentTreeOpen(): boolean {
    return Boolean((this as unknown as { treeOpen: boolean }).treeOpen);
  }

  private detachLivingListeners(): void {
    window.removeEventListener('gg-analytics', this.onAnalyticsBound as EventListener);
    window.removeEventListener('gg-world-event', this.onWorldEventBound as EventListener);
  }

  private onAnalytics(event: CustomEvent<AnalyticsDetail>): void {
    if (event.detail?.event !== 'manual_tree_tap') return;
    const amount = Number(event.detail.payload?.amount) || 1;
    this.meta = registerManualTap(amount);
    this.animateTreeTap(amount);
    this.refreshLivingVisibility();
  }

  private onWorldEvent(): void {
    this.meta = registerWorldEvent();
    this.animateWorldReaction();
    this.refreshLivingVisibility();
  }

  private renderLivingOverlay(): void {
    if (!this.livingLayer) return;
    this.livingLayer.removeAll(true);
    const w = this.scale.width;
    const h = this.scale.height;
    const state = this.parentState();
    const treeOpen = this.parentTreeOpen();

    const badge = this.add.text(w * 0.5, 14, this.generationLabel(), {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(12, Math.min(15, w / 100))}px`,
      color: '#f7e4aa',
      backgroundColor: '#07140edd',
      padding: { x: 11, y: 5 },
    }).setOrigin(0.5, 0).setName('p4-generation-badge');
    this.livingLayer.add(badge);

    if (!treeOpen) {
      this.addTreeVigorVisual();
      const helper = getGenerationBonuses(this.meta).helperName;
      if (helper !== 'none') {
        const text = helper === 'gardener'
          ? this.tr('Садовник помогает оранжерее', 'The gardener is helping the greenhouse')
          : this.tr('Фонтан и автоматика поддерживают рост', 'Fountain and automation sustain growth');
        const helperBadge = this.add.text(w - 20, h - 62, text, {
          fontFamily: 'Georgia, serif', fontSize: `${Math.max(11, Math.min(14, w / 110))}px`,
          color: '#e9f6c8', backgroundColor: '#0b2118dd', padding: { x: 10, y: 6 },
        }).setOrigin(1, 1).setName('p4-helper-badge');
        this.livingLayer.add(helperBadge);
      }
    }

    if (state.completed && !treeOpen) this.renderGenerationEnding();
    this.refreshLivingVisibility();
  }

  private refreshLivingVisibility(): void {
    if (!this.livingLayer) return;
    const treeOpen = this.parentTreeOpen();
    for (const child of this.livingLayer.list) {
      const object = child as Phaser.GameObjects.GameObject & { name?: string; setVisible?: (value: boolean) => unknown };
      if (!object.setVisible) continue;
      if (object.name === 'p4-generation-badge') object.setVisible(true);
      else object.setVisible(!treeOpen);
    }
  }

  private generationLabel(): string {
    if (this.meta.generation === 1) return this.tr('Поколение 1 · Первое дерево', 'Generation 1 · First tree');
    if (this.meta.generation === 2) return this.tr('Поколение 2 · Садовник', 'Generation 2 · Gardener');
    return this.tr('Поколение 3 · Живая оранжерея', 'Generation 3 · Living greenhouse');
  }

  private addTreeVigorVisual(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const vigor = Phaser.Math.Clamp(this.meta.treeVigor / 100, 0, 1);
    const radius = Math.min(w, h) * (0.11 + vigor * 0.045);
    const glow = this.add.circle(w * 0.5, h * 0.52, radius, 0xb9ff82, 0.018 + vigor * 0.055)
      .setStrokeStyle(Math.max(1, Math.min(w, h) * 0.002), 0xe6ffad, 0.08 + vigor * 0.18)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('p4-vigor');
    this.livingLayer.add(glow);
    if (vigor > 0.15) {
      this.tweens.add({ targets: glow, alpha: glow.alpha * 1.7, scale: 1.018 + vigor * 0.018, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const leafCount = Math.floor(vigor * 7);
    for (let i = 0; i < leafCount; i += 1) {
      const angle = (Math.PI * 2 * i) / Math.max(1, leafCount) + vigor;
      const x = w * 0.5 + Math.cos(angle) * radius * (0.55 + (i % 3) * 0.10);
      const y = h * 0.51 + Math.sin(angle) * radius * 0.65;
      const leaf = this.add.text(x, y, '✦', {
        fontFamily: 'Georgia, serif', fontSize: `${10 + Math.round(vigor * 7)}px`, color: '#d9ff91',
        stroke: '#31561c', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0.18 + vigor * 0.32).setName('p4-vigor');
      this.livingLayer.add(leaf);
      this.tweens.add({ targets: leaf, y: y - 8 - i * 0.7, alpha: Math.min(0.75, leaf.alpha + 0.12), duration: 1700 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private animateTreeTap(amount: number): void {
    if (this.parentTreeOpen()) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const strength = Phaser.Math.Clamp(Math.log10(amount + 1) / 3, 0.18, 1);
    for (let i = 0; i < 4; i += 1) {
      const x = w * 0.5 + Phaser.Math.Between(-55, 55);
      const y = h * 0.54 + Phaser.Math.Between(-35, 40);
      const mote = this.add.circle(x, y, 2 + strength * 2.2, i % 2 === 0 ? 0xdfff8f : 0xffe38c, 0.55)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(1500);
      this.tweens.add({
        targets: mote,
        x: x + Phaser.Math.Between(-35, 35),
        y: y - Phaser.Math.Between(45, 90),
        scale: 0.2,
        alpha: 0,
        duration: 650 + Phaser.Math.Between(0, 300),
        onComplete: () => mote.destroy(),
      });
    }
  }

  private animateWorldReaction(): void {
    if (this.parentTreeOpen()) return;
    const state = this.parentState();
    const reactions: Array<'water' | 'petals' | 'life' | 'light'> = [];
    if (isUnlocked(state, 'pump') || isUnlocked(state, 'gutters')) reactions.push('water');
    if (isUnlocked(state, 'flowers')) reactions.push('petals');
    if (isUnlocked(state, 'bees')) reactions.push('life');
    if (isUnlocked(state, 'glass')) reactions.push('light');
    if (!reactions.length) reactions.push('light');
    const kind = reactions[this.worldReactionIndex++ % reactions.length];
    if (kind === 'water') this.waterBurst();
    else if (kind === 'petals') this.petalBurst();
    else if (kind === 'life') this.lifeFlight();
    else this.lightSweep();
  }

  private waterBurst(): void {
    const w = this.scale.width, h = this.scale.height;
    for (let i = 0; i < 20; i += 1) {
      const x = w * 0.16 + Phaser.Math.Between(-35, 45);
      const y = h * 0.36 + Phaser.Math.Between(-20, 35);
      const drop = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0x9de8ff, 0.72).setDepth(1510).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: drop, x: x + Phaser.Math.Between(-15, 20), y: h * 0.73 + Phaser.Math.Between(-20, 25), alpha: 0.10, duration: 800 + Phaser.Math.Between(0, 420), onComplete: () => drop.destroy() });
    }
  }

  private petalBurst(): void {
    const w = this.scale.width, h = this.scale.height;
    for (let i = 0; i < 16; i += 1) {
      const x = w * 0.78 + Phaser.Math.Between(-60, 60);
      const y = h * 0.60 + Phaser.Math.Between(-35, 35);
      const petal = this.add.ellipse(x, y, Phaser.Math.Between(4, 8), Phaser.Math.Between(2, 5), i % 2 ? 0xffc0cf : 0xffe2a8, 0.78).setDepth(1510);
      this.tweens.add({ targets: petal, x: x + Phaser.Math.Between(-90, 40), y: y - Phaser.Math.Between(40, 110), angle: Phaser.Math.Between(90, 260), alpha: 0, duration: 1100 + Phaser.Math.Between(0, 500), onComplete: () => petal.destroy() });
    }
  }

  private lifeFlight(): void {
    const w = this.scale.width, h = this.scale.height;
    for (let i = 0; i < 9; i += 1) {
      const x = w * 0.74 + Phaser.Math.Between(-45, 45);
      const y = h * 0.42 + Phaser.Math.Between(-45, 55);
      const spark = this.add.circle(x, y, 2.5, 0xffd45f, 0.82).setDepth(1510).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: spark, x: w * 0.50 + Phaser.Math.Between(-100, 100), y: h * 0.48 + Phaser.Math.Between(-90, 80), alpha: 0, duration: 900 + i * 80, ease: 'Sine.inOut', onComplete: () => spark.destroy() });
    }
  }

  private lightSweep(): void {
    const w = this.scale.width, h = this.scale.height;
    const beam = this.add.rectangle(w * 0.68, h * 0.28, w * 0.08, h * 0.72, 0xffe7a0, 0.08)
      .setAngle(18).setDepth(1505).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: beam, x: w * 0.38, alpha: 0, duration: 1000, ease: 'Sine.out', onComplete: () => beam.destroy() });
  }

  private renderGenerationEnding(): void {
    const w = this.scale.width, h = this.scale.height;
    const finalGeneration = this.meta.generation >= 3;
    const panelW = Math.min(620, w * 0.62);
    const panelH = Math.min(280, h * 0.36);
    const panel = this.add.rectangle(w / 2, h * 0.53, panelW, panelH, 0x06140d, 0.96)
      .setStrokeStyle(3, 0xffdf86, 0.95).setName('p4-ending');
    const title = this.add.text(w / 2, h * 0.45,
      finalGeneration ? this.tr('Оранжерея завершена', 'The greenhouse is complete') : this.tr('Дерево расцвело', 'The tree has bloomed'),
      { fontFamily: 'Georgia, serif', fontSize: `${Math.max(27, w / 47)}px`, color: '#ffe8a5', fontStyle: 'bold' }
    ).setOrigin(0.5).setName('p4-ending');
    const body = this.add.text(w / 2, h * 0.53,
      finalGeneration
        ? this.tr('Три поколения восстановили оранжерею. Это настоящий финал текущей кампании.', 'Three generations restored the greenhouse. This is the true ending of the current campaign.')
        : this.meta.generation === 1
          ? this.tr('Следующее дерево начнёт с уже работающей оранжереей. Садовник останется и будет помогать росту.', 'The next tree starts in an already working greenhouse. A gardener remains and helps growth.')
          : this.tr('Следующее поколение сохранит помощь садовника и добавит постоянную воду и автоматику.', 'The next generation keeps the gardener and adds persistent water and automation.'),
      { fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(14, w / 92)}px`, color: '#eee7d2', align: 'center', wordWrap: { width: panelW * 0.82 } }
    ).setOrigin(0.5).setName('p4-ending');
    this.livingLayer.add([panel, title, body]);

    if (!finalGeneration) {
      const buttonY = h * 0.63;
      const button = this.add.rectangle(w / 2, buttonY, Math.min(300, panelW * 0.55), 48, 0x245f30, 1)
        .setStrokeStyle(2, 0x9ad77f, 1).setInteractive({ useHandCursor: true }).setName('p4-ending');
      const label = this.add.text(w / 2, buttonY, this.tr('Вырастить новое дерево', 'Grow a new tree'), {
        fontFamily: 'Georgia, serif', fontSize: '17px', color: '#f7efc9', fontStyle: 'bold'
      }).setOrigin(0.5).setName('p4-ending');
      button.on('pointerdown', (_p, _x, _y, event) => { event.stopPropagation(); this.startNextGeneration(); });
      this.livingLayer.add([button, label]);
    }
  }

  private startNextGeneration(): void {
    const result = advanceGeneration();
    if (!result.advanced) return;
    const fresh = createInitialState();
    if (result.meta.generation === 2) fresh.unlocked = ['sprout', 'pump', 'bed'];
    else fresh.unlocked = ['sprout', 'pump', 'bed', 'gutters', 'flowers', 'glass', 'gears'];
    grantGrowth(fresh, result.startingGrowth);
    saveState(fresh);
    this.scene.restart();
  }

  private tr(ru: string, en: string): string {
    return ((this as unknown as { locale: 'ru' | 'en' }).locale ?? 'en') === 'ru' ? ru : en;
  }
}
