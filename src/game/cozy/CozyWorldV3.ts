import Phaser from 'phaser';
import { CozyWorldV2, type WorldReaction } from './CozyWorldV2';
import { isUnlocked, type GameState } from '../model';
import type { P4MetaState } from '../p4Meta';

type CanopyLeaf = {
  node: Phaser.GameObjects.Ellipse;
  baseX: number;
  baseY: number;
  phase: number;
};

const LEAF_COLORS = [0x315f43, 0x477f50, 0x68a55b, 0x8cbc69];
const BLOOM_COLORS = [0xf7e8bd, 0xe89a9c, 0xefc96f, 0xbba1d8];

/**
 * Final P6 world wrapper.
 * V2 owns the complete living greenhouse; V3 adds a branch-following canopy pass
 * so foliage grows upward with the structural tree rather than pooling around the trunk.
 */
export class CozyWorldV3 {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly base: CozyWorldV2;
  private canopy?: Phaser.GameObjects.Container;
  private leaves: CanopyLeaf[] = [];
  private clock = 0;
  private signature = '';

  constructor(scene: Phaser.Scene, root: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.root = root;
    this.base = new CozyWorldV2(scene, root);
  }

  sync(state: GameState, meta: P4MetaState, force = false): void {
    this.base.sync(state, meta, force);
    const progress = Phaser.Math.Clamp(0.045 + (state.unlocked.length / 32) * 0.76 + (meta.treeVigor / 100) * 0.20, 0.045, 1);
    const signature = [this.scene.scale.width, this.scene.scale.height, state.unlocked.join(','), Math.floor(meta.treeVigor / 3), meta.generation].join('|');
    if (!force && signature === this.signature) return;
    this.signature = signature;
    this.buildCanopy(progress, state);
  }

  update(dt: number): void {
    this.base.update(dt);
    this.clock += dt;
    if (this.canopy) {
      this.canopy.rotation = Math.sin(this.clock * 0.72) * 0.0028;
    }
    for (const leaf of this.leaves) {
      leaf.x = leaf.baseX + Math.sin(this.clock * 0.82 + leaf.phase) * 1.5;
      leaf.y = leaf.baseY + Math.cos(this.clock * 0.67 + leaf.phase) * 1.1;
      leaf.rotation += Math.sin(this.clock * 0.5 + leaf.phase) * 0.0008;
    }
  }

  reactTap(x: number, y: number): void {
    this.base.reactTap(x, y);
    if (this.canopy) {
      this.scene.tweens.killTweensOf(this.canopy);
      this.scene.tweens.add({ targets: this.canopy, scaleX: 1.008, scaleY: 0.992, duration: 80, yoyo: true, ease: 'Quad.out' });
    }
  }

  reactEvent(kind: WorldReaction): void {
    this.base.reactEvent(kind);
  }

  treeHitTest(x: number, y: number): boolean {
    return this.base.treeHitTest(x, y);
  }

  eventAnchor(kind: WorldReaction): Phaser.Math.Vector2 {
    return this.base.eventAnchor(kind);
  }

  private buildCanopy(progress: number, state: GameState): void {
    this.canopy?.destroy(true);
    this.leaves = [];
    if (progress < 0.12) return;

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const centerX = w * 0.50;
    const baseY = h * 0.77;
    const trunkH = h * (0.07 + progress * 0.35);

    this.canopy = this.scene.add.container(centerX, baseY).setDepth(35);
    this.root.add(this.canopy);

    const clusters = this.clusterLayout(progress, trunkH, w, h);
    const leafBudget = Math.floor(10 + progress * 135);
    const perCluster = Math.max(4, Math.floor(leafBudget / clusters.length));

    for (let c = 0; c < clusters.length; c += 1) {
      const cluster = clusters[c];
      const count = perCluster + (c % 3);
      for (let i = 0; i < count; i += 1) {
        const n = c * 131 + i * 17 + Math.floor(progress * 1000);
        const angle = i * 2.399963 + this.noise(n) * 0.55;
        const radial = Math.sqrt((i + 1) / count);
        const rx = cluster.rx * radial;
        const ry = cluster.ry * radial;
        const x = cluster.x + Math.cos(angle) * rx;
        const y = cluster.y + Math.sin(angle) * ry;
        const size = Math.max(4.5, Math.min(w, h) * (0.0054 + (n % 4) * 0.0008));
        const leaf = this.scene.add.ellipse(x, y, size * 1.75, size, LEAF_COLORS[(n + c) % LEAF_COLORS.length], 0.91)
          .setRotation(angle + 0.35);
        this.canopy.add(leaf);
        this.leaves.push({ node: leaf, baseX: x, baseY: y, phase: n * 0.11 });
      }
    }

    if (isUnlocked(state, 'flowers') || progress > 0.58) {
      const bloomCount = isUnlocked(state, 'orchid') ? 30 : isUnlocked(state, 'flowers') ? 18 : 8;
      for (let i = 0; i < bloomCount; i += 1) {
        const cluster = clusters[i % clusters.length];
        const a = i * 2.23;
        const x = cluster.x + Math.cos(a) * cluster.rx * (0.35 + (i % 4) * 0.12);
        const y = cluster.y + Math.sin(a) * cluster.ry * (0.30 + (i % 3) * 0.14);
        const blossom = this.scene.add.container(x, y);
        const color = BLOOM_COLORS[i % BLOOM_COLORS.length];
        for (let p = 0; p < 5; p += 1) {
          const pa = (Math.PI * 2 * p) / 5;
          blossom.add(this.scene.add.ellipse(Math.cos(pa) * 3.2, Math.sin(pa) * 3.2, 5.4, 3.1, color, 0.94).setRotation(pa));
        }
        blossom.add(this.scene.add.circle(0, 0, 1.6, 0xe4bd74, 1));
        this.canopy.add(blossom);
      }
    }
  }

  private clusterLayout(progress: number, trunkH: number, w: number, h: number): Array<{ x: number; y: number; rx: number; ry: number }> {
    const top = -trunkH * (1.02 + progress * 0.18);
    const spread = w * (0.035 + progress * 0.105);
    const rx = w * (0.025 + progress * 0.040);
    const ry = h * (0.025 + progress * 0.034);

    const clusters: Array<{ x: number; y: number; rx: number; ry: number }> = [
      { x: 0, y: top, rx, ry },
      { x: -spread * 0.58, y: top + h * 0.035, rx: rx * 1.05, ry },
      { x: spread * 0.58, y: top + h * 0.035, rx: rx * 1.05, ry },
    ];
    if (progress > 0.34) {
      clusters.push(
        { x: -spread, y: top + h * 0.085, rx: rx * 0.92, ry: ry * 0.92 },
        { x: spread, y: top + h * 0.085, rx: rx * 0.92, ry: ry * 0.92 },
      );
    }
    if (progress > 0.62) {
      clusters.push(
        { x: -spread * 0.30, y: top - h * 0.065, rx: rx * 0.90, ry: ry * 0.86 },
        { x: spread * 0.30, y: top - h * 0.065, rx: rx * 0.90, ry: ry * 0.86 },
      );
    }
    return clusters;
  }

  private noise(n: number): number {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
}

export type { WorldReaction };
