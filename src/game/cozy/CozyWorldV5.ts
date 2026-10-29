import Phaser from 'phaser';
import { CozyWorldV4, type WorldReaction as BaseWorldReaction } from './CozyWorldV4';
import type { GameState } from '../model';
import { getCrewGardenerCount, type P4MetaState } from '../p4Meta';

export type WorldReaction = BaseWorldReaction | 'gardener';

type GardenerActor = {
  node: Phaser.GameObjects.Container;
  leftArm: Phaser.GameObjects.Rectangle;
  rightArm: Phaser.GameObjects.Rectangle;
  leftLeg: Phaser.GameObjects.Rectangle;
  rightLeg: Phaser.GameObjects.Rectangle;
  baseY: number;
  minX: number;
  maxX: number;
  phase: number;
  speed: number;
};

const P = {
  wood: 0x725038,
  woodDark: 0x493426,
  woodHi: 0xa47650,
  brass: 0xb9854d,
  brassHi: 0xe0bc75,
  green0: 0x315f43,
  green1: 0x4d7f50,
  green2: 0x78a966,
  soil: 0x4a3124,
  clay: 0x9b674d,
  stone: 0x8d7968,
  water: 0x5dc3d5,
  waterHi: 0xc6f2ec,
  cream: 0xf1dfb1,
  cloth0: 0x55735d,
  cloth1: 0x8b7258,
  cloth2: 0x5b6d86,
  skin: 0xd6aa81,
  hair: 0x5b3d2d,
};

export class CozyWorldV5 {
  private readonly base: CozyWorldV4;
  private overlay?: Phaser.GameObjects.Container;
  private gardeners: GardenerActor[] = [];
  private fountainDrops: Phaser.GameObjects.Arc[] = [];
  private clock = 0;
  private signature = '';
  private w = 0;
  private h = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly root: Phaser.GameObjects.Container,
  ) {
    this.base = new CozyWorldV4(scene, root);
  }

  sync(state: GameState, meta: P4MetaState, force = false): void {
    // The legacy base still owns the structural tree/greenhouse. It may clear the root
    // during a rebuild, so the V5 overlay is deliberately created only afterwards.
    const baseMeta: P4MetaState = meta.generation >= 2 ? { ...meta, generation: 1 } : meta;
    this.base.sync(state, baseMeta, force);

    this.w = this.scene.scale.width;
    this.h = this.scene.scale.height;
    const signature = [
      this.w,
      this.h,
      meta.generation,
      meta.crewPoints,
      meta.crewUpgrades.join(','),
      state.unlocked.join(','),
    ].join('|');
    const overlayAlive = Boolean(this.overlay?.active && this.overlay.scene);
    if (!force && signature === this.signature && overlayAlive) return;
    this.signature = signature;
    this.rebuildOverlay(state, meta);
  }

  update(dt: number): void {
    this.base.update(dt);
    this.clock += dt;

    for (const gardener of this.gardeners) {
      const travel = (Math.sin(this.clock * gardener.speed + gardener.phase) + 1) / 2;
      const direction = Math.cos(this.clock * gardener.speed + gardener.phase);
      gardener.node.x = Phaser.Math.Linear(gardener.minX, gardener.maxX, travel);
      gardener.node.y = gardener.baseY + Math.sin(this.clock * 5.8 + gardener.phase) * 1.7;
      gardener.node.scaleX = direction >= 0 ? 1 : -1;
      const stride = Math.sin(this.clock * 7.2 + gardener.phase) * 0.32;
      gardener.leftLeg.rotation = stride;
      gardener.rightLeg.rotation = -stride;
      gardener.leftArm.rotation = -stride * 0.75 - 0.12;
      gardener.rightArm.rotation = stride * 0.75 + 0.18;
    }

    for (let i = 0; i < this.fountainDrops.length; i += 1) {
      const drop = this.fountainDrops[i];
      const t = (this.clock * (0.55 + (i % 3) * 0.08) + i * 0.18) % 1;
      const arc = 4 * t * (1 - t);
      drop.x = this.w * 0.33 + (i - 7) * 3 + (t - 0.5) * (i % 2 ? 34 : -34);
      drop.y = this.h * 0.76 - 22 - arc * 52 + t * 32;
      drop.alpha = 0.45 + arc * 0.45;
    }
  }

  reactTap(x: number, y: number): void {
    this.base.reactTap(x, y);
  }

  reactEvent(kind: WorldReaction): void {
    if (kind === 'gardener') {
      for (const gardener of this.gardeners) {
        this.scene.tweens.killTweensOf(gardener.node);
        this.scene.tweens.add({ targets: gardener.node, scaleY: 1.06, duration: 95, yoyo: true, repeat: 2, ease: 'Quad.out' });
      }
      return;
    }
    this.base.reactEvent(kind);
  }

  treeHitTest(x: number, y: number): boolean {
    return this.base.treeHitTest(x, y);
  }

  eventAnchor(kind: WorldReaction): Phaser.Math.Vector2 {
    if (kind === 'gardener') {
      const actor = this.gardeners[0];
      return actor
        ? new Phaser.Math.Vector2(actor.node.x, actor.node.y - 36)
        : new Phaser.Math.Vector2(this.w * 0.38, this.h * 0.73);
    }
    return this.base.eventAnchor(kind);
  }

  destroy(): void {
    this.killOverlayTweens();
    this.overlay?.destroy(true);
    this.overlay = undefined;
    this.gardeners = [];
    this.fountainDrops = [];
  }

  private rebuildOverlay(state: GameState, meta: P4MetaState): void {
    this.killOverlayTweens();
    this.overlay?.destroy(true);
    this.overlay = this.scene.add.container(0, 0).setDepth(55);
    this.root.add(this.overlay);
    this.gardeners = [];
    this.fountainDrops = [];

    this.drawDenseProps(state);
    const gardenerCount = getCrewGardenerCount(meta);
    for (let i = 0; i < gardenerCount; i += 1) this.drawGardener(i, gardenerCount);
    if (meta.generation >= 3) this.drawFountain();
  }

  private drawDenseProps(state: GameState): void {
    const overlay = this.overlay!;
    const w = this.w;
    const h = this.h;
    const progress = state.unlocked.length / 32;
    const propCount = 7 + Math.floor(progress * 13);

    for (let i = 0; i < Math.min(8, 3 + Math.floor(progress * 6)); i += 1) {
      const x = w * (0.12 + i * 0.105);
      const y = h * (0.19 + (i % 2) * 0.035);
      const pot = this.scene.add.graphics();
      pot.lineStyle(2, P.woodDark, 0.72);
      pot.lineBetween(x - 12, h * 0.06, x - 4, y - 8);
      pot.lineBetween(x + 12, h * 0.06, x + 4, y - 8);
      pot.fillStyle(P.clay, 0.96);
      pot.fillRoundedRect(x - 19, y - 7, 38, 18, 6);
      pot.fillStyle(P.soil, 1);
      pot.fillEllipse(x, y - 6, 32, 8);
      overlay.add(pot);
      for (let leaf = 0; leaf < 3 + (i % 3); leaf += 1) {
        overlay.add(this.scene.add.ellipse(x + (leaf - 1) * 7, y + 5 + leaf * 4, 15, 7, leaf % 2 ? P.green1 : P.green2, 0.92).setRotation((leaf - 1) * 0.45));
      }
    }

    for (let i = 0; i < propCount; i += 1) {
      const side = i % 2 === 0 ? 1 : -1;
      const lane = Math.floor(i / 2) % 5;
      const x = side > 0 ? w * (0.075 + lane * 0.025) : w * (0.925 - lane * 0.025);
      const y = h * (0.64 + (i % 4) * 0.065);
      const scale = 0.82 + (i % 3) * 0.10;
      if (i % 4 === 0) this.drawCrate(x, y, scale);
      else this.drawSidePot(x, y, scale, side, state.unlocked.length > 3, i);
    }

    const benchY = h * 0.78;
    const bench = this.scene.add.graphics();
    bench.fillStyle(P.woodDark, 1);
    bench.fillRoundedRect(w * 0.74, benchY, w * 0.19, 13, 5);
    bench.fillStyle(P.wood, 1);
    bench.fillRoundedRect(w * 0.755, benchY + 10, 9, h * 0.11, 3);
    bench.fillRoundedRect(w * 0.905, benchY + 10, 9, h * 0.11, 3);
    overlay.add(bench);
    for (let i = 0; i < 3 + Math.floor(progress * 5); i += 1) {
      const jarX = w * (0.765 + i * 0.021);
      overlay.add(this.scene.add.rectangle(jarX, benchY - 7 - (i % 2) * 4, 13, 19 + (i % 3) * 4, i % 2 ? P.brassHi : P.clay, 0.88).setStrokeStyle(1, P.woodDark, 0.55));
    }

    for (const x of [w * 0.11, w * 0.89]) {
      const lantern = this.scene.add.container(x, h * 0.52);
      lantern.add(this.scene.add.rectangle(0, 0, 20, 30, P.woodDark, 0.96).setStrokeStyle(2, P.brass, 0.9));
      const glow = this.scene.add.circle(0, 0, 7, P.cream, 0.62).setBlendMode(Phaser.BlendModes.ADD);
      lantern.add(glow);
      this.scene.tweens.add({ targets: glow, alpha: 0.85, scale: 1.12, duration: 1400 + (x > w / 2 ? 180 : 0), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      overlay.add(lantern);
    }
  }

  private drawCrate(x: number, y: number, scale: number): void {
    const crate = this.scene.add.graphics();
    crate.fillStyle(P.woodDark, 1);
    crate.fillRoundedRect(x - 22 * scale, y - 16 * scale, 44 * scale, 32 * scale, 4);
    crate.lineStyle(2, P.woodHi, 0.7);
    crate.lineBetween(x - 18 * scale, y - 12 * scale, x + 18 * scale, y + 12 * scale);
    crate.lineBetween(x + 18 * scale, y - 12 * scale, x - 18 * scale, y + 12 * scale);
    this.overlay!.add(crate);
  }

  private drawSidePot(x: number, y: number, scale: number, side: number, green: boolean, index: number): void {
    const pot = this.scene.add.graphics();
    pot.fillStyle(index % 3 ? P.clay : P.brass, 0.94);
    pot.fillPoints([
      new Phaser.Geom.Point(x - 13 * scale, y - 10 * scale),
      new Phaser.Geom.Point(x + 13 * scale, y - 10 * scale),
      new Phaser.Geom.Point(x + 9 * scale, y + 12 * scale),
      new Phaser.Geom.Point(x - 9 * scale, y + 12 * scale),
    ], true);
    pot.fillStyle(P.soil, 1);
    pot.fillEllipse(x, y - 9 * scale, 23 * scale, 7 * scale);
    this.overlay!.add(pot);
    if (!green) return;
    const stem = this.scene.add.graphics();
    stem.lineStyle(2, P.green0, 0.9);
    stem.lineBetween(x, y - 9 * scale, x + side * 5, y - 35 * scale);
    this.overlay!.add(stem);
    this.overlay!.add(this.scene.add.ellipse(x - 7, y - 25 * scale, 16 * scale, 8 * scale, P.green2, 0.9).setRotation(-0.35));
    this.overlay!.add(this.scene.add.ellipse(x + 8, y - 35 * scale, 16 * scale, 8 * scale, P.green1, 0.9).setRotation(0.35));
  }

  private drawGardener(index: number, count: number): void {
    const w = this.w;
    const h = this.h;
    const color = [P.cloth0, P.cloth1, P.cloth2][index % 3];
    const node = this.scene.add.container(w * (0.30 + index * 0.08), h * 0.77).setDepth(66);

    const shadow = this.scene.add.ellipse(0, 25, 44, 10, 0x203027, 0.20);
    const body = this.scene.add.ellipse(0, -7, 27, 40, color, 1).setStrokeStyle(2, P.woodDark, 0.62);
    const apron = this.scene.add.ellipse(0, 0, 19, 27, 0xb7a77d, 0.88);
    const neck = this.scene.add.rectangle(0, -29, 7, 8, P.skin, 1);
    const head = this.scene.add.circle(0, -39, 10, P.skin, 1).setStrokeStyle(1.5, P.hair, 0.72);
    const hair = this.scene.add.ellipse(0, -45, 18, 9, P.hair, 0.92);
    const brim = this.scene.add.ellipse(0, -49, 35, 7, 0xc89b5e, 1).setStrokeStyle(1, P.woodDark, 0.6);
    const hat = this.scene.add.ellipse(0, -53, 21, 12, 0xb9844f, 1);
    const eye = this.scene.add.circle(3, -39, 1.2, 0x3a302a, 1);
    const leftLeg = this.scene.add.rectangle(-7, 17, 7, 25, 0x42584e, 1).setOrigin(0.5, 0.15);
    const rightLeg = this.scene.add.rectangle(7, 17, 7, 25, 0x42584e, 1).setOrigin(0.5, 0.15);
    const leftBoot = this.scene.add.ellipse(-9, 37, 13, 7, P.woodDark, 1);
    const rightBoot = this.scene.add.ellipse(9, 37, 13, 7, P.woodDark, 1);
    const leftArm = this.scene.add.rectangle(-17, -8, 6, 27, P.skin, 1).setOrigin(0.5, 0.16).setRotation(-0.18);
    const rightArm = this.scene.add.rectangle(17, -8, 6, 27, P.skin, 1).setOrigin(0.5, 0.16).setRotation(0.22);
    const toolHandle = this.scene.add.rectangle(24, 8, 3, 35, P.woodHi, 1).setRotation(0.35);
    const toolHead = this.scene.add.rectangle(30, 23, 13, 4, P.brass, 1).setRotation(0.35);

    node.add([shadow, leftLeg, rightLeg, leftBoot, rightBoot, body, apron, neck, head, hair, eye, brim, hat, leftArm, rightArm, toolHandle, toolHead]);
    this.overlay!.add(node);

    const spread = count <= 1 ? 0 : (index - (count - 1) / 2) * w * 0.055;
    this.gardeners.push({
      node,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      baseY: h * (0.765 + (index % 2) * 0.018),
      minX: w * 0.24 + spread,
      maxX: w * 0.72 + spread,
      phase: index * 2.17,
      speed: 0.18 + index * 0.025,
    });
  }

  private drawFountain(): void {
    const w = this.w;
    const h = this.h;
    const x = w * 0.33;
    const y = h * 0.79;
    const base = this.scene.add.graphics();
    base.fillStyle(P.stone, 1);
    base.fillEllipse(x, y + 9, w * 0.16, h * 0.060);
    base.fillStyle(0x9f8b75, 1);
    base.fillEllipse(x, y + 3, w * 0.135, h * 0.046);
    base.fillStyle(0x3f8290, 0.96);
    base.fillEllipse(x, y, w * 0.112, h * 0.033);
    base.fillStyle(P.stone, 1);
    base.fillRoundedRect(x - 8, y - 72, 16, 68, 6);
    base.fillEllipse(x, y - 72, 44, 13);
    this.overlay!.add(base);

    for (let i = 0; i < 15; i += 1) {
      const drop = this.scene.add.circle(x, y - 24, 2.2 + (i % 2) * 0.6, i % 3 ? P.water : P.waterHi, 0.78);
      this.overlay!.add(drop);
      this.fountainDrops.push(drop);
    }
  }

  private killOverlayTweens(): void {
    if (!this.overlay) return;
    const stack: Phaser.GameObjects.GameObject[] = [...this.overlay.list];
    while (stack.length > 0) {
      const object = stack.pop()!;
      this.scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) stack.push(...object.list);
    }
    this.scene.tweens.killTweensOf(this.overlay);
  }
}
