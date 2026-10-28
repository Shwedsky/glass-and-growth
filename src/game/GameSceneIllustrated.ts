import Phaser from 'phaser';
import { GameSceneP4 } from './GameSceneP4';
import { DISCOVERY_NODES, type NodeId } from './content';
import { grantGrowth, isUnlocked, loadState, resetState, saveState, type GameState } from './model';
import { loadP4Meta } from './p4Meta';

interface LifeMote {
  body: Phaser.GameObjects.Ellipse;
  halo: Phaser.GameObjects.Arc;
  phase: number;
  speed: number;
  baseX: number;
  baseY: number;
}

/**
 * P5B — coherent animated illustration proof.
 *
 * The world intentionally uses ONLY the authored greenhouse stage texture as its
 * visual source. Local movement is created by re-projecting tiny masked areas of
 * the same painting, plus restrained light/particle effects. No character sprites,
 * emoji creatures, cartoon bees, or transparent next-stage ghost overlays.
 */
export class GameSceneIllustrated extends GameSceneP4 {
  private illustrationRoot?: Phaser.GameObjects.Container;
  private parentWorld?: Phaser.GameObjects.Container;
  private parentTree?: Phaser.GameObjects.Container;
  private treeMotion?: Phaser.GameObjects.Image;
  private treeMotionMask?: Phaser.GameObjects.Graphics;
  private waterLayers: Phaser.GameObjects.Image[] = [];
  private waterMasks: Phaser.GameObjects.Graphics[] = [];
  private foliageLayers: Phaser.GameObjects.Image[] = [];
  private foliageMasks: Phaser.GameObjects.Graphics[] = [];
  private flowerLayer?: Phaser.GameObjects.Image;
  private flowerMask?: Phaser.GameObjects.Graphics;
  private lightBeams: Phaser.GameObjects.Rectangle[] = [];
  private lifeMotes: LifeMote[] = [];
  private illustratedStage = -1;
  private refreshAccumulator = 0;
  private motionClock = 0;
  private devMode = false;
  private devPanel?: Phaser.GameObjects.Container;

  create(): void {
    super.create();
    this.devMode = new URLSearchParams(window.location.search).get('dev') === '1';
    this.captureParentLayers();
    this.rebuildIllustration();
    if (this.devMode) {
      this.renderDevPanel();
      this.input.keyboard?.on('keydown', this.handleDevKey, this);
    }
    this.input.on('pointerdown', this.handleIllustratedTap, this);
    this.scale.on('resize', this.handleIllustratedResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupIllustration, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupIllustration, this);
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    const seconds = Math.min(delta / 1000, 0.1);
    this.motionClock += seconds;
    this.refreshAccumulator += seconds;
    this.animateLifeMotes();

    if (this.refreshAccumulator >= 0.22) {
      this.refreshAccumulator = 0;
      this.captureParentLayers();
      this.syncIllustrationVisibility();
      this.removePlaceholderHelperLabels();
      const stage = this.visualStage(loadState());
      if (stage !== this.illustratedStage || !this.illustrationRoot?.active) this.rebuildIllustration();
    }
  }

  private captureParentLayers(): void {
    const containers = this.children.list.filter((child): child is Phaser.GameObjects.Container => child instanceof Phaser.GameObjects.Container);
    if (!this.parentWorld || !this.parentWorld.active) {
      this.parentWorld = containers.find((container) => container.depth < 900 && container.visible) ?? containers[0];
    }
    if (!this.parentTree || !this.parentTree.active) {
      this.parentTree = containers.find((container) => container.depth < 900 && container !== this.parentWorld && !container.visible);
    }
  }

  private worldIsVisible(): boolean {
    return Boolean(this.parentWorld?.visible);
  }

  private visualStage(state: GameState): number {
    const has = (id: NodeId) => isUnlocked(state, id);
    let stage = 0;
    if (has('sprout') || has('pump') || has('bed') || state.unlocked.length >= 1) stage = 1;
    if (has('flowers') || has('gutters') || has('glass') || has('herbs') || has('gears') || state.unlocked.length >= 8) stage = 2;
    if (has('bees') || has('butterflies') || has('vines') || has('orchid') || state.unlocked.length >= 13) stage = 3;
    if (has('pond') || has('filter') || has('auto_valves') || has('humidity') || state.unlocked.length >= 19) stage = 4;
    if (has('ecosystem') || has('birds') || has('climate') || has('roof_drive') || state.unlocked.length >= 25) stage = 5;
    if (has('central_bud') || has('open_roof')) stage = 6;
    if (has('final_bloom')) stage = 7;
    return Math.max(stage, loadP4Meta().generation - 1);
  }

  private textureForStage(stage: number): string {
    const key = `greenhouse-stage-${stage}`;
    return this.textures.exists(key) ? key : 'main-greenhouse';
  }

  private rebuildIllustration(): void {
    this.destroyIllustrationObjects();
    this.captureParentLayers();

    const state = loadState();
    const stage = this.visualStage(state);
    this.illustratedStage = stage;
    const texture = this.textureForStage(stage);
    const w = this.scale.width;
    const h = this.scale.height;

    const root = this.add.container(0, 0).setDepth(110);
    this.illustrationRoot = root;

    this.treeMotion = this.makeAlignedImage(texture, w, h, 0.58);
    this.treeMotion.setDepth(120);
    const treeMask = this.add.graphics().setDepth(119);
    treeMask.fillStyle(0xffffff, 1);
    treeMask.fillEllipse(w * 0.50, h * 0.50, w * 0.38, h * 0.63);
    treeMask.setVisible(false);
    this.treeMotion.setMask(treeMask.createGeometryMask());
    this.treeMotionMask = treeMask;
    root.add(this.treeMotion);

    if (isUnlocked(state, 'pump')) {
      for (let i = 0; i < 2; i += 1) {
        const water = this.makeAlignedImage(texture, w, h, i === 0 ? 0.24 : 0.13);
        water.setDepth(125 + i).setBlendMode(i === 0 ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
        const mask = this.add.graphics().setDepth(124 + i);
        mask.fillStyle(0xffffff, 1);
        mask.fillRoundedRect(w * 0.055, h * 0.37, w * 0.245, h * 0.48, Math.max(12, w * 0.012));
        mask.setVisible(false);
        water.setMask(mask.createGeometryMask());
        this.waterLayers.push(water);
        this.waterMasks.push(mask);
        root.add(water);
        this.tweens.add({ targets: water, y: water.y + (i === 0 ? 4 : -3), x: water.x + (i === 0 ? 1.5 : -1.5), duration: i === 0 ? 1250 : 1780, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    }

    if (stage >= 2 || isUnlocked(state, 'flowers')) {
      const regions = [
        { x: 0.50, y: 0.34, rw: 0.32, rh: 0.31, dx: 2.2, angle: 0.08 },
        { x: 0.80, y: 0.56, rw: 0.25, rh: 0.30, dx: -1.8, angle: -0.06 },
      ];
      regions.forEach((region, index) => {
        const foliage = this.makeAlignedImage(texture, w, h, 0.18);
        foliage.setDepth(128 + index);
        const mask = this.add.graphics().setDepth(127 + index);
        mask.fillStyle(0xffffff, 1);
        mask.fillEllipse(w * region.x, h * region.y, w * region.rw, h * region.rh);
        mask.setVisible(false);
        foliage.setMask(mask.createGeometryMask());
        this.foliageLayers.push(foliage);
        this.foliageMasks.push(mask);
        root.add(foliage);
        this.tweens.add({ targets: foliage, x: foliage.x + region.dx, angle: region.angle, duration: 2700 + index * 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      });
    }

    if (isUnlocked(state, 'flowers')) {
      this.flowerLayer = this.makeAlignedImage(texture, w, h, 0.20);
      this.flowerLayer.setDepth(132);
      const flowerMask = this.add.graphics().setDepth(131);
      flowerMask.fillStyle(0xffffff, 1);
      flowerMask.fillEllipse(w * 0.78, h * 0.67, w * 0.31, h * 0.28);
      flowerMask.setVisible(false);
      this.flowerLayer.setMask(flowerMask.createGeometryMask());
      this.flowerMask = flowerMask;
      root.add(this.flowerLayer);
      this.tweens.add({ targets: this.flowerLayer, scaleX: this.flowerLayer.scaleX * 1.003, scaleY: this.flowerLayer.scaleY * 1.005, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    if (isUnlocked(state, 'glass') || stage >= 2) this.addPainterlyLight(root, w, h);
    if (isUnlocked(state, 'bees') || isUnlocked(state, 'butterflies') || stage >= 3) this.addSubtleLife(root, w, h);

    this.syncIllustrationVisibility();
    this.removePlaceholderHelperLabels();
  }

  private makeAlignedImage(texture: string, w: number, h: number, alpha: number): Phaser.GameObjects.Image {
    const image = this.add.image(w / 2, h / 2, texture).setAlpha(alpha);
    const source = image.texture.getSourceImage() as HTMLImageElement;
    const scale = Math.max(w / source.width, h / source.height);
    image.setDisplaySize(source.width * scale, source.height * scale);
    return image;
  }

  private addPainterlyLight(root: Phaser.GameObjects.Container, w: number, h: number): void {
    const beamA = this.add.rectangle(w * 0.69, h * 0.28, w * 0.055, h * 0.74, 0xffe9ae, 0.028).setAngle(19).setBlendMode(Phaser.BlendModes.ADD).setDepth(135);
    const beamB = this.add.rectangle(w * 0.60, h * 0.31, w * 0.032, h * 0.66, 0xfff0c2, 0.020).setAngle(17).setBlendMode(Phaser.BlendModes.ADD).setDepth(135);
    this.lightBeams.push(beamA, beamB);
    root.add([beamA, beamB]);
    this.tweens.add({ targets: beamA, alpha: 0.055, x: beamA.x - w * 0.018, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: beamB, alpha: 0.040, x: beamB.x + w * 0.014, duration: 4100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private addSubtleLife(root: Phaser.GameObjects.Container, w: number, h: number): void {
    const count = Math.min(7, Math.max(3, Math.floor(w / 320)));
    for (let i = 0; i < count; i += 1) {
      const baseX = w * (0.60 + (i % 4) * 0.065);
      const baseY = h * (0.33 + (i % 3) * 0.075);
      const halo = this.add.circle(baseX, baseY, 4.5, 0xffd57a, 0.035).setBlendMode(Phaser.BlendModes.ADD).setDepth(141);
      const body = this.add.ellipse(baseX, baseY, 3.2, 1.6, i % 2 ? 0x5e4325 : 0x80602d, 0.55).setDepth(142);
      root.add([halo, body]);
      this.lifeMotes.push({ body, halo, phase: i * 1.37, speed: 0.65 + (i % 3) * 0.14, baseX, baseY });
    }
  }

  private animateLifeMotes(): void {
    if (!this.illustrationRoot?.visible || !this.lifeMotes.length) return;
    for (const mote of this.lifeMotes) {
      const t = this.motionClock * mote.speed + mote.phase;
      const x = mote.baseX + Math.sin(t * 1.7) * 24 + Math.sin(t * 0.63) * 10;
      const y = mote.baseY + Math.cos(t * 1.3) * 15 + Math.sin(t * 0.81) * 8;
      mote.body.setPosition(x, y).setRotation(Math.sin(t) * 0.45);
      mote.halo.setPosition(x, y).setAlpha(0.025 + (Math.sin(t * 2.1) + 1) * 0.012);
    }
  }

  private handleIllustratedTap(pointer: Phaser.Input.Pointer): void {
    if (!this.worldIsVisible() || !this.isCentralTree(pointer.x, pointer.y)) return;
    if (!this.treeMotion?.active) return;
    const baseScaleX = this.treeMotion.scaleX;
    const baseScaleY = this.treeMotion.scaleY;
    this.tweens.killTweensOf(this.treeMotion);
    this.tweens.add({ targets: this.treeMotion, scaleX: baseScaleX * 1.005, scaleY: baseScaleY * 1.007, y: this.treeMotion.y - 2.5, angle: pointer.x < this.scale.width * 0.5 ? -0.09 : 0.09, duration: 115, yoyo: true, ease: 'Sine.out', onComplete: () => this.treeMotion?.setAngle(0) });
    this.spawnSapPulse(pointer.x, pointer.y);
  }

  private spawnSapPulse(x: number, y: number): void {
    const root = this.illustrationRoot;
    if (!root) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const startX = Phaser.Math.Clamp(x, w * 0.43, w * 0.57);
    const startY = Phaser.Math.Clamp(y, h * 0.50, h * 0.76);
    for (let i = 0; i < 4; i += 1) {
      const mote = this.add.circle(startX + Phaser.Math.Between(-8, 8), startY + i * 3, 2.0 + i * 0.35, 0xffdd85, 0.24).setBlendMode(Phaser.BlendModes.ADD).setDepth(155);
      root.add(mote);
      this.tweens.add({ targets: mote, x: w * 0.50 + Phaser.Math.Between(-55, 55), y: h * (0.38 - i * 0.025), alpha: 0, scale: 0.45, duration: 520 + i * 90, ease: 'Sine.out', onComplete: () => mote.destroy() });
    }
  }

  private isCentralTree(x: number, y: number): boolean {
    const w = this.scale.width;
    const h = this.scale.height;
    const dx = (x - w * 0.5) / Math.max(1, w * 0.20);
    const dy = (y - h * 0.52) / Math.max(1, h * 0.34);
    return dx * dx + dy * dy <= 1;
  }

  private syncIllustrationVisibility(): void {
    this.illustrationRoot?.setVisible(this.worldIsVisible());
    this.devPanel?.setVisible(this.devMode);
  }

  private removePlaceholderHelperLabels(): void {
    const labels = ['Садовник помогает оранжерее', 'The gardener is helping the greenhouse', 'Фонтан и автоматика поддерживают рост', 'Fountain and automation sustain growth'];
    const strip = (objects: Phaser.GameObjects.GameObject[]) => {
      for (const object of [...objects]) {
        if (object instanceof Phaser.GameObjects.Text && labels.some((label) => object.text.includes(label))) object.destroy();
      }
    };
    strip(this.children.list);
    if (this.parentWorld?.active) strip(this.parentWorld.list);
  }

  private handleIllustratedResize(): void {
    this.rebuildIllustration();
    if (this.devMode) this.renderDevPanel();
  }

  private cleanupIllustration(): void {
    this.input.off('pointerdown', this.handleIllustratedTap, this);
    this.input.keyboard?.off('keydown', this.handleDevKey, this);
    this.scale.off('resize', this.handleIllustratedResize, this);
    this.destroyIllustrationObjects();
    this.devPanel?.destroy(true);
    this.devPanel = undefined;
  }

  private destroyIllustrationObjects(): void {
    if (this.treeMotion) this.treeMotion.clearMask(true);
    this.waterLayers.forEach((layer) => layer.clearMask(true));
    this.foliageLayers.forEach((layer) => layer.clearMask(true));
    this.flowerLayer?.clearMask(true);
    this.illustrationRoot?.destroy(true);
    this.treeMotionMask?.destroy();
    this.waterMasks.forEach((mask) => mask.destroy());
    this.foliageMasks.forEach((mask) => mask.destroy());
    this.flowerMask?.destroy();
    this.illustrationRoot = undefined;
    this.treeMotion = undefined;
    this.treeMotionMask = undefined;
    this.waterLayers = [];
    this.waterMasks = [];
    this.foliageLayers = [];
    this.foliageMasks = [];
    this.flowerLayer = undefined;
    this.flowerMask = undefined;
    this.lightBeams = [];
    this.lifeMotes = [];
  }

  private handleDevKey(event: KeyboardEvent): void {
    if (!this.devMode) return;
    if (event.key === 'F8') { event.preventDefault(); this.devAction('reset'); }
    else if (event.key === 'F9') { event.preventDefault(); this.devAction('boost'); }
    else if (event.key === 'F10') { event.preventDefault(); this.devAction('finish'); }
  }

  private devAction(action: 'reset' | 'boost' | 'finish'): void {
    if (action === 'reset') { resetState(); this.scene.restart(); return; }
    const state = loadState();
    if (action === 'boost') grantGrowth(state, 1_000_000_000);
    else { state.unlocked = DISCOVERY_NODES.map((node) => node.id); state.completed = true; state.growth = Math.max(state.growth, 1_000_000_000); }
    saveState(state);
    this.scene.restart();
  }

  private renderDevPanel(): void {
    this.devPanel?.destroy(true);
    const w = this.scale.width;
    const h = this.scale.height;
    const panel = this.add.container(w / 2, h - 8).setDepth(2600);
    const mk = (x: number, text: string, action?: 'reset' | 'boost' | 'finish') => {
      const button = this.add.text(x, 0, text, { fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: action ? '#e8e0ca' : '#ffd882', backgroundColor: action ? '#102017e8' : '#32200ae8', padding: { x: 8, y: 5 }, fontStyle: action ? 'normal' : 'bold' }).setOrigin(0.5, 1);
      if (action) button.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); this.devAction(action); });
      return button;
    };
    panel.add([mk(-190, 'ILLUSTRATION DEV'), mk(-85, 'F8 RESET', 'reset'), mk(20, 'F9 +1B', 'boost'), mk(135, 'F10 FINISH', 'finish')]);
    this.devPanel = panel;
  }
}
