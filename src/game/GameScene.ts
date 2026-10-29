import Phaser from 'phaser';
import { DISCOVERY_NODES, type DiscoveryNode, type NodeId } from './content';
import {
  applyOfflineProgress,
  buyNode,
  canBuy,
  canManualTap,
  collectActiveEvent,
  createInitialState,
  getIncomePerSecond,
  getManualTapValue,
  grantGrowth,
  isUnlocked,
  loadState,
  resetState,
  saveState,
  simulate,
  type GameState,
} from './model';
import {
  advanceGeneration,
  applyManualTap,
  applyWorldEvent,
  loadP4Meta,
  saveP4Meta,
  type P4MetaState,
} from './p4Meta';
import { loadLocale, nodeNameKey, saveLocale, t, type Locale } from '../i18n';
import { CozyWorld, type WorldReaction } from './cozy/CozyWorld';
import { DiscoveryTreeView } from './DiscoveryTreeView';

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

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private meta: P4MetaState = loadP4Meta();
  private locale: Locale = 'en';

  private worldLayer!: Phaser.GameObjects.Container;
  private treeLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private world!: CozyWorld;
  private discoveryTree!: DiscoveryTreeView;

  private treeOpen = false;
  private uiAccumulator = 0;
  private saveAccumulator = 0;
  private eventCountdown = 6;
  private activeEvent?: Phaser.GameObjects.Container;
  private activeEventTimer?: Phaser.Time.TimerEvent;
  private toast?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private skipShutdownPersist = false;

  private growthText?: Phaser.GameObjects.Text;
  private rateText?: Phaser.GameObjects.Text;
  private stageText?: Phaser.GameObjects.Text;
  private menuLabel?: Phaser.GameObjects.Text;
  private readonly devMode = new URLSearchParams(window.location.search).get('dev') === '1';

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.skipShutdownPersist = false;
    this.state = loadState();
    this.meta = loadP4Meta();
    this.locale = loadLocale();
    const offline = applyOfflineProgress(this.state);
    if (offline > 0) saveState(this.state);

    this.worldLayer = this.add.container(0, 0).setDepth(0);
    this.treeLayer = this.add.container(0, 0).setDepth(500).setVisible(false);
    this.hudLayer = this.add.container(0, 0).setDepth(1000);
    this.world = new CozyWorld(this, this.worldLayer);
    this.discoveryTree = new DiscoveryTreeView(this, this.treeLayer, {
      getState: () => this.state,
      getLocale: () => this.locale,
      onPurchase: (node) => this.purchaseNode(node),
    });

    this.input.on('pointerdown', this.handleWorldTap, this);
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
    this.installDevShortcuts();

    this.renderAll(true);
    if (offline > 0.5) {
      this.showToast(this.localize(`Пока тебя не было: +${this.formatNumber(offline)}`, `While away: +${this.formatNumber(offline)}`));
    }
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
      if (this.treeOpen && !this.discoveryTree.hasPopover() && this.discoveryTree.needsAffordabilityRefresh()) {
        this.discoveryTree.render();
      }
    }

    if (this.saveAccumulator >= 3) {
      this.saveAccumulator = 0;
      this.persistProgress();
    }
  }

  private handleResize(): void {
    this.renderAll(true);
  }

  private handleWorldTap(pointer: Phaser.Input.Pointer): void {
    if (this.treeOpen || this.state.completed || !canManualTap(this.state)) return;
    if (!this.world.treeHitTest(pointer.x, pointer.y)) return;

    const amount = getManualTapValue(this.state);
    grantGrowth(this.state, amount);
    this.meta = applyManualTap(this.meta, amount);
    this.world.reactTap(pointer.x, pointer.y);
    this.world.sync(this.state, this.meta);
    this.updateHudValues();
  }

  private renderAll(forceWorld = false): void {
    this.clearActiveEvent();
    this.clearHudLayer();
    this.world.sync(this.state, this.meta, forceWorld);
    if (this.treeOpen) this.discoveryTree.render();
    else this.discoveryTree.clear();
    this.renderHud();
    this.worldLayer.setVisible(!this.treeOpen);
    this.treeLayer.setVisible(this.treeOpen);
    if (this.state.completed) this.renderGenerationEnding();
  }

  private clearHudLayer(): void {
    if (!this.hudLayer) return;
    this.killTweensRecursive(this.hudLayer);
    this.hudLayer.removeAll(true);
    this.growthText = undefined;
    this.rateText = undefined;
    this.stageText = undefined;
    this.menuLabel = undefined;
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
      const aura = this.add.circle(menuX + menuW / 2, menuY + menuH / 2, menuH * 0.72, 0xf2d483, 0.045)
        .setStrokeStyle(2, 0xffe49c, 0.34);
      this.hudLayer.add(aura);
      this.tweens.add({ targets: aura, alpha: 0.10, scale: 1.06, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const menu = this.add.rectangle(menuX + menuW / 2, menuY + menuH / 2, menuW, menuH, 0x14261e, 0.92)
      .setStrokeStyle(2, 0xc8a866, 0.78)
      .setInteractive({ useHandCursor: true });
    this.menuLabel = this.add.text(menu.x, menu.y, '', {
      fontFamily: 'Georgia, serif', fontSize: compact ? '14px' : '17px', color: '#f2deaa', fontStyle: 'bold',
    }).setOrigin(0.5);
    menu.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.treeOpen = !this.treeOpen;
      this.clearActiveEvent();
      this.renderAll(false);
    });
    this.hudLayer.add([menu, this.menuLabel]);

    const reset = this.add.text(14, h - 12, this.localize('Сбросить прогресс', 'Reset progress'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#9db49f', backgroundColor: '#102018dd', padding: { x: 8, y: 5 },
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    reset.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.skipShutdownPersist = true;
      resetState();
      this.scene.restart();
    });

    const lang = this.add.text(w - 14, h - 12, this.locale === 'ru' ? 'EN' : 'RU', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f1dda8', backgroundColor: '#102018dd', padding: { x: 8, y: 5 },
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    lang.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
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

  private purchaseNode(node: DiscoveryNode): void {
    if (!buyNode(this.state, node.id)) return;
    this.persistProgress();
    if (this.state.completed) this.treeOpen = false;
    this.renderAll(true);
    this.showToast(this.localize(`Открыто: ${t(this.locale, nodeNameKey(node.id))}`, `Unlocked: ${t(this.locale, nodeNameKey(node.id))}`));
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

    container.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const reward = collectActiveEvent(this.state);
      this.meta = applyWorldEvent(this.meta);
      this.world.reactEvent(def.reaction);
      this.world.sync(this.state, this.meta);
      this.showToast(`+${this.formatNumber(reward)}`);
      this.persistProgress();
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
    if (!this.activeEvent) return;
    this.killTweensRecursive(this.activeEvent);
    this.activeEvent.destroy(true);
    this.activeEvent = undefined;
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
      button.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
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
    this.input.keyboard.on('keydown-F8', this.onDevResetKey, this);
    this.input.keyboard.on('keydown-F9', this.onDevGrantKey, this);
    this.input.keyboard.on('keydown-F10', this.onDevFinishKey, this);
  }

  private removeDevShortcuts(): void {
    if (!this.input.keyboard) return;
    this.input.keyboard.off('keydown-F8', this.onDevResetKey, this);
    this.input.keyboard.off('keydown-F9', this.onDevGrantKey, this);
    this.input.keyboard.off('keydown-F10', this.onDevFinishKey, this);
  }

  private onDevResetKey(event: KeyboardEvent): void {
    event.preventDefault();
    this.devReset();
  }

  private onDevGrantKey(event: KeyboardEvent): void {
    event.preventDefault();
    this.devGrant();
  }

  private onDevFinishKey(event: KeyboardEvent): void {
    event.preventDefault();
    this.devFinish();
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
      button.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); fn(); });
      this.hudLayer.add([button, text]);
    });
  }

  private devReset(): void {
    this.skipShutdownPersist = true;
    resetState();
    this.scene.restart();
  }

  private devGrant(): void {
    grantGrowth(this.state, 1_000_000_000);
    this.persistProgress();
    this.updateHudValues();
    if (this.treeOpen && !this.discoveryTree.hasPopover()) this.discoveryTree.render();
  }

  private devFinish(): void {
    this.state.unlocked = DISCOVERY_NODES.map((node) => node.id);
    this.state.completed = true;
    grantGrowth(this.state, 1_000_000_000);
    this.persistProgress();
    this.treeOpen = false;
    this.renderAll(true);
  }

  private affordableNodeIds(): NodeId[] {
    return DISCOVERY_NODES.filter((node) => canBuy(this.state, node.id)).map((node) => node.id);
  }

  private persistProgress(): void {
    saveState(this.state);
    saveP4Meta(this.meta);
  }

  private shutdownScene(): void {
    if (!this.skipShutdownPersist) this.persistProgress();
    this.clearActiveEvent();
    this.toastTimer?.remove(false);
    this.toastTimer = undefined;
    this.toast?.destroy();
    this.toast = undefined;
    this.discoveryTree?.destroy();
    this.removeDevShortcuts();
    this.input.off('pointerdown', this.handleWorldTap, this);
    this.scale.off('resize', this.handleResize, this);
    this.world?.destroy();
    if (this.worldLayer) this.killTweensRecursive(this.worldLayer);
    if (this.hudLayer) this.killTweensRecursive(this.hudLayer);
  }

  private killTweensRecursive(container: Phaser.GameObjects.Container): void {
    const stack: Phaser.GameObjects.GameObject[] = [...container.list];
    while (stack.length > 0) {
      const object = stack.pop()!;
      this.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) stack.push(...object.list);
    }
    this.tweens.killTweensOf(container);
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
