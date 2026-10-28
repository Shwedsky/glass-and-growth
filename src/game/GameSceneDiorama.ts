import Phaser from 'phaser';
import { GameSceneP4 } from './GameSceneP4';
import { DISCOVERY_NODES, type NodeId } from './content';
import { grantGrowth, isUnlocked, loadState, resetState, saveState, type GameState } from './model';
import { loadP4Meta } from './p4Meta';

interface BeeActor {
  image: Phaser.GameObjects.Image;
  phase: number;
  radiusX: number;
  radiusY: number;
  speed: number;
}

interface WaterDrop {
  dot: Phaser.GameObjects.Arc;
  phase: number;
  speed: number;
}

/**
 * P5 visual pivot: the greenhouse is no longer represented by swapping full-screen progression JPEGs.
 * A single architectural shell stays in place and the living systems are independent objects layered above it.
 * The existing economy/discovery UI remains owned by GameSceneP4.
 */
export class GameSceneDiorama extends GameSceneP4 {
  private dioramaLayer!: Phaser.GameObjects.Container;
  private dioramaTreeLayers: Phaser.GameObjects.Image[] = [];
  private dioramaFlowerPatch?: Phaser.GameObjects.Image;
  private dioramaHive?: Phaser.GameObjects.Image;
  private dioramaGardener?: Phaser.GameObjects.Image;
  private dioramaBees: BeeActor[] = [];
  private dioramaWaterDrops: WaterDrop[] = [];
  private dioramaClock = 0;
  private dioramaRefresh = 0;
  private dioramaLastTreeProgress = -1;
  private dioramaEventIndex = 0;
  private readonly dioramaDevMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1';
  private dioramaDevPanel?: Phaser.GameObjects.Container;
  private readonly dioramaWorldEventBound = () => this.onDioramaWorldEvent();

  preload(): void {
    super.preload();
    this.load.image('diorama-base', 'art/diorama/base.jpg');
    for (let i = 0; i < 5; i += 1) this.load.image(`diorama-tree-${i}`, `art/diorama/tree-${i}.png`);
    this.load.image('diorama-flowers', 'art/diorama/flowers.png');
    this.load.image('diorama-hive', 'art/diorama/hive.png');
    this.load.image('diorama-bee', 'art/diorama/bee.png');
    this.load.image('diorama-gardener', 'art/diorama/gardener.png');
  }

  create(): void {
    super.create();
    this.dioramaLayer = this.add.container(0, 0).setDepth(210);
    this.buildDiorama();
    window.addEventListener('gg-world-event', this.dioramaWorldEventBound);
    this.scale.on('resize', this.handleDioramaResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupDiorama, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupDiorama, this);
    if (this.dioramaDevMode) this.renderDioramaDevPanel();
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    const dt = Math.min(delta / 1000, 0.05);
    this.dioramaClock += dt;
    this.dioramaRefresh += dt;
    this.animateDiorama(dt);
    if (this.dioramaRefresh >= 0.10) {
      this.dioramaRefresh = 0;
      this.refreshDioramaState();
    }
  }

  private cleanupDiorama(): void {
    window.removeEventListener('gg-world-event', this.dioramaWorldEventBound);
    this.scale.off('resize', this.handleDioramaResize, this);
    this.dioramaLayer?.destroy(true);
    this.dioramaDevPanel?.destroy(true);
  }

  private handleDioramaResize(): void {
    this.buildDiorama();
    if (this.dioramaDevMode) this.renderDioramaDevPanel();
  }

  private isDiscoveryTreeOpen(): boolean {
    return Boolean((this as unknown as { treeOpen?: boolean }).treeOpen);
  }

  private buildDiorama(): void {
    if (!this.dioramaLayer) return;
    this.dioramaLayer.removeAll(true);
    this.dioramaTreeLayers = [];
    this.dioramaBees = [];
    this.dioramaWaterDrops = [];

    const w = this.scale.width;
    const h = this.scale.height;
    const base = this.add.image(w / 2, h / 2, 'diorama-base');
    this.coverDiorama(base, w, h);
    this.dioramaLayer.add(base);

    // Warm window light is independent from the background and can breathe subtly.
    const light = this.add.ellipse(w * 0.67, h * 0.35, w * 0.30, h * 0.56, 0xffe7a0, 0.055)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.dioramaLayer.add(light);
    this.tweens.add({ targets: light, alpha: 0.085, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    for (let i = 0; i < 5; i += 1) {
      const tree = this.add.image(w / 2, h / 2, `diorama-tree-${i}`).setAlpha(0);
      this.coverDiorama(tree, w, h);
      this.dioramaTreeLayers.push(tree);
      this.dioramaLayer.add(tree);
    }

    this.dioramaFlowerPatch = this.add.image(w / 2, h / 2, 'diorama-flowers').setAlpha(0);
    this.coverDiorama(this.dioramaFlowerPatch, w, h);
    this.dioramaLayer.add(this.dioramaFlowerPatch);

    this.dioramaHive = this.add.image(w / 2, h / 2, 'diorama-hive').setAlpha(0);
    this.coverDiorama(this.dioramaHive, w, h);
    this.dioramaLayer.add(this.dioramaHive);

    this.createWaterSystem();
    this.createBeeActors();
    this.createGardener();
    this.createForegroundDust();

    this.dioramaLastTreeProgress = -1;
    this.refreshDioramaState();
  }

  private createWaterSystem(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    for (let i = 0; i < 14; i += 1) {
      const dot = this.add.circle(w * 0.137, h * 0.49, 2.2 + (i % 3) * 0.55, 0xa8eaff, 0)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.dioramaLayer.add(dot);
      this.dioramaWaterDrops.push({ dot, phase: i / 14, speed: 0.58 + (i % 4) * 0.06 });
    }
  }

  private createBeeActors(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const specs = [
      { phase: 0.2, radiusX: w * 0.08, radiusY: h * 0.055, speed: 1.10 },
      { phase: 2.1, radiusX: w * 0.11, radiusY: h * 0.075, speed: 0.88 },
      { phase: 4.0, radiusX: w * 0.07, radiusY: h * 0.095, speed: 1.28 },
    ];
    for (const spec of specs) {
      const image = this.add.image(w * 0.75, h * 0.49, 'diorama-bee')
        .setDisplaySize(Math.max(24, w * 0.020), Math.max(18, h * 0.025))
        .setAlpha(0);
      this.dioramaLayer.add(image);
      this.dioramaBees.push({ image, ...spec });
    }
  }

  private createGardener(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.dioramaGardener = this.add.image(w * 0.73, h * 0.77, 'diorama-gardener')
      .setDisplaySize(Math.max(72, w * 0.055), Math.max(130, h * 0.20))
      .setOrigin(0.5, 1)
      .setAlpha(0);
    this.dioramaLayer.add(this.dioramaGardener);
  }

  private createForegroundDust(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    for (let i = 0; i < 18; i += 1) {
      const particle = this.add.circle(
        Phaser.Math.Between(Math.floor(w * 0.20), Math.floor(w * 0.88)),
        Phaser.Math.Between(Math.floor(h * 0.18), Math.floor(h * 0.80)),
        Phaser.Math.FloatBetween(0.8, 1.8),
        i % 3 === 0 ? 0xe7ffb0 : 0xffe6a5,
        Phaser.Math.FloatBetween(0.08, 0.22),
      ).setBlendMode(Phaser.BlendModes.ADD);
      this.dioramaLayer.add(particle);
      this.tweens.add({
        targets: particle,
        y: particle.y - Phaser.Math.Between(18, 48),
        x: particle.x + Phaser.Math.Between(-20, 20),
        alpha: Phaser.Math.FloatBetween(0.05, 0.28),
        duration: Phaser.Math.Between(2400, 5200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  private refreshDioramaState(): void {
    if (!this.dioramaLayer) return;
    const state = loadState();
    const meta = loadP4Meta();
    const hidden = this.isDiscoveryTreeOpen();
    this.dioramaLayer.setVisible(!hidden);
    this.dioramaDevPanel?.setVisible(!hidden);
    if (hidden) return;

    const progress = this.calculateTreeProgress(state, meta.treeVigor);
    this.applyTreeProgress(progress);

    const plantsVisible = isUnlocked(state, 'bed') || isUnlocked(state, 'flowers');
    const flowerAlpha = isUnlocked(state, 'flowers') ? 1 : plantsVisible ? 0.52 : 0;
    this.dioramaFlowerPatch?.setAlpha(flowerAlpha);

    const beesVisible = isUnlocked(state, 'bees') || meta.generation >= 2;
    this.dioramaHive?.setAlpha(beesVisible ? 0.95 : 0);
    for (const bee of this.dioramaBees) bee.image.setAlpha(beesVisible ? 0.92 : 0);

    const gardenerVisible = meta.generation >= 2;
    this.dioramaGardener?.setAlpha(gardenerVisible ? 0.95 : 0);

    const waterVisible = isUnlocked(state, 'pump') || meta.generation >= 2;
    for (const drop of this.dioramaWaterDrops) drop.dot.setAlpha(waterVisible ? 0.52 : 0);
  }

  private calculateTreeProgress(state: GameState, vigor: number): number {
    const campaign = Phaser.Math.Clamp(state.unlocked.length / Math.max(1, DISCOVERY_NODES.length), 0, 1);
    const tapGrowth = Phaser.Math.Clamp(vigor / 100, 0, 1);
    const generationFloor = (loadP4Meta().generation - 1) * 0.10;
    return Phaser.Math.Clamp(generationFloor + campaign * 0.58 + tapGrowth * 0.42, 0, 1);
  }

  private applyTreeProgress(progress: number): void {
    if (Math.abs(progress - this.dioramaLastTreeProgress) < 0.002) return;
    const previous = this.dioramaLastTreeProgress;
    this.dioramaLastTreeProgress = progress;
    const scaled = progress * (this.dioramaTreeLayers.length - 1);
    const lower = Math.floor(scaled);
    const upper = Math.min(this.dioramaTreeLayers.length - 1, lower + 1);
    const blend = scaled - lower;

    for (let i = 0; i < this.dioramaTreeLayers.length; i += 1) {
      const alpha = i === lower ? 1 - blend : i === upper ? blend : 0;
      this.dioramaTreeLayers[i].setAlpha(alpha);
    }

    if (previous >= 0 && progress > previous + 0.006) {
      const focus = this.dioramaTreeLayers[upper];
      this.tweens.killTweensOf(focus);
      focus.setScale(1.002);
      this.tweens.add({ targets: focus, scaleX: 1.008, scaleY: 1.008, duration: 130, yoyo: true, ease: 'Sine.out' });
    }
  }

  private animateDiorama(_dt: number): void {
    if (!this.dioramaLayer?.visible) return;
    const state = loadState();
    const meta = loadP4Meta();
    const w = this.scale.width;
    const h = this.scale.height;

    const waterVisible = isUnlocked(state, 'pump') || meta.generation >= 2;
    if (waterVisible) {
      for (const drop of this.dioramaWaterDrops) {
        const p = (this.dioramaClock * drop.speed + drop.phase) % 1;
        drop.dot.x = w * (0.135 + p * 0.025);
        drop.dot.y = h * (0.47 + p * 0.27);
        drop.dot.setAlpha(0.22 + Math.sin(p * Math.PI) * 0.48);
      }
    }

    const beesVisible = isUnlocked(state, 'bees') || meta.generation >= 2;
    if (beesVisible) {
      const centerX = w * 0.74;
      const centerY = h * 0.50;
      for (const bee of this.dioramaBees) {
        const a = this.dioramaClock * bee.speed + bee.phase;
        const x = centerX + Math.cos(a) * bee.radiusX + Math.sin(a * 2.3) * w * 0.018;
        const y = centerY + Math.sin(a * 1.35) * bee.radiusY + Math.cos(a * 2.1) * h * 0.012;
        const dx = x - bee.image.x;
        bee.image.setPosition(x, y).setFlipX(dx < 0).setRotation(Math.sin(a * 2.0) * 0.08);
      }
    }

    if (this.dioramaGardener && meta.generation >= 2) {
      const t = (Math.sin(this.dioramaClock * 0.45) + 1) / 2;
      const left = w * 0.63;
      const right = w * 0.84;
      this.dioramaGardener.x = Phaser.Math.Linear(left, right, t);
      this.dioramaGardener.y = h * 0.79 + Math.sin(this.dioramaClock * 2.8) * 1.5;
      this.dioramaGardener.setFlipX(Math.cos(this.dioramaClock * 0.45) < 0);
    }
  }

  private onDioramaWorldEvent(): void {
    if (this.isDiscoveryTreeOpen()) return;
    const state = loadState();
    const reactions: Array<'water' | 'flowers' | 'bees'> = [];
    if (isUnlocked(state, 'pump')) reactions.push('water');
    if (isUnlocked(state, 'flowers')) reactions.push('flowers');
    if (isUnlocked(state, 'bees')) reactions.push('bees');
    if (!reactions.length) return;
    const kind = reactions[this.dioramaEventIndex++ % reactions.length];
    if (kind === 'water') this.surgeWater();
    else if (kind === 'flowers') this.releasePetals();
    else this.swarmBees();
  }

  private surgeWater(): void {
    for (const drop of this.dioramaWaterDrops) {
      this.tweens.add({ targets: drop.dot, scale: 2.2, alpha: 0.95, duration: 180, yoyo: true, ease: 'Sine.out' });
    }
  }

  private releasePetals(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    for (let i = 0; i < 16; i += 1) {
      const petal = this.add.ellipse(w * 0.79 + Phaser.Math.Between(-80, 70), h * 0.66 + Phaser.Math.Between(-35, 25), 7, 4, i % 2 ? 0xffc9d2 : 0xffe6aa, 0.82).setDepth(430);
      this.tweens.add({ targets: petal, x: petal.x + Phaser.Math.Between(-130, 50), y: petal.y - Phaser.Math.Between(70, 180), angle: Phaser.Math.Between(100, 300), alpha: 0, duration: 1000 + i * 45, onComplete: () => petal.destroy() });
    }
  }

  private swarmBees(): void {
    for (const bee of this.dioramaBees) {
      this.tweens.add({ targets: bee.image, scaleX: 1.35, scaleY: 1.35, duration: 160, yoyo: true, repeat: 2, ease: 'Sine.inOut' });
    }
  }

  private renderDioramaDevPanel(): void {
    this.dioramaDevPanel?.destroy(true);
    const w = this.scale.width;
    const h = this.scale.height;
    const panel = this.add.container(w / 2, h - 12).setDepth(2600);
    const makeButton = (x: number, label: string, action: 'reset' | 'boost' | 'finish') => {
      const text = this.add.text(x, 0, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#f2ead5', backgroundColor: '#102219ee', padding: { x: 9, y: 5 },
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
      text.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (action === 'reset') resetState();
        else {
          const state = loadState();
          if (action === 'boost') grantGrowth(state, 1_000_000_000);
          else {
            state.unlocked = DISCOVERY_NODES.map((node) => node.id);
            state.completed = true;
          }
          saveState(state);
        }
        this.scene.restart();
      });
      return text;
    };
    panel.add([
      this.add.text(-210, 0, 'DIORAMA DEV', { fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#ffd989', backgroundColor: '#2e1c0bee', padding: { x: 7, y: 5 }, fontStyle: 'bold' }).setOrigin(0.5, 1),
      makeButton(-90, 'RESET', 'reset'),
      makeButton(20, '+1B', 'boost'),
      makeButton(135, 'FINISH', 'finish'),
    ]);
    this.dioramaDevPanel = panel;
  }

  private coverDiorama(image: Phaser.GameObjects.Image, width: number, height: number): void {
    const source = image.texture.getSourceImage() as HTMLImageElement;
    const scale = Math.max(width / source.width, height / source.height);
    image.setDisplaySize(source.width * scale, source.height * scale);
  }
}
