import Phaser from 'phaser';
import { GameSceneP4 } from './GameSceneP4';
import { DISCOVERY_NODES, type NodeId } from './content';
import { grantGrowth, isUnlocked, loadState, resetState, saveState, type GameState } from './model';
import { loadP4Meta } from './p4Meta';

/**
 * Final P4 playtest shell.
 * Keeps the stable P4 scene intact and adds two deliberately isolated concerns:
 * - a visible, raster-based tree morph driven by manual tapping;
 * - robust dev controls for fast generation testing.
 */
export class GameSceneP5 extends GameSceneP4 {
  private readonly p5DevMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1';
  private p5MorphImage?: Phaser.GameObjects.Image;
  private p5MorphMaskShape?: Phaser.GameObjects.Graphics;
  private p5MorphLabel?: Phaser.GameObjects.Text;
  private p5DevPanel?: Phaser.GameObjects.Container;
  private p5RefreshAccumulator = 0;
  private p5LastStage = -1;
  private p5LastVigor = -1;
  private p5LastWidth = -1;
  private p5LastHeight = -1;

  create(): void {
    super.create();
    this.rebuildTreeMorph();
    if (this.p5DevMode) {
      this.renderDevPanel();
      this.input.keyboard?.on('keydown', this.handleDevKey, this);
    }
    this.scale.on('resize', this.handleP5Resize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupP5, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupP5, this);
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.p5RefreshAccumulator += delta / 1000;
    if (this.p5RefreshAccumulator < 0.12) return;
    this.p5RefreshAccumulator = 0;
    this.refreshTreeMorph();
  }

  private cleanupP5(): void {
    this.input.keyboard?.off('keydown', this.handleDevKey, this);
    this.scale.off('resize', this.handleP5Resize, this);
    this.destroyTreeMorph();
    this.p5DevPanel?.destroy(true);
    this.p5DevPanel = undefined;
  }

  private handleP5Resize(): void {
    this.rebuildTreeMorph();
    if (this.p5DevMode) this.renderDevPanel();
  }

  private parentTreeOpen(): boolean {
    return Boolean((this as unknown as { treeOpen?: boolean }).treeOpen);
  }

  private calculateBaseStage(state: GameState): number {
    const has = (id: NodeId) => isUnlocked(state, id);
    if (has('final_bloom')) return 7;
    if (has('central_bud') || has('open_roof')) return 6;
    if (has('ecosystem') || has('birds') || has('climate') || has('roof_drive') || state.unlocked.length >= 25) return 5;
    if (has('pond') || has('filter') || has('auto_valves') || has('humidity') || state.unlocked.length >= 19) return 4;
    if (has('bees') || has('butterflies') || has('vines') || has('orchid') || state.unlocked.length >= 13) return 3;
    if (has('flowers') || has('gutters') || has('glass') || has('herbs') || has('gears') || state.unlocked.length >= 8) return 2;
    if (has('sprout') || has('pump') || has('bed') || state.unlocked.length >= 1) return 1;
    return 0;
  }

  private calculateVisualStage(state: GameState): number {
    const generationFloor = Math.max(0, loadP4Meta().generation - 1);
    return Math.max(this.calculateBaseStage(state), generationFloor);
  }

  private rebuildTreeMorph(): void {
    this.destroyTreeMorph();
    const state = loadState();
    if (state.completed) return;

    const meta = loadP4Meta();
    const stage = this.calculateVisualStage(state);
    const targetStage = Math.min(7, stage + 1);
    const w = this.scale.width;
    const h = this.scale.height;

    if (targetStage > stage) {
      const image = this.add.image(w / 2, h / 2, `greenhouse-stage-${targetStage}`).setDepth(240);
      this.coverP5(image, w, h);

      const maskShape = this.add.graphics();
      maskShape.fillStyle(0xffffff, 1);
      // Only the central tree/crown changes. The surrounding greenhouse remains on its current authored stage.
      maskShape.fillEllipse(w * 0.50, h * 0.49, w * 0.38, h * 0.66);
      const mask = maskShape.createGeometryMask();
      maskShape.setVisible(false);
      image.setMask(mask);

      this.p5MorphImage = image;
      this.p5MorphMaskShape = maskShape;
    }

    this.p5MorphLabel = this.add.text(w * 0.5, h - 51, '', {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(11, Math.min(14, w / 110))}px`,
      color: '#efffc4',
      backgroundColor: '#07140ed9',
      padding: { x: 10, y: 5 },
      stroke: '#1a2b13',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(970);

    this.p5LastStage = stage;
    this.p5LastVigor = -1;
    this.p5LastWidth = w;
    this.p5LastHeight = h;
    this.applyTreeMorphState(meta.treeVigor);
  }

  private refreshTreeMorph(): void {
    const state = loadState();
    const meta = loadP4Meta();
    const stage = this.calculateVisualStage(state);
    const treeOpen = this.parentTreeOpen();

    if (state.completed) {
      this.p5MorphImage?.setVisible(false);
      this.p5MorphLabel?.setVisible(false);
      return;
    }

    if (
      stage !== this.p5LastStage ||
      this.scale.width !== this.p5LastWidth ||
      this.scale.height !== this.p5LastHeight
    ) {
      this.rebuildTreeMorph();
    }

    this.p5MorphImage?.setVisible(!treeOpen);
    this.p5MorphLabel?.setVisible(!treeOpen);

    if (Math.abs(meta.treeVigor - this.p5LastVigor) >= 0.05) {
      this.applyTreeMorphState(meta.treeVigor);
    }
  }

  private applyTreeMorphState(vigorValue: number): void {
    const vigor = Phaser.Math.Clamp(vigorValue / 100, 0, 1);
    this.p5LastVigor = vigorValue;
    if (this.p5MorphImage) {
      // A real next-stage raster is revealed only over the tree. At high vigor the trunk/crown visibly
      // approaches the next authored stage instead of merely emitting particles.
      this.p5MorphImage.setAlpha(Math.pow(vigor, 0.82) * 0.76);
    }
    if (this.p5MorphLabel) {
      const percent = Math.round(vigor * 100);
      const ru = `Рост дерева ${percent}% · тапы меняют дерево`;
      const en = `Tree growth ${percent}% · tapping changes the tree`;
      const locale = localStorage.getItem('glass-and-growth:locale') === 'ru' ? 'ru' : 'en';
      this.p5MorphLabel.setText(locale === 'ru' ? ru : en);
      this.p5MorphLabel.setAlpha(0.72 + vigor * 0.25);
    }
  }

  private destroyTreeMorph(): void {
    if (this.p5MorphImage) {
      this.p5MorphImage.clearMask(true);
      this.p5MorphImage.destroy();
      this.p5MorphImage = undefined;
    }
    this.p5MorphMaskShape?.destroy();
    this.p5MorphMaskShape = undefined;
    this.p5MorphLabel?.destroy();
    this.p5MorphLabel = undefined;
  }

  private coverP5(image: Phaser.GameObjects.Image, width: number, height: number): void {
    const source = image.texture.getSourceImage() as HTMLImageElement;
    const scale = Math.max(width / source.width, height / source.height);
    image.setDisplaySize(source.width * scale, source.height * scale);
  }

  private handleDevKey(event: KeyboardEvent): void {
    if (!this.p5DevMode) return;
    if (event.key === 'F8') {
      event.preventDefault();
      this.performDevAction('reset');
    } else if (event.key === 'F9') {
      event.preventDefault();
      this.performDevAction('boost');
    } else if (event.key === 'F10') {
      event.preventDefault();
      this.performDevAction('finish');
    }
  }

  private performDevAction(action: 'boost' | 'finish' | 'reset'): void {
    if (action === 'reset') {
      resetState();
      this.scene.restart();
      return;
    }

    const state = loadState();
    if (action === 'boost') {
      grantGrowth(state, 1_000_000_000);
    } else {
      state.unlocked = DISCOVERY_NODES.map((node) => node.id);
      state.completed = true;
      state.growth = Math.max(state.growth, 1_000_000_000);
    }
    saveState(state);
    this.scene.restart();
  }

  private renderDevPanel(): void {
    this.p5DevPanel?.destroy(true);
    const w = this.scale.width;
    const h = this.scale.height;
    const y = h - 18;
    const panel = this.add.container(w / 2, y).setDepth(2600);

    const label = this.add.text(-205, 0, 'DEV', {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#ffdc88',
      backgroundColor: '#301d0aee', padding: { x: 7, y: 5 }, fontStyle: 'bold',
    }).setOrigin(0.5, 1);

    const makeButton = (x: number, text: string, action: 'boost' | 'finish' | 'reset') => {
      const button = this.add.text(x, 0, text, {
        fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#f3ead4',
        backgroundColor: '#11251dee', padding: { x: 9, y: 5 },
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
      button.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.performDevAction(action);
      });
      return button;
    };

    panel.add([
      label,
      makeButton(-120, 'F8 RESET', 'reset'),
      makeButton(0, 'F9 +1B', 'boost'),
      makeButton(125, 'F10 FINISH', 'finish'),
    ]);
    this.p5DevPanel = panel;
  }
}
