import Phaser from 'phaser';

/**
 * Pure presentation overlay. It deliberately owns no gameplay state and no input.
 * This lets the visual language evolve without coupling it to the incremental model.
 */
export class PresentationScene extends Phaser.Scene {
  private frameLayer!: Phaser.GameObjects.Container;
  private motes: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super({ key: 'PresentationScene', active: true });
  }

  create(): void {
    this.frameLayer = this.add.container(0, 0).setDepth(10_000);
    this.input.enabled = false;
    this.scale.on('resize', () => this.redraw());
    this.redraw();
    this.createMotes();
  }

  private redraw(): void {
    this.frameLayer.removeAll(true);

    const w = this.scale.width;
    const h = this.scale.height;
    if (w <= 0 || h <= 0) return;

    // Botanical-machine outer frame: dark iron body, warm brass inner rail and glass edge.
    const shade = this.add.graphics();
    shade.fillStyle(0x050907, 0.34);
    shade.fillRect(0, 0, w, 12);
    shade.fillRect(0, h - 12, w, 12);
    shade.fillRect(0, 0, 12, h);
    shade.fillRect(w - 12, 0, 12, h);

    shade.lineStyle(3, 0x8d7043, 0.72);
    shade.strokeRoundedRect(9, 9, Math.max(0, w - 18), Math.max(0, h - 18), 18);
    shade.lineStyle(1, 0xd3bd7e, 0.34);
    shade.strokeRoundedRect(15, 15, Math.max(0, w - 30), Math.max(0, h - 30), 15);
    shade.lineStyle(1, 0x9cb8aa, 0.16);
    shade.strokeRoundedRect(20, 20, Math.max(0, w - 40), Math.max(0, h - 40), 13);
    this.frameLayer.add(shade);

    // Corner joints make the frame read as an object rather than a generic screen border.
    const corners: Array<[number, number]> = [
      [24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24],
    ];
    for (const [x, y] of corners) {
      const plate = this.add.circle(x, y, 8, 0x6f5736, 0.96).setStrokeStyle(2, 0xb99558, 0.82);
      const screw = this.add.circle(x, y, 2.3, 0x2b241b, 0.95);
      this.frameLayer.add([plate, screw]);
    }

    // Soft top glass reflection; deliberately subtle so gameplay remains readable.
    const reflection = this.add.graphics();
    reflection.fillStyle(0xddeee5, 0.025);
    reflection.fillTriangle(w * 0.12, 22, w * 0.58, 22, w * 0.36, h * 0.62);
    reflection.fillStyle(0xf4e7bd, 0.018);
    reflection.fillTriangle(w * 0.54, 22, w * 0.88, 22, w * 0.70, h * 0.46);
    this.frameLayer.add(reflection);

    // A narrow lower sill visually anchors the greenhouse scene and the footer controls.
    const sill = this.add.rectangle(w / 2, h - 26, Math.max(0, w - 54), 10, 0x4b3828, 0.78)
      .setStrokeStyle(1, 0x967248, 0.65);
    this.frameLayer.add(sill);
  }

  private createMotes(): void {
    for (const mote of this.motes) mote.destroy();
    this.motes = [];

    const count = Math.max(8, Math.min(18, Math.floor(this.scale.width / 90)));
    for (let i = 0; i < count; i++) {
      const mote = this.add.circle(
        Phaser.Math.Between(35, Math.max(36, this.scale.width - 35)),
        Phaser.Math.Between(80, Math.max(81, this.scale.height - 80)),
        Phaser.Math.FloatBetween(0.8, 2.0),
        i % 4 === 0 ? 0xe7d995 : 0xc8d9cf,
        Phaser.Math.FloatBetween(0.05, 0.16),
      ).setDepth(9_999);
      this.motes.push(mote);
      this.floatMote(mote, i);
    }
  }

  private floatMote(mote: Phaser.GameObjects.Arc, index: number): void {
    const startX = mote.x;
    const startY = mote.y;
    this.tweens.add({
      targets: mote,
      x: startX + Phaser.Math.Between(-28, 38),
      y: startY - Phaser.Math.Between(45, 110),
      alpha: Phaser.Math.FloatBetween(0.02, 0.13),
      duration: Phaser.Math.Between(5_000, 9_000) + index * 70,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }
}
