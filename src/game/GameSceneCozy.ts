import Phaser from 'phaser';
import { DISCOVERY_NODES, NODE_BY_ID, type Branch, type DiscoveryNode, type NodeId } from './content';
import {
  applyOfflineProgress,
  buyNode,
  canBuy,
  canManualTap,
  collectActiveEvent,
  createInitialState,
  getIncomePerSecond,
  getManualTapValue,
  getNodeSplit,
  grantGrowth,
  isRevealed,
  isUnlocked,
  loadState,
  resetState,
  saveState,
  simulate,
  type GameState,
} from './model';
import {
  advanceGeneration,
  loadP4Meta,
  registerManualTap,
  registerWorldEvent,
  type P4MetaState,
} from './p4Meta';
import { loadLocale, nodeDescriptionKey, nodeNameKey, saveLocale, t, type Locale } from '../i18n';
import { CozyWorld, type WorldReaction } from './cozy/CozyWorld';

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
  water: 0x64c9df,
  plants: 0x6fbf6f,
  climate: 0xe3bd67,
  mechanisms: 0xc88a55,
  life: 0xe6a6a6,
  synergy: 0xc7ad77,
  final: 0xf4d78e,
};

const NODE_GLYPHS: Record<NodeId, string> = {
  sprout: '✦', pump: '◉', bed: '♣', gutters: '⌄', flowers: '✿', glass: '☀', cistern: '◍', herbs: '❧',
  gears: '⚙', mirrors: '◇', bees: '◆', irrigation: '≈', vines: '⌁', timer: '◷', vents: '≋', butterflies: '⋈',
  filter: '◈', pollination: '✣', orchid: '❀', auto_valves: '⚙', heater: '△', dragonflies: '✧', pond: '◯',
  humidity: '☁', canopy: '♠', roof_drive: '⚙', climate: '☼', birds: '⌁', ecosystem: '✺',
  central_bud: '❈', open_roof: '☀', final_bloom: '✹',
};

const BRANCH_LABELS: Record<Exclude<Branch, 'synergy' | 'final'>, [string, string]> = {
  water: ['Вода', 'Water'],
  plants: ['Растения', 'Plants'],
  climate: ['Климат', 'Climate'],
  mechanisms: ['Механизмы', 'Mechanisms'],
  life: ['Жизнь', 'Life'],
};

type EventDef = {
  requires: NodeId;
  reaction: WorldReaction;
  glyph: string;
  ru: string;
  en: string;
};

const ACTIVE_EVENTS: EventDef[] = [
  { requires: 'pump', reaction: 'water', glyph: '!', ru: 'Подтолкнуть помпу', en: 'Nudge the pump' },
  { requires: 'gutters', reaction: 'water', glyph: '!', ru: 'Направить поток', en: 'Guide the flow' },
  { requires: 'glass', reaction: 'light', glyph: '!', ru: 'Поймать солнечный луч', en: 'Catch a sunbeam' },
  { requires: 'flowers', reaction: 'petals', glyph: '!', ru: 'Помочь цветам', en: 'Help the flowers' },
  { requires: 'bees', reaction: 'life', glyph: '!', ru: 'Помочь опылению', en: 'Help pollination' },
];

export class GameSceneCozy extends Phaser.Scene {
  private state!: GameState;
  private meta: P4MetaState = loadP4Meta();
  private locale: Locale = 'en';

  private worldLayer!: Phaser.GameObjects.Container;
  private treeLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private world!: CozyWorld;

  private treeOpen = false;
  private uiAccumulator = 0;
  private saveAccumulator = 0;
  private eventCountdown = 6;
  private activeEvent?: Phaser.GameObjects.Container;
  private activeEventTimer?: Phaser.Time.TimerEvent;
  private popover?: Phaser.GameObjects.Container;
  private popoverHideTimer?: Phaser.Time.TimerEvent;
  private toast?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;

  private growthText?: Phaser.GameObjects.Text;
  private rateText?: Phaser.GameObjects.Text;
  private stageText?: Phaser.GameObjects.Text;
  private menuLabel?: Phaser.GameObjects.Text;
  private menuAura?: Phaser.GameObjects.Arc;
  private lastAffordableSignature = '';
  private readonly devMode = new URLSearchParams(window.location.search).get('dev') === '1';

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.state = loadState();
    this.meta = loadP4Meta();
    this.locale = loadLocale();
    const offline = applyOfflineProgress(this.state);

    this.worldLayer = this.add.container(0, 0).setDepth(0);
    this.treeLayer = this.add.container(0, 0).setDepth(500).setVisible(false);
    this.hudLayer = this.add.container(0, 0).setDepth(1000);
    this.world = new CozyWorld(this, this.worldLayer);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleWorldTap(pointer));
    this.scale.on('resize', () => this.renderAll(true));
    this.installDevShortcuts();

    this.renderAll(true);
    if (offline > 0.5) this.showToast(this.localize(`Пока тебя не было: +${this.formatNumber(offline)}`, `While away: +${this.formatNumber(offline)}`));
  }

  update(_time: number, delta: number): void {
    const seconds = Math.min(delta / 1000, 0.25);
    simulate(this.state, seconds);
    if (!this.treeOpen) this.world.update(seconds);

    this.uiAccumulator += seconds;
    this.saveAccumulator += seconds;

    if (!this.treeOpen && !this.state.completed && isUnlocked(this.state, 'pump')) {
      this.eventCountdown -= seconds;
      if (this.eventCountdown <= 0 && !this.activeEvent) this.spawnActiveEvent();
    }

    if (this.uiAccumulator >= 0.2) {
      this.uiAccumulator = 0;
      this.updateHudValues();
      const affordable = this.affordableNodeIds().join('|');
      if (this.treeOpen && affordable !== this.lastAffordableSignature) {
        this.lastAffordableSignature = affordable;
        this.renderTree();
      }
    }

    if (this.saveAccumulator >= 3) {
      this.saveAccumulator = 0;
      saveState(this.state);
    }
  }

  private renderAll(forceWorld = false): void {
    this.clearActiveEvent();
    this.hidePopover();
    this.treeLayer.removeAll(true);
    this.hudLayer.removeAll(true);
    this.meta = loadP4Meta();
    this.world.sync(this.state, this.meta, forceWorld);
    this.renderTree();
    this.renderHud();
    this.worldLayer.setVisible(!this.treeOpen);
    this.treeLayer.setVisible(this.treeOpen);
    if (this.state.completed) this.renderGenerationEnding();
  }

  private handleWorldTap(pointer: Phaser.Input.Pointer): void {
    if (this.treeOpen || this.state.completed || !canManualTap(this.state)) return;
    if (!this.world.treeHitTest(pointer.x, pointer.y)) return;

    const amount = getManualTapValue(this.state);
    grantGrowth(this.state, amount);
    this.meta = registerManualTap(amount);
    this.world.reactTap(pointer.x, pointer.y);
    this.world.sync(this.state, this.meta);
    this.updateHudValues();
  }

  private renderHud(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const compact = w < 760;
    const panelW = compact ? Math.min(310, w * 0.58) : Math.min(360, w * 0.30);
    const panelH = compact ? 92 : 108;

    const panel = this.add.graphics();
    panel.fillStyle(0x13251d, 0.90);
    panel.fillRoundedRect(10, 10, panelW, panelH, 14);
    panel.lineStyle(2, 0xc7a96c, 0.75);
    panel.strokeRoundedRect(10, 10, panelW, panelH, 14);
    this.hudLayer.add(panel);

    this.growthText = this.add.text(28, 25, '', {
      fontFamily: 'Georgia, serif', fontSize: compact ? '18px' : '21px', color: '#f3dfac', fontStyle: 'bold',
    });
    this.rateText = this.add.text(28, compact ? 57 : 62, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: compact ? '13px' : '15px', color: '#d8ead5',
    });
    this.stageText = this.add.text(28, compact ? 78 : 87, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: compact ? '10px' : '12px', color: '#91bca0',
    });
    this.hudLayer.add([this.growthText, this.rateText, this.stageText]);

    const affordable = this.affordableNodeIds().length;
    const menuW = compact ? 160 : 220;
    const menuH = 54;
    const menuX = w - menuW - 12;
    const menuY = 12;
    if (affordable > 0) {
      this.menuAura = this.add.circle(menuX + menuW / 2, menuY + menuH / 2, menuH * 0.72, 0xf2d483, 0.045)
        .setStrokeStyle(2, 0xffe49c, 0.34);
      this.hudLayer.add(this.menuAura);
      this.tweens.add({ targets: this.menuAura, alpha: 0.10, scale: 1.06, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    const menu = this.add.rectangle(menuX + menuW / 2, menuY + menuH / 2, menuW, menuH, 0x14261e, 0.92)
      .setStrokeStyle(2, 0xc8a866, 0.78)
      .setInteractive({ useHandCursor: true });
    this.menuLabel = this.add.text(menu.x, menu.y, '', {
      fontFamily: 'Georgia, serif', fontSize: compact ? '14px' : '17px', color: '#f2deaa', fontStyle: 'bold',
    }).setOrigin(0.5);
    menu.on('pointerdown', (_p, _x, _y, event) => {
      event.stopPropagation();
      this.treeOpen = !this.treeOpen;
      this.clearActiveEvent();
      this.renderAll(false);
    });
    this.hudLayer.add([menu, this.menuLabel]);

    const reset = this.add.text(14, h - 12, this.localize('Сбросить прогресс', 'Reset progress'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#9db49f', backgroundColor: '#102018dd', padding: { x: 8, y: 5 },
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    reset.on('pointerdown', (_p, _x, _y, event) => {
      event.stopPropagation();
      resetState();
      this.scene.restart();
    });

    const lang = this.add.text(w - 14, h - 12, this.locale === 'ru' ? 'EN' : 'RU', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f1dda8', backgroundColor: '#102018dd', padding: { x: 8, y: 5 },
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    lang.on('pointerdown', (_p, _x, _y, event) => {
      event.stopPropagation();
      this.locale = this.locale === 'ru' ? 'en' : 'ru';
      saveLocale(this.locale);
      this.renderAll(false);
    });
    this.hudLayer.add([reset, lang]);

    if (this.devMode) this.renderDevPanel();
    this.updateHudValues();
  }

  private updateHudValues(): void {
    if (!this.growthText || !this.rateText || !this.stageText || !this.menuLabel) return;
    const passive = getIncomePerSecond(this.state);
    const tap = getManualTapValue(this.state);
    const affordable = this.affordableNodeIds().length;
    this.growthText.setText(this.localize(`Рост ${this.formatNumber(this.state.growth)}`, `Growth ${this.formatNumber(this.state.growth)}`));
    this.rateText.setText(this.localize(`Пассив +${this.formatNumber(passive)}/с  •  Тап +${this.formatNumber(tap)}`, `Passive +${this.formatNumber(passive)}/s  •  Tap +${this.formatNumber(tap)}`));
    this.stageText.setText(this.localize(`Этап ${this.state.unlocked.length}/32  •  Поколение ${this.meta.generation}`, `Stage ${this.state.unlocked.length}/32  •  Generation ${this.meta.generation}`));
    this.menuLabel.setText(this.treeOpen
      ? this.localize('← В оранжерею', '← Greenhouse')
      : `${this.localize('✦ Открытия', '✦ Discoveries')}${affordable ? ` (${affordable})` : ''}`);
  }

  private renderTree(): void {
    this.treeLayer.removeAll(true);
    if (!this.treeOpen) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const minSide = Math.min(w, h);

    const bg = this.add.graphics();
    bg.fillStyle(0x09150f, 0.985);
    bg.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i += 1) {
      bg.lineStyle(1, i % 2 ? 0x284b38 : 0x395f46, 0.16);
      bg.lineBetween(w * (0.08 + i * 0.095), h, w * (0.44 + i * 0.025), 0);
    }
    this.treeLayer.add(bg);

    const title = this.add.text(w / 2, 16, this.localize('Дерево открытий', 'Discovery Tree'), {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(28, Math.min(46, w / 28))}px`, color: '#f0d99e', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    const help = this.add.text(w / 2, 65, this.localize('Наведи на узел. Доступные сейчас открытия показывают эффект до покупки.', 'Hover a node. Available discoveries reveal their effect before purchase.'), {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(11, Math.min(14, w / 100))}px`, color: '#b8c8bb', align: 'center',
    }).setOrigin(0.5, 0);
    const progress = this.add.text(14, 14, this.localize(`Этап ${this.state.unlocked.length}/32 • Рост ${this.formatNumber(this.state.growth)}`, `Stage ${this.state.unlocked.length}/32 • Growth ${this.formatNumber(this.state.growth)}`), {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#9fbea8', backgroundColor: '#102019bb', padding: { x: 7, y: 4 },
    });
    this.treeLayer.add([title, help, progress]);

    const positions = new Map<NodeId, Phaser.Math.Vector2>();
    for (const node of DISCOVERY_NODES) {
      const [nx, ny] = NODE_POSITIONS[node.id];
      positions.set(node.id, new Phaser.Math.Vector2(nx * w, ny * h));
    }

    const links = this.add.graphics();
    for (const node of DISCOVERY_NODES) {
      const child = positions.get(node.id)!;
      for (const req of node.requires) {
        const parent = positions.get(req)!;
        const unlocked = isUnlocked(this.state, node.id);
        const available = this.isAvailable(node);
        const sameBranch = NODE_BY_ID[req].branch === node.branch;
        links.lineStyle(sameBranch ? 2.5 : 1.4, BRANCH_COLORS[node.branch], unlocked ? 0.82 : available ? 0.48 : 0.12);
        links.beginPath();
        links.moveTo(parent.x, parent.y);
        if (!sameBranch) {
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
      const size = node.id === 'sprout' ? Math.max(72, minSide * 0.105) : Math.max(40, minSide * 0.057);
      this.renderNode(node, p, size);
    }
    this.renderBranchLabels();
    this.lastAffordableSignature = this.affordableNodeIds().join('|');
  }

  private renderNode(node: DiscoveryNode, p: Phaser.Math.Vector2, size: number): void {
    const unlocked = isUnlocked(this.state, node.id);
    const available = this.isAvailable(node);
    const revealed = isRevealed(this.state, node.id);
    const affordable = canBuy(this.state, node.id);
    const color = unlocked ? BRANCH_COLORS[node.branch] : available ? 0xe6c36f : 0x586a5d;

    if (affordable) {
      const aura = this.add.circle(p.x, p.y, size * 0.60, 0xf6d47b, 0.045).setStrokeStyle(2, 0xf7dfa2, 0.30);
      this.treeLayer.add(aura);
      this.tweens.add({ targets: aura, scale: 1.055, alpha: 0.085, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const hit = this.add.circle(p.x, p.y, size * 0.46, unlocked ? 0x173424 : available ? 0x302919 : 0x121d17, unlocked ? 0.96 : available ? 0.90 : 0.72)
      .setStrokeStyle(Math.max(2, size * 0.045), color, unlocked || available ? 0.95 : 0.38)
      .setInteractive({ useHandCursor: true });
    this.treeLayer.add(hit);

    const glyph = unlocked || available ? NODE_GLYPHS[node.id] : revealed ? '◇' : '?';
    const glyphText = this.add.text(p.x, p.y, glyph, {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(15, size * 0.38)}px`,
      color: unlocked ? '#f6efc8' : available ? '#f2db91' : '#91a097',
    }).setOrigin(0.5);
    this.treeLayer.add(glyphText);

    if (unlocked) {
      this.treeLayer.add(this.add.text(p.x + size * 0.31, p.y - size * 0.30, '✓', {
        fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(10, size * 0.18)}px`, color: '#9fe58e', stroke: '#163521', strokeThickness: 3,
      }).setOrigin(0.5));
    } else if (available) {
      this.treeLayer.add(this.add.text(p.x, p.y + size * 0.70, this.formatNumber(node.cost), {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(9, size * 0.16)}px`, color: affordable ? '#f2df9b' : '#b8b09a', backgroundColor: '#0c1812cc', padding: { x: 5, y: 2 },
      }).setOrigin(0.5));
    }

    hit.on('pointerover', () => {
      this.cancelPopoverHide();
      this.showNodePopover(node, p, size);
    });
    hit.on('pointerout', () => this.schedulePopoverHide());
  }

  private showNodePopover(node: DiscoveryNode, p: Phaser.Math.Vector2, nodeSize: number): void {
    this.hidePopover();
    const w = this.scale.width;
    const h = this.scale.height;
    const unlocked = isUnlocked(this.state, node.id);
    const available = this.isAvailable(node);
    const affordable = canBuy(this.state, node.id);
    const showDetails = unlocked || available;

    const panelW = Math.max(290, Math.min(365, w * 0.29));
    const panelH = 244;
    const toRight = p.x < w * 0.64;
    let x = toRight ? p.x + nodeSize * 0.72 + panelW / 2 : p.x - nodeSize * 0.72 - panelW / 2;
    x = Phaser.Math.Clamp(x, panelW / 2 + 12, w - panelW / 2 - 12);
    const y = Phaser.Math.Clamp(p.y, panelH / 2 + 86, h - panelH / 2 - 14);

    const container = this.add.container(x, y).setDepth(1500);
    const panel = this.add.graphics();
    panel.fillStyle(0x102019, 0.985);
    panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    panel.lineStyle(2, available ? 0xd0ad61 : 0x5a7463, 0.9);
    panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    container.add(panel);

    const status = unlocked
      ? this.localize('ОТКРЫТО', 'UNLOCKED')
      : available
        ? this.localize('ДОСТУПНО', 'AVAILABLE')
        : this.localize('ПОКА СКРЫТО', 'LOCKED');
    container.add(this.add.text(-panelW / 2 + 16, -panelH / 2 + 13, status, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: unlocked ? '#9bdd8f' : available ? '#e7c978' : '#829187', fontStyle: 'bold',
    }));

    const title = showDetails ? t(this.locale, nodeNameKey(node.id)) : this.localize('Неизвестное открытие', 'Unknown discovery');
    container.add(this.add.text(-panelW / 2 + 16, -panelH / 2 + 38, title, {
      fontFamily: 'Georgia, serif', fontSize: '21px', color: '#f1dda6', fontStyle: 'bold', wordWrap: { width: panelW - 32 },
    }));

    const description = showDetails
      ? t(this.locale, nodeDescriptionKey(node.id))
      : this.localize('Продвинься по связанным ветвям, чтобы раскрыть это открытие.', 'Advance through connected branches to reveal this discovery.');
    container.add(this.add.text(-panelW / 2 + 16, -panelH / 2 + 76, description, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#d2ddd5', lineSpacing: 4, wordWrap: { width: panelW - 32 },
    }));

    if (showDetails) {
      container.add(this.add.text(-panelW / 2 + 16, panelH / 2 - 78, this.nodeEffectText(node), {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#a8d6ad', wordWrap: { width: panelW - 150 },
      }));
    }

    if (!unlocked && available) {
      const buttonW = 116;
      const buttonH = 36;
      const bx = panelW / 2 - buttonW / 2 - 13;
      const by = panelH / 2 - buttonH / 2 - 12;
      const button = this.add.rectangle(bx, by, buttonW, buttonH, affordable ? 0x35633d : 0x3a4038, 1)
        .setStrokeStyle(1.5, affordable ? 0xaed187 : 0x777d72, 0.95)
        .setInteractive({ useHandCursor: affordable });
      const label = affordable
        ? this.localize(`Открыть ${this.formatNumber(node.cost)}`, `Open ${this.formatNumber(node.cost)}`)
        : this.localize(`Нужно ${this.formatNumber(Math.max(0, node.cost - this.state.growth))}`, `Need ${this.formatNumber(Math.max(0, node.cost - this.state.growth))}`);
      const buttonText = this.add.text(bx, by, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: affordable ? '12px' : '11px', color: affordable ? '#f2efcf' : '#b8bdb5', fontStyle: affordable ? 'bold' : 'normal',
      }).setOrigin(0.5);
      container.add([button, buttonText]);
      if (affordable) {
        button.on('pointerdown', (_p, _x, _y, event) => {
          event.stopPropagation();
          if (!buyNode(this.state, node.id)) return;
          saveState(this.state);
          this.showToast(this.localize(`Открыто: ${t(this.locale, nodeNameKey(node.id))}`, `Unlocked: ${t(this.locale, nodeNameKey(node.id))}`));
          this.world.sync(this.state, this.meta, true);
          this.renderAll(true);
        });
      }
    }

    const hover = this.add.rectangle(0, 0, panelW, panelH, 0xffffff, 0.001).setInteractive();
    hover.on('pointerover', () => this.cancelPopoverHide());
    hover.on('pointerout', () => this.schedulePopoverHide());
    container.add(hover);
    hover.sendToBack();

    this.treeLayer.add(container);
    this.popover = container;
  }

  private nodeEffectText(node: DiscoveryNode): string {
    const split = getNodeSplit(node);
    const parts: string[] = [];
    if (split.passivePerSecond > 0.001) parts.push(this.localize(`Пассив +${this.formatNumber(split.passivePerSecond)}/с`, `Passive +${this.formatNumber(split.passivePerSecond)}/s`));
    if (split.tapPerTap > 0.001) parts.push(this.localize(`Тап +${this.formatNumber(split.tapPerTap)}`, `Tap +${this.formatNumber(split.tapPerTap)}`));
    if (node.multiplier && node.multiplier > 1) parts.push(this.localize(`Всё производство ×${node.multiplier.toFixed(2)}`, `All production ×${node.multiplier.toFixed(2)}`));
    if (node.final) parts.push(this.localize('Завершает текущее дерево', 'Completes the current tree'));
    return parts.join('  •  ') || this.localize('Открывает новое состояние оранжереи', 'Unlocks a new greenhouse state');
  }

  private renderBranchLabels(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const labels: Array<[Exclude<Branch, 'synergy' | 'final'>, number, number]> = [
      ['water', 0.23, 0.16], ['plants', 0.77, 0.16], ['climate', 0.23, 0.91], ['mechanisms', 0.50, 0.97], ['life', 0.77, 0.91],
    ];
    for (const [branch, nx, ny] of labels) {
      const [ru, en] = BRANCH_LABELS[branch];
      this.treeLayer.add(this.add.text(w * nx, h * ny, this.locale === 'ru' ? ru : en, {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(12, Math.min(16, w / 105))}px`, color: '#d4c89f', backgroundColor: '#102019aa', padding: { x: 7, y: 3 },
      }).setOrigin(0.5));
    }
  }

  private spawnActiveEvent(): void {
    const eligible = ACTIVE_EVENTS.filter((event) => isUnlocked(this.state, event.requires));
    if (eligible.length === 0 || this.treeOpen || this.state.completed) {
      this.eventCountdown = 5;
      return;
    }
    const def = eligible[Math.floor(Math.random() * eligible.length)];
    const anchor = this.world.eventAnchor(def.reaction);
    const container = this.add.container(anchor.x, anchor.y).setDepth(800).setSize(150, 90).setInteractive({ useHandCursor: true });
    const aura = this.add.circle(0, 0, 36, 0xf5d985, 0.08).setStrokeStyle(3, 0xffe59d, 0.8);
    const core = this.add.circle(0, 0, 25, 0x173126, 0.96).setStrokeStyle(2, 0xf2d58a, 0.95);
    const glyph = this.add.text(0, -2, def.glyph, { fontFamily: 'Georgia, serif', fontSize: '23px', color: '#ffe9aa', fontStyle: 'bold' }).setOrigin(0.5);
    const label = this.add.text(0, 39, this.locale === 'ru' ? def.ru : def.en, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#f2e7c4', backgroundColor: '#0d1c15e8', padding: { x: 7, y: 4 },
    }).setOrigin(0.5);
    container.add([aura, core, glyph, label]);
    this.worldLayer.add(container);
    this.tweens.add({ targets: aura, scale: 1.18, alpha: 0.16, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    container.on('pointerdown', (_p, _x, _y, event) => {
      event.stopPropagation();
      const reward = collectActiveEvent(this.state);
      this.meta = registerWorldEvent();
      this.world.reactEvent(def.reaction);
      this.world.sync(this.state, this.meta);
      this.showToast(`+${this.formatNumber(reward)}`);
      saveState(this.state);
      this.clearActiveEvent();
      this.eventCountdown = 5 + Math.random() * 5;
      this.updateHudValues();
    });

    this.activeEvent = container;
    this.activeEventTimer = this.time.delayedCall(8500, () => {
      this.clearActiveEvent();
      this.eventCountdown = 4 + Math.random() * 5;
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

  private renderGenerationEnding(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const finalGeneration = this.meta.generation >= 3;
    const panelW = Math.min(620, w * 0.62);
    const panelH = 270;
    const panel = this.add.graphics().setDepth(1900);
    panel.fillStyle(0x0b1b14, 0.97);
    panel.fillRoundedRect(w / 2 - panelW / 2, h * 0.50 - panelH / 2, panelW, panelH, 18);
    panel.lineStyle(2, 0xd2b66d, 0.92);
    panel.strokeRoundedRect(w / 2 - panelW / 2, h * 0.50 - panelH / 2, panelW, panelH, 18);
    this.hudLayer.add(panel);

    const title = this.add.text(w / 2, h * 0.42, finalGeneration ? this.localize('Оранжерея завершена', 'The greenhouse is complete') : this.localize('Дерево расцвело', 'The tree has bloomed'), {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(25, w / 50)}px`, color: '#f3dda0', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1901);
    const bodyText = finalGeneration
      ? this.localize('Три поколения превратили оранжерею в живую экосистему. Это настоящий финал текущей кампании.', 'Three generations turned the greenhouse into a living ecosystem. This is the true ending of the current campaign.')
      : this.meta.generation === 1
        ? this.localize('Следующее дерево начнёт с уже работающими базовыми системами. В оранжерее появится садовник.', 'The next tree starts with basic systems already running. A gardener joins the greenhouse.')
        : this.localize('Следующее поколение сохранит садовника и получит постоянную воду и автоматизацию.', 'The next generation keeps the gardener and gains permanent water and automation.');
    const body = this.add.text(w / 2, h * 0.51, bodyText, {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(13, w / 96)}px`, color: '#d7e0d6', align: 'center', wordWrap: { width: panelW * 0.82 },
    }).setOrigin(0.5).setDepth(1901);
    this.hudLayer.add([title, body]);

    if (!finalGeneration) {
      const button = this.add.rectangle(w / 2, h * 0.62, Math.min(300, panelW * 0.58), 48, 0x35633d, 1)
        .setStrokeStyle(2, 0xa8ce83, 1)
        .setInteractive({ useHandCursor: true })
        .setDepth(1902);
      const label = this.add.text(w / 2, h * 0.62, this.localize('Вырастить новое дерево', 'Grow a new tree'), {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#f4ebc7', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1903);
      button.on('pointerdown', (_p, _x, _y, event) => {
        event.stopPropagation();
        this.startNextGeneration();
      });
      this.hudLayer.add([button, label]);
    }
  }

  private startNextGeneration(): void {
    const result = advanceGeneration();
    if (!result.advanced) return;
    const fresh = createInitialState();
    if (result.meta.generation === 2) fresh.unlocked = ['sprout', 'pump', 'bed'];
    else fresh.unlocked = ['sprout', 'pump', 'bed', 'gutters', 'flowers', 'glass', 'gears'];
    grantGrowth(fresh, result.startingGrowth);
    saveState(fresh);
    this.state = fresh;
    this.meta = result.meta;
    this.treeOpen = false;
    this.eventCountdown = 4;
    this.renderAll(true);
  }

  private installDevShortcuts(): void {
    if (!this.devMode || !this.input.keyboard) return;
    this.input.keyboard.on('keydown-F8', (event: KeyboardEvent) => { event.preventDefault(); this.devReset(); });
    this.input.keyboard.on('keydown-F9', (event: KeyboardEvent) => { event.preventDefault(); this.devGrant(); });
    this.input.keyboard.on('keydown-F10', (event: KeyboardEvent) => { event.preventDefault(); this.devFinish(); });
  }

  private renderDevPanel(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const items: Array<[string, () => void]> = [
      ['RESET', () => this.devReset()], ['+1B', () => this.devGrant()], ['FINISH', () => this.devFinish()],
    ];
    const startX = w / 2 - 118;
    this.hudLayer.add(this.add.text(startX - 58, h - 11, 'COZY DEV', {
      fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#d7c485', backgroundColor: '#16261ddd', padding: { x: 6, y: 5 },
    }).setOrigin(0, 1));
    items.forEach(([label, fn], i) => {
      const x = startX + i * 82;
      const button = this.add.rectangle(x, h - 22, 72, 28, 0x20382b, 0.96).setStrokeStyle(1, 0x8dab7b, 0.8).setInteractive({ useHandCursor: true });
      const text = this.add.text(x, h - 22, label, { fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#e6e0bd' }).setOrigin(0.5);
      button.on('pointerdown', (_p, _x, _y, event) => { event.stopPropagation(); fn(); });
      this.hudLayer.add([button, text]);
    });
  }

  private devReset(): void {
    resetState();
    this.scene.restart();
  }

  private devGrant(): void {
    grantGrowth(this.state, 1_000_000_000);
    saveState(this.state);
    this.updateHudValues();
    if (this.treeOpen) this.renderTree();
  }

  private devFinish(): void {
    this.state.unlocked = DISCOVERY_NODES.map((node) => node.id);
    this.state.completed = true;
    grantGrowth(this.state, 1_000_000_000);
    saveState(this.state);
    this.treeOpen = false;
    this.renderAll(true);
  }

  private affordableNodeIds(): NodeId[] {
    return DISCOVERY_NODES.filter((node) => canBuy(this.state, node.id)).map((node) => node.id);
  }

  private isAvailable(node: DiscoveryNode): boolean {
    return !isUnlocked(this.state, node.id) && node.requires.every((req) => isUnlocked(this.state, req));
  }

  private schedulePopoverHide(): void {
    this.popoverHideTimer?.remove(false);
    this.popoverHideTimer = this.time.delayedCall(120, () => this.hidePopover());
  }

  private cancelPopoverHide(): void {
    this.popoverHideTimer?.remove(false);
    this.popoverHideTimer = undefined;
  }

  private hidePopover(): void {
    this.cancelPopoverHide();
    if (!this.popover) return;
    this.popover.destroy(true);
    this.popover = undefined;
  }

  private showToast(message: string): void {
    this.toastTimer?.remove(false);
    this.toast?.destroy();
    const w = this.scale.width;
    this.toast = this.add.text(w / 2, 118, message, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#f2e9c9', backgroundColor: '#102018ee', padding: { x: 12, y: 7 },
    }).setOrigin(0.5).setDepth(2200);
    this.toastTimer = this.time.delayedCall(1800, () => {
      this.toast?.destroy();
      this.toast = undefined;
      this.toastTimer = undefined;
    });
  }

  private localize(ru: string, en: string): string {
    return this.locale === 'ru' ? ru : en;
  }

  private formatNumber(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 1 : 2)}K`;
    if (abs >= 100) return value.toFixed(0);
    if (abs >= 10) return value.toFixed(1).replace(/\.0$/, '');
    return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }
}