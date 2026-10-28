import Phaser from 'phaser';
import { isUnlocked, type GameState } from '../model';
import type { NodeId } from '../content';
import type { P4MetaState } from '../p4Meta';

export type WorldReaction = 'water' | 'petals' | 'life' | 'light';

type BeeActor = {
  node: Phaser.GameObjects.Container;
  baseX: number;
  baseY: number;
  phase: number;
  radiusX: number;
  radiusY: number;
  speed: number;
};

type AmbientMote = {
  dot: Phaser.GameObjects.Arc;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
  range: number;
};

const PALETTE = {
  skyTop: 0xdcefe5,
  skyBottom: 0x91b5a2,
  forest: 0x466b59,
  glass: 0x9fd4c9,
  glassLight: 0xdff7e9,
  frameDark: 0x5a4030,
  frame: 0x8b6546,
  frameLight: 0xb58a62,
  floor: 0x8a6b50,
  floorDark: 0x6f513d,
  wood: 0x7b5235,
  woodDark: 0x4d3325,
  soil: 0x5c3c28,
  brass: 0xb8793a,
  brassLight: 0xe0b367,
  pipe: 0x7e8f82,
  water: 0x6fd5e9,
  waterLight: 0xc5f5ff,
  trunkDark: 0x4f3525,
  trunk: 0x765039,
  trunkLight: 0xa4774d,
  leafDark: 0x2f6f47,
  leaf: 0x4f9a58,
  leafLight: 0x83bd64,
  flowerA: 0xf2a6a4,
  flowerB: 0xf6d58a,
  flowerC: 0xc9a7e8,
  cream: 0xffefc2,
  ink: 0x24342b,
};

export class CozyWorld {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private signature = '';
  private viewportW = 0;
  private viewportH = 0;
  private clock = 0;

  private tree?: Phaser.GameObjects.Container;
  private treeCrown?: Phaser.GameObjects.Container;
  private pumpWheel?: Phaser.GameObjects.Arc;
  private waterDrops: Phaser.GameObjects.Arc[] = [];
  private bees: BeeActor[] = [];
  private motes: AmbientMote[] = [];
  private gardener?: Phaser.GameObjects.Container;
  private gardenerBaseY = 0;
  private flowerGroup?: Phaser.GameObjects.Container;
  private lightRays: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, root: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.root = root;
  }

  sync(state: GameState, meta: P4MetaState, force = false): void {
    const vigorBucket = Math.floor(meta.treeVigor / 4);
    const signature = [this.scene.scale.width, this.scene.scale.height, meta.generation, vigorBucket, ...state.unlocked].join('|');
    if (!force && signature === this.signature) return;
    this.signature = signature;
    this.render(state, meta);
  }

  update(deltaSeconds: number): void {
    this.clock += deltaSeconds;

    if (this.tree) {
      this.tree.rotation = Math.sin(this.clock * 0.75) * 0.0025;
    }
    if (this.treeCrown) {
      this.treeCrown.rotation = Math.sin(this.clock * 0.9) * 0.004;
      const breathe = 1 + Math.sin(this.clock * 1.05) * 0.004;
      this.treeCrown.setScale(breathe);
    }
    if (this.flowerGroup) {
      this.flowerGroup.rotation = Math.sin(this.clock * 0.8) * 0.003;
    }
    if (this.pumpWheel) {
      this.pumpWheel.rotation += deltaSeconds * 0.65;
    }

    for (let i = 0; i < this.waterDrops.length; i += 1) {
      const drop = this.waterDrops[i];
      drop.y += deltaSeconds * (54 + (i % 4) * 10);
      if (drop.y > this.viewportH * 0.78) drop.y = this.viewportH * 0.53 - (i % 5) * 8;
      drop.alpha = 0.65 + Math.sin(this.clock * 4 + i) * 0.18;
    }

    for (const bee of this.bees) {
      const t = this.clock * bee.speed + bee.phase;
      bee.node.x = bee.baseX + Math.cos(t * 1.3) * bee.radiusX;
      bee.node.y = bee.baseY + Math.sin(t * 1.9) * bee.radiusY + Math.sin(t * 4.2) * 3;
      bee.node.rotation = Math.sin(t * 2.6) * 0.18;
    }

    for (const mote of this.motes) {
      const t = this.clock * mote.speed + mote.phase;
      mote.dot.x = mote.baseX + Math.cos(t) * mote.range;
      mote.dot.y = mote.baseY - ((t * 13) % (this.viewportH * 0.22));
      mote.dot.alpha = 0.18 + (Math.sin(t * 2.1) + 1) * 0.14;
    }

    for (let i = 0; i < this.lightRays.length; i += 1) {
      this.lightRays[i].alpha = 0.035 + (Math.sin(this.clock * 0.55 + i) + 1) * 0.025;
    }

    if (this.gardener) {
      const phase = (Math.sin(this.clock * 0.22) + 1) / 2;
      const minX = this.viewportW * 0.27;
      const maxX = this.viewportW * 0.76;
      this.gardener.x = Phaser.Math.Linear(minX, maxX, phase);
      this.gardener.y = this.gardenerBaseY + Math.sin(this.clock * 5.3) * 1.6;
      this.gardener.scaleX = Math.cos(this.clock * 0.22) >= 0 ? 1 : -1;
    }
  }

  reactTap(x: number, y: number): void {
    if (this.tree) {
      this.scene.tweens.killTweensOf(this.tree);
      this.scene.tweens.add({ targets: this.tree, scaleX: 1.016, scaleY: 0.988, duration: 75, yoyo: true, ease: 'Quad.out' });
    }

    const colors = [PALETTE.leafLight, PALETTE.cream, PALETTE.leaf];
    for (let i = 0; i < 9; i += 1) {
      const angle = (Math.PI * 2 * i) / 9 + Math.random() * 0.25;
      const dot = this.scene.add.ellipse(
        x + Math.cos(angle) * 12,
        y + Math.sin(angle) * 8,
        4 + (i % 3),
        2.5 + (i % 2),
        colors[i % colors.length],
        0.78,
      ).setRotation(angle).setDepth(85);
      this.root.add(dot);
      this.scene.tweens.add({
        targets: dot,
        x: dot.x + Math.cos(angle) * (30 + i * 2),
        y: dot.y - 22 - (i % 4) * 7,
        alpha: 0,
        rotation: dot.rotation + 1.2,
        duration: 520 + i * 20,
        ease: 'Quad.out',
        onComplete: () => dot.destroy(),
      });
    }
  }

  reactEvent(kind: WorldReaction): void {
    if (kind === 'water') {
      const x = this.viewportW * 0.21;
      const y = this.viewportH * 0.62;
      for (let i = 0; i < 16; i += 1) {
        const drop = this.scene.add.circle(x, y, 2 + (i % 2), i % 3 === 0 ? PALETTE.waterLight : PALETTE.water, 0.8).setDepth(90);
        this.root.add(drop);
        const dx = (i - 7.5) * 7;
        this.scene.tweens.add({ targets: drop, x: x + dx, y: y - 40 - Math.abs(dx) * 0.35, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: () => drop.destroy() });
      }
      return;
    }

    if (kind === 'petals') {
      const x = this.viewportW * 0.78;
      const y = this.viewportH * 0.66;
      const colors = [PALETTE.flowerA, PALETTE.flowerB, PALETTE.flowerC];
      for (let i = 0; i < 18; i += 1) {
        const petal = this.scene.add.ellipse(x + (i - 9) * 6, y - (i % 4) * 5, 7, 4, colors[i % colors.length], 0.88).setDepth(90);
        this.root.add(petal);
        this.scene.tweens.add({ targets: petal, x: petal.x + (i % 2 ? 35 : -35), y: petal.y - 55 - (i % 5) * 7, rotation: (i % 2 ? 1 : -1) * 2.2, alpha: 0, duration: 720 + i * 14, ease: 'Sine.out', onComplete: () => petal.destroy() });
      }
      return;
    }

    if (kind === 'life') {
      for (const bee of this.bees) {
        this.scene.tweens.add({ targets: bee.node, scale: 1.28, duration: 120, yoyo: true, repeat: 2 });
      }
      return;
    }

    const flash = this.scene.add.rectangle(this.viewportW * 0.68, this.viewportH * 0.28, this.viewportW * 0.62, 34, 0xffefb6, 0.18)
      .setRotation(-0.38)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(70);
    this.root.add(flash);
    this.scene.tweens.add({ targets: flash, alpha: 0, scaleX: 1.15, duration: 620, ease: 'Quad.out', onComplete: () => flash.destroy() });
  }

  treeHitTest(x: number, y: number): boolean {
    const dx = (x - this.viewportW * 0.50) / Math.max(1, this.viewportW * 0.18);
    const dy = (y - this.viewportH * 0.53) / Math.max(1, this.viewportH * 0.34);
    return dx * dx + dy * dy <= 1;
  }

  eventAnchor(kind: WorldReaction): Phaser.Math.Vector2 {
    if (kind === 'water') return new Phaser.Math.Vector2(this.viewportW * 0.20, this.viewportH * 0.58);
    if (kind === 'petals') return new Phaser.Math.Vector2(this.viewportW * 0.80, this.viewportH * 0.60);
    if (kind === 'life') return new Phaser.Math.Vector2(this.viewportW * 0.73, this.viewportH * 0.38);
    return new Phaser.Math.Vector2(this.viewportW * 0.72, this.viewportH * 0.25);
  }

  private render(state: GameState, meta: P4MetaState): void {
    this.root.removeAll(true);
    this.waterDrops = [];
    this.bees = [];
    this.motes = [];
    this.lightRays = [];
    this.tree = undefined;
    this.treeCrown = undefined;
    this.pumpWheel = undefined;
    this.gardener = undefined;
    this.flowerGroup = undefined;

    this.viewportW = this.scene.scale.width;
    this.viewportH = this.scene.scale.height;
    const w = this.viewportW;
    const h = this.viewportH;

    this.drawArchitecture(w, h, state);
    this.drawTree(w, h, state, meta);
    this.drawPump(w, h, state);
    this.drawBeds(w, h, state);
    this.drawPond(w, h, state);
    this.drawLife(w, h, state);
    this.drawGenerationActors(w, h, meta);
    this.drawAtmosphere(w, h, state);
  }

  private drawArchitecture(w: number, h: number, state: GameState): void {
    const g = this.scene.add.graphics().setDepth(0);
    this.root.add(g);

    const bands = 12;
    for (let i = 0; i < bands; i += 1) {
      const t = i / (bands - 1);
      g.fillStyle(this.mix(PALETTE.skyTop, PALETTE.skyBottom, t), 1);
      g.fillRect(0, (h * 0.70 * i) / bands, w, h * 0.70 / bands + 1);
    }

    // distant forest silhouettes
    for (let i = 0; i < 17; i += 1) {
      const x = (i / 16) * w;
      const treeH = h * (0.14 + ((i * 37) % 9) / 100);
      g.fillStyle(PALETTE.forest, 0.15 + (i % 3) * 0.025);
      g.fillTriangle(x - w * 0.035, h * 0.47, x, h * 0.47 - treeH, x + w * 0.035, h * 0.47);
    }

    // glass panes
    const paneTop = h * 0.06;
    const paneBottom = h * 0.71;
    const paneCount = 8;
    for (let i = 0; i < paneCount; i += 1) {
      const x0 = (w * i) / paneCount;
      g.fillStyle(i % 2 ? PALETTE.glassLight : PALETTE.glass, 0.10);
      g.fillRect(x0 + 2, paneTop, w / paneCount - 4, paneBottom - paneTop);
    }

    // greenhouse frame
    const frameW = Math.max(4, w * 0.0042);
    g.lineStyle(frameW + 3, PALETTE.frameDark, 0.92);
    g.strokeRect(w * 0.035, paneTop, w * 0.93, paneBottom - paneTop);
    g.lineStyle(frameW, PALETTE.frameLight, 0.94);
    g.strokeRect(w * 0.035, paneTop, w * 0.93, paneBottom - paneTop);

    for (let i = 1; i < paneCount; i += 1) {
      const x = (w * i) / paneCount;
      g.lineStyle(frameW + 2, PALETTE.frameDark, 0.82);
      g.lineBetween(x, paneTop, x, paneBottom);
      g.lineStyle(Math.max(2, frameW * 0.55), PALETTE.frameLight, 0.9);
      g.lineBetween(x, paneTop, x, paneBottom);
    }

    // upper roof ribs
    const cx = w * 0.5;
    for (let i = 0; i < 7; i += 1) {
      const x = w * (0.08 + i * 0.14);
      g.lineStyle(Math.max(3, frameW * 0.75), PALETTE.frame, 0.8);
      g.lineBetween(x, paneTop, cx, 0);
    }
    g.lineStyle(frameW + 3, PALETTE.frameDark, 0.85);
    g.beginPath();
    g.arc(cx, paneTop + h * 0.05, w * 0.32, Math.PI, Math.PI * 2, false);
    g.strokePath();
    g.lineStyle(frameW, PALETTE.frameLight, 0.9);
    g.beginPath();
    g.arc(cx, paneTop + h * 0.05, w * 0.32, Math.PI, Math.PI * 2, false);
    g.strokePath();

    // floor
    g.fillStyle(PALETTE.floorDark, 1);
    g.fillRect(0, h * 0.70, w, h * 0.30);
    const tileRows = 6;
    for (let r = 0; r <= tileRows; r += 1) {
      const y = h * 0.70 + (h * 0.30 * r) / tileRows;
      g.lineStyle(1, PALETTE.floor, 0.52);
      g.lineBetween(0, y, w, y);
    }
    for (let c = -5; c <= 13; c += 1) {
      const topX = w * 0.5 + c * w * 0.06;
      const bottomX = w * 0.5 + c * w * 0.13;
      g.lineStyle(1, PALETTE.floor, 0.42);
      g.lineBetween(topX, h * 0.70, bottomX, h);
    }

    // shelves and empty pots establish a real room even before upgrades
    this.drawShelf(w * 0.055, h * 0.44, w * 0.15, h * 0.22, 3);
    this.drawShelf(w * 0.81, h * 0.42, w * 0.14, h * 0.24, 3);

    if (isUnlocked(state, 'glass') || isUnlocked(state, 'mirrors')) {
      const rayCount = isUnlocked(state, 'mirrors') ? 4 : 2;
      for (let i = 0; i < rayCount; i += 1) {
        const ray = this.scene.add.rectangle(w * (0.67 + i * 0.04), h * 0.24, w * 0.34, 12 + i * 3, 0xffefb0, 0.055)
          .setRotation(-0.48 + i * 0.035)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(8);
        this.lightRays.push(ray);
        this.root.add(ray);
      }
    }
  }

  private drawShelf(x: number, y: number, width: number, height: number, levels: number): void {
    const g = this.scene.add.graphics().setDepth(6);
    g.fillStyle(PALETTE.woodDark, 0.92);
    g.fillRect(x, y, 7, height);
    g.fillRect(x + width - 7, y, 7, height);
    for (let i = 0; i < levels; i += 1) {
      const sy = y + (height * i) / Math.max(1, levels - 1);
      g.fillStyle(PALETTE.wood, 1);
      g.fillRoundedRect(x, sy, width, 8, 3);
      for (let p = 0; p < 3; p += 1) {
        const px = x + 18 + p * (width - 36) / 2;
        g.fillStyle(0x8d6347, 0.78);
        g.fillTrapezoid(px - 8, sy - 12, 16, 12, 12, 12);
      }
    }
    this.root.add(g);
  }

  private drawTree(w: number, h: number, state: GameState, meta: P4MetaState): void {
    const unlockedFactor = state.unlocked.length / 32;
    const vigorFactor = meta.treeVigor / 100;
    const progress = Phaser.Math.Clamp(0.08 + unlockedFactor * 0.72 + vigorFactor * 0.20, 0.08, 1);
    const baseX = w * 0.50;
    const baseY = h * 0.77;
    const crownY = h * (0.61 - progress * 0.17);
    const treeH = h * (0.14 + progress * 0.36);

    const tree = this.scene.add.container(baseX, baseY).setDepth(28);
    this.root.add(tree);
    this.tree = tree;

    const shadow = this.scene.add.ellipse(0, 12, w * (0.13 + progress * 0.08), h * 0.04, 0x17251c, 0.20);
    tree.add(shadow);

    // planter
    const planter = this.scene.add.graphics();
    planter.fillStyle(PALETTE.woodDark, 1);
    planter.fillRoundedRect(-w * 0.13, -4, w * 0.26, h * 0.095, 9);
    planter.fillStyle(PALETTE.wood, 1);
    planter.fillRoundedRect(-w * 0.12, 0, w * 0.24, h * 0.072, 7);
    planter.fillStyle(PALETTE.soil, 1);
    planter.fillEllipse(0, 0, w * 0.21, h * 0.035);
    planter.lineStyle(2, PALETTE.brassLight, 0.75);
    planter.strokeRoundedRect(-w * 0.115, 5, w * 0.23, h * 0.057, 6);
    tree.add(planter);

    const trunk = this.scene.add.graphics();
    const trunkWidth = Math.max(7, h * (0.016 + progress * 0.028));
    const trunkTopY = -treeH;
    this.strokeBranch(trunk, 0, -3, -2, trunkTopY * 0.46, trunkWidth, PALETTE.trunkDark, PALETTE.trunk);
    this.strokeBranch(trunk, -2, trunkTopY * 0.42, -8, trunkTopY, trunkWidth * 0.58, PALETTE.trunkDark, PALETTE.trunkLight);

    const branchDefs = [
      [-3, 0.42, -0.105, 0.61, 0.72],
      [0, 0.38, 0.105, 0.58, 0.70],
      [-6, 0.56, -0.16, 0.74, 0.54],
      [4, 0.55, 0.16, 0.75, 0.54],
      [-8, 0.72, -0.12, 0.90, 0.42],
      [6, 0.70, 0.12, 0.91, 0.42],
      [0, 0.66, 0.00, 1.00, 0.38],
    ] as const;

    const visibleBranches = Math.max(1, Math.min(branchDefs.length, Math.floor(progress * branchDefs.length) + 1));
    for (let i = 0; i < visibleBranches; i += 1) {
      const [sx, startRatio, dxRatio, endRatio, widthRatio] = branchDefs[i];
      const sy = trunkTopY * startRatio;
      const ex = dxRatio * w;
      const ey = trunkTopY * endRatio;
      this.strokeBranch(trunk, sx, sy, ex, ey, trunkWidth * widthRatio, PALETTE.trunkDark, i % 2 ? PALETTE.trunk : PALETTE.trunkLight);
      trunk.fillStyle(PALETTE.trunk, 1);
      trunk.fillCircle(ex, ey, Math.max(2, trunkWidth * widthRatio * 0.34));
    }
    tree.add(trunk);

    const crown = this.scene.add.container(0, crownY - baseY);
    tree.add(crown);
    this.treeCrown = crown;

    const leafCount = Math.floor(progress * 92);
    const crownRadiusX = w * (0.045 + progress * 0.16);
    const crownRadiusY = h * (0.035 + progress * 0.13);
    const colors = [PALETTE.leafDark, PALETTE.leaf, PALETTE.leafLight, 0x6fa85b];
    for (let i = 0; i < leafCount; i += 1) {
      const angle = i * 2.399963 + (i % 5) * 0.07;
      const radial = Math.sqrt((i + 1) / Math.max(1, leafCount));
      const lx = Math.cos(angle) * crownRadiusX * radial;
      const ly = Math.sin(angle) * crownRadiusY * radial * 0.85 + Math.sin(i * 0.9) * 3;
      const size = Math.max(5, Math.min(w, h) * (0.007 + (i % 4) * 0.0012));
      const leaf = this.scene.add.ellipse(lx, ly, size * 1.7, size, colors[i % colors.length], 0.88)
        .setRotation(angle + 0.4);
      crown.add(leaf);
    }

    if (isUnlocked(state, 'flowers') || isUnlocked(state, 'orchid') || progress > 0.66) {
      const bloomCount = isUnlocked(state, 'orchid') ? 26 : 12;
      const bloomColors = [PALETTE.cream, PALETTE.flowerA, PALETTE.flowerB];
      for (let i = 0; i < bloomCount; i += 1) {
        const angle = i * 2.17;
        const bx = Math.cos(angle) * crownRadiusX * (0.45 + (i % 5) * 0.09);
        const by = Math.sin(angle) * crownRadiusY * (0.35 + (i % 4) * 0.12);
        const blossom = this.scene.add.circle(bx, by, 2.5 + (i % 2), bloomColors[i % bloomColors.length], 0.95);
        crown.add(blossom);
      }
    }

    if (isUnlocked(state, 'central_bud')) {
      const bud = this.scene.add.ellipse(0, -crownRadiusY * 0.18, 26 + progress * 18, 32 + progress * 22, 0xe1a7cf, 0.9)
        .setStrokeStyle(3, PALETTE.cream, 0.75);
      crown.add(bud);
    }
    if (isUnlocked(state, 'final_bloom')) {
      const bloom = this.scene.add.circle(0, -crownRadiusY * 0.14, Math.min(w, h) * 0.055, PALETTE.flowerB, 0.26)
        .setStrokeStyle(4, PALETTE.cream, 0.85)
        .setBlendMode(Phaser.BlendModes.ADD);
      crown.add(bloom);
      this.scene.tweens.add({ targets: bloom, scale: 1.12, alpha: 0.38, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private strokeBranch(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, width: number, outline: number, inner: number): void {
    g.lineStyle(width + 4, outline, 1);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(Math.max(2, width), inner, 1);
    g.lineBetween(x1, y1, x2, y2);
  }

  private drawPump(w: number, h: number, state: GameState): void {
    if (!isUnlocked(state, 'pump')) return;
    const x = w * 0.18;
    const y = h * 0.71;
    const pump = this.scene.add.container(x, y).setDepth(20);
    this.root.add(pump);

    const body = this.scene.add.graphics();
    body.fillStyle(PALETTE.woodDark, 0.25);
    body.fillEllipse(0, h * 0.025, w * 0.13, h * 0.035);
    body.fillStyle(PALETTE.brass, 1);
    body.fillRoundedRect(-w * 0.037, -h * 0.17, w * 0.074, h * 0.16, 12);
    body.fillStyle(PALETTE.brassLight, 0.76);
    body.fillRoundedRect(-w * 0.029, -h * 0.155, w * 0.018, h * 0.13, 8);
    body.lineStyle(5, PALETTE.pipe, 1);
    body.lineBetween(w * 0.035, -h * 0.09, w * 0.085, -h * 0.09);
    body.lineBetween(w * 0.085, -h * 0.09, w * 0.085, h * 0.005);
    body.fillStyle(PALETTE.pipe, 1);
    body.fillRoundedRect(-w * 0.052, -h * 0.185, w * 0.104, h * 0.025, 8);
    pump.add(body);

    const wheel = this.scene.add.circle(-w * 0.047, -h * 0.07, Math.min(w, h) * 0.032, 0x28493f, 1)
      .setStrokeStyle(4, PALETTE.brassLight, 1);
    const hub = this.scene.add.circle(-w * 0.047, -h * 0.07, 5, PALETTE.brassLight, 1);
    pump.add([wheel, hub]);
    this.pumpWheel = wheel;

    const hasFlow = isUnlocked(state, 'gutters') || isUnlocked(state, 'irrigation') || isUnlocked(state, 'filter');
    if (hasFlow) {
      const dropCount = isUnlocked(state, 'irrigation') ? 11 : 7;
      for (let i = 0; i < dropCount; i += 1) {
        const drop = this.scene.add.circle(x + w * 0.085 + (i % 3) * 2, h * 0.54 - (i % 5) * 12, 2.5 + (i % 2), i % 3 ? PALETTE.water : PALETTE.waterLight, 0.8).setDepth(24);
        this.root.add(drop);
        this.waterDrops.push(drop);
      }
    }
  }

  private drawBeds(w: number, h: number, state: GameState): void {
    if (!isUnlocked(state, 'bed')) return;
    const group = this.scene.add.container(0, 0).setDepth(18);
    this.root.add(group);
    this.flowerGroup = group;

    const bedCount = isUnlocked(state, 'herbs') ? 3 : 2;
    for (let b = 0; b < bedCount; b += 1) {
      const x = w * (0.70 + b * 0.095);
      const y = h * (0.73 - (b % 2) * 0.025);
      const box = this.scene.add.graphics();
      box.fillStyle(PALETTE.woodDark, 1);
      box.fillRoundedRect(x - w * 0.05, y, w * 0.10, h * 0.055, 6);
      box.fillStyle(PALETTE.wood, 1);
      box.fillRoundedRect(x - w * 0.047, y + 3, w * 0.094, h * 0.043, 5);
      box.fillStyle(PALETTE.soil, 1);
      box.fillEllipse(x, y + 2, w * 0.084, h * 0.025);
      group.add(box);

      const plantCount = 4 + (isUnlocked(state, 'herbs') ? 2 : 0) + (isUnlocked(state, 'canopy') ? 2 : 0);
      for (let p = 0; p < plantCount; p += 1) {
        const px = x - w * 0.034 + p * (w * 0.068 / Math.max(1, plantCount - 1));
        const stemH = h * (0.035 + (p % 3) * 0.008);
        const stem = this.scene.add.graphics();
        stem.lineStyle(2, PALETTE.leafDark, 1);
        stem.lineBetween(px, y, px + (p % 2 ? 2 : -2), y - stemH);
        group.add(stem);
        const leaf = this.scene.add.ellipse(px - 4, y - stemH * 0.52, 11, 6, p % 2 ? PALETTE.leaf : PALETTE.leafLight, 0.92).setRotation(-0.45);
        group.add(leaf);
        if (isUnlocked(state, 'flowers')) {
          const colors = [PALETTE.flowerA, PALETTE.flowerB, PALETTE.flowerC];
          group.add(this.scene.add.circle(px, y - stemH, 4 + (p % 2), colors[(b + p) % colors.length], 0.95));
        }
      }
    }

    if (isUnlocked(state, 'vines')) {
      const vine = this.scene.add.graphics();
      vine.lineStyle(3, PALETTE.leafDark, 0.85);
      const x = w * 0.92;
      vine.beginPath();
      vine.moveTo(x, h * 0.70);
      for (let i = 0; i < 9; i += 1) vine.lineTo(x + Math.sin(i * 0.9) * 14, h * (0.68 - i * 0.055));
      vine.strokePath();
      group.add(vine);
      for (let i = 0; i < 12; i += 1) {
        group.add(this.scene.add.ellipse(x + Math.sin(i * 0.75) * 18, h * (0.64 - i * 0.038), 16, 9, i % 2 ? PALETTE.leaf : PALETTE.leafLight, 0.86).setRotation(i * 0.35));
      }
    }
  }

  private drawPond(w: number, h: number, state: GameState): void {
    if (!isUnlocked(state, 'pond')) return;
    const x = w * 0.31;
    const y = h * 0.79;
    const pond = this.scene.add.ellipse(x, y, w * 0.18, h * 0.075, 0x487f85, 0.92)
      .setStrokeStyle(4, 0x345a52, 0.9)
      .setDepth(16);
    const shine = this.scene.add.ellipse(x - w * 0.02, y - 3, w * 0.09, h * 0.018, PALETTE.waterLight, 0.22).setDepth(17);
    this.root.add([pond, shine]);
    this.scene.tweens.add({ targets: shine, scaleX: 1.16, alpha: 0.10, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private drawLife(w: number, h: number, state: GameState): void {
    if (isUnlocked(state, 'bees')) {
      const hive = this.scene.add.container(w * 0.84, h * 0.48).setDepth(24);
      const hg = this.scene.add.graphics();
      hg.fillStyle(PALETTE.woodDark, 1);
      hg.fillRoundedRect(-22, -24, 44, 50, 12);
      hg.fillStyle(PALETTE.brassLight, 0.86);
      hg.fillRoundedRect(-18, -20, 36, 9, 4);
      hg.fillRoundedRect(-20, -7, 40, 9, 4);
      hg.fillRoundedRect(-18, 6, 36, 9, 4);
      hg.fillStyle(PALETTE.ink, 1);
      hg.fillCircle(0, 17, 4);
      hive.add(hg);
      this.root.add(hive);

      const count = isUnlocked(state, 'pollination') ? 6 : 3;
      for (let i = 0; i < count; i += 1) this.createBee(w * 0.75, h * 0.42, i, w, h);
    }

    if (isUnlocked(state, 'butterflies')) {
      for (let i = 0; i < 3; i += 1) {
        const node = this.scene.add.container(w * (0.66 + i * 0.06), h * (0.34 + (i % 2) * 0.08)).setDepth(25);
        const left = this.scene.add.ellipse(-4, 0, 8, 11, i % 2 ? PALETTE.flowerC : PALETTE.flowerA, 0.8).setRotation(-0.45);
        const right = this.scene.add.ellipse(4, 0, 8, 11, i % 2 ? PALETTE.flowerC : PALETTE.flowerA, 0.8).setRotation(0.45);
        const body = this.scene.add.ellipse(0, 2, 3, 9, PALETTE.ink, 0.85);
        node.add([left, right, body]);
        this.root.add(node);
        this.bees.push({ node, baseX: node.x, baseY: node.y, phase: i * 1.7, radiusX: w * 0.05, radiusY: h * 0.05, speed: 0.38 + i * 0.04 });
      }
    }

    if (isUnlocked(state, 'birds')) {
      for (let i = 0; i < 2; i += 1) {
        const bx = w * (0.62 + i * 0.11);
        const by = h * (0.23 + i * 0.04);
        const bird = this.scene.add.container(bx, by).setDepth(22);
        bird.add(this.scene.add.ellipse(0, 0, 13, 8, 0x56746a, 1));
        bird.add(this.scene.add.triangle(8, 0, 0, -3, 8, 0, 0, 3, PALETTE.brassLight, 1));
        bird.add(this.scene.add.ellipse(-2, -2, 8, 4, 0x78998a, 0.9).setRotation(-0.3));
        this.root.add(bird);
        this.bees.push({ node: bird, baseX: bx, baseY: by, phase: i * 2.8, radiusX: w * 0.12, radiusY: h * 0.035, speed: 0.16 + i * 0.02 });
      }
    }
  }

  private createBee(baseX: number, baseY: number, i: number, w: number, h: number): void {
    const node = this.scene.add.container(baseX, baseY).setDepth(30);
    const wingL = this.scene.add.ellipse(-4, -4, 7, 5, PALETTE.glassLight, 0.60).setRotation(-0.4);
    const wingR = this.scene.add.ellipse(4, -4, 7, 5, PALETTE.glassLight, 0.60).setRotation(0.4);
    const body = this.scene.add.ellipse(0, 0, 11, 7, PALETTE.brassLight, 1).setStrokeStyle(2, PALETTE.ink, 0.85);
    const stripe = this.scene.add.rectangle(0, 0, 2, 7, PALETTE.ink, 0.85);
    node.add([wingL, wingR, body, stripe]);
    this.root.add(node);
    this.scene.tweens.add({ targets: [wingL, wingR], scaleY: 0.45, duration: 85 + i * 4, yoyo: true, repeat: -1 });
    this.bees.push({ node, baseX, baseY, phase: i * 1.37, radiusX: w * (0.055 + (i % 3) * 0.018), radiusY: h * (0.04 + (i % 2) * 0.015), speed: 0.52 + i * 0.035 });
  }

  private drawGenerationActors(w: number, h: number, meta: P4MetaState): void {
    if (meta.generation >= 2) this.drawGardener(w, h);
    if (meta.generation >= 3) this.drawFountain(w, h);
  }

  private drawGardener(w: number, h: number): void {
    const node = this.scene.add.container(w * 0.34, h * 0.77).setDepth(38);
    const shadow = this.scene.add.ellipse(0, 13, 36, 9, 0x1b271f, 0.23);
    const legs = this.scene.add.graphics();
    legs.lineStyle(6, 0x4b5d53, 1);
    legs.lineBetween(-5, 5, -7, 20);
    legs.lineBetween(5, 5, 7, 20);
    const torso = this.scene.add.roundedRectangle(0, -9, 24, 29, 7, 0x6c8f61, 1).setStrokeStyle(2, 0x35503e, 1);
    const head = this.scene.add.circle(0, -29, 8, 0xd8b18c, 1).setStrokeStyle(1.5, 0x6f513d, 0.85);
    const hat = this.scene.add.ellipse(0, -38, 28, 7, PALETTE.brassLight, 1);
    const hatTop = this.scene.add.roundedRectangle(0, -42, 16, 9, 4, 0xc28d49, 1);
    const arm = this.scene.add.rectangle(13, -8, 16, 5, 0xd8b18c, 1).setRotation(0.35);
    const can = this.scene.add.roundedRectangle(24, -1, 13, 10, 3, 0x698a81, 1).setStrokeStyle(1, 0x38564d, 1);
    node.add([shadow, legs, torso, head, hat, hatTop, arm, can]);
    this.root.add(node);
    this.gardener = node;
    this.gardenerBaseY = h * 0.77;
  }

  private drawFountain(w: number, h: number): void {
    const x = w * 0.34;
    const y = h * 0.76;
    const base = this.scene.add.graphics().setDepth(19);
    base.fillStyle(PALETTE.frameDark, 1);
    base.fillEllipse(x, y + 8, w * 0.11, h * 0.045);
    base.fillStyle(PALETTE.frame, 1);
    base.fillEllipse(x, y, w * 0.10, h * 0.035);
    base.fillStyle(0x527f7d, 1);
    base.fillEllipse(x, y - 2, w * 0.085, h * 0.023);
    this.root.add(base);
    for (let i = 0; i < 8; i += 1) {
      const drop = this.scene.add.circle(x + (i - 3.5) * 3, y - 16 - (i % 3) * 7, 2.5, i % 2 ? PALETTE.water : PALETTE.waterLight, 0.8).setDepth(20);
      this.root.add(drop);
      this.waterDrops.push(drop);
    }
  }

  private drawAtmosphere(w: number, h: number, state: GameState): void {
    const count = 12 + (isUnlocked(state, 'ecosystem') ? 14 : 0);
    for (let i = 0; i < count; i += 1) {
      const baseX = w * (0.20 + ((i * 71) % 65) / 100);
      const baseY = h * (0.35 + ((i * 29) % 40) / 100);
      const color = i % 3 === 0 ? PALETTE.cream : i % 3 === 1 ? PALETTE.leafLight : PALETTE.waterLight;
      const dot = this.scene.add.circle(baseX, baseY, 1.2 + (i % 2), color, 0.18).setDepth(15);
      this.root.add(dot);
      this.motes.push({ dot, baseX, baseY, phase: i * 0.73, speed: 0.12 + (i % 5) * 0.018, range: 8 + (i % 4) * 4 });
    }
  }

  private mix(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff; const ag = (a >> 8) & 0xff; const ab = a & 0xff;
    const br = (b >> 16) & 0xff; const bg = (b >> 8) & 0xff; const bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }
}