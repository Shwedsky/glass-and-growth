import Phaser from 'phaser';
import { DISCOVERY_NODES, NODE_BY_ID, type Branch, type DiscoveryNode, type NodeId } from './content';
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
import { loadLocale, nodeDescriptionKey, nodeNameKey, saveLocale, t, type Locale } from '../i18n';
import { uiText, type UiTextKey } from '../uiText';

const NODE_POSITIONS: Record<NodeId, [number, number]> = {
  sprout: [0.50, 0.50],
  pump: [0.39, 0.43], gutters: [0.30, 0.35], cistern: [0.19, 0.28], irrigation: [0.27, 0.45], filter: [0.13, 0.51], pond: [0.21, 0.61],
  bed: [0.61, 0.43], flowers: [0.70, 0.35], herbs: [0.81, 0.28], vines: [0.78, 0.43], orchid: [0.88, 0.50], canopy: [0.79, 0.60],
  glass: [0.40, 0.59], mirrors: [0.31, 0.68], vents: [0.21, 0.76], heater: [0.35, 0.82], climate: [0.44, 0.76],
  gears: [0.50, 0.61], timer: [0.50, 0.71], auto_valves: [0.50, 0.84], roof_drive: [0.60, 0.79],
  bees: [0.61, 0.60], butterflies: [0.71, 0.68], dragonflies: [0.81, 0.76], birds: [0.70, 0.84],
  pollination: [0.73, 0.51], humidity: [0.29, 0.59], ecosystem: [0.61, 0.69],
  central_bud: [0.50, 0.36], open_roof: [0.50, 0.24], final_bloom: [0.50, 0.13],
};

const BRANCH_COLORS: Record<Branch, number> = {
  water: 0x65c8f2,
  plants: 0x7ed957,
  climate: 0xd9a947,
  mechanisms: 0xd48842,
  life: 0xd9ae48,
  synergy: 0xf1d36b,
  final: 0xffe0a7,
};

const NODE_ICONS: Record<NodeId, string> = {
  sprout: '🌱', pump: '💧', bed: '🌿', gutters: '🌧', flowers: '🌸', glass: '☀', cistern: '💧', herbs: '🌿', gears: '⚙', mirrors: '☀',
  bees: '🐝', irrigation: '💦', vines: '🍃', timer: '⏱', vents: '〰', butterflies: '🦋', filter: '◈', pollination: '✿', orchid: '🌺',
  auto_valves: '⚙', heater: '🔥', dragonflies: '✧', pond: '💧', humidity: '☁', canopy: '🌳', roof_drive: '⚙', climate: '☀', birds: '🐦',
  ecosystem: '✺', central_bud: '🌿', open_roof: '☀', final_bloom: '🌼',
};

interface ActiveEventDefinition {
  x: number;
  y: number;
  icon: string;
  textKey: UiTextKey;
  requires: NodeId;
}

const ACTIVE_EVENTS: ActiveEventDefinition[] = [
  { x: 0.18, y: 0.69, icon: '⚙', textKey: 'event_pump', requires: 'pump' },
  { x: 0.17, y: 0.38, icon: '💧', textKey: 'event_water', requires: 'gutters' },
  { x: 0.78, y: 0.30, icon: '☀', textKey: 'event_light', requires: 'glass' },
  { x: 0.83, y: 0.67, icon: '✿', textKey: 'event_flowers', requires: 'flowers' },
  { x: 0.75, y: 0.42, icon: '🐝', textKey: 'event_bee', requires: 'bees' },
];

export class GameSceneV4 extends Phaser.Scene {
  private state!: GameState;
  private readonly platform = new BrowserPlatformAdapter();
  private locale: Locale = 'en';
  private worldLayer!: Phaser.GameObjects.Container;
  private treeLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private treeOpen = false;
  private selectedNode?: NodeId;
  private uiAccumulator = 0;
  private lastSaveAt = 0;
  private activeEventCountdown = 8;
  private activeEvent?: Phaser.GameObjects.Container;
  private activeEventTimer?: Phaser.Time.TimerEvent;
  private growthText?: Phaser.GameObjects.Text;
  private stageText?: Phaser.GameObjects.Text;
  private toast?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.image('main-greenhouse', '/art/main-greenhouse.jpg');
    this.load.image('heart-medallion', '/art/heart-medallion.jpg');
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
    if (this.uiAccumulator >= 0.2) {
      this.uiAccumulator = 0;
      this.updateHudValues();
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
      this.updateHudValues();
    });
  }

  private isTreeTap(x: number, y: number): boolean {
    const w = this.scale.width;
    const h = this.scale.height;
    const dx = (x - w * 0.55) / Math.max(1, w * 0.18);
    const dy = (y - h * 0.50) / Math.max(1, h * 0.34);
    return dx * dx + dy * dy <= 1;
  }

  private renderAll(): void {
    this.clearActiveEvent();
    this.worldLayer.removeAll(true);
    this.treeLayer.removeAll(true);
    this.hudLayer.removeAll(true);
    this.renderWorld();
    this.renderTree();
    this.worldLayer.setVisible(!this.treeOpen);
    this.treeLayer.setVisible(this.treeOpen);
    this.renderHud();
  }

  private renderWorld(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const progress = this.state.unlocked.length / DISCOVERY_NODES.length;

    const background = this.add.image(w / 2, h / 2, 'main-greenhouse');
    this.coverImage(background, w, h);
    const shade = 0xe5 + Math.round(progress * 0x1a);
    background.setTint(Phaser.Display.Color.GetColor(shade, shade, Math.min(255, shade + 3)));
    this.worldLayer.add(background);

    const glow = this.add.circle(w * 0.55, h * 0.50, Math.min(w, h) * (0.11 + progress * 0.05), 0xffdf79, 0.04 + progress * 0.07)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.worldLayer.add(glow);

    if (this.state.unlocked.length < 2) {
      const hint = this.add.text(w * 0.55, h * 0.84, uiText(this.locale, 'tap_tree_hint'), {
        fontFamily: 'Georgia, serif',
        fontSize: `${Math.max(18, Math.min(28, w / 65))}px`,
        color: '#ffe9a7',
        stroke: '#1a1008',
        strokeThickness: 5,
        shadow: { color: '#000000', fill: true, blur: 8, offsetX: 0, offsetY: 2 },
        align: 'center',
        wordWrap: { width: w * 0.42 },
      }).setOrigin(0.5).setDepth(10);
      this.worldLayer.add(hint);
    }
  }

  private renderTree(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const minSide = Math.min(w, h);

    const bg = this.add.image(w / 2, h / 2, 'main-greenhouse');
    this.coverImage(bg, w, h);
    bg.setTint(0x415048).setAlpha(0.30);
    const shade = this.add.rectangle(w / 2, h / 2, w, h, 0x06100b, 0.82);
    this.treeLayer.add([bg, shade]);

    const title = this.add.text(w / 2, 18, t(this.locale, 'tree_title'), {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(27, Math.min(44, w / 29))}px`,
      color: '#f7df9a',
      stroke: '#321f0e',
      strokeThickness: 5,
    }).setOrigin(0.5, 0);
    const help = this.add.text(w / 2, 68, uiText(this.locale, 'tree_help_radial'), {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(11, Math.min(14, w / 100))}px`,
      color: '#e9dfc4',
      align: 'center',
      wordWrap: { width: w * 0.62 },
    }).setOrigin(0.5, 0);
    this.treeLayer.add([title, help]);

    const positions = new Map<NodeId, Phaser.Math.Vector2>();
    for (const node of DISCOVERY_NODES) {
      const [nx, ny] = NODE_POSITIONS[node.id];
      positions.set(node.id, new Phaser.Math.Vector2(nx * w, ny * h));
    }

    const links = this.add.graphics();
    for (const node of DISCOVERY_NODES) {
      const unlocked = isUnlocked(this.state, node.id);
      const available = this.isAvailable(node);
      if (!isRevealed(this.state, node.id) && !unlocked && !available) continue;
      const child = positions.get(node.id)!;
      for (const req of node.requires) {
        const parent = positions.get(req)!;
        const parentNode = NODE_BY_ID[req];
        const crossBranch = parentNode.branch !== node.branch;
        if (crossBranch && !available && !unlocked) continue;
        links.lineStyle(crossBranch ? 1.5 : 3, BRANCH_COLORS[node.branch], unlocked ? 0.88 : available ? 0.58 : 0.16);
        links.beginPath();
        links.moveTo(parent.x, parent.y);
        if (crossBranch) {
          const mx = parent.x + (child.x - parent.x) * 0.52;
          links.lineTo(mx, parent.y);
          links.lineTo(mx, child.y);
        }
        links.lineTo(child.x, child.y);
        links.strokePath();
      }
    }
    this.treeLayer.add(links);

    for (const node of DISCOVERY_NODES) {
      const p = positions.get(node.id)!;
      const unlocked = isUnlocked(this.state, node.id);
      const available = this.isAvailable(node);
      const revealed = isRevealed(this.state, node.id);
      const selected = this.selectedNode === node.id;
      const size = node.id === 'sprout' ? Math.max(78, minSide * 0.115) : Math.max(42, minSide * 0.060);
      this.renderNode(node, p, size, unlocked, available, revealed, selected);
    }

    this.renderBranchLabels();
    if (this.selectedNode) {
      const p = positions.get(this.selectedNode)!;
      const size = this.selectedNode === 'sprout' ? Math.max(78, minSide * 0.115) : Math.max(42, minSide * 0.060);
      this.renderNodePopover(NODE_BY_ID[this.selectedNode], p, size);
    }
  }

  private renderNode(node: DiscoveryNode, p: Phaser.Math.Vector2, size: number, unlocked: boolean, available: boolean, revealed: boolean, selected: boolean): void {
    const color = unlocked ? BRANCH_COLORS[node.branch] : available ? 0xe7bd58 : 0x657067;
    const alpha = unlocked ? 1 : available ? 0.96 : revealed ? 0.50 : 0.24;
    const hit = this.add.circle(p.x, p.y, size * 0.48, 0x0d1710, alpha)
      .setStrokeStyle(Math.max(2, size * 0.045), color, unlocked || available ? 0.96 : 0.35)
      .setInteractive({ useHandCursor: true });
    this.treeLayer.add(hit);

    if (node.id === 'sprout' && unlocked) {
      const heart = this.add.image(p.x, p.y, 'heart-medallion').setDisplaySize(size * 0.90, size * 0.90).setAlpha(0.95);
      this.treeLayer.add(heart);
    } else {
      const glyph = unlocked || available ? NODE_ICONS[node.id] : revealed ? '◆' : '?';
      const glyphText = this.add.text(p.x, p.y, glyph, {
        fontFamily: 'Segoe UI Emoji, Segoe UI Symbol, Georgia, serif',
        fontSize: `${Math.max(15, size * (unlocked || available ? 0.36 : 0.30))}px`,
        color: unlocked ? '#fff7d7' : available ? '#fff0a5' : '#c6c4b7',
        stroke: '#20150b',
        strokeThickness: 2,
      }).setOrigin(0.5);
      this.treeLayer.add(glyphText);
    }

    if (unlocked) {
      this.treeLayer.add(this.add.text(p.x + size * 0.32, p.y - size * 0.31, '✓', {
        fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(11, size * 0.20)}px`, color: '#b8ff9a', stroke: '#153317', strokeThickness: 3,
      }).setOrigin(0.5));
    } else if (available) {
      this.treeLayer.add(this.add.text(p.x, p.y + size * 0.72, this.formatNumber(node.cost), {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(10, size * 0.17)}px`, color: '#ffe39a', backgroundColor: '#0b1711dd', padding: { x: 5, y: 2 },
      }).setOrigin(0.5));
    }

    if (selected) {
      this.treeLayer.add(this.add.circle(p.x, p.y, size * 0.58, 0, 0).setStrokeStyle(Math.max(2, size * 0.035), 0xffebaa, 1));
    }

    hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.selectedNode = node.id;
      this.renderTreeOnly();
    });
  }

  private renderNodePopover(node: DiscoveryNode, p: Phaser.Math.Vector2, nodeSize: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const unlocked = isUnlocked(this.state, node.id);
    const available = this.isAvailable(node);
    const revealed = isRevealed(this.state, node.id);
    const affordable = this.state.growth >= node.cost;

    const panelW = Math.max(260, Math.min(350, w * 0.27));
    const panelH = Math.max(155, Math.min(205, h * 0.27));
    const preferRight = p.x < w * 0.66;
    let panelX = preferRight ? p.x + nodeSize * 0.75 + panelW / 2 : p.x - nodeSize * 0.75 - panelW / 2;
    let panelY = p.y;
    panelX = Phaser.Math.Clamp(panelX, panelW / 2 + 14, w - panelW / 2 - 14);
    panelY = Phaser.Math.Clamp(panelY, panelH / 2 + 96, h - panelH / 2 - 18);

    const connector = this.add.graphics();
    connector.lineStyle(2, available ? 0xe7bd58 : unlocked ? BRANCH_COLORS[node.branch] : 0x8f8a78, 0.65);
    connector.beginPath();
    connector.moveTo(p.x + (preferRight ? nodeSize * 0.48 : -nodeSize * 0.48), p.y);
    connector.lineTo(panelX + (preferRight ? -panelW / 2 : panelW / 2), panelY);
    connector.strokePath();
    this.treeLayer.add(connector);

    const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x07140e, 0.97)
      .setStrokeStyle(2, available ? 0xe7bd58 : unlocked ? BRANCH_COLORS[node.branch] : 0x7a725e, 0.95);
    this.treeLayer.add(panel);

    const showDetails = unlocked || available;
    const icon = showDetails ? NODE_ICONS[node.id] : revealed ? '◆' : '?';
    this.treeLayer.add(this.add.text(panelX - panelW * 0.43, panelY - panelH * 0.38, icon, {
      fontFamily: 'Segoe UI Emoji, Segoe UI Symbol, serif', fontSize: `${Math.max(22, panelH * 0.17)}px`, color: '#fff0ae',
    }).setOrigin(0, 0));

    const status = unlocked ? uiText(this.locale, 'node_opened') : available ? uiText(this.locale, 'node_available') : revealed ? uiText(this.locale, 'node_locked') : uiText(this.locale, 'node_mystery');
    this.treeLayer.add(this.add.text(panelX - panelW * 0.28, panelY - panelH * 0.36, status, {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(10, panelH * 0.075)}px`, color: unlocked ? '#a9f58f' : available ? '#ffe080' : '#c8c2ad', fontStyle: 'bold',
    }).setOrigin(0, 0));

    const title = showDetails ? t(this.locale, nodeNameKey(node.id)) : '???';
    this.treeLayer.add(this.add.text(panelX - panelW * 0.43, panelY - panelH * 0.14, title, {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(15, panelH * 0.12)}px`, color: '#f5df9d', fontStyle: 'bold', wordWrap: { width: panelW * 0.86 },
    }).setOrigin(0, 0));

    const effect = showDetails ? this.nodeEffectText(node) : '';
    const desc = showDetails ? `${t(this.locale, nodeDescriptionKey(node.id))}${effect ? `\n${effect}` : ''}` : revealed ? uiText(this.locale, 'need_requirements') : this.mysteryLabel();
    this.treeLayer.add(this.add.text(panelX - panelW * 0.43, panelY + panelH * 0.05, desc, {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(10, panelH * 0.070)}px`, color: '#efe9d8', lineSpacing: 2, wordWrap: { width: panelW * 0.86 },
    }).setOrigin(0, 0));

    if (!unlocked && available) {
      const buttonW = panelW * 0.72;
      const buttonH = Math.max(32, panelH * 0.22);
      const buttonY = panelY + panelH * 0.34;
      const button = this.add.rectangle(panelX, buttonY, buttonW, buttonH, affordable ? 0x245f30 : 0x383c37, 1)
        .setStrokeStyle(2, affordable ? 0x83c76b : 0x777061, 1)
        .setInteractive({ useHandCursor: affordable });
      const label = affordable ? uiText(this.locale, 'open_for', { value: this.formatNumber(node.cost) }) : this.locale === 'ru' ? `Не хватает ${this.formatNumber(node.cost - this.state.growth)}` : `Need ${this.formatNumber(node.cost - this.state.growth)} more`;
      this.treeLayer.add(button);
      this.treeLayer.add(this.add.text(panelX, buttonY, label, {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(11, buttonH * 0.34)}px`, color: affordable ? '#f8efc7' : '#c7c2b3', align: 'center',
      }).setOrigin(0.5));

      if (affordable) {
        button.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          if (!buyNode(this.state, node.id)) return;
          saveState(this.state);
          this.platform.analytics('discovery_unlocked', { node: node.id });
          if (node.final) void this.platform.achievement('final_bloom');
          this.renderAll();
          this.treeOpen = true;
          this.worldLayer.setVisible(false);
          this.treeLayer.setVisible(true);
          this.renderHud();
          this.showToast(node.final ? t(this.locale, 'ending_toast') : `${NODE_ICONS[node.id]} ${t(this.locale, nodeNameKey(node.id))}`);
        });
      }
    }
  }

  private isAvailable(node: DiscoveryNode): boolean {
    return !isUnlocked(this.state, node.id) && node.requires.every((req) => isUnlocked(this.state, req));
  }

  private nodeEffectText(node: DiscoveryNode): string {
    const parts: string[] = [];
    if (node.incomePerSecond) parts.push(this.locale === 'ru' ? `+${this.formatNumber(node.incomePerSecond)} роста/с` : `+${this.formatNumber(node.incomePerSecond)} Growth/s`);
    if (node.multiplier) parts.push(this.locale === 'ru' ? `×${node.multiplier.toFixed(2).replace(/0$/, '')} к общему производству` : `×${node.multiplier.toFixed(2).replace(/0$/, '')} total production`);
    if (node.id === 'open_roof') parts.push(this.locale === 'ru' ? 'Открывает финальную цепочку.' : 'Unlocks the final chain.');
    if (node.final) parts.push(this.locale === 'ru' ? 'Финальное преображение оранжереи.' : 'Final greenhouse transformation.');
    return parts.join(' • ');
  }

  private renderBranchLabels(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const labels: Array<{ x: number; y: number; key: 'branch_water' | 'branch_plants' | 'branch_climate' | 'branch_mechanisms' | 'branch_life' }> = [
      { x: 0.24, y: 0.19, key: 'branch_water' }, { x: 0.76, y: 0.19, key: 'branch_plants' },
      { x: 0.24, y: 0.88, key: 'branch_climate' }, { x: 0.50, y: 0.93, key: 'branch_mechanisms' }, { x: 0.76, y: 0.88, key: 'branch_life' },
    ];
    for (const label of labels) {
      this.treeLayer.add(this.add.text(label.x * w, label.y * h, t(this.locale, label.key), {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(12, Math.min(16, w / 90))}px`, color: '#fff1bf', backgroundColor: '#0b1711dd', padding: { x: 9, y: 5 },
      }).setOrigin(0.5));
    }
  }

  private renderTreeOnly(): void {
    this.treeLayer.removeAll(true);
    this.renderTree();
    this.treeLayer.setVisible(true);
    this.renderHud();
  }

  private renderHud(): void {
    this.hudLayer.removeAll(true);
    const w = this.scale.width;
    const h = this.scale.height;
    this.growthText = undefined;
    this.stageText = undefined;

    if (!this.treeOpen) {
      const panelW = Math.min(360, w * 0.32);
      const panelH = Math.min(130, h * 0.18);
      const panel = this.add.rectangle(panelW / 2 + 14, panelH / 2 + 12, panelW, panelH, 0x06140d, 0.93).setStrokeStyle(2, 0xc89a4d, 0.95);
      this.growthText = this.add.text(42, 31, '', { fontFamily: 'Georgia, serif', fontSize: `${Math.max(15, panelH * 0.16)}px`, color: '#f8e9b9', lineSpacing: 7, stroke: '#1d1309', strokeThickness: 2 });
      this.hudLayer.add([panel, this.growthText]);

      const menuW = Math.max(180, Math.min(250, w * 0.20));
      const menuH = Math.max(52, Math.min(68, h * 0.085));
      const menuX = w - menuW / 2 - 18;
      const menuY = menuH / 2 + 16;
      const menu = this.add.rectangle(menuX, menuY, menuW, menuH, 0x07140e, 0.95).setStrokeStyle(2, 0xc89a4d, 1).setInteractive({ useHandCursor: true });
      const menuText = this.add.text(menuX, menuY, `✦  ${t(this.locale, 'discoveries')}`, { fontFamily: 'Georgia, serif', fontSize: `${Math.max(15, menuH * 0.25)}px`, color: '#f8e3a3' }).setOrigin(0.5);
      menu.on('pointerdown', (_p, _x, _y, event) => {
        event.stopPropagation();
        this.treeOpen = true;
        this.selectedNode = undefined;
        this.clearActiveEvent();
        this.worldLayer.setVisible(false);
        this.treeLayer.setVisible(true);
        this.renderTreeOnly();
      });
      this.hudLayer.add([menu, menuText]);
    } else {
      const backW = Math.max(190, Math.min(270, w * 0.21));
      const backH = Math.max(52, Math.min(66, h * 0.085));
      const backX = w - backW / 2 - 18;
      const backY = backH / 2 + 14;
      const back = this.add.rectangle(backX, backY, backW, backH, 0x07140e, 0.95).setStrokeStyle(2, 0xc89a4d, 1).setInteractive({ useHandCursor: true });
      const backText = this.add.text(backX, backY, `←  ${t(this.locale, 'back')}`, { fontFamily: 'Georgia, serif', fontSize: `${Math.max(14, backH * 0.23)}px`, color: '#f5dfa2' }).setOrigin(0.5);
      back.on('pointerdown', (_p, _x, _y, event) => {
        event.stopPropagation();
        this.treeOpen = false;
        this.selectedNode = undefined;
        this.treeLayer.setVisible(false);
        this.worldLayer.setVisible(true);
        this.renderHud();
      });
      this.hudLayer.add([back, backText]);
      this.stageText = this.add.text(20, 18, '', { fontFamily: 'Georgia, serif', fontSize: '14px', color: '#f5dfa2', backgroundColor: '#0c1812dd', padding: { x: 12, y: 7 } });
      this.hudLayer.add(this.stageText);
    }

    const language = this.add.text(w - 20, h - 18, t(this.locale, 'language'), { fontFamily: 'Georgia, serif', fontSize: '14px', color: '#f0d899', backgroundColor: '#132219ee', padding: { x: 13, y: 8 } }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    language.on('pointerdown', (_p, _x, _y, event) => { event.stopPropagation(); this.locale = this.locale === 'ru' ? 'en' : 'ru'; saveLocale(this.locale); this.renderAll(); });

    const reset = this.add.text(18, h - 18, t(this.locale, 'reset'), { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#d8cda9', backgroundColor: '#132219cc', padding: { x: 10, y: 6 } }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    reset.on('pointerdown', (_p, _x, _y, event) => { event.stopPropagation(); this.state = resetState(); this.selectedNode = undefined; this.treeOpen = false; this.activeEventCountdown = 8; this.renderAll(); });

    this.hudLayer.add([language, reset]);
    this.updateHudValues();
  }

  private updateHudValues(): void {
    if (this.growthText) {
      const income = getIncomePerSecond(this.state);
      const tap = getManualTapValue(this.state);
      this.growthText.setText(`${t(this.locale, 'growth')}  ${this.formatNumber(this.state.growth)}\n+${this.formatNumber(income)}${t(this.locale, 'per_second')}   •   ${t(this.locale, 'tap')} +${this.formatNumber(tap)}`);
    }
    if (this.stageText) this.stageText.setText(t(this.locale, 'stage', { value: this.state.unlocked.length }));
  }

  private pulseCentralTree(x: number, y: number, amount: number): void {
    const pulse = this.add.circle(this.scale.width * 0.55, this.scale.height * 0.50, Math.min(this.scale.width, this.scale.height) * 0.11, 0xffdf78, 0.24).setBlendMode(Phaser.BlendModes.ADD).setDepth(950);
    const reward = this.add.text(x, y - 20, `+${this.formatNumber(amount)}`, { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#efffbc', fontStyle: 'bold', stroke: '#284318', strokeThickness: 4 }).setOrigin(0.5).setDepth(1100);
    this.tweens.add({ targets: pulse, scale: 1.45, alpha: 0, duration: 330, onComplete: () => pulse.destroy() });
    this.tweens.add({ targets: reward, y: y - 64, alpha: 0, duration: 650, onComplete: () => reward.destroy() });
  }

  private spawnActiveEvent(): void {
    if (this.treeOpen || this.state.completed) return;
    const eligible = ACTIVE_EVENTS.filter((event) => isUnlocked(this.state, event.requires));
    if (eligible.length === 0) return;
    const definition = Phaser.Utils.Array.GetRandom(eligible);
    const x = definition.x * this.scale.width;
    const y = definition.y * this.scale.height;
    const size = Math.max(50, Math.min(this.scale.width, this.scale.height) * 0.075);
    const container = this.add.container(x, y).setDepth(900);
    const halo = this.add.circle(0, 0, size * 0.55, 0xffdc70, 0.22).setStrokeStyle(3, 0xffe6a0, 0.95).setInteractive({ useHandCursor: true });
    const icon = this.add.text(0, 0, definition.icon, { fontFamily: 'Segoe UI Emoji, Segoe UI Symbol, sans-serif', fontSize: `${size * 0.38}px`, color: '#fff5c9' }).setOrigin(0.5);
    const tag = this.add.text(0, size * 0.82, uiText(this.locale, definition.textKey), { fontFamily: 'Georgia, serif', fontSize: `${Math.max(10, size * 0.16)}px`, color: '#fff0b4', backgroundColor: '#0b1711ee', padding: { x: 8, y: 4 } }).setOrigin(0.5);
    container.add([halo, icon, tag]);
    const collect = (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (!this.activeEvent) return;
      const reward = collectActiveEvent(this.state);
      this.platform.analytics('active_event_collected', { reward, type: definition.textKey });
      this.showToast(`${uiText(this.locale, definition.textKey)}: +${this.formatNumber(reward)}`);
      this.pulseCentralTree(x, y, reward);
      this.clearActiveEvent();
      this.activeEventCountdown = Phaser.Math.Between(9, 15);
      this.updateHudValues();
    };
    halo.on('pointerdown', collect);
    tag.setInteractive({ useHandCursor: true }).on('pointerdown', collect);
    this.tweens.add({ targets: halo, scale: 1.08, alpha: 0.34, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.activeEvent = container;
    this.activeEventTimer = this.time.delayedCall(7500, () => { this.clearActiveEvent(); this.activeEventCountdown = Phaser.Math.Between(7, 13); });
  }

  private clearActiveEvent(): void {
    this.activeEventTimer?.remove(false);
    this.activeEventTimer = undefined;
    if (this.activeEvent) { this.activeEvent.destroy(true); this.activeEvent = undefined; }
  }

  private showToast(message: string): void {
    this.toastTimer?.remove(false);
    this.toast?.destroy();
    this.toast = this.add.text(this.scale.width / 2, 92, message, { fontFamily: 'Georgia, serif', fontSize: '16px', color: '#fff0b4', backgroundColor: '#152119ee', padding: { x: 18, y: 10 }, stroke: '#24160b', strokeThickness: 2, wordWrap: { width: Math.max(300, this.scale.width * 0.68) }, align: 'center' }).setOrigin(0.5).setDepth(2000);
    this.toastTimer = this.time.delayedCall(1800, () => { this.toast?.destroy(); this.toast = undefined; this.toastTimer = undefined; });
  }

  private coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void {
    const source = image.texture.getSourceImage() as HTMLImageElement;
    const scale = Math.max(width / source.width, height / source.height);
    image.setDisplaySize(source.width * scale, source.height * scale);
  }

  private mysteryLabel(): string {
    return this.locale === 'ru' ? 'Связь ещё не раскрыта.' : 'This connection has not been revealed yet.';
  }

  private formatNumber(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    if (value >= 100) return Math.floor(value).toString();
    if (value >= 10) return value.toFixed(1);
    return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }
}
