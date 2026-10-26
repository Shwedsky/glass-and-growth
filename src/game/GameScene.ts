import Phaser from 'phaser';
import { BRANCH_X, DISCOVERY_NODES, NODE_BY_ID, type Branch, type NodeId } from './content';
import {
  applyOfflineProgress,
  buyNode,
  canManualTap,
  collectActiveEvent,
  getIncomePerSecond,
  getManualTapValue,
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
import {
  loadLocale,
  nodeDescriptionKey,
  nodeNameKey,
  saveLocale,
  t,
  type Locale,
} from '../i18n';

const TREE_STAGE_HEIGHT = 138;
const TREE_TOP = 220;
const TREE_CONTENT_HEIGHT = TREE_TOP + TREE_STAGE_HEIGHT * 13 + 170;
const MAIN_BRANCHES: Branch[] = ['water', 'plants', 'climate', 'mechanisms', 'life'];

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private readonly platform = new BrowserPlatformAdapter();
  private locale: Locale = 'en';

  private worldLayer!: Phaser.GameObjects.Container;
  private treeLayer!: Phaser.GameObjects.Container;
  private treeContentLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private hudText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private treeButton!: Phaser.GameObjects.Text;
  private languageButton!: Phaser.GameObjects.Text;
  private resetButton!: Phaser.GameObjects.Text;

  private treeOpen = false;
  private treeScroll = 0;
  private draggingTree = false;
  private treeDragMoved = false;
  private treeDragLastY = 0;
  private uiAccumulator = 0;
  private lastSaveAt = 0;
  private activeEventCountdown = 8;
  private activeEvent?: Phaser.GameObjects.Container;
  private activeEventTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.state = loadState();
    this.locale = loadLocale();
    const offline = applyOfflineProgress(this.state);
    this.cameras.main.setBackgroundColor('#101814');

    this.worldLayer = this.add.container(0, 0);
    this.treeLayer = this.add.container(0, 0).setVisible(false);
    this.treeContentLayer = this.add.container(0, 0);
    this.treeLayer.add(this.treeContentLayer);
    this.hudLayer = this.add.container(0, 0).setDepth(1000);

    this.createHud();
    this.bindInput();
    this.renderAll();

    if (offline > 0.5) this.showToast(t(this.locale, 'offline', { value: this.formatNumber(offline) }));
  }

  update(_time: number, delta: number): void {
    const seconds = Math.min(delta / 1000, 0.25);
    simulate(this.state, seconds);
    this.uiAccumulator += seconds;
    this.lastSaveAt += seconds;

    if (isUnlocked(this.state, 'pump') && !this.state.completed && !this.treeOpen) {
      this.activeEventCountdown -= seconds;
      if (this.activeEventCountdown <= 0 && !this.activeEvent) this.spawnActiveEvent();
    }

    if (this.uiAccumulator >= 0.20) {
      this.uiAccumulator = 0;
      this.updateHud();
    }

    if (this.lastSaveAt >= 3) {
      this.lastSaveAt = 0;
      saveState(this.state);
    }
  }

  private bindInput(): void {
    this.scale.on('resize', () => this.renderAll());

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      if (!this.treeOpen) return;
      this.setTreeScroll(this.treeScroll - dy * 0.8);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.treeOpen) {
        if (pointer.y > 145) {
          this.draggingTree = true;
          this.treeDragMoved = false;
          this.treeDragLastY = pointer.y;
        }
        return;
      }

      if (pointer.y < 92 || pointer.y > this.scale.height - 60 || !canManualTap(this.state)) return;
      const amount = getManualTapValue(this.state);
      grantGrowth(this.state, amount);
      this.spawnTapFeedback(pointer.x, pointer.y, amount);
      this.platform.analytics('manual_tap', { amount });
      this.updateHud();
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.treeOpen || !this.draggingTree || !pointer.isDown) return;
      const deltaY = pointer.y - this.treeDragLastY;
      if (Math.abs(deltaY) > 1) this.treeDragMoved = true;
      this.treeDragLastY = pointer.y;
      this.setTreeScroll(this.treeScroll + deltaY);
    });

    this.input.on('pointerup', () => {
      this.draggingTree = false;
      this.time.delayedCall(0, () => { this.treeDragMoved = false; });
    });
  }

  private createHud(): void {
    const common = { fontFamily: 'system-ui, sans-serif' };
    this.hudText = this.add.text(20, 18, '', { ...common, fontSize: '20px', color: '#eff8f2', fontStyle: '600' });
    this.stageText = this.add.text(20, 50, '', { ...common, fontSize: '13px', color: '#91a69b' });
    this.treeButton = this.add.text(0, 18, '', {
      ...common, fontSize: '17px', color: '#f1e7bd', backgroundColor: '#2c4738', padding: { x: 13, y: 8 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.languageButton = this.add.text(0, 0, '', {
      ...common, fontSize: '13px', color: '#d9e4dc', backgroundColor: '#24372e', padding: { x: 10, y: 6 },
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    this.resetButton = this.add.text(20, 0, '', { ...common, fontSize: '13px', color: '#83958b' })
      .setOrigin(0, 1).setInteractive({ useHandCursor: true });
    this.hintText = this.add.text(0, 0, '', { ...common, fontSize: '14px', color: '#aebdb5', align: 'center' })
      .setOrigin(0.5, 1);

    this.treeButton.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.treeOpen = !this.treeOpen;
      this.clearActiveEvent();
      this.worldLayer.setVisible(!this.treeOpen);
      this.treeLayer.setVisible(this.treeOpen);
      this.updateHud();
    });

    this.languageButton.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.locale = this.locale === 'ru' ? 'en' : 'ru';
      saveLocale(this.locale);
      this.renderAll();
    });

    this.resetButton.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.state = resetState();
      this.treeOpen = false;
      this.treeScroll = 0;
      this.clearActiveEvent();
      this.activeEventCountdown = 8;
      this.renderAll();
    });

    this.hudLayer.add([this.hudText, this.stageText, this.treeButton, this.languageButton, this.resetButton, this.hintText]);
  }

  private renderAll(): void {
    this.tweens.killTweensOf(this.worldLayer.getAll());
    this.worldLayer.removeAll(true);
    this.treeContentLayer.removeAll(true);
    this.renderWorld();
    this.renderTree();
    this.worldLayer.setVisible(!this.treeOpen);
    this.treeLayer.setVisible(this.treeOpen);
    this.setTreeScroll(this.treeScroll);
    this.updateHud();
  }

  private updateHud(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const income = getIncomePerSecond(this.state);
    const tapValue = getManualTapValue(this.state);

    this.hudText.setText(
      `${t(this.locale, 'growth')}  ${this.formatNumber(this.state.growth)}   •   +${this.formatNumber(income)}${t(this.locale, 'per_second')}   •   ${t(this.locale, 'tap')} +${this.formatNumber(tapValue)}`,
    );
    this.hudText.setFontSize(Math.max(14, Math.min(21, w / 52)));
    this.stageText.setText(t(this.locale, 'stage', { value: this.state.unlocked.length }));

    this.treeButton.setText(this.treeOpen ? t(this.locale, 'back') : t(this.locale, 'discoveries')).setPosition(w - 20, 18);
    this.languageButton.setText(t(this.locale, 'language')).setPosition(w - 20, h - 14);
    this.resetButton.setText(t(this.locale, 'reset')).setPosition(20, h - 14);

    const status = this.state.completed
      ? t(this.locale, 'status_complete')
      : this.treeOpen
        ? t(this.locale, 'status_tree')
        : this.state.unlocked.length === 0
          ? t(this.locale, 'status_bootstrap')
          : t(this.locale, 'status_world');
    this.hintText.setText(status).setPosition(w / 2, h - 14).setWordWrapWidth(Math.max(260, w * 0.58));
  }

  private renderWorld(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const top = 92;
    const bottom = h - 62;
    const cx = w / 2;
    const innerW = Math.min(w * 0.90, 1080);
    const left = cx - innerW / 2;
    const roofY = top + 48;
    const progress = this.state.unlocked.length / DISCOVERY_NODES.length;

    const bgColor = progress > 0.70 ? 0x294331 : progress > 0.35 ? 0x213529 : 0x1b2821;
    this.worldLayer.add(
      this.add.rectangle(cx, (top + bottom) / 2, innerW, bottom - top, bgColor)
        .setStrokeStyle(3, 0x8fa99b, 0.35),
    );

    const frame = this.add.graphics();
    frame.lineStyle(4, isUnlocked(this.state, 'glass') ? 0xb8cec2 : 0x74867d, 0.75);
    frame.beginPath();
    frame.moveTo(left + 28, roofY + 55);
    frame.lineTo(cx - 115, roofY - 22);
    frame.lineTo(cx + 115, roofY - 22);
    frame.lineTo(left + innerW - 28, roofY + 55);
    frame.strokePath();
    for (let i = 1; i < 8; i++) {
      const x = left + (innerW / 8) * i;
      frame.lineBetween(x, roofY + 44, x, bottom - 18);
    }
    this.worldLayer.add(frame);
    this.worldLayer.add(this.add.rectangle(cx, bottom - 44, innerW - 34, 74, 0x3d3027));

    if (isUnlocked(this.state, 'glass')) this.drawSunlight(cx, roofY + 60);
    if (isUnlocked(this.state, 'sprout')) this.drawPlant(cx, bottom - 78, isUnlocked(this.state, 'central_bud'));
    if (isUnlocked(this.state, 'bed')) this.drawBed(cx - 230, bottom - 88);
    if (isUnlocked(this.state, 'flowers')) this.drawFlowers(cx + 155, bottom - 88);
    if (isUnlocked(this.state, 'vines')) this.drawVines(left + 60, roofY + 100, bottom - 82);
    if (isUnlocked(this.state, 'canopy')) this.drawCanopy(cx, roofY + 92, innerW * 0.60);
    if (isUnlocked(this.state, 'pump')) this.drawMachine(left + 105, bottom - 112, 0x856b4a);
    if (isUnlocked(this.state, 'cistern')) this.worldLayer.add(this.add.ellipse(left + innerW - 110, bottom - 112, 92, 105, 0x536d6d));
    if (isUnlocked(this.state, 'pond')) this.worldLayer.add(this.add.ellipse(cx + 280, bottom - 95, 190, 72, 0x4f8084, 0.75));
    if (isUnlocked(this.state, 'gears')) this.drawGears(left + innerW - 205, bottom - 150);
    if (isUnlocked(this.state, 'heater')) this.drawMachine(left + 200, bottom - 115, 0x765f50);
    if (isUnlocked(this.state, 'bees')) this.drawMovingDot(cx + 215, bottom - 180, 0xe1bd50, 55);
    if (isUnlocked(this.state, 'butterflies')) this.drawMovingDot(cx - 120, bottom - 205, 0xc39bd1, 75);
    if (isUnlocked(this.state, 'dragonflies')) this.drawMovingDot(cx + 330, bottom - 195, 0x79aeb4, 90);
    if (isUnlocked(this.state, 'pollination')) this.drawGlow(cx, bottom - 150, 0xd9cb76, 0.08);
    if (isUnlocked(this.state, 'humidity')) this.drawMist(cx, bottom - 165, innerW * 0.65);
    if (isUnlocked(this.state, 'ecosystem')) this.drawGlow(cx, (roofY + bottom) / 2, 0x9dcf89, 0.06, 210);
    if (isUnlocked(this.state, 'open_roof')) this.drawOpenRoof(cx, roofY);
    if (isUnlocked(this.state, 'final_bloom')) this.drawFinalBloom(cx, bottom - 215);

    if (this.state.unlocked.length === 0) {
      this.worldLayer.add(this.add.text(cx, h * 0.48, t(this.locale, 'intro'), {
        fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(18, Math.min(30, w / 32))}px`, color: '#d8e1dc', align: 'center',
      }).setOrigin(0.5).setAlpha(0.82));
    }
  }

  private renderTree(): void {
    const w = this.scale.width;
    const title = this.add.text(w / 2, 100, t(this.locale, 'tree_title'), {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(24, Math.min(36, w / 32))}px`, color: '#edf5ef', fontStyle: '700',
    }).setOrigin(0.5).setDepth(5);
    const help = this.add.text(w / 2, 132, t(this.locale, 'tree_help'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#82958a', align: 'center', wordWrap: { width: w * 0.72 },
    }).setOrigin(0.5).setDepth(5);
    this.treeLayer.add([title, help]);

    const branchColors: Record<Branch, number> = {
      water: 0x4f8290,
      plants: 0x5c8b55,
      climate: 0x9b8c52,
      mechanisms: 0x817968,
      life: 0x8b6380,
      synergy: 0xc2a65c,
      final: 0xb67b5b,
    };

    const positions = new Map<NodeId, Phaser.Math.Vector2>();
    for (const node of DISCOVERY_NODES) {
      const offset = node.branch === 'synergy' ? 56 : node.branch === 'final' ? 24 : 0;
      positions.set(
        node.id,
        new Phaser.Math.Vector2(w * BRANCH_X[node.branch], TREE_TOP + node.stage * TREE_STAGE_HEIGHT + offset),
      );
    }

    // Stable branch lanes make the large tree readable before any individual link is inspected.
    for (const branch of MAIN_BRANCHES) {
      const x = w * BRANCH_X[branch];
      const lane = this.add.graphics();
      lane.lineStyle(2, branchColors[branch], 0.12);
      lane.lineBetween(x, TREE_TOP - 34, x, TREE_CONTENT_HEIGHT - 100);
      this.treeContentLayer.add(lane);

      const label = this.add.text(x, TREE_TOP - 58, this.branchLabel(branch), {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#9eafa5', align: 'center',
      }).setOrigin(0.5);
      this.treeContentLayer.add(label);
    }

    // Only links whose child is already relevant are rendered. Future mystery stays visible as dots,
    // but the player is not forced to read the entire dependency graph at once.
    const links = this.add.graphics();
    for (const node of DISCOVERY_NODES) {
      const visibleChild = isRevealed(this.state, node.id) || isUnlocked(this.state, node.id);
      if (!visibleChild) continue;
      const child = positions.get(node.id)!;
      for (const req of node.requires) {
        const parent = positions.get(req)!;
        const sameLane = Math.abs(parent.x - child.x) < 3;
        links.lineStyle(2, branchColors[node.branch], isUnlocked(this.state, node.id) ? 0.62 : 0.34);
        if (sameLane) {
          links.lineBetween(parent.x, parent.y, child.x, child.y);
        } else {
          const midY = parent.y + (child.y - parent.y) * 0.55;
          links.beginPath();
          links.moveTo(parent.x, parent.y);
          links.lineTo(parent.x, midY);
          links.lineTo(child.x, midY);
          links.lineTo(child.x, child.y);
          links.strokePath();
        }
      }
    }
    this.treeContentLayer.add(links);

    for (const node of DISCOVERY_NODES) {
      const p = positions.get(node.id)!;
      const unlocked = isUnlocked(this.state, node.id);
      const revealed = isRevealed(this.state, node.id);
      const available = node.requires.every((req) => isUnlocked(this.state, req));
      const affordable = this.state.growth >= node.cost;
      const radius = Math.max(25, Math.min(38, w / 31));

      const circle = this.add.circle(
        p.x,
        p.y,
        radius,
        unlocked ? branchColors[node.branch] : available ? 0x6d5a35 : 0x25322c,
        revealed || unlocked ? 1 : 0.45,
      ).setStrokeStyle(
        affordable && available && !unlocked ? 3 : 2,
        affordable && available && !unlocked ? 0xe7d78e : branchColors[node.branch],
        unlocked ? 0.95 : 0.48,
      ).setInteractive({ useHandCursor: true });
      this.treeContentLayer.add(circle);

      const label = this.add.text(
        p.x,
        p.y - 2,
        unlocked ? t(this.locale, nodeNameKey(node.id)) : revealed ? '?' : '·',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: unlocked ? '11px' : revealed ? '23px' : '18px',
          color: '#f4f5ec',
          align: 'center',
          wordWrap: { width: radius * 1.85 },
        },
      ).setOrigin(0.5);
      this.treeContentLayer.add(label);

      const info = this.add.text(
        p.x,
        p.y + radius + 6,
        unlocked ? this.nodeEffectText(node.id) : revealed ? this.formatNumber(node.cost) : '',
        {
          fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: available ? '#d9cfaa' : '#6f7e75', align: 'center', wordWrap: { width: 108 },
        },
      ).setOrigin(0.5, 0);
      this.treeContentLayer.add(info);

      circle.on('pointerup', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (this.treeDragMoved) return;
        if (unlocked) {
          this.showToast(`${t(this.locale, nodeNameKey(node.id))}: ${t(this.locale, nodeDescriptionKey(node.id))}`);
          return;
        }
        if (buyNode(this.state, node.id)) {
          saveState(this.state);
          this.platform.analytics('discovery_unlocked', { node: node.id });
          if (node.final) void this.platform.achievement('final_bloom');
          this.renderAll();
          this.showToast(node.final ? t(this.locale, 'ending_toast') : t(this.locale, nodeNameKey(node.id)));
        } else if (available && !affordable) {
          this.showToast(t(this.locale, 'need_more', { value: this.formatNumber(node.cost - this.state.growth) }));
        }
      });
    }
  }

  private branchLabel(branch: Branch): string {
    if (branch === 'water') return t(this.locale, 'branch_water');
    if (branch === 'plants') return t(this.locale, 'branch_plants');
    if (branch === 'climate') return t(this.locale, 'branch_climate');
    if (branch === 'mechanisms') return t(this.locale, 'branch_mechanisms');
    if (branch === 'life') return t(this.locale, 'branch_life');
    return '';
  }

  private nodeEffectText(id: NodeId): string {
    const node = NODE_BY_ID[id];
    if (node.multiplier) return `×${node.multiplier.toFixed(2)}`;
    if (node.incomePerSecond) return `+${this.formatNumber(node.incomePerSecond)}${t(this.locale, 'per_second')}`;
    return node.final ? '✓' : '';
  }

  private setTreeScroll(value: number): void {
    const min = Math.min(0, this.scale.height - TREE_CONTENT_HEIGHT);
    this.treeScroll = Phaser.Math.Clamp(value, min, 0);
    this.treeContentLayer.y = this.treeScroll;
  }

  private spawnActiveEvent(): void {
    if (this.treeOpen || this.state.completed || !isUnlocked(this.state, 'pump')) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const x = Phaser.Math.Between(Math.max(80, Math.floor(w * 0.15)), Math.max(100, Math.floor(w * 0.85)));
    const y = Phaser.Math.Between(145, Math.max(180, h - 125));
    const container = this.add.container(x, y).setDepth(900);
    const pulse = this.add.circle(0, 0, 26, 0xd7cb75, 0.18).setStrokeStyle(3, 0xe8dc93, 0.9);
    const core = this.add.circle(0, 0, 10, 0xe8dc93, 0.95);
    const text = this.add.text(0, 36, t(this.locale, 'event_hint'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#e8dcaa',
    }).setOrigin(0.5);
    container.add([pulse, core, text]);
    pulse.setInteractive({ useHandCursor: true });
    core.setInteractive({ useHandCursor: true });

    const collect = (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (!this.activeEvent) return;
      const reward = collectActiveEvent(this.state);
      this.platform.analytics('active_event_collected', { reward });
      this.spawnTapFeedback(x, y, reward);
      this.clearActiveEvent();
      this.activeEventCountdown = Phaser.Math.Between(9, 15);
      this.updateHud();
    };
    pulse.on('pointerdown', collect);
    core.on('pointerdown', collect);
    this.tweens.add({ targets: pulse, scale: 1.35, alpha: 0.05, duration: 850, yoyo: true, repeat: -1 });
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
      this.tweens.killTweensOf(this.activeEvent.getAll());
      this.activeEvent.destroy(true);
      this.activeEvent = undefined;
    }
  }

  private spawnTapFeedback(x: number, y: number, amount: number): void {
    const text = this.add.text(x, y, t(this.locale, 'event_reward', { value: this.formatNumber(amount) }), {
      fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#dcedc8', fontStyle: '700',
    }).setOrigin(0.5).setDepth(1200);
    this.tweens.add({ targets: text, y: y - 38, alpha: 0, duration: 620, onComplete: () => text.destroy() });
  }

  private showToast(message: string): void {
    const toast = this.add.text(this.scale.width / 2, 78, message, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#17241d', backgroundColor: '#e5dbb0', padding: { x: 14, y: 8 },
      align: 'center', wordWrap: { width: Math.max(280, this.scale.width * 0.70) },
    }).setOrigin(0.5).setDepth(2000).setAlpha(0);
    this.tweens.add({ targets: toast, alpha: 1, duration: 160, hold: 1350, yoyo: true, onComplete: () => toast.destroy() });
  }

  private formatNumber(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    if (abs >= 10) return Math.floor(value).toString();
    return value.toFixed(abs < 1 ? 2 : 1);
  }

  private drawPlant(x: number, y: number, bud: boolean): void {
    const height = bud ? 145 : 58;
    const stem = this.add.rectangle(x, y, bud ? 12 : 8, height, 0x5f8752).setOrigin(0.5, 1);
    const leafA = this.add.ellipse(x - 18, y - height * 0.65, 35, 16, 0x719c5f).setRotation(-0.35);
    const leafB = this.add.ellipse(x + 20, y - height * 0.45, 38, 17, 0x82aa68).setRotation(0.35);
    this.worldLayer.add([stem, leafA, leafB]);
    if (bud) this.worldLayer.add(this.add.ellipse(x, y - height - 16, 45, 62, 0xb8909f).setStrokeStyle(4, 0xd8b8c2));
  }

  private drawBed(x: number, y: number): void {
    const box = this.add.rectangle(x, y, 170, 42, 0x765a3c).setStrokeStyle(2, 0xa4855f);
    const greens = [-55, -20, 20, 55].map((dx, i) => this.add.ellipse(x + dx, y - 28 - (i % 2) * 6, 32, 44, 0x557c4e));
    this.worldLayer.add([box, ...greens]);
  }

  private drawFlowers(x: number, y: number): void {
    const colors = [0xd8a5a5, 0xe2c978, 0xc3a8df, 0xe6b48b, 0xbccf8f];
    const objects: Phaser.GameObjects.GameObject[] = [];
    colors.forEach((color, i) => {
      const fx = x + (i - 2) * 30;
      objects.push(this.add.rectangle(fx, y - 16, 4, 36, 0x5e8153));
      objects.push(this.add.circle(fx, y - 38 - (i % 2) * 6, 11, color));
    });
    this.worldLayer.add(objects);
  }

  private drawVines(x: number, top: number, bottom: number): void {
    const g = this.add.graphics();
    g.lineStyle(5, 0x547b4f, 0.9);
    g.beginPath();
    g.moveTo(x, bottom);
    g.lineTo(x + 15, top);
    g.strokePath();
    this.worldLayer.add(g);
  }

  private drawCanopy(x: number, y: number, width: number): void {
    for (let i = 0; i < 12; i++) {
      const px = x - width / 2 + (width / 11) * i;
      this.worldLayer.add(this.add.ellipse(px, y + (i % 3) * 12, 95, 42, 0x466d48, 0.88));
    }
  }

  private drawMachine(x: number, y: number, color: number): void {
    this.worldLayer.add(this.add.rectangle(x, y, 70, 72, color).setStrokeStyle(3, 0xa88d70));
  }

  private drawGears(x: number, y: number): void {
    const a = this.add.circle(x, y, 30, 0x807663).setStrokeStyle(6, 0xa69a7e);
    const b = this.add.circle(x + 45, y + 22, 20, 0x716a5d).setStrokeStyle(5, 0x978d77);
    this.worldLayer.add([a, b]);
    this.tweens.add({ targets: a, rotation: Math.PI * 2, duration: 6000, repeat: -1 });
    this.tweens.add({ targets: b, rotation: -Math.PI * 2, duration: 4200, repeat: -1 });
  }

  private drawMovingDot(x: number, y: number, color: number, distance: number): void {
    const creature = this.add.circle(x, y, 7, color);
    this.worldLayer.add(creature);
    this.tweens.add({ targets: creature, x: x + distance, y: y - 22, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private drawSunlight(x: number, y: number): void {
    this.worldLayer.add(this.add.triangle(x, y + 120, -130, -120, 130, -120, 0, 180, 0xe6dfaf, 0.07));
  }

  private drawGlow(x: number, y: number, color: number, alpha: number, radius = 130): void {
    const glow = this.add.circle(x, y, radius, color, alpha);
    this.worldLayer.add(glow);
    this.tweens.add({ targets: glow, alpha: alpha * 1.8, scale: 1.08, duration: 1500, yoyo: true, repeat: -1 });
  }

  private drawMist(x: number, y: number, width: number): void {
    for (let i = 0; i < 7; i++) {
      this.worldLayer.add(this.add.ellipse(x - width / 2 + i * width / 6, y - (i % 2) * 18, 120, 42, 0xc7d9d0, 0.035));
    }
  }

  private drawOpenRoof(x: number, y: number): void {
    this.worldLayer.add([
      this.add.rectangle(x - 115, y, 180, 8, 0xb4c5bc, 0.8).setRotation(-0.35),
      this.add.rectangle(x + 115, y, 180, 8, 0xb4c5bc, 0.8).setRotation(0.35),
    ]);
  }

  private drawFinalBloom(x: number, y: number): void {
    const bloom = this.add.circle(x, y, 62, 0xe7cf9f, 0.95).setStrokeStyle(10, 0xc18fa8, 0.9);
    const light = this.add.triangle(x, y - 120, -130, -160, 130, -160, 0, 180, 0xf2e5a2, 0.14);
    this.worldLayer.add([light, bloom]);
    this.tweens.add({ targets: bloom, scale: 1.12, duration: 1700, yoyo: true, repeat: -1 });
  }
}
