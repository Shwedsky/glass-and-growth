import Phaser from 'phaser';
import { DISCOVERY_NODES, type NodeId } from './content';
import {
  applyOfflineProgress,
  buyNode,
  getClickValue,
  getIncomePerSecond,
  isRevealed,
  isUnlocked,
  loadState,
  grantGrowth,
  resetState,
  saveState,
  simulate,
  type GameState,
} from './model';
import { BrowserPlatformAdapter } from '../platform/PlatformAdapter';

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private readonly platform = new BrowserPlatformAdapter();
  private hudText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private treeLayer!: Phaser.GameObjects.Container;
  private worldLayer!: Phaser.GameObjects.Container;
  private treeOpen = false;
  private accumulator = 0;
  private lastSaveAt = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.state = loadState();
    const offline = applyOfflineProgress(this.state);
    this.cameras.main.setBackgroundColor('#101814');

    this.worldLayer = this.add.container(0, 0);
    this.treeLayer = this.add.container(0, 0).setVisible(false);

    this.scale.on('resize', () => this.renderAll());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.treeOpen) return;
      if (pointer.y < 110) return;
      grantGrowth(this.state, getClickValue(this.state));
      this.spawnTapFeedback(pointer.x, pointer.y);
      this.platform.analytics('active_interaction');
      this.renderHud();
    });

    this.renderAll();
    if (offline > 0.5) {
      this.showToast(`While you were away: +${Math.floor(offline)} Growth`);
    }
  }

  update(_time: number, delta: number): void {
    const seconds = Math.min(delta / 1000, 0.25);
    simulate(this.state, seconds);
    this.accumulator += seconds;
    this.lastSaveAt += seconds;

    if (this.accumulator >= 0.15) {
      this.accumulator = 0;
      this.renderHud();
      if (!this.treeOpen) this.refreshWorldDynamic();
    }

    if (this.lastSaveAt >= 3) {
      this.lastSaveAt = 0;
      saveState(this.state);
    }
  }

  private renderAll(): void {
    this.worldLayer.removeAll(true);
    this.treeLayer.removeAll(true);
    this.renderWorld();
    this.renderTree();
    this.renderHud();
  }

  private renderWorld(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const worldTop = 96;
    const worldBottom = h - 78;
    const cx = w / 2;
    const innerW = Math.min(w * 0.88, 980);
    const left = cx - innerW / 2;

    const bg = this.add.rectangle(cx, (worldTop + worldBottom) / 2, innerW, worldBottom - worldTop, 0x1c2a22, 1)
      .setStrokeStyle(3, 0x8fa99b, 0.35);
    this.worldLayer.add(bg);

    const roofY = worldTop + 42;
    const roof = this.add.graphics();
    roof.lineStyle(4, 0x879b90, 0.65);
    roof.beginPath();
    roof.moveTo(left + 30, roofY + 55);
    roof.lineTo(cx - 110, roofY - 20);
    roof.lineTo(cx + 110, roofY - 20);
    roof.lineTo(left + innerW - 30, roofY + 55);
    roof.strokePath();
    for (let i = 1; i < 7; i++) {
      const x = left + (innerW / 7) * i;
      roof.lineBetween(x, roofY + 45, x, worldBottom - 18);
    }
    this.worldLayer.add(roof);

    const soil = this.add.rectangle(cx, worldBottom - 44, innerW - 36, 74, 0x3d3027, 1);
    this.worldLayer.add(soil);

    if (isUnlocked(this.state, 'sprout')) this.drawSprout(cx, worldBottom - 76);
    if (isUnlocked(this.state, 'pump')) this.drawPump(left + 105, worldBottom - 102);
    if (isUnlocked(this.state, 'planter')) this.drawPlanter(cx - 210, worldBottom - 94);
    if (isUnlocked(this.state, 'rain')) this.drawRainSystem(left + innerW - 116, roofY + 15, worldBottom - 112);
    if (isUnlocked(this.state, 'flowers')) this.drawFlowers(cx + 150, worldBottom - 88);
    if (isUnlocked(this.state, 'hive')) this.drawHive(cx + 285, worldBottom - 155);
    if (isUnlocked(this.state, 'pollination')) this.drawPollinationGlow(cx, worldBottom - 145);
    if (isUnlocked(this.state, 'roof')) this.drawEnding(cx, roofY - 10);

    if (this.state.unlocked.length === 0) {
      const intro = this.add.text(cx, h * 0.48, 'The greenhouse is quiet.\nTap anywhere inside to gather Growth.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.max(18, Math.min(30, w / 32))}px`,
        color: '#d8e1dc',
        align: 'center',
      }).setOrigin(0.5).setAlpha(0.8);
      this.worldLayer.add(intro);
    }
  }

  private refreshWorldDynamic(): void {
    if (this.state.completed && !this.hintText?.text.includes('restored')) {
      this.renderAll();
    }
  }

  private renderHud(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.hudText?.destroy();
    this.hintText?.destroy();

    const income = getIncomePerSecond(this.state);
    this.hudText = this.add.text(20, 18, `Growth  ${Math.floor(this.state.growth)}   •   +${income.toFixed(1)}/s   •   tap +${getClickValue(this.state)}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(16, Math.min(24, w / 48))}px`,
      color: '#eff8f2',
      fontStyle: '600',
    }).setDepth(1000);

    const label = this.treeOpen ? 'Back to greenhouse' : 'Discoveries';
    const treeButton = this.add.text(w - 20, 18, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(15, Math.min(22, w / 52))}px`,
      color: '#f1e7bd',
      backgroundColor: '#2c4738',
      padding: { x: 14, y: 9 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(1001);
    treeButton.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.treeOpen = !this.treeOpen;
      this.treeLayer.setVisible(this.treeOpen);
      this.worldLayer.setVisible(!this.treeOpen);
      this.renderAll();
    });

    const reset = this.add.text(20, h - 16, 'Reset slice', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#83958b',
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setDepth(1001);
    reset.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.state = resetState();
      this.treeOpen = false;
      this.renderAll();
    });

    const status = this.state.completed
      ? 'The greenhouse is restored. P0 mini-ending reached.'
      : this.treeOpen
        ? 'Unknown nodes reveal themselves only when their path becomes possible.'
        : 'Tap the greenhouse for active Growth. Restore systems to automate it.';
    this.hintText = this.add.text(w / 2, h - 16, status, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(13, Math.min(17, w / 65))}px`,
      color: this.state.completed ? '#f8e9a7' : '#aebdb5',
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(1000);
  }

  private renderTree(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const title = this.add.text(w / 2, 112, 'Discovery Tree', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(24, Math.min(38, w / 30))}px`,
      color: '#edf5ef',
      fontStyle: '700',
    }).setOrigin(0.5);
    this.treeLayer.add(title);

    const positions: Record<NodeId, [number, number]> = {
      sprout: [0.50, 0.25],
      pump: [0.34, 0.39],
      planter: [0.66, 0.39],
      rain: [0.24, 0.56],
      flowers: [0.69, 0.56],
      hive: [0.78, 0.71],
      pollination: [0.50, 0.76],
      roof: [0.50, 0.90],
    };

    const graphics = this.add.graphics();
    graphics.lineStyle(3, 0x6f8b79, 0.45);
    for (const node of DISCOVERY_NODES) {
      const [x2, y2] = positions[node.id];
      for (const req of node.requires) {
        const [x1, y1] = positions[req];
        graphics.lineBetween(w * x1, h * y1, w * x2, h * y2);
      }
    }
    this.treeLayer.add(graphics);

    for (const node of DISCOVERY_NODES) {
      const [xp, yp] = positions[node.id];
      const x = w * xp;
      const y = h * yp;
      const unlocked = isUnlocked(this.state, node.id);
      const revealed = isRevealed(this.state, node.id);
      const fullyAvailable = node.requires.every((req) => isUnlocked(this.state, req));
      const affordable = this.state.growth >= node.cost;
      const radius = Math.max(30, Math.min(48, w / 22));
      const fill = unlocked ? 0x496d4d : fullyAvailable ? 0x765f37 : 0x26342d;
      const alpha = revealed || unlocked ? 1 : 0.65;

      const circle = this.add.circle(x, y, radius, fill, alpha)
        .setStrokeStyle(3, affordable && fullyAvailable && !unlocked ? 0xd7c67c : 0x83958b, 0.8)
        .setInteractive({ useHandCursor: fullyAvailable && !unlocked });
      this.treeLayer.add(circle);

      const visibleName = unlocked ? node.name : revealed ? '?' : '·';
      const label = this.add.text(x, y - 5, visibleName, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: unlocked ? '14px' : '24px',
        color: '#f4f5ec',
        align: 'center',
        wordWrap: { width: radius * 1.7 },
      }).setOrigin(0.5);
      this.treeLayer.add(label);

      if (revealed && !unlocked) {
        const cost = this.add.text(x, y + radius + 9, `${node.cost}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: fullyAvailable ? '#e8dcae' : '#66756c',
        }).setOrigin(0.5, 0);
        this.treeLayer.add(cost);
      }

      if (unlocked) {
        const desc = this.add.text(x, y + radius + 7, node.description, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#9fb0a6',
          align: 'center',
          wordWrap: { width: Math.max(120, w * 0.2) },
        }).setOrigin(0.5, 0);
        this.treeLayer.add(desc);
      }

      circle.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (buyNode(this.state, node.id)) {
          saveState(this.state);
          this.platform.analytics('discovery_unlocked', { node: node.id });
          if (node.final) void this.platform.achievement('p0_restored');
          this.renderAll();
          this.showToast(node.final ? 'The roof opens. The greenhouse breathes.' : node.name);
        } else if (fullyAvailable && !affordable) {
          this.showToast(`Need ${Math.ceil(node.cost - this.state.growth)} more Growth`);
        }
      });
    }
  }

  private drawSprout(x: number, y: number): void {
    const stem = this.add.rectangle(x, y, 8, 56, 0x5f8752).setOrigin(0.5, 1);
    const leafA = this.add.ellipse(x - 16, y - 38, 30, 14, 0x719c5f, 1).setRotation(-0.35);
    const leafB = this.add.ellipse(x + 17, y - 25, 32, 14, 0x82aa68, 1).setRotation(0.35);
    this.worldLayer.add([stem, leafA, leafB]);
  }

  private drawPump(x: number, y: number): void {
    const body = this.add.rectangle(x, y, 66, 66, 0x856b4a).setStrokeStyle(3, 0xb59a6c);
    const pipe = this.add.rectangle(x + 48, y - 14, 64, 15, 0x687a70);
    const water = this.add.circle(x + 80, y - 3, 8, 0x7fb9c4, 0.8);
    this.worldLayer.add([body, pipe, water]);
  }

  private drawPlanter(x: number, y: number): void {
    const box = this.add.rectangle(x, y, 170, 45, 0x765a3c).setStrokeStyle(2, 0xa4855f);
    const greens = [-55, -20, 20, 55].map((dx, i) => this.add.ellipse(x + dx, y - 30 - (i % 2) * 7, 34, 48, 0x557c4e + i * 0x050300, 1));
    this.worldLayer.add([box, ...greens]);
  }

  private drawRainSystem(x: number, roofY: number, floorY: number): void {
    const tank = this.add.circle(x, floorY, 42, 0x546d6d).setStrokeStyle(3, 0x849b92);
    const pipe = this.add.rectangle(x, (roofY + floorY) / 2, 12, floorY - roofY, 0x70857b);
    const drop = this.add.circle(x + 22, roofY + 35, 7, 0x8dc8d3, 0.85);
    this.tweens.add({ targets: drop, y: roofY + 70, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    this.worldLayer.add([pipe, tank, drop]);
  }

  private drawFlowers(x: number, y: number): void {
    const colors = [0xd8a5a5, 0xe2c978, 0xc3a8df, 0xe6b48b, 0xbccf8f];
    const flowers: Phaser.GameObjects.GameObject[] = [];
    colors.forEach((color, i) => {
      const fx = x + (i - 2) * 34;
      flowers.push(this.add.rectangle(fx, y - 18, 4, 38, 0x5e8153));
      flowers.push(this.add.circle(fx, y - 42 - (i % 2) * 7, 12, color));
    });
    this.worldLayer.add(flowers);
  }

  private drawHive(x: number, y: number): void {
    const hive = this.add.ellipse(x, y, 74, 96, 0xb18a43).setStrokeStyle(3, 0xd1b568);
    const entrance = this.add.circle(x, y + 17, 10, 0x463522);
    const bee = this.add.circle(x - 55, y - 5, 6, 0xe2bd4e);
    this.tweens.add({ targets: bee, x: x + 55, y: y - 28, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.worldLayer.add([hive, entrance, bee]);
  }

  private drawPollinationGlow(x: number, y: number): void {
    const glow = this.add.circle(x, y, 110, 0xd7cb75, 0.07);
    this.tweens.add({ targets: glow, alpha: 0.16, scale: 1.15, duration: 1500, yoyo: true, repeat: -1 });
    this.worldLayer.add(glow);
  }

  private drawEnding(x: number, y: number): void {
    const light = this.add.triangle(x, y + 180, x - 110, -40, x + 110, -40, x, 240, 0xf2e5a2, 0.18);
    const bloom = this.add.circle(x, y + 205, 54, 0xe8cfa0, 0.95).setStrokeStyle(8, 0xc28faa, 0.9);
    this.tweens.add({ targets: bloom, scale: 1.12, duration: 1700, yoyo: true, repeat: -1 });
    this.worldLayer.add([light, bloom]);
  }

  private spawnTapFeedback(x: number, y: number): void {
    const text = this.add.text(x, y, `+${getClickValue(this.state)}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#dcedc8',
      fontStyle: '700',
    }).setOrigin(0.5).setDepth(1200);
    this.tweens.add({ targets: text, y: y - 40, alpha: 0, duration: 650, onComplete: () => text.destroy() });
  }

  private showToast(message: string): void {
    const w = this.scale.width;
    const toast = this.add.text(w / 2, 74, message, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#17241d',
      backgroundColor: '#e5dbb0',
      padding: { x: 15, y: 9 },
    }).setOrigin(0.5).setDepth(2000).setAlpha(0);
    this.tweens.add({ targets: toast, alpha: 1, duration: 180, hold: 1200, yoyo: true, onComplete: () => toast.destroy() });
  }
}
