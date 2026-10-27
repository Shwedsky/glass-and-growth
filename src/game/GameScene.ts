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
  water: 0x65c8f2, plants: 0x7ed957, climate: 0xd9a947, mechanisms: 0xd48842,
  life: 0xd26ce5, synergy: 0xf1d36b, final: 0xffe0a7,
};

const NODE_ICONS: Record<NodeId, string> = {
  sprout: '🌱', pump: '💧', bed: '🌿', gutters: '🌧', flowers: '🌸', glass: '☀', cistern: '🫙', herbs: '🌿', gears: '⚙', mirrors: '✦',
  bees: '🐝', irrigation: '💦', vines: '🍃', timer: '⏱', vents: '〰', butterflies: '🦋', filter: '◈', pollination: '✿', orchid: '🌺',
  auto_valves: '⚙', heater: '🔥', dragonflies: '✧', pond: '💧', humidity: '☁', canopy: '🌳', roof_drive: '⚙', climate: '☀', birds: '🐦',
  ecosystem: '✺', central_bud: '🌿', open_roof: '☀', final_bloom: '🌼',
};

interface ActiveEventDefinition {
  x: number;
  y: number;
  icon: string;
  textKey: UiTextKey;
  tint: number;
  requires?: NodeId;
}

const ACTIVE_EVENTS: ActiveEventDefinition[] = [
  { x: 0.17, y: 0.69, icon: '⚙', textKey: 'event_pump', tint: 0xd4924f, requires: 'pump' },
  { x: 0.16, y: 0.38, icon: '💧', textKey: 'event_water', tint: 0x70c8ef, requires: 'gutters' },
  { x: 0.79, y: 0.31, icon: '☀', textKey: 'event_light', tint: 0xf4c75b, requires: 'glass' },
  { x: 0.84, y: 0.67, icon: '✿', textKey: 'event_flowers', tint: 0xe678bf, requires: 'flowers' },
  { x: 0.75, y: 0.42, icon: '🐝', textKey: 'event_bee', tint: 0xf0c84b, requires: 'bees' },
];

interface RevealRegion {
  node: NodeId;
  x: number;
  y: number;
  w: number;
  h: number;
}

const REVEAL_REGIONS: RevealRegion[] = [
  { node: 'pump', x: 0.00, y: 0.55, w: 0.31, h: 0.45 },
  { node: 'gutters', x: 0.00, y: 0.16, w: 0.31, h: 0.42 },
  { node: 'bed', x: 0.66, y: 0.55, w: 0.34, h: 0.45 },
  { node: 'flowers', x: 0.72, y: 0.45, w: 0.28, h: 0.40 },
  { node: 'bees', x: 0.77, y: 0.21, w: 0.23, h: 0.35 },
  { node: 'vines', x: 0.66, y: 0.00, w: 0.34, h: 0.48 },
  { node: 'pond', x: 0.50, y: 0.60, w: 0.30, h: 0.40 },
  { node: 'gears', x: 0.02, y: 0.48, w: 0.32, h: 0.40 },
  { node: 'canopy', x: 0.28, y: 0.00, w: 0.44, h: 0.44 },
  { node: 'birds', x: 0.55, y: 0.05, w: 0.38, h: 0.35 },
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
  private growthText?: Phaser.GameObjects.Text;
  private stageText?: Phaser.GameObjects.Text;

  constructor() { super('GameScene'); }

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
    if (this.uiAccumulator >= 0.20) { this.uiAccumulator = 0; this.updateHudValues(); }
    if (this.lastSaveAt >= 3) { this.lastSaveAt = 0; saveState(this.state); }
  }

  private bindInput(): void {
    this.scale.on('resize', () => this.renderAll());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.treeOpen || this.state.completed || !canManualTap(this.state) || !this.isTreeTap(pointer.x, pointer.y)) return;
      const amount = getManualTapValue(this.state);
      grantGrowth(this.state, amount);
      this.platform.analytics('manual_tree_tap', { amount });
      this.pulseCentralTree(pointer.x, pointer.y, amount);
      this.updateHudValues();
    });
  }

  private isTreeTap(x: number, y: number): boolean {
    const w = this.scale.width; const h = this.scale.height;
    const dx = (x - w * 0.50) / Math.max(1, w * 0.18);
    const dy = (y - h * 0.48) / Math.max(1, h * 0.31);
    return dx * dx + dy * dy <= 1;
  }

  private renderAll(): void {
    this.clearActiveEvent();
    this.tweens.killAll();
    this.worldLayer.removeAll(true); this.treeLayer.removeAll(true); this.hudLayer.removeAll(true);
    this.renderWorld(); this.renderTree();
    this.worldLayer.setVisible(!this.treeOpen); this.treeLayer.setVisible(this.treeOpen);
    this.renderHud();
  }

  private renderWorld(): void {
    const w = this.scale.width; const h = this.scale.height;
    const base = this.add.image(w / 2, h / 2, 'main-greenhouse');
    this.coverImage(base, w, h);
    base.setTint(0x565a4d).setAlpha(0.72);
    this.worldLayer.add(base);

    const progress = this.state.unlocked.length / DISCOVERY_NODES.length;
    const treeRadiusX = 0.18 + progress * 0.13;
    const treeRadiusY = 0.38 + progress * 0.14;
    this.addRevealCrop(0.50 - treeRadiusX, 0.50 - treeRadiusY, treeRadiusX * 2, treeRadiusY * 2, 1);

    for (const region of REVEAL_REGIONS) {
      if (isUnlocked(this.state, region.node)) this.addRevealCrop(region.x, region.y, region.w, region.h, 1);
    }

    const glowCount = Math.min(5, Math.floor(this.state.unlocked.length / 6));
    for (let i = 0; i < glowCount; i += 1) {
      const glow = this.add.image(w * 0.50, h * (0.48 - i * 0.008), 'heart-medallion')
        .setDisplaySize(Math.min(w, h) * (0.12 + i * 0.025), Math.min(w, h) * (0.12 + i * 0.025))
        .setAlpha(0.05 + i * 0.018).setBlendMode(Phaser.BlendModes.ADD);
      this.worldLayer.add(glow);
    }

    if (this.state.unlocked.length < 2) {
      const hintW = Math.min(430, w * 0.40); const hintH = Math.max(58, Math.min(76, h * 0.10));
      const hintPanel = this.add.image(w * 0.50, h * 0.80, 'hud-panel').setDisplaySize(hintW, hintH).setAlpha(0.97);
      const hintText = this.add.text(w * 0.50, h * 0.80, uiText(this.locale, 'tap_tree_hint'), {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(14, hintH * 0.23)}px`, color: '#f5dfa0',
        stroke: '#2b190b', strokeThickness: 3, align: 'center', wordWrap: { width: hintW * 0.78 },
      }).setOrigin(0.5);
      this.worldLayer.add([hintPanel, hintText]);
    }

    const focus = this.add.image(w * 0.50, h * 0.50, 'heart-medallion')
      .setDisplaySize(Math.min(w, h) * 0.14, Math.min(w, h) * 0.14)
      .setAlpha(0.10 + Math.min(0.12, progress * 0.12)).setBlendMode(Phaser.BlendModes.ADD);
    this.worldLayer.add(focus);
    this.tweens.add({ targets: focus, alpha: focus.alpha + 0.10, scale: 1.08, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private addRevealCrop(nx: number, ny: number, nw: number, nh: number, alpha: number): void {
    const w = this.scale.width; const h = this.scale.height;
    const image = this.add.image(w / 2, h / 2, 'main-greenhouse');
    this.coverImage(image, w, h);
    const source = image.texture.getSourceImage() as HTMLImageElement;
    const x = Phaser.Math.Clamp(nx, 0, 1) * source.width;
    const y = Phaser.Math.Clamp(ny, 0, 1) * source.height;
    const cw = Phaser.Math.Clamp(nw, 0, 1) * source.width;
    const ch = Phaser.Math.Clamp(nh, 0, 1) * source.height;
    image.setCrop(x, y, cw, ch).setAlpha(alpha);
    this.worldLayer.add(image);
  }

  private renderTree(): void {
    const w = this.scale.width; const h = this.scale.height; const minSide = Math.min(w, h);
    const bg = this.add.image(w / 2, h / 2, 'main-greenhouse'); this.coverImage(bg, w, h); bg.setTint(0x344037).setAlpha(0.33);
    const shade = this.add.rectangle(w / 2, h / 2, w, h, 0x07100b, 0.74);
    this.treeLayer.add([bg, shade]);
    const title = this.add.text(w / 2, 18, t(this.locale, 'tree_title'), {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(27, Math.min(44, w / 29))}px`, color: '#f7df9a', stroke: '#321f0e', strokeThickness: 5,
    }).setOrigin(0.5, 0);
    const help = this.add.text(w / 2, 68, uiText(this.locale, 'tree_help_radial'), {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(11, Math.min(14, w / 100))}px`, color: '#e9dfc4', align: 'center', wordWrap: { width: w * 0.60 },
    }).setOrigin(0.5, 0);
    this.treeLayer.add([title, help]);

    const positions = new Map<NodeId, Phaser.Math.Vector2>();
    for (const node of DISCOVERY_NODES) { const [nx, ny] = NODE_POSITIONS[node.id]; positions.set(node.id, new Phaser.Math.Vector2(nx * w, ny * h)); }
    const links = this.add.graphics();
    for (const node of DISCOVERY_NODES) {
      const childVisible = isRevealed(this.state, node.id) || isUnlocked(this.state, node.id);
      if (!childVisible) continue;
      const child = positions.get(node.id)!; const childAvailable = node.requires.every((req) => isUnlocked(this.state, req));
      for (const req of node.requires) {
        const parentNode = NODE_BY_ID[req]; const parent = positions.get(req)!; const crossBranch = parentNode.branch !== node.branch;
        if (crossBranch && !childAvailable && !isUnlocked(this.state, node.id)) continue;
        const lineAlpha = isUnlocked(this.state, node.id) ? 0.82 : childAvailable ? 0.58 : 0.18;
        links.lineStyle(crossBranch ? 1.5 : 3, BRANCH_COLORS[node.branch], lineAlpha);
        links.beginPath(); links.moveTo(parent.x, parent.y);
        if (crossBranch) { const mx = parent.x + (child.x - parent.x) * 0.52; links.lineTo(mx, parent.y); links.lineTo(mx, child.y); }
        links.lineTo(child.x, child.y); links.strokePath();
      }
    }
    this.treeLayer.add(links);

    for (const node of DISCOVERY_NODES) {
      const p = positions.get(node.id)!; const unlocked = isUnlocked(this.state, node.id); const revealed = isRevealed(this.state, node.id);
      const available = node.requires.every((req) => isUnlocked(this.state, req)); const affordable = this.state.growth >= node.cost; const selected = this.selectedNode === node.id;
      const size = node.id === 'sprout' ? Math.max(76, minSide * 0.125) : Math.max(42, minSide * 0.066);
      const medallion = this.add.image(p.x, p.y, node.id === 'sprout' ? 'heart-medallion' : 'node-medallion')
        .setDisplaySize(size, size).setTint(unlocked ? BRANCH_COLORS[node.branch] : available ? 0xe4bd58 : revealed ? 0x807f76 : 0x484d48)
        .setAlpha(unlocked ? 1 : available ? 0.95 : revealed ? 0.68 : 0.35).setInteractive({ useHandCursor: true });
      this.treeLayer.add(medallion);
      if (selected) this.treeLayer.add(this.add.circle(p.x, p.y, size * 0.58, 0, 0).setStrokeStyle(Math.max(3, size * 0.05), 0xffe49a, 0.95));
      const glyph = unlocked ? NODE_ICONS[node.id] : available ? '✦' : revealed ? '◈' : '?';
      const glyphText = this.add.text(p.x, p.y, glyph, {
        fontFamily: 'Segoe UI Emoji, Segoe UI Symbol, Georgia, serif', fontSize: `${Math.max(15, size * (unlocked ? 0.34 : 0.30))}px`,
        color: unlocked ? '#fff7d7' : available ? '#fff0a5' : '#d6d0bc', stroke: '#24170b', strokeThickness: 3,
      }).setOrigin(0.5);
      this.treeLayer.add(glyphText);
      medallion.on('pointerdown', (_pointer, _x, _y, event) => { event.stopPropagation(); this.selectedNode = node.id; this.renderTreeOnly(); });
      if (available && affordable && !unlocked) this.tweens.add({ targets: medallion, scale: 1.07, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    this.renderBranchLabels(); this.renderSelectedNodePanel();
  }

  private renderBranchLabels(): void {
    const w = this.scale.width; const h = this.scale.height;
    const labels: Array<{ x: number; y: number; key: 'branch_water' | 'branch_plants' | 'branch_climate' | 'branch_mechanisms' | 'branch_life'; branch: Branch }> = [
      { x: 0.24, y: 0.19, key: 'branch_water', branch: 'water' }, { x: 0.76, y: 0.19, key: 'branch_plants', branch: 'plants' },
      { x: 0.24, y: 0.88, key: 'branch_climate', branch: 'climate' }, { x: 0.50, y: 0.93, key: 'branch_mechanisms', branch: 'mechanisms' },
      { x: 0.76, y: 0.88, key: 'branch_life', branch: 'life' },
    ];
    for (const label of labels) this.treeLayer.add(this.add.text(label.x * w, label.y * h, t(this.locale, label.key), {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(12, Math.min(16, w / 90))}px`, color: '#fff1bf', backgroundColor: '#0b1711dd', padding: { x: 9, y: 5 },
      stroke: Phaser.Display.Color.IntegerToColor(BRANCH_COLORS[label.branch]).rgba, strokeThickness: 1,
    }).setOrigin(0.5));
  }

  private renderTreeOnly(): void { this.tweens.killAll(); this.treeLayer.removeAll(true); this.renderTree(); this.treeLayer.setVisible(true); this.renderHud(); }

  private renderSelectedNodePanel(): void {
    const w = this.scale.width; const h = this.scale.height; const node = NODE_BY_ID[this.selectedNode];
    const unlocked = isUnlocked(this.state, node.id); const revealed = isRevealed(this.state, node.id);
    const available = node.requires.every((req) => isUnlocked(this.state, req)); const affordable = this.state.growth >= node.cost;
    const panelW = Math.min(520, w * 0.42); const panelH = Math.min(175, h * 0.23); const panelX = w - panelW / 2 - 20; const panelY = h - panelH / 2 - 18;
    const panel = this.add.image(panelX, panelY, 'hud-panel').setDisplaySize(panelW, panelH).setAlpha(0.98); this.treeLayer.add(panel);
    const icon = unlocked ? NODE_ICONS[node.id] : available ? '✦' : '?';
    this.treeLayer.add(this.add.text(panelX - panelW * 0.43, panelY - panelH * 0.34, icon, {
      fontFamily: 'Segoe UI Emoji, Segoe UI Symbol, serif', fontSize: `${Math.max(24, panelH * 0.20)}px`, color: '#fff0ae',
    }).setOrigin(0, 0));
    const statusKey: UiTextKey = unlocked ? 'node_opened' : available ? 'node_available' : revealed ? 'node_locked' : 'node_mystery';
    this.treeLayer.add(this.add.text(panelX - panelW * 0.31, panelY - panelH * 0.31, uiText(this.locale, statusKey), {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(10, panelH * 0.085)}px`, color: unlocked ? '#a9f58f' : available ? '#ffe080' : '#c8c2ad', fontStyle: 'bold',
    }).setOrigin(0, 0));
    const titleText = unlocked ? t(this.locale, nodeNameKey(node.id)) : revealed ? this.unknownLabel() : '???';
    this.treeLayer.add(this.add.text(panelX - panelW * 0.43, panelY - panelH * 0.08, titleText, {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(16, panelH * 0.14)}px`, color: '#f5df9d', fontStyle: 'bold', stroke: '#25180d', strokeThickness: 3,
      wordWrap: { width: panelW * 0.58 },
    }).setOrigin(0, 0));
    const desc = unlocked ? t(this.locale, nodeDescriptionKey(node.id)) : available ? `${this.costLabel()}: ${this.formatNumber(node.cost)}` : revealed ? uiText(this.locale, 'need_requirements') : this.mysteryLabel();
    this.treeLayer.add(this.add.text(panelX - panelW * 0.43, panelY + panelH * 0.18, desc, {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(11, panelH * 0.085)}px`, color: '#efe9d8', wordWrap: { width: panelW * 0.57 }, lineSpacing: 3,
    }).setOrigin(0, 0));
    const buttonW = panelW * 0.30; const buttonH = panelH * 0.40; const buttonX = panelX + panelW * 0.29; const buttonY = panelY + panelH * 0.15;
    const button = this.add.image(buttonX, buttonY, 'hud-panel').setDisplaySize(buttonW, buttonH)
      .setTint(unlocked ? 0x557f50 : available && affordable ? 0x6fac55 : 0x5d5a50).setAlpha(unlocked || available ? 1 : 0.70)
      .setInteractive({ useHandCursor: available && affordable && !unlocked });
    const buttonLabel = unlocked ? uiText(this.locale, 'node_opened') : available ? uiText(this.locale, 'open_for', { value: this.formatNumber(node.cost) }) : uiText(this.locale, 'node_locked');
    const buttonText = this.add.text(buttonX, buttonY, buttonLabel, {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(11, buttonH * 0.22)}px`, color: '#fff3c6', align: 'center', stroke: '#28180b', strokeThickness: 3, wordWrap: { width: buttonW * 0.82 },
    }).setOrigin(0.5);
    this.treeLayer.add([button, buttonText]);
    if (!unlocked && available) button.on('pointerdown', (_p, _x, _y, event) => {
      event.stopPropagation();
      if (!affordable) { this.showToast(t(this.locale, 'need_more', { value: this.formatNumber(node.cost - this.state.growth) })); return; }
      if (buyNode(this.state, node.id)) {
        saveState(this.state); this.platform.analytics('discovery_unlocked', { node: node.id }); if (node.final) void this.platform.achievement('final_bloom');
        this.showToast(node.final ? t(this.locale, 'ending_toast') : `${NODE_ICONS[node.id]} ${t(this.locale, nodeNameKey(node.id))}`);
        this.renderAll(); this.treeOpen = true; this.worldLayer.setVisible(false); this.treeLayer.setVisible(true); this.renderHud();
      }
    });
  }

  private renderHud(): void {
    this.hudLayer.removeAll(true); const w = this.scale.width; const h = this.scale.height; this.growthText = undefined; this.stageText = undefined;
    if (!this.treeOpen) {
      const panelW = Math.min(360, w * 0.32); const panelH = Math.min(130, h * 0.18);
      const panel = this.add.image(panelW / 2 + 14, panelH / 2 + 12, 'hud-panel').setDisplaySize(panelW, panelH).setAlpha(0.98);
      const dark = this.add.rectangle(panelW / 2 + 14, panelH / 2 + 12, panelW * 0.82, panelH * 0.58, 0x08140f, 0.84);
      this.growthText = this.add.text(42, 31, '', { fontFamily: 'Georgia, serif', fontSize: `${Math.max(15, panelH * 0.16)}px`, color: '#f8e9b9', lineSpacing: 7, stroke: '#1d1309', strokeThickness: 2 });
      this.hudLayer.add([panel, dark, this.growthText]);
      const menuW = Math.max(180, Math.min(250, w * 0.20)); const menuH = Math.max(58, Math.min(76, h * 0.10));
      const menu = this.add.image(w - menuW / 2 - 18, menuH / 2 + 16, 'hud-panel').setDisplaySize(menuW, menuH).setAlpha(0.98).setInteractive({ useHandCursor: true });
      const menuText = this.add.text(w - menuW / 2 - 18, menuH / 2 + 16, `✦  ${t(this.locale, 'discoveries')}`, { fontFamily: 'Georgia, serif', fontSize: `${Math.max(15, menuH * 0.25)}px`, color: '#f8e3a3', stroke: '#27170a', strokeThickness: 3 }).setOrigin(0.5);
      menu.on('pointerdown', (_p, _x, _y, event) => { event.stopPropagation(); this.treeOpen = true; this.clearActiveEvent(); this.worldLayer.setVisible(false); this.treeLayer.setVisible(true); this.renderHud(); });
      this.hudLayer.add([menu, menuText]);
    } else {
      const backW = Math.max(190, Math.min(270, w * 0.21)); const backH = Math.max(58, Math.min(72, h * 0.095));
      const back = this.add.image(w - backW / 2 - 18, backH / 2 + 14, 'hud-panel').setDisplaySize(backW, backH).setAlpha(0.98).setInteractive({ useHandCursor: true });
      const backText = this.add.text(w - backW / 2 - 18, backH / 2 + 14, `←  ${t(this.locale, 'back')}`, { fontFamily: 'Georgia, serif', fontSize: `${Math.max(14, backH * 0.23)}px`, color: '#f5dfa2', stroke: '#24170b', strokeThickness: 3 }).setOrigin(0.5);
      back.on('pointerdown', (_p, _x, _y, event) => { event.stopPropagation(); this.treeOpen = false; this.treeLayer.setVisible(false); this.worldLayer.setVisible(true); this.renderHud(); });
      this.hudLayer.add([back, backText]);
      this.stageText = this.add.text(20, 18, '', { fontFamily: 'Georgia, serif', fontSize: '14px', color: '#f5dfa2', backgroundColor: '#0c1812dd', padding: { x: 12, y: 7 } });
      this.hudLayer.add(this.stageText);
    }
    const language = this.add.text(w - 20, h - 18, t(this.locale, 'language'), { fontFamily: 'Georgia, serif', fontSize: '14px', color: '#f0d899', backgroundColor: '#132219ee', padding: { x: 13, y: 8 } }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    language.on('pointerdown', (_p, _x, _y, event) => { event.stopPropagation(); this.locale = this.locale === 'ru' ? 'en' : 'ru'; saveLocale(this.locale); this.renderAll(); });
    const reset = this.add.text(18, h - 18, t(this.locale, 'reset'), { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#d8cda9', backgroundColor: '#132219cc', padding: { x: 10, y: 6 } }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    reset.on('pointerdown', (_p, _x, _y, event) => { event.stopPropagation(); this.state = resetState(); this.selectedNode = 'sprout'; this.treeOpen = false; this.activeEventCountdown = 8; this.renderAll(); });
    this.hudLayer.add([language, reset]); this.updateHudValues();
  }

  private updateHudValues(): void {
    if (this.growthText) { const income = getIncomePerSecond(this.state); const tap = getManualTapValue(this.state); this.growthText.setText(`${t(this.locale, 'growth')}  ${this.formatNumber(this.state.growth)}\n+${this.formatNumber(income)}${t(this.locale, 'per_second')}   •   ${t(this.locale, 'tap')} +${this.formatNumber(tap)}`); }
    if (this.stageText) this.stageText.setText(t(this.locale, 'stage', { value: this.state.unlocked.length }));
  }

  private pulseCentralTree(x: number, y: number, amount: number): void {
    const pulse = this.add.image(this.scale.width * 0.50, this.scale.height * 0.50, 'heart-medallion').setDisplaySize(Math.min(this.scale.width, this.scale.height) * 0.18, Math.min(this.scale.width, this.scale.height) * 0.18).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD).setDepth(950);
    const reward = this.add.text(x, y - 20, `+${this.formatNumber(amount)}`, { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#efffbc', fontStyle: 'bold', stroke: '#284318', strokeThickness: 4 }).setOrigin(0.5).setDepth(1100);
    this.tweens.add({ targets: pulse, scale: 1.28, alpha: 0, duration: 330, onComplete: () => pulse.destroy() });
    this.tweens.add({ targets: reward, y: y - 64, alpha: 0, duration: 650, onComplete: () => reward.destroy() });
  }

  private spawnActiveEvent(): void {
    if (this.treeOpen || this.state.completed) return;
    const eligible = ACTIVE_EVENTS.filter((event) => !event.requires || isUnlocked(this.state, event.requires));
    if (eligible.length === 0) return;
    const definition = Phaser.Utils.Array.GetRandom(eligible); const x = definition.x * this.scale.width; const y = definition.y * this.scale.height; const size = Math.max(60, Math.min(this.scale.width, this.scale.height) * 0.09);
    const container = this.add.container(x, y).setDepth(900);
    const medallion = this.add.image(0, 0, 'node-medallion').setDisplaySize(size, size).setTint(definition.tint).setInteractive({ useHandCursor: true });
    const icon = this.add.text(0, -2, definition.icon, { fontFamily: 'Segoe UI Emoji, Segoe UI Symbol, sans-serif', fontSize: `${size * 0.34}px`, color: '#fff5c9', stroke: '#3c230d', strokeThickness: 4 }).setOrigin(0.5);
    const tag = this.add.image(0, size * 0.72, 'hud-panel').setDisplaySize(Math.max(150, size * 2.5), 54).setAlpha(0.98);
    const tagText = this.add.text(0, size * 0.72, `${uiText(this.locale, 'event_hint')}\n${uiText(this.locale, definition.textKey)}`, { fontFamily: 'Georgia, serif', fontSize: `${Math.max(10, size * 0.15)}px`, color: '#fff0b4', align: 'center', stroke: '#2b1909', strokeThickness: 2, lineSpacing: 1 }).setOrigin(0.5);
    container.add([tag, medallion, icon, tagText]);
    const collect = (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); if (!this.activeEvent) return; const reward = collectActiveEvent(this.state); this.platform.analytics('active_event_collected', { reward, type: definition.textKey });
      this.showToast(`${uiText(this.locale, definition.textKey)}: +${this.formatNumber(reward)}`); this.pulseCentralTree(x, y, reward); this.clearActiveEvent(); this.activeEventCountdown = Phaser.Math.Between(9, 15); this.updateHudValues();
    };
    medallion.on('pointerdown', collect); tag.setInteractive({ useHandCursor: true }).on('pointerdown', collect);
    this.tweens.add({ targets: medallion, scale: 1.10, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.activeEvent = container; this.activeEventTimer = this.time.delayedCall(7500, () => { this.clearActiveEvent(); this.activeEventCountdown = Phaser.Math.Between(7, 13); });
  }

  private clearActiveEvent(): void { this.activeEventTimer?.remove(false); this.activeEventTimer = undefined; if (this.activeEvent) { this.activeEvent.destroy(true); this.activeEvent = undefined; } }
  private showToast(message: string): void { const toast = this.add.text(this.scale.width / 2, 92, message, { fontFamily: 'Georgia, serif', fontSize: '16px', color: '#fff0b4', backgroundColor: '#152119ee', padding: { x: 18, y: 10 }, stroke: '#24160b', strokeThickness: 2, wordWrap: { width: Math.max(300, this.scale.width * 0.68) }, align: 'center' }).setOrigin(0.5).setDepth(2000).setAlpha(0); this.tweens.add({ targets: toast, alpha: 1, duration: 150, hold: 1300, yoyo: true, onComplete: () => toast.destroy() }); }
  private coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void { const texture = image.texture.getSourceImage() as HTMLImageElement; const scale = Math.max(width / texture.width, height / texture.height); image.setDisplaySize(texture.width * scale, texture.height * scale); }
  private unknownLabel(): string { return this.locale === 'ru' ? 'Неизвестное открытие' : 'Unknown discovery'; }
  private mysteryLabel(): string { return this.locale === 'ru' ? 'Связь ещё не раскрыта.' : 'This connection has not been revealed yet.'; }
  private costLabel(): string { return this.locale === 'ru' ? 'Стоимость' : 'Cost'; }
  private formatNumber(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    if (value >= 100) return Math.floor(value).toString();
    if (value >= 10) return value.toFixed(1);
    return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }
}
