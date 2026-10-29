import Phaser from 'phaser';
import { DISCOVERY_NODES, NODE_BY_ID, type Branch, type DiscoveryNode, type NodeId } from './content';
import { canBuy, getNodeSplit, isRevealed, isUnlocked, type GameState } from './model';
import { nodeDescriptionKey, nodeNameKey, t, type Locale } from '../i18n';

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

export type DiscoveryTreeContext = {
  getState: () => GameState;
  getLocale: () => Locale;
  onPurchase: (node: DiscoveryNode) => void;
};

/**
 * Owns discovery-tree presentation and interaction.
 * Mouse users can cross from a node to its card through a safe corridor;
 * touch users can explicitly tap a node and tap outside to dismiss the card.
 */
export class DiscoveryTreeView {
  private popover?: Phaser.GameObjects.Container;
  private popoverHideTimer?: Phaser.Time.TimerEvent;
  private popoverSafeBounds?: Phaser.Geom.Rectangle;
  private lastAffordableSignature = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly context: DiscoveryTreeContext,
  ) {
    this.scene.input.on('pointermove', this.handlePointerMove, this);
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('gameout', this.schedulePopoverHide, this);
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('gameout', this.schedulePopoverHide, this);
    this.clear();
  }

  clear(): void {
    this.hidePopover();
    this.clearLayer();
    this.lastAffordableSignature = '';
  }

  hasPopover(): boolean {
    return Boolean(this.popover);
  }

  affordableSignature(): string {
    return DISCOVERY_NODES.filter((node) => canBuy(this.context.getState(), node.id)).map((node) => node.id).join('|');
  }

  needsAffordabilityRefresh(): boolean {
    return this.affordableSignature() !== this.lastAffordableSignature;
  }

  render(): void {
    this.hidePopover();
    this.clearLayer();

    const state = this.context.getState();
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const minSide = Math.min(w, h);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x09150f, 0.985);
    bg.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i += 1) {
      bg.lineStyle(1, i % 2 ? 0x284b38 : 0x395f46, 0.16);
      bg.lineBetween(w * (0.08 + i * 0.095), h, w * (0.44 + i * 0.025), 0);
    }
    this.layer.add(bg);

    const title = this.scene.add.text(w / 2, 16, this.localize('Дерево открытий', 'Discovery Tree'), {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(28, Math.min(46, w / 28))}px`, color: '#f0d99e', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    const help = this.scene.add.text(w / 2, 65, this.localize('Наведи или нажми на узел. Карточка остаётся активной по пути к кнопке.', 'Hover or tap a node. The card stays active while moving to its action button.'), {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(11, Math.min(14, w / 100))}px`, color: '#b8c8bb', align: 'center',
    }).setOrigin(0.5, 0);
    const progress = this.scene.add.text(14, 14, this.localize(`Этап ${state.unlocked.length}/32 • Рост ${this.formatNumber(state.growth)}`, `Stage ${state.unlocked.length}/32 • Growth ${this.formatNumber(state.growth)}`), {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#9fbea8', backgroundColor: '#102019bb', padding: { x: 7, y: 4 },
    });
    this.layer.add([title, help, progress]);

    const positions = new Map<NodeId, Phaser.Math.Vector2>();
    for (const node of DISCOVERY_NODES) {
      const [nx, ny] = NODE_POSITIONS[node.id];
      positions.set(node.id, new Phaser.Math.Vector2(nx * w, ny * h));
    }

    const links = this.scene.add.graphics();
    for (const node of DISCOVERY_NODES) {
      const child = positions.get(node.id)!;
      for (const req of node.requires) {
        const parent = positions.get(req)!;
        const unlocked = isUnlocked(state, node.id);
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
    this.layer.add(links);

    for (const node of DISCOVERY_NODES) {
      const p = positions.get(node.id)!;
      const size = node.id === 'sprout' ? Math.max(72, minSide * 0.105) : Math.max(40, minSide * 0.057);
      this.renderNode(node, p, size);
    }
    this.renderBranchLabels();
    this.lastAffordableSignature = this.affordableSignature();
  }

  private renderNode(node: DiscoveryNode, p: Phaser.Math.Vector2, size: number): void {
    const state = this.context.getState();
    const unlocked = isUnlocked(state, node.id);
    const available = this.isAvailable(node);
    const revealed = isRevealed(state, node.id);
    const affordable = canBuy(state, node.id);
    const color = unlocked ? BRANCH_COLORS[node.branch] : available ? 0xe6c36f : 0x586a5d;

    if (affordable) {
      const aura = this.scene.add.circle(p.x, p.y, size * 0.60, 0xf6d47b, 0.045).setStrokeStyle(2, 0xf7dfa2, 0.30);
      this.layer.add(aura);
      this.scene.tweens.add({ targets: aura, scale: 1.055, alpha: 0.085, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const hit = this.scene.add.circle(p.x, p.y, size * 0.46, unlocked ? 0x173424 : available ? 0x302919 : 0x121d17, unlocked ? 0.96 : available ? 0.90 : 0.72)
      .setStrokeStyle(Math.max(2, size * 0.045), color, unlocked || available ? 0.95 : 0.38)
      .setInteractive({ useHandCursor: true });
    this.layer.add(hit);

    const glyph = unlocked || available ? NODE_GLYPHS[node.id] : revealed ? '◇' : '?';
    this.layer.add(this.scene.add.text(p.x, p.y, glyph, {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(15, size * 0.38)}px`, color: unlocked ? '#f6efc8' : available ? '#f2db91' : '#91a097',
    }).setOrigin(0.5));

    if (unlocked) {
      this.layer.add(this.scene.add.text(p.x + size * 0.31, p.y - size * 0.30, '✓', {
        fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(10, size * 0.18)}px`, color: '#9fe58e', stroke: '#163521', strokeThickness: 3,
      }).setOrigin(0.5));
    } else if (available) {
      this.layer.add(this.scene.add.text(p.x, p.y + size * 0.70, this.formatNumber(node.cost), {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(9, size * 0.16)}px`, color: affordable ? '#f2df9b' : '#b8b09a', backgroundColor: '#0c1812cc', padding: { x: 5, y: 2 },
      }).setOrigin(0.5));
    }

    const openCard = () => {
      this.cancelPopoverHide();
      this.showNodePopover(node, p, size);
    };
    hit.on('pointerover', openCard);
    hit.on('pointerdown', (_pointer, _localX, _localY, event) => {
      event.stopPropagation();
      openCard();
    });
  }

  private showNodePopover(node: DiscoveryNode, p: Phaser.Math.Vector2, nodeSize: number): void {
    this.hidePopover();
    const state = this.context.getState();
    const locale = this.context.getLocale();
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const unlocked = isUnlocked(state, node.id);
    const available = this.isAvailable(node);
    const affordable = canBuy(state, node.id);
    const showDetails = unlocked || available;

    const panelW = Math.max(290, Math.min(365, w * 0.29));
    const panelH = 244;
    const toRight = p.x < w * 0.64;
    let x = toRight ? p.x + nodeSize * 0.56 + panelW / 2 : p.x - nodeSize * 0.56 - panelW / 2;
    x = Phaser.Math.Clamp(x, panelW / 2 + 12, w - panelW / 2 - 12);
    const y = Phaser.Math.Clamp(p.y, panelH / 2 + 86, h - panelH / 2 - 14);

    const nodeRadius = nodeSize * 0.54;
    const safeLeft = Math.min(x - panelW / 2 - 10, p.x - nodeRadius);
    const safeTop = Math.min(y - panelH / 2 - 10, p.y - nodeRadius);
    const safeRight = Math.max(x + panelW / 2 + 10, p.x + nodeRadius);
    const safeBottom = Math.max(y + panelH / 2 + 10, p.y + nodeRadius);
    this.popoverSafeBounds = new Phaser.Geom.Rectangle(safeLeft, safeTop, safeRight - safeLeft, safeBottom - safeTop);

    const container = this.scene.add.container(x, y);
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x102019, 0.985);
    panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    panel.lineStyle(2, available ? 0xd0ad61 : 0x5a7463, 0.9);
    panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    container.add(panel);

    const status = unlocked ? this.localize('ОТКРЫТО', 'UNLOCKED') : available ? this.localize('ДОСТУПНО', 'AVAILABLE') : this.localize('ПОКА СКРЫТО', 'LOCKED');
    container.add(this.scene.add.text(-panelW / 2 + 16, -panelH / 2 + 13, status, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: unlocked ? '#9bdd8f' : available ? '#e7c978' : '#829187', fontStyle: 'bold',
    }));

    const title = showDetails ? t(locale, nodeNameKey(node.id)) : this.localize('Неизвестное открытие', 'Unknown discovery');
    container.add(this.scene.add.text(-panelW / 2 + 16, -panelH / 2 + 38, title, {
      fontFamily: 'Georgia, serif', fontSize: '21px', color: '#f1dda6', fontStyle: 'bold', wordWrap: { width: panelW - 32 },
    }));

    const description = showDetails ? t(locale, nodeDescriptionKey(node.id)) : this.localize('Продвинься по связанным ветвям, чтобы раскрыть это открытие.', 'Advance through connected branches to reveal this discovery.');
    container.add(this.scene.add.text(-panelW / 2 + 16, -panelH / 2 + 76, description, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#d2ddd5', lineSpacing: 4, wordWrap: { width: panelW - 32 },
    }));

    if (showDetails) {
      container.add(this.scene.add.text(-panelW / 2 + 16, panelH / 2 - 78, this.nodeEffectText(node), {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#a8d6ad', wordWrap: { width: panelW - 150 },
      }));
    }

    if (!unlocked && available) {
      const buttonW = 116;
      const buttonH = 36;
      const bx = panelW / 2 - buttonW / 2 - 13;
      const by = panelH / 2 - buttonH / 2 - 12;
      const button = this.scene.add.rectangle(bx, by, buttonW, buttonH, affordable ? 0x35633d : 0x3a4038, 1)
        .setStrokeStyle(1.5, affordable ? 0xaed187 : 0x777d72, 0.95)
        .setInteractive({ useHandCursor: affordable });
      const label = affordable
        ? this.localize(`Открыть ${this.formatNumber(node.cost)}`, `Open ${this.formatNumber(node.cost)}`)
        : this.localize(`Нужно ${this.formatNumber(Math.max(0, node.cost - state.growth))}`, `Need ${this.formatNumber(Math.max(0, node.cost - state.growth))}`);
      const buttonText = this.scene.add.text(bx, by, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: affordable ? '12px' : '11px', color: affordable ? '#f2efcf' : '#b8bdb5', fontStyle: affordable ? 'bold' : 'normal',
      }).setOrigin(0.5);
      container.add([button, buttonText]);
      if (affordable) {
        button.on('pointerdown', (_p, _x, _y, event) => {
          event.stopPropagation();
          this.context.onPurchase(node);
        });
      }
    }

    this.layer.add(container);
    this.popover = container;
    this.cancelPopoverHide();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.popover || !this.popoverSafeBounds) return;
    if (Phaser.Geom.Rectangle.Contains(this.popoverSafeBounds, pointer.x, pointer.y)) {
      this.cancelPopoverHide();
      return;
    }
    this.schedulePopoverHide();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.popover || !this.popoverSafeBounds) return;
    if (!Phaser.Geom.Rectangle.Contains(this.popoverSafeBounds, pointer.x, pointer.y)) this.hidePopover();
  }

  private schedulePopoverHide(): void {
    if (!this.popover) return;
    this.popoverHideTimer?.remove(false);
    this.popoverHideTimer = this.scene.time.delayedCall(220, () => this.hidePopover());
  }

  private cancelPopoverHide(): void {
    this.popoverHideTimer?.remove(false);
    this.popoverHideTimer = undefined;
  }

  private hidePopover(): void {
    this.cancelPopoverHide();
    this.popoverSafeBounds = undefined;
    this.popover?.destroy(true);
    this.popover = undefined;
  }

  private clearLayer(): void {
    const stack: Phaser.GameObjects.GameObject[] = [...this.layer.list];
    while (stack.length > 0) {
      const object = stack.pop()!;
      this.scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) stack.push(...object.list);
    }
    this.scene.tweens.killTweensOf(this.layer);
    this.layer.removeAll(true);
  }

  private isAvailable(node: DiscoveryNode): boolean {
    const state = this.context.getState();
    return !isUnlocked(state, node.id) && node.requires.every((req) => isUnlocked(state, req));
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
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const labels: Array<[Exclude<Branch, 'synergy' | 'final'>, number, number]> = [
      ['water', 0.23, 0.16], ['plants', 0.77, 0.16], ['climate', 0.23, 0.91], ['mechanisms', 0.50, 0.97], ['life', 0.77, 0.91],
    ];
    for (const [branch, nx, ny] of labels) {
      const [ru, en] = BRANCH_LABELS[branch];
      this.layer.add(this.scene.add.text(w * nx, h * ny, this.context.getLocale() === 'ru' ? ru : en, {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(12, Math.min(16, w / 105))}px`, color: '#d4c89f', backgroundColor: '#102019aa', padding: { x: 7, y: 3 },
      }).setOrigin(0.5));
    }
  }

  private localize(ru: string, en: string): string {
    return this.context.getLocale() === 'ru' ? ru : en;
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
