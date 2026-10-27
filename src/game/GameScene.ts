import Phaser from 'phaser';
import { DISCOVERY_NODES, NODE_BY_ID, type Branch, type NodeId } from './content';
import {
  applyOfflineProgress,
  buyNode,
  canManualTap,
  collectActiveEvent,
  getIncomePerSecond,
  getManualTapValue,
  grantGrowth,
  isRevealed,
  isUnlocked,
  loadState,
  resetState,
  saveState,
  simulate,
  type GameState,
} from './model';
import { BrowserPlatformAdapter } from '../platform/PlatformAdapter';
import {
  loadLocale,
  nodeDescriptionKey,
  nodeNameKey,
  saveLocale,
  t,
  type Locale,
} from '../i18n';

const NODE_POSITIONS: Record<NodeId, [number, number]> = {
  sprout: [0.50, 0.50],
  pump: [0.38, 0.43],
  gutters: [0.30, 0.34],
  cistern: [0.20, 0.28],
  irrigation: [0.18, 0.42],
  filter: [0.12, 0.52],
  pond: [0.22, 0.58],
  bed: [0.62, 0.43],
  flowers: [0.70, 0.34],
  herbs: [0.80, 0.27],
  vines: [0.81, 0.41],
  orchid: [0.88, 0.50],
  canopy: [0.78, 0.58],
  glass: [0.40, 0.61],
  mirrors: [0.32, 0.69],
  vents: [0.23, 0.78],
  heater: [0.36, 0.81],
  climate: [0.45, 0.75],
  gears: [0.51, 0.65],
  timer: [0.50, 0.76],
  auto_valves: [0.50, 0.87],
  roof_drive: [0.61, 0.79],
  bees: [0.62, 0.60],
  butterflies: [0.71, 0.68],
  dragonflies: [0.80, 0.76],
  birds: [0.70, 0.85],
  pollination: [0.75, 0.50],
  humidity: [0.29, 0.60],
  ecosystem: [0.61, 0.69],
  central_bud: [0.50, 0.36],
  open_roof: [0.50, 0.24],
  final_bloom: [0.50, 0.13],
};

const BRANCH_COLORS: Record<Branch, number> = {
  water: 0x70c8ef,
  plants: 0x8fdb63,
  climate: 0xf0bd57,
  mechanisms: 0xd39752,
  life: 0xd978e8,
  synergy: 0xf3d26b,
  final: 0xf6d7a2,
};

const EVENT_ANCHORS: [number, number][] = [
  [0.17, 0.69], // pump
  [0.16, 0.38], // rain collector
  [0.79, 0.31], // vines
  [0.84, 0.67], // flower bed
  [0.50, 0.49], // central tree
];

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private readonly platform = new BrowserPlatformAdapter();
  private locale: Locale = 'en';
  private worldLayer!: Phaser.GameObjects.Container;
  private treeLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private treeOpen = false;
  private selectedNode: NodeId = 'sprout';
  private uiAccumulator = 0;
  private lastSaveAt = 0;
  private activeEventCountdown = 8;
  private activeEvent?: Phaser.GameObjects.Container;
  private activeEventTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.image('main-greenhouse', '/art/main-greenhouse.jpg');
    this.load.image('node-medallion', '/art/node-medallion.jpg');
    this.load.image('heart-medallion', '/art/heart-medallion.jpg');
    this.load.image('hud-panel', '/art/hud-panel.jpg');
  }

  create(): void {
    this.state = loadState();
    this.locale = loadLocale();
    const offline = applyOfflineProgress(this.state);

    this.worldLayer = this.add.container(0, 0);
    this.treeLayer = this.add.container(0, 0).setVisible(false);
    this.hudLayer = this.add.container(0, 0).setDepth(1000);

    this.bindInput();
    this.renderAll();
    if (offline > 0.5) this.showToast(t(this.locale, 'offline', { value: this.formatNumber(offline) }));
  }

  update(_time: number, delta: number): void {
    const seconds = Math.min(delta / 1000, 0.25);
    simulate(this.state, seconds);
    this.uiAccumulator += seconds;
    this.lastSaveAt += seconds;

    if (!this.treeOpen && !this.state.completed && isUnlocked(this.state, 'pump')) {
      this.activeEventCountdown -= seconds;
      if (this.activeEventCountdown <= 0 && !this.activeEvent) this.spawnActiveEvent();
    }

    if (this.uiAccumulator >= 0.20) {
      this.uiAccumulator = 0;
      this.renderHud();
    }
    if (this.lastSaveAt >= 3) {
      this.lastSaveAt = 0;
      saveState(this.state);
    }
  }

  private bindInput(): void {
    this.scale.on('resize', () => this.renderAll());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.treeOpen || this.state.completed || !canManualTap(this.state)) return;
      if (!this.isTreeTap(pointer.x, pointer.y)) return;

      const amount = getManualTapValue(this.state);
      grantGrowth(this.state, amount);
      this.platform.analytics('manual_tree_tap', { amount });
      this.pulseCentralTree(pointer.x, pointer.y, amount);
      this.renderHud();
    });
  }

  private isTreeTap(x: number, y: number): boolean {
    const w = this.scale.width;
    const h = this.scale.height;
    const dx = (x - w * 0.50) / Math.max(1, w * 0.18);
    const dy = (y - h * 0.50) / Math.max(1, h * 0.30);
    return dx * dx + dy * dy <= 1;
  }

  private renderAll(): void {
    this.clearActiveEvent();
    this.worldLayer.removeAll(true);
    this.treeLayer.removeAll(true);
    this.renderWorld();
    this.renderTree();
    this.worldLayer.setVisible(!this.treeOpen);
    this.treeLayer.setVisible(this.treeOpen);
    this.renderHud();
  }

  private renderWorld(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const image = this.add.image(w / 2, h / 2, 'main-greenhouse');
    this.coverImage(image, w, h);
    this.worldLayer.add(image);

    // The art is the scene. Code adds only interaction feedback and a subtle focus cue.
    const focus = this.add.image(w * 0.50, h * 0.51, 'heart-medallion')
      .setDisplaySize(Math.min(w, h) * 0.15, Math.min(w, h) * 0.15)
      .setAlpha(0.17)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.worldLayer.add(focus);
    this.tweens.add({ targets: focus, alpha: 0.27, scale: 1.08, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private renderTree(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const minSide = Math.min(w, h);

    const bg = this.add.image(w / 2, h / 2, 'main-greenhouse');
    this.coverImage(bg, w, h);
    bg.setTint(0x424a3b).setAlpha(0.42);
    this.treeLayer.add(bg);

    const shade = this.add.rectangle(w / 2, h / 2, w, h, 0x07100b, 0.58);
    this.treeLayer.add(shade);

    const title = this.add.text(w / 2, 26, t(this.locale, 'tree_title'), {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(28, Math.min(46, w / 28))}px`, color: '#f7df9a',
      stroke: '#321f0e', strokeThickness: 5,
    }).setOrigin(0.5, 0);
    this.treeLayer.add(title);

    const positions = new Map<NodeId, Phaser.Math.Vector2>();
    for (const node of DISCOVERY_NODES) {
      const [nx, ny] = NODE_POSITIONS[node.id];
      positions.set(node.id, new Phaser.Math.Vector2(nx * w, ny * h));
    }

    const links = this.add.graphics();
    for (const node of DISCOVERY_NODES) {
      const childVisible = isRevealed(this.state, node.id) || isUnlocked(this.state, node.id);
      if (!childVisible) continue;
      const child = positions.get(node.id)!;
      for (const req of node.requires) {
        const parent = positions.get(req)!;
        links.lineStyle(isUnlocked(this.state, node.id) ? 3 : 2, BRANCH_COLORS[node.branch], isUnlocked(this.state, node.id) ? 0.70 : 0.28);
        links.beginPath();
        links.moveTo(parent.x, parent.y);
        const mx = (parent.x + child.x) / 2;
        const my = (parent.y + child.y) / 2;
        links.lineTo(mx, my);
        links.lineTo(child.x, child.y);
        links.strokePath();
      }
    }
    this.treeLayer.add(links);

    for (const node of DISCOVERY_NODES) {
      const p = positions.get(node.id)!;
      const unlocked = isUnlocked(this.state, node.id);
      const revealed = isRevealed(this.state, node.id);
      const available = node.requires.every((req) => isUnlocked(this.state, req));
      const affordable = this.state.growth >= node.cost;
      const selected = this.selectedNode === node.id;
      const size = node.id === 'sprout' ? Math.max(72, minSide * 0.13) : Math.max(42, minSide * 0.072);

      const medallion = this.add.image(p.x, p.y, node.id === 'sprout' ? 'heart-medallion' : 'node-medallion')
        .setDisplaySize(size, size)
        .setTint(unlocked ? BRANCH_COLORS[node.branch] : available ? 0xd6b865 : 0x777b70)
        .setAlpha(unlocked ? 1 : revealed ? 0.92 : 0.50)
        .setInteractive({ useHandCursor: true });
      if (selected) medallion.setScale(1.12);
      this.treeLayer.add(medallion);

      const glyph = this.add.text(p.x, p.y, unlocked ? '✓' : '?', {
        fontFamily: 'Georgia, serif',
        fontSize: `${Math.max(15, size * 0.28)}px`,
        color: unlocked ? '#f8efcc' : '#ead9ad',
        stroke: '#24170b', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(node.id === 'sprout' && !unlocked ? 0.72 : 1);
      this.treeLayer.add(glyph);

      medallion.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.selectedNode = node.id;
        this.renderTreeOnly();
      });

      if (affordable && available && !unlocked) {
        this.tweens.add({ targets: medallion, alpha: 0.62, duration: 700, yoyo: true, repeat: -1 });
      }
    }

    this.renderSelectedNodePanel();
  }

  private renderTreeOnly(): void {
    this.treeLayer.removeAll(true);
    this.renderTree();
    this.treeLayer.setVisible(true);
    this.renderHud();
  }

  private renderSelectedNodePanel(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const node = NODE_BY_ID[this.selectedNode];
    const unlocked = isUnlocked(this.state, node.id);
    const revealed = isRevealed(this.state, node.id);
    const available = node.requires.every((req) => isUnlocked(this.state, req));
    const affordable = this.state.growth >= node.cost;

    const panelW = Math.min(440, w * 0.38);
    const panelH = Math.min(150, h * 0.21);
    const panelX = w - panelW / 2 - 18;
    const panelY = h - panelH / 2 - 18;

    const panel = this.add.image(panelX, panelY, 'hud-panel').setDisplaySize(panelW, panelH).setAlpha(0.96);
    this.treeLayer.add(panel);

    const title = this.add.text(panelX - panelW * 0.43, panelY - panelH * 0.34,
      unlocked ? t(this.locale, nodeNameKey(node.id)) : revealed ? this.unknownLabel() : '???', {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(15, panelH * 0.14)}px`, color: '#f5df9d', fontStyle: 'bold',
        stroke: '#25180d', strokeThickness: 3,
      }).setOrigin(0, 0);
    this.treeLayer.add(title);

    const desc = unlocked
      ? t(this.locale, nodeDescriptionKey(node.id))
      : revealed
        ? `${this.costLabel()}: ${this.formatNumber(node.cost)}`
        : this.mysteryLabel();
    const description = this.add.text(panelX - panelW * 0.43, panelY - panelH * 0.06, desc, {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(11, panelH * 0.09)}px`, color: '#efe9d8',
      wordWrap: { width: panelW * 0.58 }, lineSpacing: 4,
    }).setOrigin(0, 0);
    this.treeLayer.add(description);

    if (!unlocked && revealed) {
      const buttonX = panelX + panelW * 0.31;
      const buttonY = panelY + panelH * 0.14;
      const button = this.add.image(buttonX, buttonY, 'node-medallion').setDisplaySize(panelH * 0.58, panelH * 0.58)
        .setTint(available && affordable ? 0x9bc76a : 0x756d5b)
        .setInteractive({ useHandCursor: available && affordable });
      const buttonText = this.add.text(buttonX, buttonY, this.unlockLabel(), {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(10, panelH * 0.085)}px`, color: '#fff2c4', align: 'center',
        stroke: '#26180b', strokeThickness: 3, wordWrap: { width: panelH * 0.48 },
      }).setOrigin(0.5);
      this.treeLayer.add([button, buttonText]);

      button.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (!available) return;
        if (!affordable) {
          this.showToast(t(this.locale, 'need_more', { value: this.formatNumber(node.cost - this.state.growth) }));
          return;
        }
        if (buyNode(this.state, node.id)) {
          saveState(this.state);
          this.platform.analytics('discovery_unlocked', { node: node.id });
          if (node.final) void this.platform.achievement('final_bloom');
          this.renderAll();
          this.treeOpen = true;
          this.worldLayer.setVisible(false);
          this.treeLayer.setVisible(true);
          this.showToast(node.final ? t(this.locale, 'ending_toast') : t(this.locale, nodeNameKey(node.id)));
        }
      });
    }
  }

  private renderHud(): void {
    this.hudLayer.removeAll(true);
    const w = this.scale.width;
    const h = this.scale.height;

    if (!this.treeOpen) {
      const panelW = Math.min(360, w * 0.33);
      const panelH = Math.min(130, h * 0.19);
      const panel = this.add.image(panelW / 2 + 14, panelH / 2 + 12, 'hud-panel').setDisplaySize(panelW, panelH).setAlpha(0.97);
      const mask = this.add.graphics();
      mask.fillStyle(0x0a1510, 0.90);
      mask.fillRoundedRect(34, 26, panelW - 55, panelH - 45, 16);
      const income = getIncomePerSecond(this.state);
      const tap = getManualTapValue(this.state);
      const text = this.add.text(48, 32,
        `${t(this.locale, 'growth')}  ${this.formatNumber(this.state.growth)}\n+${this.formatNumber(income)}${t(this.locale, 'per_second')}   •   ${t(this.locale, 'tap')} +${this.formatNumber(tap)}`, {
          fontFamily: 'Georgia, serif', fontSize: `${Math.max(15, panelH * 0.16)}px`, color: '#f8e9b9', lineSpacing: 8,
          stroke: '#1d1309', strokeThickness: 2,
        });
      this.hudLayer.add([panel, mask, text]);

      const discoverHit = this.add.rectangle(w * 0.875, h * 0.075, Math.max(160, w * 0.17), Math.max(55, h * 0.10), 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      discoverHit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.treeOpen = true;
        this.clearActiveEvent();
        this.worldLayer.setVisible(false);
        this.treeLayer.setVisible(true);
        this.renderHud();
      });
      this.hudLayer.add(discoverHit);
    } else {
      const back = this.add.image(w - 110, 48, 'hud-panel').setDisplaySize(190, 64).setAlpha(0.95).setInteractive({ useHandCursor: true });
      const backText = this.add.text(w - 110, 48, t(this.locale, 'back'), {
        fontFamily: 'Georgia, serif', fontSize: '15px', color: '#f5dfa2', stroke: '#24170b', strokeThickness: 3,
      }).setOrigin(0.5);
      back.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.treeOpen = false;
        this.treeLayer.setVisible(false);
        this.worldLayer.setVisible(true);
        this.renderHud();
      });
      this.hudLayer.add([back, backText]);
    }

    const language = this.add.text(w - 20, h - 18, t(this.locale, 'language'), {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#f0d899', backgroundColor: '#132219cc', padding: { x: 12, y: 7 },
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    language.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.locale = this.locale === 'ru' ? 'en' : 'ru';
      saveLocale(this.locale);
      this.renderAll();
    });

    const reset = this.add.text(20, h - 18, t(this.locale, 'reset'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#d8cda9', backgroundColor: '#132219aa', padding: { x: 10, y: 6 },
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    reset.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.state = resetState();
      this.selectedNode = 'sprout';
      this.treeOpen = false;
      this.activeEventCountdown = 8;
      this.renderAll();
    });

    this.hudLayer.add([language, reset]);
  }

  private pulseCentralTree(x: number, y: number, amount: number): void {
    const pulse = this.add.image(this.scale.width * 0.50, this.scale.height * 0.50, 'heart-medallion')
      .setDisplaySize(Math.min(this.scale.width, this.scale.height) * 0.18, Math.min(this.scale.width, this.scale.height) * 0.18)
      .setAlpha(0.26).setBlendMode(Phaser.BlendModes.ADD).setDepth(950);
    const reward = this.add.text(x, y - 20, `+${this.formatNumber(amount)}`, {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#efffbc', fontStyle: 'bold', stroke: '#284318', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1100);
    this.tweens.add({ targets: pulse, scale: 1.28, alpha: 0, duration: 330, onComplete: () => pulse.destroy() });
    this.tweens.add({ targets: reward, y: y - 64, alpha: 0, duration: 650, onComplete: () => reward.destroy() });
  }

  private spawnActiveEvent(): void {
    if (this.treeOpen || this.state.completed) return;
    const [nx, ny] = Phaser.Utils.Array.GetRandom(EVENT_ANCHORS);
    const x = nx * this.scale.width;
    const y = ny * this.scale.height;
    const size = Math.max(54, Math.min(this.scale.width, this.scale.height) * 0.085);
    const container = this.add.container(x, y).setDepth(900);
    const medallion = this.add.image(0, 0, 'node-medallion').setDisplaySize(size, size).setTint(0xffd56b).setInteractive({ useHandCursor: true });
    const mark = this.add.text(0, 0, '!', { fontFamily: 'Georgia, serif', fontSize: `${size * 0.38}px`, color: '#fff2b1', stroke: '#4b2605', strokeThickness: 4 }).setOrigin(0.5);
    container.add([medallion, mark]);
    const collect = (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (!this.activeEvent) return;
      const reward = collectActiveEvent(this.state);
      this.platform.analytics('active_event_collected', { reward });
      this.pulseCentralTree(x, y, reward);
      this.clearActiveEvent();
      this.activeEventCountdown = Phaser.Math.Between(9, 15);
      this.renderHud();
    };
    medallion.on('pointerdown', collect);
    this.tweens.add({ targets: medallion, scale: 1.12, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.activeEvent = container;
    this.activeEventTimer = this.time.delayedCall(6500, () => {
      this.clearActiveEvent();
      this.activeEventCountdown = Phaser.Math.Between(7, 13);
    });
  }

  private clearActiveEvent(): void {
    this.activeEventTimer?.remove(false);
    this.activeEventTimer = undefined;
    if (this.activeEvent) {
      this.activeEvent.destroy(true);
      this.activeEvent = undefined;
    }
  }

  private showToast(message: string): void {
    const toast = this.add.text(this.scale.width / 2, 86, message, {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#fff0b4', backgroundColor: '#152119e8', padding: { x: 18, y: 10 },
      stroke: '#24160b', strokeThickness: 2, wordWrap: { width: Math.max(300, this.scale.width * 0.68) }, align: 'center',
    }).setOrigin(0.5).setDepth(2000).setAlpha(0);
    this.tweens.add({ targets: toast, alpha: 1, duration: 150, hold: 1300, yoyo: true, onComplete: () => toast.destroy() });
  }

  private coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void {
    const texture = image.texture.getSourceImage() as HTMLImageElement;
    const scale = Math.max(width / texture.width, height / texture.height);
    image.setDisplaySize(texture.width * scale, texture.height * scale);
  }

  private unknownLabel(): string {
    return this.locale === 'ru' ? 'Неизвестное открытие' : 'Unknown discovery';
  }

  private mysteryLabel(): string {
    return this.locale === 'ru' ? 'Связь ещё не раскрыта.' : 'This connection has not been revealed yet.';
  }

  private costLabel(): string {
    return this.locale === 'ru' ? 'Стоимость' : 'Cost';
  }

  private unlockLabel(): string {
    return this.locale === 'ru' ? 'Открыть' : 'Unlock';
  }

  private formatNumber(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    if (abs >= 10) return Math.floor(value).toString();
    return value.toFixed(abs < 1 ? 2 : 1);
  }
}
