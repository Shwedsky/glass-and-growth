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
  CREW_UPGRADES,
  advanceGeneration,
  applyManualTap,
  applyWorldEvent,
  buyCrewUpgrade,
  canBuyCrewUpgrade,
  getCrewUpgrade,
  loadP4Meta,
  saveP4Meta,
  type CrewUpgradeId,
  type P4MetaState,
} from './p4Meta';
import { loadLocale, nodeNameKey, saveLocale, t, type Locale } from '../i18n';
import { CozyWorld, type WorldReaction } from './cozy/CozyWorld';
import { DiscoveryTreeView } from './DiscoveryTreeView';
import { CrewTreeView } from './CrewTreeView';

type EventDef = {
  requires?: NodeId;
  minGeneration?: 1 | 2 | 3;
  reaction: WorldReaction;
  hits: number;
  ru: string;
  en: string;
  passiveBoost?: boolean;
};

const ACTIVE_EVENTS: EventDef[] = [
  { requires: 'pump', reaction: 'water', hits: 8, ru: 'Разогнать помпу', en: 'Prime the pump' },
  { requires: 'gutters', reaction: 'water', hits: 9, ru: 'Продавить поток', en: 'Push the flow' },
  { requires: 'glass', reaction: 'light', hits: 7, ru: 'Поймать солнечный луч', en: 'Catch the sunbeam' },
  { requires: 'flowers', reaction: 'petals', hits: 10, ru: 'Помочь цветам', en: 'Help the flowers' },
  { requires: 'bees', reaction: 'life', hits: 10, ru: 'Ускорить опыление', en: 'Boost pollination' },
  { minGeneration: 2, reaction: 'gardener', hits: 10, ru: 'Ускорить садовника', en: 'Hurry the gardener', passiveBoost: true },
];

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private meta: P4MetaState = loadP4Meta();
  private locale: Locale = 'en';

  private worldLayer!: Phaser.GameObjects.Container;
  private treeLayer!: Phaser.GameObjects.Container;
  private crewLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private world!: CozyWorld;
  private discoveryTree!: DiscoveryTreeView;
  private crewTree!: CrewTreeView;

  private treeOpen = false;
  private crewOpen = false;
  private uiAccumulator = 0;
  private saveAccumulator = 0;
  private eventCountdown = 6;
  private activeEvent?: Phaser.GameObjects.Container;
  private activeEventTimer?: Phaser.Time.TimerEvent;
  private activeEventDef?: EventDef;
  private activeEventHits = 0;
  private activeEventStartedAt = 0;
  private toast?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private skipShutdownPersist = false;
  private passiveBoostUntil = 0;

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
    this.crewLayer = this.add.container(0, 0).setDepth(600).setVisible(false);
    this.hudLayer = this.add.container(0, 0).setDepth(1000);
    this.world = new CozyWorld(this, this.worldLayer);
    this.discoveryTree = new DiscoveryTreeView(this, this.treeLayer, {
      getState: () => this.state,
      getLocale: () => this.locale,
      onPurchase: (node) => this.purchaseNode(node),
    });
    this.crewTree = new CrewTreeView(this, this.crewLayer, {
      getMeta: () => this.meta,
      getLocale: () => this.locale,
      onPurchase: (id) => this.purchaseCrewUpgrade(id),
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
    simulate(this.state, seconds * this.currentPassiveBoost());
    if (!this.treeOpen && !this.crewOpen) this.world.update(seconds);

    this.uiAccumulator += seconds;
    this.saveAccumulator += seconds;

    if (!this.treeOpen && !this.crewOpen && !this.state.completed && isUnlocked(this.state, 'pump')) {
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
    if (this.treeOpen || this.crewOpen || this.state.completed || !canManualTap(this.state)) return;
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
    if (this.crewOpen) this.crewTree.render();
    else this.crewTree.clear();
    this.renderHud();
    this.worldLayer.setVisible(!this.treeOpen && !this.crewOpen);
    this.treeLayer.setVisible(this.treeOpen);
    this.crewLayer.setVisible(this.crewOpen);
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
    const overlayOpen = this.treeOpen || this.crewOpen;
    const compactOverlay = compact && overlayOpen;
    const menuW = compactOverlay ? Math.min(136, w * 0.36) : compact ? Math.min(150, w * 0.40) : 220;
    const menuH = compactOverlay ? 42 : 54;
    const menuX = w - menuW - (compact ? 8 : 12);
    const menuY = compactOverlay ? 8 : 12;

    if (!compactOverlay) {
      const panelW = compact ? Math.max(150, w - menuW - 34) : Math.min(360, w * 0.30);
      const panelH = compact ? 92 : 108;
      const panel = this.add.graphics();
      panel.fillStyle(0x13251d, 0.90);
      panel.fillRoundedRect(10, 10, panelW, panelH, 14);
      panel.lineStyle(2, 0xc7a96c, 0.75);
      panel.strokeRoundedRect(10, 10, panelW, panelH, 14);
      this.hudLayer.add(panel);

      this.growthText = this.add.text(28, 25, '', {
        fontFamily: 'Georgia, serif', fontSize: compact ? '16px' : '21px', color: '#f3dfac', fontStyle: 'bold',
      });
      this.rateText = this.add.text(28, compact ? 55 : 62, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: compact ? '11px' : '15px', color: '#d8ead5',
      });
      this.stageText = this.add.text(28, compact ? 76 : 87, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: compact ? '9px' : '12px', color: '#91bca0',
      });
      this.hudLayer.add([this.growthText, this.rateText, this.stageText]);
    }

    const affordable = this.affordableNodeIds().length;
    if (affordable > 0 && !overlayOpen) {
      const aura = this.add.circle(menuX + menuW / 2, menuY + menuH / 2, menuH * 0.72, 0xf2d483, 0.045)
        .setStrokeStyle(2, 0xffe49c, 0.34);
      this.hudLayer.add(aura);
      this.tweens.add({ targets: aura, alpha: 0.10, scale: 1.06, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const menu = this.add.rectangle(menuX + menuW / 2, menuY + menuH / 2, menuW, menuH, 0x14261e, 0.92)
      .setStrokeStyle(2, 0xc8a866, 0.78)
      .setInteractive({ useHandCursor: true });
    this.menuLabel = this.add.text(menu.x, menu.y, '', {
      fontFamily: 'Georgia, serif', fontSize: compact ? '13px' : '17px', color: '#f2deaa', fontStyle: 'bold',
    }).setOrigin(0.5);
    menu.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.treeOpen) this.treeOpen = false;
      else {
        this.treeOpen = true;
        this.crewOpen = false;
      }
      this.clearActiveEvent();
      this.renderAll(false);
    });
    this.hudLayer.add([menu, this.menuLabel]);

    if (this.meta.generation >= 2) this.renderCrewButton(compact, menuX, menuY + menuH + 10, menuW, compactOverlay ? 38 : 46);

    const reset = this.add.text(10, h - 8, this.localize('Сбросить прогресс', 'Reset progress'), {
      fontFamily: 'system-ui, sans-serif', fontSize: compact ? '9px' : '11px', color: '#9db49f', backgroundColor: '#102018dd', padding: { x: 7, y: 4 },
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    reset.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.skipShutdownPersist = true;
      resetState();
      this.scene.restart();
    });

    const lang = this.add.text(w - 10, h - 8, this.locale === 'ru' ? 'EN' : 'RU', {
      fontFamily: 'Georgia, serif', fontSize: compact ? '11px' : '12px', color: '#f1dda8', backgroundColor: '#102018dd', padding: { x: 7, y: 4 },
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    lang.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.locale = this.locale === 'ru' ? 'en' : 'ru';
      saveLocale(this.locale);
      this.renderAll(false);
    });
    this.hudLayer.add([reset, lang]);

    if (this.devMode) this.renderDevPanel(compact);
    this.updateHudValues();
  }

  private renderCrewButton(compact: boolean, x: number, y: number, width: number, height: number): void {
    const affordable = CREW_UPGRADES.some((upgrade) => canBuyCrewUpgrade(this.meta, upgrade.id));
    if (affordable && !this.treeOpen && !this.crewOpen) {
      const aura = this.add.ellipse(x + width / 2, y + height / 2, width * 0.92, height * 1.35, 0xe0b86c, 0.045)
        .setStrokeStyle(2, 0xf0cf83, 0.28);
      this.hudLayer.add(aura);
      this.tweens.add({ targets: aura, alpha: 0.10, scale: 1.04, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const button = this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x1c2d23, 0.94)
      .setStrokeStyle(2, 0x9f7b49, 0.82)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(button.x, button.y,
      this.crewOpen
        ? this.localize('← В оранжерею', '← Greenhouse')
        : `${this.localize('Команда', 'Crew')} • ${this.meta.crewPoints}`,
      { fontFamily: 'Georgia, serif', fontSize: compact ? '11px' : '14px', color: '#e6cf99', fontStyle: 'bold' },
    ).setOrigin(0.5);
    button.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.crewOpen) this.crewOpen = false;
      else {
        this.crewOpen = true;
        this.treeOpen = false;
      }
      this.clearActiveEvent();
      this.renderAll(false);
    });
    this.hudLayer.add([button, label]);
  }

  private updateHudValues(): void {
    const passive = getIncomePerSecond(this.state) * this.currentPassiveBoost();
    const tap = getManualTapValue(this.state);
    const affordable = this.affordableNodeIds().length;
    const boostRemaining = Math.max(0, Math.ceil((this.passiveBoostUntil - this.time.now) / 1000));
    this.growthText?.setText(this.localize(`Рост ${this.formatNumber(this.state.growth)}`, `Growth ${this.formatNumber(this.state.growth)}`));
    this.rateText?.setText(this.localize(`Пассив +${this.formatNumber(passive)}/с  •  Тап +${this.formatNumber(tap)}`, `Passive +${this.formatNumber(passive)}/s  •  Tap +${this.formatNumber(tap)}`));
    this.stageText?.setText(this.localize(
      `Этап ${this.state.unlocked.length}/32  •  Поколение ${this.meta.generation}${boostRemaining > 0 ? `  •  ⚡ +50% ${boostRemaining}с` : ''}`,
      `Stage ${this.state.unlocked.length}/32  •  Generation ${this.meta.generation}${boostRemaining > 0 ? `  •  ⚡ +50% ${boostRemaining}s` : ''}`,
    ));
    this.menuLabel?.setText(this.treeOpen
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

  private purchaseCrewUpgrade(id: CrewUpgradeId): void {
    const before = this.meta.crewUpgrades.length;
    this.meta = buyCrewUpgrade(this.meta, id);
    if (this.meta.crewUpgrades.length === before) return;
    this.persistProgress();
    const upgrade = getCrewUpgrade(id);
    this.renderAll(true);
    this.showToast(this.locale === 'ru' ? `Команда: ${upgrade.ru}` : `Crew: ${upgrade.en}`);
  }

  private spawnActiveEvent(): void {
    const eligible = ACTIVE_EVENTS.filter((event) => {
      const nodeReady = event.requires ? isUnlocked(this.state, event.requires) : true;
      const generationReady = event.minGeneration ? this.meta.generation >= event.minGeneration : true;
      return nodeReady && generationReady;
    });
    if (eligible.length === 0 || this.treeOpen || this.crewOpen || this.state.completed) {
      this.eventCountdown = 5;
      return;
    }

    const def = eligible[Math.floor(Math.random() * eligible.length)];
    const anchor = this.world.eventAnchor(def.reaction);
    const width = def.reaction === 'gardener' ? 150 : 126;
    const height = def.reaction === 'water' ? 118 : 92;
    const container = this.add.container(anchor.x, anchor.y).setDepth(800).setSize(width, height).setInteractive({ useHandCursor: true });
    const glow = this.add.ellipse(0, 0, width * 0.86, height * 0.78, 0xf5d985, 0.035).setStrokeStyle(3, 0xffdf83, 0.76);
    const label = this.add.text(0, -height * 0.52, this.locale === 'ru' ? def.ru : def.en, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#f5e6b8', backgroundColor: '#0d1c15e8', padding: { x: 7, y: 4 }, fontStyle: 'bold',
    }).setOrigin(0.5);
    const counter = this.add.text(0, height * 0.50, `0/${def.hits}`, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#ffe39b', backgroundColor: '#0d1c15dd', padding: { x: 7, y: 3 },
    }).setOrigin(0.5);
    container.add([glow, label, counter]);
    this.worldLayer.add(container);
    this.tweens.add({ targets: glow, scale: 1.08, alpha: 0.11, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.activeEvent = container;
    this.activeEventDef = def;
    this.activeEventHits = 0;
    this.activeEventStartedAt = this.time.now;

    container.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (!this.activeEvent || this.activeEventDef !== def) return;
      this.activeEventHits += 1;
      grantGrowth(this.state, getManualTapValue(this.state) * 0.25);
      this.world.reactEvent(def.reaction);
      counter.setText(`${this.activeEventHits}/${def.hits}`);
      this.tweens.add({ targets: glow, scale: 1.18, alpha: 0.18, duration: 80, yoyo: true, ease: 'Quad.out' });
      if (this.activeEventHits >= def.hits) this.completeActiveEvent(def);
      this.updateHudValues();
    });

    this.activeEventTimer = this.time.delayedCall(9000, () => {
      this.clearActiveEvent();
      this.eventCountdown = 4 + Math.random() * 5;
    });
  }

  private completeActiveEvent(def: EventDef): void {
    const elapsed = this.time.now - this.activeEventStartedAt;
    const critical = elapsed <= 3500;
    const baseReward = collectActiveEvent(this.state);
    const rewardMultiplier = critical ? 2 : 1.35;
    const bonus = baseReward * (rewardMultiplier - 1);
    grantGrowth(this.state, bonus);
    this.meta = applyWorldEvent(this.meta);
    if (def.passiveBoost) this.passiveBoostUntil = Math.max(this.passiveBoostUntil, this.time.now + 15_000);
    this.world.reactEvent(def.reaction);
    this.world.sync(this.state, this.meta);
    const totalReward = baseReward + bonus;
    const prefix = critical ? this.localize('КРИТ!', 'CRIT!') : this.localize('Готово!', 'Done!');
    const buff = def.passiveBoost ? this.localize(' • +50% пассива на 15с', ' • +50% passive for 15s') : '';
    this.showToast(`${prefix} +${this.formatNumber(totalReward)}${buff}`);
    this.persistProgress();
    this.clearActiveEvent();
    this.eventCountdown = 6 + Math.random() * 5;
    this.updateHudValues();
  }

  private clearActiveEvent(): void {
    this.activeEventTimer?.remove(false);
    this.activeEventTimer = undefined;
    if (this.activeEvent) {
      this.killTweensRecursive(this.activeEvent);
      this.activeEvent.destroy(true);
    }
    this.activeEvent = undefined;
    this.activeEventDef = undefined;
    this.activeEventHits = 0;
    this.activeEventStartedAt = 0;
  }

  private currentPassiveBoost(): number {
    return this.time.now < this.passiveBoostUntil ? 1.5 : 1;
  }

  private renderGenerationEnding(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const finalGeneration = this.meta.generation >= 3;
    const panelW = Math.min(650, w * 0.68);
    const panelH = 292;
    const panel = this.add.graphics().setDepth(1900);
    panel.fillStyle(0x0b1b14, 0.97);
    panel.fillRoundedRect(w / 2 - panelW / 2, h * 0.50 - panelH / 2, panelW, panelH, 18);
    panel.lineStyle(2, 0xd2b66d, 0.92);
    panel.strokeRoundedRect(w / 2 - panelW / 2, h * 0.50 - panelH / 2, panelW, panelH, 18);
    this.hudLayer.add(panel);

    const title = this.add.text(w / 2, h * 0.40, finalGeneration ? this.localize('Оранжерея завершена', 'The greenhouse is complete') : this.localize('Дерево расцвело', 'The tree has bloomed'), {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(25, w / 50)}px`, color: '#f3dda0', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1901);
    const bodyText = finalGeneration
      ? this.localize('Три поколения превратили оранжерею в живую экосистему. Это настоящий финал текущей кампании.', 'Three generations turned the greenhouse into a living ecosystem. This is the true ending of the current campaign.')
      : this.meta.generation === 1
        ? this.localize('Следующее дерево даст 3 очка команды. Откроется постоянная ветка садовников и инструментов.', 'The next tree grants 3 crew points and unlocks permanent gardener/tool upgrades.')
        : this.localize('Следующее поколение даст ещё 4 очка команды. Можно собрать полноценную бригаду.', 'The next generation grants 4 more crew points so you can build a full greenhouse crew.');
    const body = this.add.text(w / 2, h * 0.50, bodyText, {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(13, w / 96)}px`, color: '#d7e0d6', align: 'center', wordWrap: { width: panelW * 0.82 },
    }).setOrigin(0.5).setDepth(1901);
    this.hudLayer.add([title, body]);

    if (!finalGeneration) {
      const button = this.add.rectangle(w / 2, h * 0.63, Math.min(320, panelW * 0.60), 48, 0x35633d, 1)
        .setStrokeStyle(2, 0xa8ce83, 1)
        .setInteractive({ useHandCursor: true })
        .setDepth(1902);
      const label = this.add.text(w / 2, h * 0.63, this.localize('Вырастить новое дерево', 'Grow a new tree'), {
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
    this.crewOpen = false;
    this.eventCountdown = 4;
    this.renderAll(true);
    this.showToast(this.localize(`Получено очков команды: ${this.meta.crewPoints}`, `Crew points available: ${this.meta.crewPoints}`));
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

  private renderDevPanel(compact: boolean): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const items: Array<[string, () => void]> = [
      ['RESET', () => this.devReset()], ['+1B', () => this.devGrant()], ['FINISH', () => this.devFinish()],
    ];
    const gap = compact ? 66 : 82;
    const buttonW = compact ? 58 : 72;
    const buttonH = compact ? 26 : 28;
    const y = compact ? h - 58 : h - 22;
    const startX = w / 2 - gap;

    this.hudLayer.add(this.add.text(compact ? w / 2 : startX - 58, compact ? y - 24 : h - 11, compact ? 'DEV' : 'COZY DEV', {
      fontFamily: 'system-ui, sans-serif', fontSize: compact ? '9px' : '10px', color: '#d7c485', backgroundColor: '#16261ddd', padding: { x: 6, y: 4 },
    }).setOrigin(compact ? 0.5 : 0, compact ? 0.5 : 1));

    items.forEach(([label, fn], i) => {
      const x = startX + i * gap;
      const button = this.add.rectangle(x, y, buttonW, buttonH, 0x20382b, 0.96).setStrokeStyle(1, 0x8dab7b, 0.8).setInteractive({ useHandCursor: true });
      const text = this.add.text(x, y, label, { fontFamily: 'system-ui, sans-serif', fontSize: compact ? '9px' : '10px', color: '#e6e0bd' }).setOrigin(0.5);
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
    this.crewOpen = false;
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
    this.crewTree?.destroy();
    this.removeDevShortcuts();
    this.input.off('pointerdown', this.handleWorldTap, this);
    this.scale.off('resize', this.handleResize, this);
    this.world?.destroy();
    if (this.worldLayer) this.killTweensRecursive(this.worldLayer);
    if (this.treeLayer) this.killTweensRecursive(this.treeLayer);
    if (this.crewLayer) this.killTweensRecursive(this.crewLayer);
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
