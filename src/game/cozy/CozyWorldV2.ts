import Phaser from 'phaser';
import { isUnlocked, type GameState } from '../model';
import type { NodeId } from '../content';
import type { P4MetaState } from '../p4Meta';

export type WorldReaction = 'water' | 'petals' | 'life' | 'light';

type Mover = {
  node: Phaser.GameObjects.Container;
  baseX: number;
  baseY: number;
  rx: number;
  ry: number;
  speed: number;
  phase: number;
  kind: 'bee' | 'butterfly' | 'bird';
};

type Mote = {
  dot: Phaser.GameObjects.Arc;
  baseX: number;
  baseY: number;
  range: number;
  speed: number;
  phase: number;
};

const C = {
  skyTop: 0xeaf5e9,
  skyBottom: 0xa8c9b6,
  mountain: 0x739183,
  forest: 0x4f755f,
  glass: 0xaed8c9,
  glassWarm: 0xf1e4be,
  frameDark: 0x4b392f,
  frame: 0x765642,
  frameHi: 0xb78b64,
  brass: 0xb77a3f,
  brassHi: 0xe4bd74,
  brassDark: 0x6f492e,
  stone: 0x8a7562,
  stoneHi: 0xb39b82,
  floor: 0x80614c,
  floorHi: 0x9b785c,
  floorDark: 0x624735,
  wood: 0x805638,
  woodHi: 0xa87349,
  woodDark: 0x503524,
  soil: 0x4d3326,
  soilHi: 0x76523a,
  trunk: 0x725039,
  trunkHi: 0xa5764e,
  trunkDark: 0x423026,
  leaf0: 0x315f43,
  leaf1: 0x477f50,
  leaf2: 0x68a55b,
  leaf3: 0x8cbc69,
  pink: 0xe89a9c,
  yellow: 0xefc96f,
  lavender: 0xbba1d8,
  cream: 0xf7e8bd,
  water: 0x62c9df,
  waterHi: 0xc4f4ef,
  waterDark: 0x3f8392,
  ink: 0x21352c,
  cloth: 0x63845f,
  skin: 0xd8ad83,
};

export class CozyWorldV2 {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private w = 0;
  private h = 0;
  private clock = 0;
  private signature = '';

  private tree?: Phaser.GameObjects.Container;
  private crown?: Phaser.GameObjects.Container;
  private pumpWheel?: Phaser.GameObjects.Container;
  private flowerGroup?: Phaser.GameObjects.Container;
  private gardener?: Phaser.GameObjects.Container;
  private gardenerY = 0;
  private waterDrops: Phaser.GameObjects.Arc[] = [];
  private movers: Mover[] = [];
  private motes: Mote[] = [];
  private rays: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, root: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.root = root;
  }

  sync(state: GameState, meta: P4MetaState, force = false): void {
    const vigorBucket = Math.floor(meta.treeVigor / 3);
    const signature = [this.scene.scale.width, this.scene.scale.height, meta.generation, vigorBucket, ...state.unlocked].join('|');
    if (!force && signature === this.signature) return;
    this.signature = signature;
    this.render(state, meta);
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.tree) this.tree.rotation = Math.sin(this.clock * 0.55) * 0.0025;
    if (this.crown) {
      this.crown.rotation = Math.sin(this.clock * 0.78) * 0.0045;
      const breathe = 1 + Math.sin(this.clock * 0.92) * 0.005;
      this.crown.setScale(breathe);
    }
    if (this.flowerGroup) this.flowerGroup.rotation = Math.sin(this.clock * 0.64) * 0.003;
    if (this.pumpWheel) this.pumpWheel.rotation += dt * 0.72;

    for (let i = 0; i < this.waterDrops.length; i += 1) {
      const d = this.waterDrops[i];
      d.y += dt * (65 + (i % 4) * 11);
      if (d.y > this.h * 0.805) d.y = this.h * 0.515 - (i % 6) * 9;
      d.alpha = 0.55 + Math.sin(this.clock * 4.1 + i) * 0.18;
    }

    for (const m of this.movers) {
      const t = this.clock * m.speed + m.phase;
      m.node.x = m.baseX + Math.cos(t * 1.25) * m.rx;
      m.node.y = m.baseY + Math.sin(t * 1.75) * m.ry + Math.sin(t * 5.1) * 2.2;
      if (m.kind !== 'bird') m.node.rotation = Math.sin(t * 2.2) * 0.12;
      if (m.kind === 'bird') m.node.scaleX = Math.cos(t * 0.4) >= 0 ? 1 : -1;
    }

    for (const m of this.motes) {
      const t = this.clock * m.speed + m.phase;
      m.dot.x = m.baseX + Math.sin(t) * m.range;
      m.dot.y = m.baseY - ((t * 16) % Math.max(40, this.h * 0.22));
      m.dot.alpha = 0.10 + (Math.sin(t * 2.4) + 1) * 0.10;
    }

    for (let i = 0; i < this.rays.length; i += 1) {
      this.rays[i].alpha = 0.025 + (Math.sin(this.clock * 0.42 + i * 0.8) + 1) * 0.022;
    }

    if (this.gardener) {
      const t = (Math.sin(this.clock * 0.23) + 1) / 2;
      this.gardener.x = Phaser.Math.Linear(this.w * 0.27, this.w * 0.73, t);
      this.gardener.y = this.gardenerY + Math.sin(this.clock * 5.2) * 1.4;
      this.gardener.scaleX = Math.cos(this.clock * 0.23) >= 0 ? 1 : -1;
    }
  }

  reactTap(x: number, y: number): void {
    if (this.tree) {
      this.scene.tweens.killTweensOf(this.tree);
      this.scene.tweens.add({ targets: this.tree, scaleX: 1.013, scaleY: 0.986, duration: 72, yoyo: true, ease: 'Quad.out' });
    }
    const leafColors = [C.leaf2, C.leaf3, C.cream];
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10 + this.noise(i + this.clock) * 0.4;
      const leaf = this.scene.add.ellipse(x, y, 8, 4, leafColors[i % leafColors.length], 0.8)
        .setRotation(angle).setDepth(95);
      this.root.add(leaf);
      this.scene.tweens.add({
        targets: leaf,
        x: x + Math.cos(angle) * (26 + i * 3),
        y: y - 26 - (i % 4) * 8,
        rotation: angle + 1.4,
        alpha: 0,
        duration: 500 + i * 25,
        ease: 'Quad.out',
        onComplete: () => leaf.destroy(),
      });
    }
  }

  reactEvent(kind: WorldReaction): void {
    if (kind === 'water') {
      const p = this.eventAnchor('water');
      for (let i = 0; i < 18; i += 1) {
        const d = this.scene.add.circle(p.x, p.y, 2 + (i % 2), i % 3 ? C.water : C.waterHi, 0.82).setDepth(100);
        this.root.add(d);
        const dx = (i - 8.5) * 6;
        this.scene.tweens.add({ targets: d, x: p.x + dx, y: p.y - 35 - Math.abs(dx) * 0.32, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: () => d.destroy() });
      }
      return;
    }
    if (kind === 'petals') {
      const p = this.eventAnchor('petals');
      const colors = [C.pink, C.yellow, C.lavender, C.cream];
      for (let i = 0; i < 18; i += 1) {
        const petal = this.scene.add.ellipse(p.x + (i - 9) * 4, p.y, 7, 4, colors[i % colors.length], 0.9).setDepth(100);
        this.root.add(petal);
        this.scene.tweens.add({ targets: petal, x: petal.x + (i % 2 ? 34 : -34), y: petal.y - 55 - (i % 4) * 8, rotation: (i % 2 ? 1 : -1) * 2.5, alpha: 0, duration: 720 + i * 15, onComplete: () => petal.destroy() });
      }
      return;
    }
    if (kind === 'life') {
      for (const mover of this.movers.filter((m) => m.kind === 'bee' || m.kind === 'butterfly')) {
        this.scene.tweens.add({ targets: mover.node, scale: 1.22, duration: 100, yoyo: true, repeat: 2 });
      }
      return;
    }
    const p = this.eventAnchor('light');
    const glow = this.scene.add.circle(p.x, p.y, Math.min(this.w, this.h) * 0.065, C.cream, 0.15)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(90);
    this.root.add(glow);
    this.scene.tweens.add({ targets: glow, scale: 1.8, alpha: 0, duration: 650, ease: 'Quad.out', onComplete: () => glow.destroy() });
  }

  treeHitTest(x: number, y: number): boolean {
    const dx = (x - this.w * 0.50) / Math.max(1, this.w * 0.20);
    const dy = (y - this.h * 0.53) / Math.max(1, this.h * 0.35);
    return dx * dx + dy * dy <= 1;
  }

  eventAnchor(kind: WorldReaction): Phaser.Math.Vector2 {
    if (kind === 'water') return new Phaser.Math.Vector2(this.w * 0.19, this.h * 0.60);
    if (kind === 'petals') return new Phaser.Math.Vector2(this.w * 0.80, this.h * 0.64);
    if (kind === 'life') return new Phaser.Math.Vector2(this.w * 0.73, this.h * 0.37);
    return new Phaser.Math.Vector2(this.w * 0.70, this.h * 0.26);
  }

  private render(state: GameState, meta: P4MetaState): void {
    this.root.removeAll(true);
    this.w = this.scene.scale.width;
    this.h = this.scene.scale.height;
    this.waterDrops = [];
    this.movers = [];
    this.motes = [];
    this.rays = [];
    this.tree = undefined;
    this.crown = undefined;
    this.pumpWheel = undefined;
    this.flowerGroup = undefined;
    this.gardener = undefined;

    this.drawBackground(state);
    this.drawGreenhouseShell(state);
    this.drawSideStations(state);
    this.drawTree(state, meta);
    this.drawPump(state);
    this.drawBeds(state);
    this.drawPond(state);
    this.drawLife(state);
    this.drawGenerationActors(meta);
    this.drawForeground(state);
    this.drawAtmosphere(state);
  }

  private drawBackground(state: GameState): void {
    const w = this.w, h = this.h;
    const g = this.scene.add.graphics().setDepth(0);
    g.fillGradientStyle(C.skyTop, C.skyTop, C.skyBottom, C.skyBottom, 1);
    g.fillRect(0, 0, w, h * 0.72);
    this.root.add(g);

    // distant layered hills and forest
    const back = this.scene.add.graphics().setDepth(1);
    for (let layer = 0; layer < 3; layer += 1) {
      const alpha = 0.07 + layer * 0.04;
      const color = layer === 0 ? C.mountain : C.forest;
      for (let i = 0; i < 14; i += 1) {
        const x = (i / 13) * w + (layer - 1) * 18;
        const base = h * (0.53 + layer * 0.025);
        const th = h * (0.12 + ((i * 31 + layer * 17) % 9) / 100);
        back.fillStyle(color, alpha);
        back.fillTriangle(x - w * 0.05, base, x, base - th, x + w * 0.05, base);
      }
    }
    this.root.add(back);

    const sun = this.scene.add.circle(w * 0.73, h * 0.16, Math.min(w, h) * 0.055, 0xffefc2, 0.15)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
    this.root.add(sun);
    this.scene.tweens.add({ targets: sun, alpha: 0.24, scale: 1.14, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    if (isUnlocked(state, 'glass') || isUnlocked(state, 'mirrors')) {
      const count = isUnlocked(state, 'mirrors') ? 5 : 3;
      for (let i = 0; i < count; i += 1) {
        const ray = this.scene.add.rectangle(w * (0.65 + i * 0.035), h * 0.30, w * 0.36, 12 + i * 4, 0xffefb0, 0.04)
          .setRotation(-0.46 + i * 0.035).setBlendMode(Phaser.BlendModes.ADD).setDepth(12);
        this.rays.push(ray);
        this.root.add(ray);
      }
    }
  }

  private drawGreenhouseShell(state: GameState): void {
    const w = this.w, h = this.h;
    const g = this.scene.add.graphics().setDepth(4);
    this.root.add(g);
    const top = h * 0.055;
    const bottom = h * 0.72;
    const left = w * 0.035;
    const right = w * 0.965;
    const center = w * 0.50;

    // glass wall tint
    g.fillStyle(C.glass, 0.07);
    g.fillRect(left, top, right - left, bottom - top);

    // warm stone foundation
    g.fillStyle(C.stone, 1);
    g.fillRect(0, bottom - h * 0.025, w, h * 0.07);
    g.fillStyle(C.stoneHi, 0.42);
    for (let i = 0; i < 22; i += 1) {
      const bw = w / 22;
      g.fillRoundedRect(i * bw + 3, bottom - h * 0.021, bw - 6, h * 0.045, 5);
    }

    // vertical iron/wood frames
    const columns = 8;
    for (let i = 0; i <= columns; i += 1) {
      const x = Phaser.Math.Linear(left, right, i / columns);
      g.lineStyle(Math.max(7, w * 0.006), C.frameDark, 0.88);
      g.lineBetween(x, top, x, bottom);
      g.lineStyle(Math.max(3, w * 0.0028), C.frameHi, 0.94);
      g.lineBetween(x, top, x, bottom);
      // decorative rivets
      for (let r = 1; r <= 5; r += 1) {
        g.fillStyle(C.brassHi, 0.55);
        g.fillCircle(x, Phaser.Math.Linear(top, bottom, r / 6), 2.1);
      }
    }

    // roof ribs converge into central ridge
    for (let i = 0; i <= columns; i += 1) {
      const x = Phaser.Math.Linear(left, right, i / columns);
      g.lineStyle(Math.max(5, w * 0.004), C.frameDark, 0.85);
      g.lineBetween(x, top, center, 0);
      g.lineStyle(Math.max(2, w * 0.0018), C.frameHi, 0.9);
      g.lineBetween(x, top, center, 0);
    }

    // central arched window - visual focal point behind tree
    const archW = w * 0.27;
    const archH = h * 0.46;
    const archX = center - archW / 2;
    const archY = h * 0.13;
    g.fillStyle(C.glassWarm, 0.055);
    g.fillRoundedRect(archX, archY, archW, archH, archW * 0.47);
    g.lineStyle(Math.max(6, w * 0.0045), C.frameDark, 0.9);
    g.strokeRoundedRect(archX, archY, archW, archH, archW * 0.47);
    g.lineStyle(Math.max(2.5, w * 0.002), C.frameHi, 0.95);
    g.strokeRoundedRect(archX, archY, archW, archH, archW * 0.47);
    g.lineBetween(center, archY + 6, center, archY + archH);
    g.lineBetween(archX + 6, archY + archH * 0.52, archX + archW - 6, archY + archH * 0.52);

    // tile floor with perspective and softer alternating stone tones
    const floor = this.scene.add.graphics().setDepth(3);
    floor.fillGradientStyle(C.floorHi, C.floorHi, C.floorDark, C.floorDark, 1);
    floor.fillRect(0, bottom, w, h - bottom);
    for (let r = 1; r <= 7; r += 1) {
      const t = r / 7;
      const y = bottom + (h - bottom) * Math.pow(t, 1.32);
      floor.lineStyle(1, C.stoneHi, 0.24);
      floor.lineBetween(0, y, w, y);
    }
    for (let c = -8; c <= 8; c += 1) {
      floor.lineStyle(1, C.stoneHi, 0.19);
      floor.lineBetween(center + c * w * 0.035, bottom, center + c * w * 0.10, h);
    }
    this.root.add(floor);

    // old vines stay dry until plant progression makes them green
    const vineGreen = isUnlocked(state, 'vines') || isUnlocked(state, 'canopy');
    this.drawHangingVine(w * 0.07, top + 8, h * 0.28, vineGreen);
    this.drawHangingVine(w * 0.91, top + 4, h * 0.33, vineGreen);
    this.drawHangingVine(w * 0.80, top + 4, h * 0.20, vineGreen);
  }

  private drawSideStations(state: GameState): void {
    const w = this.w, h = this.h;
    this.drawWorkbench(w * 0.055, h * 0.49, w * 0.18, h * 0.19, 'left', state);
    this.drawWorkbench(w * 0.765, h * 0.47, w * 0.18, h * 0.20, 'right', state);
    this.drawHangingLamp(w * 0.15, h * 0.34);
    this.drawHangingLamp(w * 0.86, h * 0.35);

    // central rug / work circle grounds the tree
    const rug = this.scene.add.ellipse(w * 0.5, h * 0.82, w * 0.30, h * 0.10, 0x5a4c3f, 0.28).setDepth(7);
    this.root.add(rug);
  }

  private drawWorkbench(x: number, y: number, width: number, height: number, side: 'left' | 'right', state: GameState): void {
    const g = this.scene.add.graphics().setDepth(10);
    this.root.add(g);
    g.fillStyle(C.woodDark, 0.35);
    g.fillEllipse(x + width / 2, y + height + 8, width * 1.05, 18);
    g.fillStyle(C.wood, 1);
    g.fillRoundedRect(x, y + height * 0.42, width, 13, 5);
    g.fillRoundedRect(x + 8, y + height * 0.42 + 10, 10, height * 0.58, 4);
    g.fillRoundedRect(x + width - 18, y + height * 0.42 + 10, 10, height * 0.58, 4);
    g.fillStyle(C.woodDark, 0.96);
    g.fillRoundedRect(x + width * 0.08, y + height * 0.08, width * 0.84, 8, 4);
    g.fillRoundedRect(x + width * 0.08, y + height * 0.28, width * 0.84, 7, 4);

    // coherent clutter: pots, jars, tools, books
    for (let i = 0; i < 5; i += 1) {
      const px = x + width * (0.12 + i * 0.17);
      const py = y + height * (i % 2 ? 0.28 : 0.08);
      const potColor = i % 2 ? 0x9e674b : 0x765744;
      g.fillStyle(potColor, 0.95);
      g.fillTrapezoid(px - 7, py - 15, 14, 15, 17, 12);
      g.fillStyle(C.stoneHi, 0.5);
      g.fillRoundedRect(px - 9, py - 17, 18, 4, 2);
      if ((state.unlocked.length + i) % 3 === 0) {
        g.lineStyle(2, C.leaf0, 0.9);
        g.lineBetween(px, py - 17, px + (i % 2 ? 5 : -5), py - 33);
        g.fillStyle(C.leaf2, 0.85);
        g.fillEllipse(px + (i % 2 ? 4 : -4), py - 31, 12, 6);
      }
    }

    // watering can
    const canX = side === 'left' ? x + width * 0.73 : x + width * 0.22;
    const canY = y + height * 0.39;
    g.fillStyle(0x738c7f, 0.95);
    g.fillRoundedRect(canX - 13, canY - 18, 26, 18, 6);
    g.lineStyle(3, 0x526a61, 0.95);
    g.beginPath();
    g.arc(canX, canY - 17, 15, Math.PI, Math.PI * 2, false);
    g.strokePath();
    g.lineBetween(canX + 12, canY - 12, canX + 28, canY - 22);
  }

  private drawHangingLamp(x: number, y: number): void {
    const g = this.scene.add.graphics().setDepth(14);
    g.lineStyle(2, C.frameDark, 0.8);
    g.lineBetween(x, 0, x, y - 18);
    g.fillStyle(C.brassDark, 1);
    g.fillRoundedRect(x - 12, y - 18, 24, 10, 4);
    g.fillStyle(C.brass, 1);
    g.fillTriangle(x - 15, y - 8, x + 15, y - 8, x, y + 16);
    this.root.add(g);
    const glow = this.scene.add.circle(x, y + 4, 18, C.cream, 0.09).setBlendMode(Phaser.BlendModes.ADD).setDepth(13);
    const core = this.scene.add.circle(x, y + 1, 4.5, C.cream, 0.88).setDepth(15);
    this.root.add([glow, core]);
    this.scene.tweens.add({ targets: glow, alpha: 0.16, scale: 1.12, duration: 1600 + x % 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private drawHangingVine(x: number, y: number, length: number, green: boolean): void {
    const g = this.scene.add.graphics().setDepth(9);
    const color = green ? C.leaf0 : 0x75695a;
    g.lineStyle(2.5, color, green ? 0.72 : 0.45);
    g.beginPath();
    g.moveTo(x, y);
    const points: Array<[number, number]> = [];
    for (let i = 1; i <= 9; i += 1) {
      const px = x + Math.sin(i * 0.9) * 11;
      const py = y + (length * i) / 9;
      g.lineTo(px, py);
      points.push([px, py]);
    }
    g.strokePath();
    this.root.add(g);
    for (let i = 0; i < points.length; i += 1) {
      const [px, py] = points[i];
      const leaf = this.scene.add.ellipse(px + (i % 2 ? 6 : -6), py, green ? 13 : 9, green ? 7 : 5, green ? (i % 2 ? C.leaf1 : C.leaf2) : 0x877663, green ? 0.72 : 0.35)
        .setRotation(i % 2 ? 0.42 : -0.42).setDepth(9);
      this.root.add(leaf);
    }
  }

  private drawTree(state: GameState, meta: P4MetaState): void {
    const w = this.w, h = this.h;
    const unlocked = state.unlocked.length / 32;
    const vigor = meta.treeVigor / 100;
    const progress = Phaser.Math.Clamp(0.045 + unlocked * 0.76 + vigor * 0.20, 0.045, 1);
    const baseX = w * 0.50;
    const baseY = h * 0.77;
    const tree = this.scene.add.container(baseX, baseY).setDepth(32);
    this.root.add(tree);
    this.tree = tree;

    const shadow = this.scene.add.ellipse(0, h * 0.023, w * (0.12 + progress * 0.12), h * 0.038, 0x213027, 0.22);
    tree.add(shadow);

    // ornate central planter, coherent with greenhouse brass/wood language
    const planter = this.scene.add.graphics();
    planter.fillStyle(C.woodDark, 1);
    planter.fillRoundedRect(-w * 0.14, -2, w * 0.28, h * 0.105, 13);
    planter.fillStyle(C.wood, 1);
    planter.fillRoundedRect(-w * 0.132, 4, w * 0.264, h * 0.080, 10);
    planter.lineStyle(3, C.brass, 0.94);
    planter.strokeRoundedRect(-w * 0.127, 8, w * 0.254, h * 0.067, 8);
    planter.fillStyle(C.soil, 1);
    planter.fillEllipse(0, 1, w * 0.22, h * 0.030);
    planter.fillStyle(C.brassHi, 0.82);
    planter.fillCircle(0, h * 0.047, 10);
    planter.fillStyle(C.leaf1, 0.92);
    planter.fillTriangle(-5, h * 0.050, 0, h * 0.034, 5, h * 0.050);
    tree.add(planter);

    // roots become visible as tree matures
    const roots = this.scene.add.graphics();
    const rootCount = Math.max(2, Math.floor(progress * 8));
    for (let i = 0; i < rootCount; i += 1) {
      const a = Math.PI + (Math.PI * i) / Math.max(1, rootCount - 1);
      const len = w * (0.035 + progress * 0.05);
      roots.lineStyle(4 + progress * 3, C.trunkDark, 0.75);
      roots.lineBetween(0, -5, Math.cos(a) * len, -5 + Math.sin(a) * len * 0.28);
      roots.lineStyle(2 + progress * 2, C.trunkHi, 0.55);
      roots.lineBetween(0, -5, Math.cos(a) * len, -5 + Math.sin(a) * len * 0.28);
    }
    tree.add(roots);

    const trunkG = this.scene.add.graphics();
    const trunkHeight = h * (0.07 + progress * 0.35);
    const trunkWidth = Math.max(5, h * (0.010 + progress * 0.031));
    const seed = 1127 + Math.floor(progress * 100);
    this.drawBranchRecursive(trunkG, 0, -4, -Math.PI / 2, trunkHeight, trunkWidth, 0, this.branchDepth(progress), progress, seed);
    tree.add(trunkG);

    const crown = this.scene.add.container(0, -trunkHeight * 0.83);
    tree.add(crown);
    this.crown = crown;

    const leaves = Math.floor(progress * 125);
    const radiusX = w * (0.025 + progress * 0.17);
    const radiusY = h * (0.018 + progress * 0.13);
    const leafColors = [C.leaf0, C.leaf1, C.leaf2, C.leaf3];
    for (let i = 0; i < leaves; i += 1) {
      const angle = i * 2.399963 + this.noise(i + seed) * 0.32;
      const radial = Math.sqrt((i + 1) / Math.max(1, leaves));
      const lx = Math.cos(angle) * radiusX * radial;
      const ly = Math.sin(angle) * radiusY * radial * 0.86 + Math.sin(i * 0.72) * 2;
      const leafW = Math.max(5, Math.min(w, h) * (0.006 + (i % 4) * 0.0011));
      const leaf = this.scene.add.ellipse(lx, ly, leafW * 1.72, leafW, leafColors[i % leafColors.length], 0.90)
        .setRotation(angle + 0.35);
      crown.add(leaf);
    }

    if (isUnlocked(state, 'flowers') || progress > 0.58) {
      const count = isUnlocked(state, 'orchid') ? 32 : isUnlocked(state, 'flowers') ? 18 : 8;
      const colors = [C.cream, C.pink, C.yellow, C.lavender];
      for (let i = 0; i < count; i += 1) {
        const a = i * 2.11 + 0.3;
        const bx = Math.cos(a) * radiusX * (0.40 + (i % 5) * 0.10);
        const by = Math.sin(a) * radiusY * (0.36 + (i % 4) * 0.13);
        const blossom = this.scene.add.container(bx, by);
        const color = colors[i % colors.length];
        for (let p = 0; p < 5; p += 1) {
          const pa = (Math.PI * 2 * p) / 5;
          blossom.add(this.scene.add.ellipse(Math.cos(pa) * 3.5, Math.sin(pa) * 3.5, 5.5, 3.2, color, 0.92).setRotation(pa));
        }
        blossom.add(this.scene.add.circle(0, 0, 1.7, C.brassHi, 1));
        crown.add(blossom);
      }
    }

    if (isUnlocked(state, 'central_bud')) {
      const bud = this.scene.add.container(0, -radiusY * 0.18);
      bud.add(this.scene.add.ellipse(0, 0, 34, 48, C.pink, 0.88).setStrokeStyle(3, C.cream, 0.72));
      bud.add(this.scene.add.ellipse(-8, 3, 17, 37, 0xc8798b, 0.52).setRotation(-0.28));
      crown.add(bud);
    }
    if (isUnlocked(state, 'final_bloom')) {
      const glow = this.scene.add.circle(0, -radiusY * 0.16, Math.min(w, h) * 0.065, C.cream, 0.13)
        .setBlendMode(Phaser.BlendModes.ADD);
      crown.add(glow);
      this.scene.tweens.add({ targets: glow, scale: 1.18, alpha: 0.24, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private branchDepth(progress: number): number {
    if (progress < 0.18) return 1;
    if (progress < 0.38) return 2;
    if (progress < 0.65) return 3;
    return 4;
  }

  private drawBranchRecursive(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number, length: number, width: number, depth: number, maxDepth: number, progress: number, seed: number): void {
    const bend = (this.noise(seed + depth * 17) - 0.5) * 0.12;
    const ex = x + Math.cos(angle + bend) * length;
    const ey = y + Math.sin(angle + bend) * length;
    g.lineStyle(width + 3.5, C.trunkDark, 1);
    g.lineBetween(x, y, ex, ey);
    g.lineStyle(Math.max(1.5, width), depth % 2 ? C.trunk : C.trunkHi, 1);
    g.lineBetween(x, y, ex, ey);
    if (depth >= maxDepth) return;

    const branchCount = depth === 0 ? 3 : 2;
    for (let i = 0; i < branchCount; i += 1) {
      const spread = branchCount === 3 ? [-0.52, 0, 0.52][i] : (i === 0 ? -0.50 : 0.50);
      const variance = (this.noise(seed + depth * 31 + i * 13) - 0.5) * 0.22;
      const childLen = length * (0.58 + this.noise(seed + i * 11) * 0.08);
      this.drawBranchRecursive(g, ex, ey, angle + spread + variance, childLen, width * 0.64, depth + 1, maxDepth, progress, seed + i * 97 + 19);
    }
  }

  private drawPump(state: GameState): void {
    if (!isUnlocked(state, 'pump')) return;
    const w = this.w, h = this.h;
    const x = w * 0.19, y = h * 0.73;
    const pump = this.scene.add.container(x, y).setDepth(25);
    this.root.add(pump);

    const shadow = this.scene.add.ellipse(0, 10, w * 0.13, 19, 0x253027, 0.20);
    pump.add(shadow);
    const body = this.scene.add.graphics();
    body.fillStyle(C.brassDark, 1);
    body.fillRoundedRect(-w * 0.038, -h * 0.20, w * 0.076, h * 0.19, 14);
    body.fillStyle(C.brass, 1);
    body.fillRoundedRect(-w * 0.033, -h * 0.194, w * 0.066, h * 0.18, 12);
    body.fillStyle(C.brassHi, 0.55);
    body.fillRoundedRect(-w * 0.026, -h * 0.184, w * 0.014, h * 0.15, 7);
    body.lineStyle(5, C.waterDark, 1);
    body.lineBetween(w * 0.033, -h * 0.10, w * 0.092, -h * 0.10);
    body.lineBetween(w * 0.092, -h * 0.10, w * 0.092, 0);
    body.fillStyle(C.brassDark, 1);
    body.fillRoundedRect(-w * 0.052, -h * 0.215, w * 0.104, h * 0.025, 8);
    pump.add(body);

    const wheel = this.scene.add.container(-w * 0.052, -h * 0.085);
    const ring = this.scene.add.circle(0, 0, Math.min(w, h) * 0.035, 0x1d4439, 1).setStrokeStyle(4, C.brassHi, 1);
    wheel.add(ring);
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI * 2 * i) / 6;
      wheel.add(this.scene.add.rectangle(Math.cos(a) * 10, Math.sin(a) * 10, 20, 2, C.brassHi, 0.88).setRotation(a));
    }
    wheel.add(this.scene.add.circle(0, 0, 5, C.brassHi, 1));
    pump.add(wheel);
    this.pumpWheel = wheel;

    if (isUnlocked(state, 'gutters') || isUnlocked(state, 'irrigation') || isUnlocked(state, 'filter')) {
      const count = isUnlocked(state, 'irrigation') ? 13 : 8;
      for (let i = 0; i < count; i += 1) {
        const d = this.scene.add.circle(x + w * 0.092 + (i % 3) * 2, h * 0.515 - (i % 6) * 9, 2.3 + (i % 2), i % 3 ? C.water : C.waterHi, 0.78).setDepth(27);
        this.root.add(d);
        this.waterDrops.push(d);
      }
      const basin = this.scene.add.ellipse(x + w * 0.092, h * 0.795, w * 0.10, h * 0.030, C.waterDark, 0.65).setDepth(21);
      const shine = this.scene.add.ellipse(x + w * 0.084, h * 0.790, w * 0.067, h * 0.010, C.waterHi, 0.18).setDepth(22);
      this.root.add([basin, shine]);
      this.scene.tweens.add({ targets: shine, scaleX: 1.15, alpha: 0.09, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private drawBeds(state: GameState): void {
    if (!isUnlocked(state, 'bed')) return;
    const w = this.w, h = this.h;
    const group = this.scene.add.container(0, 0).setDepth(22);
    this.root.add(group);
    this.flowerGroup = group;
    const bedCount = isUnlocked(state, 'herbs') ? 3 : 2;
    for (let b = 0; b < bedCount; b += 1) {
      const x = w * (0.70 + b * 0.095);
      const y = h * (0.73 - (b % 2) * 0.025);
      const box = this.scene.add.graphics();
      box.fillStyle(C.woodDark, 1);
      box.fillRoundedRect(x - w * 0.052, y, w * 0.104, h * 0.062, 8);
      box.fillStyle(C.wood, 1);
      box.fillRoundedRect(x - w * 0.048, y + 4, w * 0.096, h * 0.048, 6);
      box.fillStyle(C.soil, 1);
      box.fillEllipse(x, y + 2, w * 0.086, h * 0.027);
      box.lineStyle(1.5, C.brass, 0.45);
      box.strokeRoundedRect(x - w * 0.045, y + 7, w * 0.09, h * 0.038, 5);
      group.add(box);

      const plantCount = 5 + (isUnlocked(state, 'herbs') ? 2 : 0) + (isUnlocked(state, 'canopy') ? 2 : 0);
      for (let p = 0; p < plantCount; p += 1) {
        const px = x - w * 0.035 + p * (w * 0.070 / Math.max(1, plantCount - 1));
        const stemH = h * (0.035 + (p % 3) * 0.010);
        const stem = this.scene.add.graphics();
        stem.lineStyle(2, C.leaf0, 0.92);
        stem.lineBetween(px, y, px + (p % 2 ? 2 : -2), y - stemH);
        group.add(stem);
        group.add(this.scene.add.ellipse(px - 5, y - stemH * 0.55, 12, 6, p % 2 ? C.leaf1 : C.leaf2, 0.92).setRotation(-0.45));
        group.add(this.scene.add.ellipse(px + 5, y - stemH * 0.70, 11, 6, p % 2 ? C.leaf2 : C.leaf1, 0.88).setRotation(0.45));
        if (isUnlocked(state, 'flowers')) {
          const colors = [C.pink, C.yellow, C.lavender, C.cream];
          const bloom = this.scene.add.container(px, y - stemH);
          for (let petal = 0; petal < 5; petal += 1) {
            const a = (Math.PI * 2 * petal) / 5;
            bloom.add(this.scene.add.ellipse(Math.cos(a) * 3, Math.sin(a) * 3, 5, 3, colors[(b + p) % colors.length], 0.95).setRotation(a));
          }
          bloom.add(this.scene.add.circle(0, 0, 1.5, C.brassHi, 1));
          group.add(bloom);
        }
      }
    }
  }

  private drawPond(state: GameState): void {
    if (!isUnlocked(state, 'pond')) return;
    const w = this.w, h = this.h;
    const x = w * 0.33, y = h * 0.80;
    const rim = this.scene.add.ellipse(x, y, w * 0.18, h * 0.078, C.stone, 1).setStrokeStyle(3, C.stoneHi, 0.75).setDepth(18);
    const water = this.scene.add.ellipse(x, y - 2, w * 0.155, h * 0.057, C.waterDark, 0.92).setDepth(19);
    const shine = this.scene.add.ellipse(x - w * 0.018, y - 5, w * 0.085, h * 0.014, C.waterHi, 0.20).setDepth(20);
    this.root.add([rim, water, shine]);
    this.scene.tweens.add({ targets: shine, scaleX: 1.18, alpha: 0.10, duration: 1350, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private drawLife(state: GameState): void {
    const w = this.w, h = this.h;
    if (isUnlocked(state, 'bees')) {
      const hive = this.scene.add.container(w * 0.86, h * 0.50).setDepth(28);
      const g = this.scene.add.graphics();
      g.fillStyle(C.woodDark, 0.25);
      g.fillEllipse(0, 31, 54, 12);
      g.fillStyle(C.brassDark, 1);
      g.fillRoundedRect(-23, -29, 46, 58, 12);
      for (let i = 0; i < 4; i += 1) {
        g.fillStyle(i % 2 ? C.brass : C.brassHi, 0.92);
        g.fillRoundedRect(-20 + i, -24 + i * 12, 40 - i * 2, 9, 5);
      }
      g.fillStyle(C.ink, 1);
      g.fillCircle(0, 20, 4);
      hive.add(g);
      this.root.add(hive);
      const count = isUnlocked(state, 'pollination') ? 6 : 3;
      for (let i = 0; i < count; i += 1) this.makeBee(w * 0.76, h * 0.42, i);
    }

    if (isUnlocked(state, 'butterflies')) {
      for (let i = 0; i < 3; i += 1) this.makeButterfly(w * (0.64 + i * 0.055), h * (0.35 + (i % 2) * 0.06), i);
    }

    if (isUnlocked(state, 'birds')) {
      for (let i = 0; i < 2; i += 1) {
        const bx = w * (0.62 + i * 0.11), by = h * (0.25 + i * 0.04);
        const bird = this.scene.add.container(bx, by).setDepth(24);
        bird.add(this.scene.add.ellipse(0, 0, 15, 9, 0x5d776c, 1));
        bird.add(this.scene.add.triangle(8, 0, 0, -3, 8, 0, 0, 3, C.brassHi, 1));
        bird.add(this.scene.add.ellipse(-3, -2, 9, 4, 0x81998e, 0.9).setRotation(-0.25));
        this.root.add(bird);
        this.movers.push({ node: bird, baseX: bx, baseY: by, rx: w * 0.11, ry: h * 0.032, speed: 0.16 + i * 0.02, phase: i * 2.7, kind: 'bird' });
      }
    }
  }

  private makeBee(baseX: number, baseY: number, i: number): void {
    const node = this.scene.add.container(baseX, baseY).setDepth(34);
    const left = this.scene.add.ellipse(-4, -4, 8, 5, C.glassWarm, 0.68).setRotation(-0.45);
    const right = this.scene.add.ellipse(4, -4, 8, 5, C.glassWarm, 0.68).setRotation(0.45);
    const body = this.scene.add.ellipse(0, 0, 12, 7, C.yellow, 1).setStrokeStyle(1.5, C.ink, 0.85);
    const stripe = this.scene.add.rectangle(0, 0, 2.3, 7, C.ink, 0.88);
    node.add([left, right, body, stripe]);
    this.root.add(node);
    this.scene.tweens.add({ targets: [left, right], scaleY: 0.42, duration: 82 + i * 5, yoyo: true, repeat: -1 });
    this.movers.push({ node, baseX, baseY, rx: this.w * (0.055 + (i % 3) * 0.016), ry: this.h * (0.038 + (i % 2) * 0.014), speed: 0.52 + i * 0.035, phase: i * 1.31, kind: 'bee' });
  }

  private makeButterfly(baseX: number, baseY: number, i: number): void {
    const node = this.scene.add.container(baseX, baseY).setDepth(33);
    const color = i % 2 ? C.lavender : C.pink;
    const left = this.scene.add.ellipse(-4, 0, 9, 13, color, 0.82).setRotation(-0.42);
    const right = this.scene.add.ellipse(4, 0, 9, 13, color, 0.82).setRotation(0.42);
    const body = this.scene.add.ellipse(0, 2, 3, 10, C.ink, 0.9);
    node.add([left, right, body]);
    this.root.add(node);
    this.scene.tweens.add({ targets: [left, right], scaleX: 0.38, duration: 140 + i * 12, yoyo: true, repeat: -1 });
    this.movers.push({ node, baseX, baseY, rx: this.w * 0.055, ry: this.h * 0.045, speed: 0.33 + i * 0.04, phase: i * 1.8, kind: 'butterfly' });
  }

  private drawGenerationActors(meta: P4MetaState): void {
    if (meta.generation >= 2) this.drawGardener();
    if (meta.generation >= 3) this.drawFountain();
  }

  private drawGardener(): void {
    const w = this.w, h = this.h;
    const node = this.scene.add.container(w * 0.32, h * 0.76).setDepth(42);
    const shadow = this.scene.add.ellipse(0, 20, 40, 10, 0x203027, 0.24);
    const legL = this.scene.add.rectangle(-6, 11, 6, 22, 0x465d50, 1).setRotation(0.08);
    const legR = this.scene.add.rectangle(6, 11, 6, 22, 0x465d50, 1).setRotation(-0.08);
    const torso = this.scene.add.rectangle(0, -8, 26, 34, C.cloth, 1).setStrokeStyle(2, 0x395542, 0.9);
    const apron = this.scene.add.rectangle(0, -4, 18, 22, 0x889a79, 0.9);
    const head = this.scene.add.circle(0, -33, 9, C.skin, 1).setStrokeStyle(1.5, 0x77563f, 0.8);
    const brim = this.scene.add.ellipse(0, -43, 32, 7, C.brassHi, 1);
    const hat = this.scene.add.rectangle(0, -47, 18, 9, 0xc39352, 1);
    const arm = this.scene.add.rectangle(14, -8, 18, 5, C.skin, 1).setRotation(0.35);
    const can = this.scene.add.rectangle(25, -2, 14, 11, 0x718b80, 1).setStrokeStyle(1.5, 0x46645a, 1);
    node.add([shadow, legL, legR, torso, apron, head, brim, hat, arm, can]);
    this.root.add(node);
    this.gardener = node;
    this.gardenerY = h * 0.76;
  }

  private drawFountain(): void {
    const w = this.w, h = this.h;
    const x = w * 0.33, y = h * 0.76;
    const g = this.scene.add.graphics().setDepth(21);
    g.fillStyle(C.stone, 1);
    g.fillEllipse(x, y + 10, w * 0.12, h * 0.048);
    g.fillStyle(C.stoneHi, 1);
    g.fillEllipse(x, y + 5, w * 0.10, h * 0.037);
    g.fillStyle(C.waterDark, 1);
    g.fillEllipse(x, y + 2, w * 0.085, h * 0.024);
    g.fillStyle(C.stone, 1);
    g.fillRoundedRect(x - 6, y - h * 0.08, 12, h * 0.08, 4);
    this.root.add(g);
    for (let i = 0; i < 10; i += 1) {
      const d = this.scene.add.circle(x + (i - 4.5) * 2.5, y - 30 - (i % 4) * 7, 2.3, i % 2 ? C.water : C.waterHi, 0.80).setDepth(22);
      this.root.add(d);
      this.waterDrops.push(d);
    }
  }

  private drawForeground(state: GameState): void {
    const w = this.w, h = this.h;
    const g = this.scene.add.graphics().setDepth(48);
    // foreground pots create depth without hiding gameplay center
    for (let i = 0; i < 4; i += 1) {
      const x = i < 2 ? w * (0.03 + i * 0.055) : w * (0.88 + (i - 2) * 0.055);
      const y = h * (0.88 + (i % 2) * 0.025);
      g.fillStyle(i % 2 ? 0x805c47 : 0x9b694d, 0.98);
      g.fillTrapezoid(x - 15, y - 30, 30, 30, 36, 24);
      g.fillStyle(C.soil, 1);
      g.fillEllipse(x, y - 29, 31, 8);
      const green = state.unlocked.length > 6;
      if (green) {
        g.lineStyle(3, C.leaf0, 0.9);
        g.lineBetween(x, y - 29, x + (i % 2 ? 8 : -8), y - 60);
        g.fillStyle(C.leaf2, 0.88);
        g.fillEllipse(x - 7, y - 50, 19, 10);
        g.fillEllipse(x + 8, y - 61, 18, 10);
      }
    }
    this.root.add(g);
  }

  private drawAtmosphere(state: GameState): void {
    const count = 14 + (isUnlocked(state, 'ecosystem') ? 16 : 0);
    for (let i = 0; i < count; i += 1) {
      const x = this.w * (0.15 + ((i * 67) % 72) / 100);
      const y = this.h * (0.34 + ((i * 29) % 42) / 100);
      const color = i % 3 === 0 ? C.cream : i % 3 === 1 ? C.leaf3 : C.waterHi;
      const dot = this.scene.add.circle(x, y, 1.2 + (i % 2) * 0.6, color, 0.12).setDepth(17);
      this.root.add(dot);
      this.motes.push({ dot, baseX: x, baseY: y, range: 6 + (i % 4) * 4, speed: 0.10 + (i % 5) * 0.018, phase: i * 0.74 });
    }
  }

  private noise(n: number): number {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
}
