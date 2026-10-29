import Phaser from 'phaser';
import { CozyWorldV3, type WorldReaction } from './CozyWorldV3';
import { isUnlocked, type GameState } from '../model';
import type { P4MetaState } from '../p4Meta';

type Leaf = { node: Phaser.GameObjects.Ellipse; x: number; y: number; phase: number };

const GREENS = [0x2f6042, 0x477f50, 0x68a55b, 0x8cbc69];
const BLOOMS = [0xf6e9bd, 0xe99b9c, 0xefca70, 0xbca4dc];

/** Adds the high branch canopy on top of the complete procedural greenhouse. */
export class CozyWorldV4 {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly base: CozyWorldV3;
  private canopy?: Phaser.GameObjects.Container;
  private leaves: Leaf[] = [];
  private clock = 0;
  private signature = '';

  constructor(scene: Phaser.Scene, root: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.root = root;
    this.base = new CozyWorldV3(scene, root);
  }

  sync(state: GameState, meta: P4MetaState, force = false): void {
    this.base.sync(state, meta, force);
    const progress = Phaser.Math.Clamp(0.045 + (state.unlocked.length / 32) * 0.76 + (meta.treeVigor / 100) * 0.20, 0.045, 1);
    const sig = [this.scene.scale.width, this.scene.scale.height, state.unlocked.join(','), Math.floor(meta.treeVigor / 3), meta.generation].join('|');
    if (!force && sig === this.signature) return;
    this.signature = sig;
    this.rebuildUpperCanopy(progress, state);
  }

  update(dt: number): void {
    this.base.update(dt);
    this.clock += dt;
    if (this.canopy) this.canopy.rotation = Math.sin(this.clock * 0.58) * 0.0022;
    for (const leaf of this.leaves) {
      leaf.node.x = leaf.x + Math.sin(this.clock * 0.71 + leaf.phase) * 1.25;
      leaf.node.y = leaf.y + Math.cos(this.clock * 0.63 + leaf.phase) * 0.9;
    }
  }

  reactTap(x: number, y: number): void {
    this.base.reactTap(x, y);
    if (this.canopy) this.scene.tweens.add({ targets: this.canopy, scale: 1.006, duration: 70, yoyo: true, ease: 'Quad.out' });
  }

  reactEvent(kind: WorldReaction): void { this.base.reactEvent(kind); }
  treeHitTest(x: number, y: number): boolean { return this.base.treeHitTest(x, y); }
  eventAnchor(kind: WorldReaction): Phaser.Math.Vector2 { return this.base.eventAnchor(kind); }

  private rebuildUpperCanopy(progress: number, state: GameState): void {
    this.canopy?.destroy(true);
    this.leaves = [];
    if (progress < 0.24) return;

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const baseX = w * 0.50;
    const baseY = h * 0.77;
    this.canopy = this.scene.add.container(baseX, baseY).setDepth(36);
    this.root.add(this.canopy);

    const trunkH = h * (0.07 + progress * 0.35);
    const upperY = -trunkH * (1.50 + progress * 0.12);
    const spread = w * (0.055 + progress * 0.105);
    const rx = w * (0.025 + progress * 0.036);
    const ry = h * (0.022 + progress * 0.032);
    const clusters = [
      { x: 0, y: upperY },
      { x: -spread * 0.45, y: upperY + h * 0.038 },
      { x: spread * 0.45, y: upperY + h * 0.038 },
      { x: -spread * 0.88, y: upperY + h * 0.092 },
      { x: spread * 0.88, y: upperY + h * 0.092 },
    ];
    if (progress > 0.62) {
      clusters.push(
        { x: -spread * 0.22, y: upperY - h * 0.052 },
        { x: spread * 0.22, y: upperY - h * 0.052 },
      );
    }

    const leafCount = Math.floor((progress - 0.20) * 155);
    const per = Math.max(5, Math.floor(leafCount / clusters.length));
    for (let c = 0; c < clusters.length; c += 1) {
      for (let i = 0; i < per + (c % 2); i += 1) {
        const n = c * 149 + i * 23 + Math.floor(progress * 1000);
        const a = i * 2.399963 + this.noise(n) * 0.5;
        const radial = Math.sqrt((i + 1) / Math.max(1, per));
        const x = clusters[c].x + Math.cos(a) * rx * radial;
        const y = clusters[c].y + Math.sin(a) * ry * radial;
        const size = Math.max(4.5, Math.min(w, h) * (0.0052 + (n % 4) * 0.00075));
        const node = this.scene.add.ellipse(x, y, size * 1.72, size, GREENS[n % GREENS.length], 0.92).setRotation(a + 0.35);
        this.canopy.add(node);
        this.leaves.push({ node, x, y, phase: n * 0.10 });
      }
    }

    if (isUnlocked(state, 'flowers') || progress > 0.62) {
      const count = isUnlocked(state, 'orchid') ? 26 : 14;
      for (let i = 0; i < count; i += 1) {
        const cluster = clusters[i % clusters.length];
        const a = i * 2.31;
        const x = cluster.x + Math.cos(a) * rx * (0.25 + (i % 4) * 0.16);
        const y = cluster.y + Math.sin(a) * ry * (0.30 + (i % 3) * 0.16);
        const flower = this.scene.add.container(x, y);
        const color = BLOOMS[i % BLOOMS.length];
        for (let p = 0; p < 5; p += 1) {
          const pa = (Math.PI * 2 * p) / 5;
          flower.add(this.scene.add.ellipse(Math.cos(pa) * 3, Math.sin(pa) * 3, 5.2, 3, color, 0.95).setRotation(pa));
        }
        flower.add(this.scene.add.circle(0, 0, 1.5, 0xe4bd74, 1));
        this.canopy.add(flower);
      }
    }
  }

  private noise(n: number): number {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
}

export type { WorldReaction };
