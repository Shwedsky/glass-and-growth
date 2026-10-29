import Phaser from 'phaser';
import {
  CREW_UPGRADES,
  canBuyCrewUpgrade,
  getCrewUpgrade,
  type CrewUpgradeDef,
  type CrewUpgradeId,
  type P4MetaState,
} from './p4Meta';
import type { Locale } from '../i18n';

const POSITIONS: Record<CrewUpgradeId, [number, number]> = {
  sharp_tools: [0.34, 0.34],
  assistant_gardener: [0.66, 0.34],
  quick_hands: [0.27, 0.58],
  watering_rounds: [0.73, 0.58],
  foreman: [0.66, 0.78],
  greenhouse_rhythm: [0.50, 0.88],
};

export type CrewTreeContext = {
  getMeta: () => P4MetaState;
  getLocale: () => Locale;
  onPurchase: (id: CrewUpgradeId) => void;
};

export class CrewTreeView {
  private selected?: CrewUpgradeId;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly context: CrewTreeContext,
  ) {}

  clear(): void {
    this.selected = undefined;
    this.killTweensRecursive(this.layer);
    this.layer.removeAll(true);
  }

  destroy(): void {
    this.clear();
  }

  render(): void {
    this.killTweensRecursive(this.layer);
    this.layer.removeAll(true);

    const meta = this.context.getMeta();
    const locale = this.context.getLocale();
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const compact = w < 760;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0b1712, 0.985);
    bg.fillRect(0, 0, w, h);
    this.layer.add(bg);

    const title = this.scene.add.text(compact ? 14 : w / 2, compact ? 12 : 20, this.localize('Команда оранжереи', 'Greenhouse Crew'), {
      fontFamily: 'Georgia, serif',
      fontSize: compact ? '20px' : '36px',
      color: '#f0d99e',
      fontStyle: 'bold',
    }).setOrigin(compact ? 0 : 0.5, 0);
    const points = this.scene.add.text(compact ? 14 : w / 2, compact ? 43 : 67, this.localize(`Очки команды: ${meta.crewPoints}`, `Crew points: ${meta.crewPoints}`), {
      fontFamily: 'system-ui, sans-serif', fontSize: compact ? '11px' : '14px', color: '#b8d0bd',
    }).setOrigin(compact ? 0 : 0.5, 0);
    this.layer.add([title, points]);

    const links = this.scene.add.graphics();
    for (const upgrade of CREW_UPGRADES) {
      const [nx, ny] = POSITIONS[upgrade.id];
      for (const required of upgrade.requires) {
        const [px, py] = POSITIONS[required];
        const active = meta.crewUpgrades.includes(required);
        links.lineStyle(3, 0xb78a55, active ? 0.72 : 0.16);
        links.lineBetween(px * w, py * h, nx * w, ny * h);
      }
    }
    this.layer.add(links);

    for (const upgrade of CREW_UPGRADES) this.renderUpgrade(upgrade, meta, locale);

    const footer = this.scene.add.text(w / 2, h - 18, this.localize('Очки команды сохраняются между деревьями.', 'Crew upgrades persist between trees.'), {
      fontFamily: 'system-ui, sans-serif', fontSize: compact ? '10px' : '12px', color: '#7f9b88',
    }).setOrigin(0.5, 1);
    this.layer.add(footer);
  }

  private renderUpgrade(upgrade: CrewUpgradeDef, meta: P4MetaState, locale: Locale): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const compact = w < 760;
    const [nx, ny] = POSITIONS[upgrade.id];
    const x = nx * w;
    const y = ny * h;
    const unlocked = meta.crewUpgrades.includes(upgrade.id);
    const requirementsMet = upgrade.requires.every((required) => meta.crewUpgrades.includes(required));
    const affordable = canBuyCrewUpgrade(meta, upgrade.id);
    const radius = compact ? 25 : 34;

    if (affordable) {
      const aura = this.scene.add.circle(x, y, radius * 1.35, 0xf0c875, 0.055).setStrokeStyle(2, 0xf4d990, 0.32);
      this.layer.add(aura);
      this.scene.tweens.add({ targets: aura, scale: 1.06, alpha: 0.11, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const node = this.scene.add.circle(x, y, radius, unlocked ? 0x315d3b : requirementsMet ? 0x332b1d : 0x172019, 0.98)
      .setStrokeStyle(3, unlocked ? 0x96d58a : requirementsMet ? 0xd4ae60 : 0x55645a, 0.95)
      .setInteractive({ useHandCursor: true });
    const glyph = this.scene.add.text(x, y - 2, this.glyph(upgrade.id), {
      fontFamily: 'Georgia, serif', fontSize: compact ? '18px' : '24px', color: unlocked ? '#eff4d4' : requirementsMet ? '#f0d58c' : '#77877d',
    }).setOrigin(0.5);
    const cost = unlocked ? '✓' : `${upgrade.cost}`;
    const costText = this.scene.add.text(x, y + radius + 7, cost, {
      fontFamily: 'system-ui, sans-serif', fontSize: compact ? '9px' : '11px', color: unlocked ? '#9fe58e' : '#c9b777',
    }).setOrigin(0.5, 0);
    this.layer.add([node, glyph, costText]);

    node.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.selected = upgrade.id;
      if (affordable) this.context.onPurchase(upgrade.id);
      this.render();
    });

    if (!compact || this.selected === upgrade.id) {
      const name = locale === 'ru' ? upgrade.ru : upgrade.en;
      this.layer.add(this.scene.add.text(x, y - radius - 9, name, {
        fontFamily: 'system-ui, sans-serif', fontSize: compact ? '9px' : '11px', color: unlocked ? '#cde8c9' : '#dfd0a3', backgroundColor: '#102019d9', padding: { x: 5, y: 3 },
      }).setOrigin(0.5, 1));
    }

    if (this.selected === upgrade.id) {
      const cardW = Math.min(390, w - 32);
      const cardH = 92;
      const cardX = Phaser.Math.Clamp(x, cardW / 2 + 16, w - cardW / 2 - 16);
      const cardY = Phaser.Math.Clamp(y + radius + 78, 118, h - cardH / 2 - 42);
      const card = this.scene.add.rectangle(cardX, cardY, cardW, cardH, 0x102019, 0.98).setStrokeStyle(2, 0xc2a362, 0.9);
      const description = locale === 'ru' ? upgrade.ruDescription : upgrade.enDescription;
      const text = this.scene.add.text(cardX, cardY - 10, description, {
        fontFamily: 'system-ui, sans-serif', fontSize: compact ? '11px' : '13px', color: '#d4dfd6', align: 'center', wordWrap: { width: cardW - 28 },
      }).setOrigin(0.5);
      const stateText = this.scene.add.text(cardX, cardY + 28, unlocked
        ? this.localize('Куплено', 'Purchased')
        : requirementsMet
          ? this.localize(`Стоимость: ${upgrade.cost} очк. команды`, `Cost: ${upgrade.cost} crew points`)
          : this.localize('Сначала открой предыдущий навык', 'Unlock the prerequisite first'), {
        fontFamily: 'system-ui, sans-serif', fontSize: compact ? '10px' : '11px', color: unlocked ? '#9fe58e' : affordable ? '#f1d98f' : '#9da8a0',
      }).setOrigin(0.5);
      this.layer.add([card, text, stateText]);
    }
  }

  private glyph(id: CrewUpgradeId): string {
    switch (id) {
      case 'sharp_tools': return '✦';
      case 'assistant_gardener': return '♟';
      case 'watering_rounds': return '≈';
      case 'quick_hands': return '✣';
      case 'foreman': return '♛';
      case 'greenhouse_rhythm': return '❈';
    }
  }

  private killTweensRecursive(container: Phaser.GameObjects.Container): void {
    const stack: Phaser.GameObjects.GameObject[] = [...container.list];
    while (stack.length > 0) {
      const object = stack.pop()!;
      this.scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) stack.push(...object.list);
    }
    this.scene.tweens.killTweensOf(container);
  }

  private localize(ru: string, en: string): string {
    return this.context.getLocale() === 'ru' ? ru : en;
  }
}
