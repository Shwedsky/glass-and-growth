import Phaser from 'phaser';
import { CozyWorldV4, type WorldReaction } from './CozyWorldV4';
import type { GameState } from '../model';
import type { P4MetaState } from '../p4Meta';

/**
 * Stable public facade for the procedural greenhouse.
 * It owns rebuild hygiene so repeated tap-vigor/world-state renders cannot leave
 * infinite tweens attached to destroyed Phaser objects.
 */
export class CozyWorld {
  private readonly base: CozyWorldV4;
  private rebuildSignature = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly root: Phaser.GameObjects.Container,
  ) {
    this.base = new CozyWorldV4(scene, root);
  }

  sync(state: GameState, meta: P4MetaState, force = false): void {
    const signature = [
      this.scene.scale.width,
      this.scene.scale.height,
      meta.generation,
      Math.floor(meta.treeVigor / 3),
      ...state.unlocked,
    ].join('|');

    if (force || signature !== this.rebuildSignature) {
      this.killRootTweens();
      this.rebuildSignature = signature;
    }
    this.base.sync(state, meta, force);
  }

  update(dt: number): void {
    this.base.update(dt);
  }

  reactTap(x: number, y: number): void {
    this.base.reactTap(x, y);
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

  destroy(): void {
    this.killRootTweens();
  }

  private killRootTweens(): void {
    const stack: Phaser.GameObjects.GameObject[] = [...this.root.list];
    while (stack.length > 0) {
      const object = stack.pop()!;
      this.scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) stack.push(...object.list);
    }
    this.scene.tweens.killTweensOf(this.root);
  }
}

export type { WorldReaction };
