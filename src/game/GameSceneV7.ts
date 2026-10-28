import Phaser from 'phaser';
import { DISCOVERY_NODES, NODE_BY_ID, type Branch, type DiscoveryNode, type NodeId } from './content';
import {
  applyOfflineProgress,
  buyNode,
  canBuy,
  canManualTap,
  collectActiveEvent,
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
  water: 0x65c8f2, plants: 0x7ed957, climate: 0xd9a947, mechanisms: 0xd48842,
  life: 0xd9ae48, synergy: 0xf1d36b, final: 0xffe0a7,
};

const NODE_ICONS: Record<NodeId, string> = {
  sprout: '🌱', pump: '💧', bed: '🌿', gutters: '🌧', flowers: '🌸', glass: '☀', cistern: '💧', herbs: '🌿',
  gears: '⚙', mirrors: '☀', bees: '🐝', irrigation: '💦', vines: '🍃', timer: '⏱', vents: '〰', butterflies: '🦋',
  filter: '◈', pollination: '✿', orchid: '🌺', auto_valves: '⚙', heater: '🔥', dragonflies: '✧', pond: '💧',
  humidity: '☁', canopy: '🌳', roof_drive: '⚙', climate: '☀', birds: '🐦', ecosystem: '✺',
  central_bud: '🌿', open_roof: '☀', final_bloom: '🌼',
};

interface ActiveEventDefinition { x: number; y: number; icon: string; textKey: UiTextKey; requires: NodeId; }
const ACTIVE_EVENTS: ActiveEventDefinition[] = [
  { x: 0.18, y: 0.69, icon: '⚙', textKey: 'event_pump', requires: 'pump' },
  { x: 0.17, y: 0.38, icon: '💧', textKey: 'event_water', requires: 'gutters' },
  { x: 0.78, y: 0.30, icon: '☀', textKey: 'event_light', requires: 'glass' },
  { x: 0.83, y: 0.67, icon: '✿', textKey: 'event_flowers', requires: 'flowers' },
  { x: 0.75, y: 0.42, icon: '🐝', textKey: 'event_bee', requires: 'bees' },
];

interface AmbientDot {
  object: Phaser.GameObjects.Arc | Phaser.GameObjects.Text;
  vx: number; vy: number; baseX: number; baseY: number; phase: number;
  kind: 'water' | 'pollen' | 'firefly' | 'life';
}

const STAGE_TEXTURES = Array.from({ length: 8 }, (_, i) => `greenhouse-stage-${i}`);

export class GameSceneV7 extends Phaser.Scene {
  private state!: GameState;
  private readonly platform = new BrowserPlatformAdapter();
  private locale: Locale = 'en';
  private worldLayer!: Phaser.GameObjects.Container;
  private treeLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private treeOpen = false;
  private uiAccumulator = 0;
  private lastSaveAt = 0;
  private activeEventCountdown = 7;
  private activeEvent?: Phaser.GameObjects.Container;
  private activeEventTimer?: Phaser.Time.TimerEvent;
  private growthText?: Phaser.GameObjects.Text;
  private stageText?: Phaser.GameObjects.Text;
  private menuText?: Phaser.GameObjects.Text;
  private menuAura?: Phaser.GameObjects.Rectangle;
  private toast?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private popover?: Phaser.GameObjects.Container;
  private popoverCloseTimer?: Phaser.Time.TimerEvent;
  private ambientDots: AmbientDot[] = [];
  private ambientClock = 0;
  private lastAffordableSignature = '';

  constructor() { super('GameScene'); }

  preload(): void {
    this.load.image('main-greenhouse', 'art/main-greenhouse.jpg');
    this.load.image('heart-medallion', 'art/heart-medallion.jpg');
    for (let i = 0; i < STAGE_TEXTURES.length; i += 1) this.load.image(STAGE_TEXTURES[i], `art/stages/stage-${i}.jpg`);
  }

  create(): void {
    this.state = loadState();
    this.locale = loadLocale();
    const offline = applyOfflineProgress(this.state);
    this.worldLayer = this.add.container(0, 0);
    this.treeLayer = this.add.container(0, 0).setVisible(false);
    this.hudLayer = this.add.container(0, 0).setDepth(1000);
    this.scale.on('resize', () => this.renderAll());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleWorldTap(pointer));
    this.renderAll();
    if (offline > 0.5) this.showToast(t(this.locale, 'offline', { value: this.formatNumber(offline) }));
  }

  update(_time: number, delta: number): void {
    const seconds = Math.min(delta / 1000, 0.25);
    simulate(this.state, seconds);
    this.animateAmbient(seconds);
    this.uiAccumulator += seconds;
    this.lastSaveAt += seconds;

    if (!this.treeOpen && !this.state.completed && isUnlocked(this.state, 'pump')) {
      this.activeEventCountdown -= seconds;
      if (this.activeEventCountdown <= 0 && !this.activeEvent) this.spawnActiveEvent();
    }

    if (this.uiAccumulator >= 0.2) {
      this.uiAccumulator = 0;
      this.updateHudValues();
      const sig = this.affordableNodeIds().join('|');
      if (this.treeOpen && sig !== this.lastAffordableSignature) {
        this.lastAffordableSignature = sig;
        this.renderTreeOnly();
      }
    }
    if (this.lastSaveAt >= 3) { this.lastSaveAt = 0; saveState(this.state); }
  }

  private tr(ru: string, en: string): string { return this.locale === 'ru' ? ru : en; }

  private handleWorldTap(pointer: Phaser.Input.Pointer): void {
    if (this.treeOpen || this.state.completed || !canManualTap(this.state) || !this.isTreeTap(pointer.x, pointer.y)) return;
    const amount = getManualTapValue(this.state);
    grantGrowth(this.state, amount);
    this.platform.analytics('manual_tree_tap', { amount });
    this.pulseCentralTree(pointer.x, pointer.y, amount);
    this.updateHudValues();
  }

  private isTreeTap(x: number, y: number): boolean {
    const w = this.scale.width, h = this.scale.height;
    const dx = (x - w * 0.50) / Math.max(1, w * 0.19);
    const dy = (y - h * 0.52) / Math.max(1, h * 0.34);
    return dx * dx + dy * dy <= 1;
  }

  private renderAll(): void {
    this.clearActiveEvent();
    this.hidePopover();
    this.worldLayer.removeAll(true);
    this.treeLayer.removeAll(true);
    this.hudLayer.removeAll(true);
    this.renderWorld();
    this.renderTree();
    this.worldLayer.setVisible(!this.treeOpen);
    this.treeLayer.setVisible(this.treeOpen);
    this.renderHud();
  }

  private getVisualStage(): number {
    const has = (id: NodeId) => isUnlocked(this.state, id);
    if (has('final_bloom')) return 7;
    if (has('central_bud') || has('open_roof')) return 6;
    if (has('ecosystem') || has('birds') || has('climate') || has('roof_drive') || this.state.unlocked.length >= 25) return 5;
    if (has('pond') || has('filter') || has('auto_valves') || has('humidity') || this.state.unlocked.length >= 19) return 4;
    if (has('bees') || has('butterflies') || has('vines') || has('orchid') || this.state.unlocked.length >= 13) return 3;
    if (has('flowers') || has('gutters') || has('glass') || has('herbs') || has('gears') || this.state.unlocked.length >= 8) return 2;
    if (has('sprout') || has('pump') || has('bed') || this.state.unlocked.length >= 1) return 1;
    return 0;
  }

  private stageTexture(stage: number): string { return this.textures.exists(STAGE_TEXTURES[stage]) ? STAGE_TEXTURES[stage] : 'main-greenhouse'; }

  private renderWorld(): void {
    const w = this.scale.width, h = this.scale.height;
    const stage = this.getVisualStage();
    const background = this.add.image(w / 2, h / 2, this.stageTexture(stage));
    this.cover(background, w, h);
    this.worldLayer.add(background);
    this.ambientDots = [];
    this.addAmbientMotion(stage);

    if (this.state.unlocked.length < 2) {
      const hint = this.add.text(w * 0.5, h * 0.84, uiText(this.locale, 'tap_tree_hint'), {
        fontFamily: 'Georgia, serif', fontSize: `${Math.max(18, Math.min(28, w / 65))}px`,
        color: '#ffe9a7', stroke: '#1a1008', strokeThickness: 5,
        shadow: { color: '#000000', fill: true, blur: 8, offsetX: 0, offsetY: 2 }, align: 'center',
      }).setOrigin(0.5).setDepth(10);
      this.worldLayer.add(hint);
    }

    const stageLabel = this.add.text(w / 2, h - 18, this.visualStageLabel(stage), {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(11, Math.min(15, w / 105))}px`,
      color: '#f7e4aa', backgroundColor: '#07140ecc', padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 1).setAlpha(0.88);
    this.worldLayer.add(stageLabel);
    if (this.state.completed) this.renderFinaleOverlay();
  }

  private visualStageLabel(stage: number): string {
    const ru = ['Оранжерея спит','Первые системы оживают','Появляются вода и растения','Возвращается жизнь','Формируется экосистема','Оранжерея почти восстановлена','Сердце готовится к цветению','Оранжерея восстановлена'];
    const en = ['The greenhouse sleeps','The first systems awaken','Water and plants return','Life returns','The ecosystem takes shape','The greenhouse is nearly restored','The heart prepares to bloom','The greenhouse is restored'];
    return (this.locale === 'ru' ? ru : en)[stage];
  }

  private renderFinaleOverlay(): void {
    const w = this.scale.width, h = this.scale.height;
    const panel = this.add.rectangle(w / 2, h * 0.52, Math.min(560, w * 0.55), Math.min(210, h * 0.28), 0x07140e, 0.90).setStrokeStyle(2, 0xffdf86, 0.95);
    const title = this.add.text(w / 2, h * 0.47, this.tr('Оранжерея восстановлена', 'Greenhouse restored'), {
      fontFamily:'Georgia, serif', fontSize:`${Math.max(25,w/48)}px`, color:'#ffe9a7', fontStyle:'bold',
    }).setOrigin(0.5);
    const body = this.add.text(w / 2, h * 0.56, this.tr('Финальное цветение достигнуто. Это завершённая цель текущего дерева.','Final Bloom reached. This tree has a complete ending.'), {
      fontFamily:'system-ui, sans-serif', fontSize:`${Math.max(14,w/90)}px`, color:'#efe7cf', align:'center', wordWrap:{width:Math.min(490,w*.48)}
    }).setOrigin(0.5);
    this.worldLayer.add([panel,title,body]);
  }

  private renderTree(): void {
    const w = this.scale.width, h = this.scale.height, minSide = Math.min(w, h);
    const bg = this.add.image(w / 2, h / 2, this.stageTexture(this.getVisualStage()));
    this.cover(bg, w, h); bg.setTint(0x425047).setAlpha(0.28);
    this.treeLayer.add([bg, this.add.rectangle(w / 2, h / 2, w, h, 0x06100b, 0.84)]);

    const title = this.add.text(w / 2, 14, t(this.locale, 'tree_title'), {
      fontFamily:'Georgia, serif', fontSize:`${Math.max(27,Math.min(44,w/29))}px`, color:'#f7df9a', stroke:'#321f0e', strokeThickness:5,
    }).setOrigin(0.5,0);
    const help = this.add.text(w / 2, 64, this.tr('Наведи курсор на узел. Доступные сейчас узлы раскрывают эффект до покупки.','Hover a node. Nodes available now reveal their effect before purchase.'), {
      fontFamily:'system-ui, sans-serif', fontSize:`${Math.max(11,Math.min(14,w/100))}px`, color:'#e9dfc4', align:'center'
    }).setOrigin(0.5,0);
    this.treeLayer.add([title, help]);

    const positions = new Map<NodeId, Phaser.Math.Vector2>();
    for (const node of DISCOVERY_NODES) { const [nx,ny] = NODE_POSITIONS[node.id]; positions.set(node.id,new Phaser.Math.Vector2(nx*w,ny*h)); }

    const links = this.add.graphics();
    for (const node of DISCOVERY_NODES) {
      const unlocked=isUnlocked(this.state,node.id), available=this.isAvailable(node);
      if (!isRevealed(this.state,node.id) && !unlocked && !available) continue;
      const child=positions.get(node.id)!;
      for (const req of node.requires) {
        const parent=positions.get(req)!, cross=NODE_BY_ID[req].branch!==node.branch;
        if (cross && !available && !unlocked) continue;
        links.lineStyle(cross?1.5:3,BRANCH_COLORS[node.branch],unlocked?.88:available?.58:.16);
        links.beginPath(); links.moveTo(parent.x,parent.y);
        if (cross) { const mx=parent.x+(child.x-parent.x)*.52; links.lineTo(mx,parent.y); links.lineTo(mx,child.y); }
        links.lineTo(child.x,child.y); links.strokePath();
      }
    }
    this.treeLayer.add(links);

    for (const node of DISCOVERY_NODES) {
      const p=positions.get(node.id)!;
      const size=node.id==='sprout'?Math.max(78,minSide*.115):Math.max(42,minSide*.060);
      this.renderNode(node,p,size);
    }
    this.renderBranchLabels();
  }

  private renderNode(node: DiscoveryNode, p: Phaser.Math.Vector2, size: number): void {
    const unlocked=isUnlocked(this.state,node.id), available=this.isAvailable(node), revealed=isRevealed(this.state,node.id), affordable=canBuy(this.state,node.id);
    const color=unlocked?BRANCH_COLORS[node.branch]:available?0xe7bd58:0x657067;
    const alpha=unlocked?1:available?.94:revealed?.50:.24;

    if (affordable) {
      const aura=this.add.circle(p.x,p.y,size*.62,0xffdf79,.055).setStrokeStyle(Math.max(2,size*.025),0xffe49b,.28);
      this.treeLayer.add(aura);
      this.tweens.add({targets:aura,alpha:.10,scale:1.045,duration:1200,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    }

    const hit=this.add.circle(p.x,p.y,size*.48,0x0d1710,alpha).setStrokeStyle(Math.max(2,size*.045),color,unlocked||available?.96:.35).setInteractive({useHandCursor:true});
    this.treeLayer.add(hit);

    if (node.id==='sprout' && unlocked) {
      const heart=this.add.image(p.x,p.y,'heart-medallion').setDisplaySize(size*.90,size*.90).setAlpha(.95);
      const maskShape=this.make.graphics({x:0,y:0,add:false});
      maskShape.fillStyle(0xffffff,1); maskShape.fillCircle(p.x,p.y,size*.43);
      heart.setMask(maskShape.createGeometryMask());
      this.treeLayer.add([maskShape,heart]);
    } else {
      const glyph=unlocked||available?NODE_ICONS[node.id]:revealed?'◆':'?';
      this.treeLayer.add(this.add.text(p.x,p.y,glyph,{
        fontFamily:'Segoe UI Emoji, Segoe UI Symbol, Georgia, serif', fontSize:`${Math.max(15,size*(unlocked||available?.36:.30))}px`,
        color:unlocked?'#fff7d7':available?'#fff0a5':'#c6c4b7',stroke:'#20150b',strokeThickness:2,
      }).setOrigin(.5));
    }
    if (unlocked) this.treeLayer.add(this.add.text(p.x+size*.32,p.y-size*.31,'✓',{
      fontFamily:'system-ui, sans-serif',fontSize:`${Math.max(11,size*.20)}px`,color:'#b8ff9a',stroke:'#153317',strokeThickness:3,
    }).setOrigin(.5));
    else if (available) this.treeLayer.add(this.add.text(p.x,p.y+size*.72,this.formatNumber(node.cost),{
      fontFamily:'Georgia, serif',fontSize:`${Math.max(10,size*.17)}px`,color:affordable?'#fff0ad':'#d0c8ae',backgroundColor:'#0b1711dd',padding:{x:5,y:2},
    }).setOrigin(.5));

    hit.on('pointerover',()=>{ this.cancelPopoverHide(); this.showNodePopover(node,p,size); });
    hit.on('pointerout',()=>this.schedulePopoverHide());
  }

  private showNodePopover(node: DiscoveryNode, p: Phaser.Math.Vector2, nodeSize: number): void {
    this.hidePopover();
    const w=this.scale.width,h=this.scale.height;
    const unlocked=isUnlocked(this.state,node.id), available=this.isAvailable(node), revealed=isRevealed(this.state,node.id), affordable=canBuy(this.state,node.id);
    const showDetails=unlocked||available;
    const panelW=Math.max(270,Math.min(350,w*.27)), panelH=Math.max(205,Math.min(240,h*.31));
    const right=p.x<w*.64;
    let x=right?p.x+nodeSize*.72+panelW/2:p.x-nodeSize*.72-panelW/2;
    let y=Phaser.Math.Clamp(p.y,panelH/2+92,h-panelH/2-18);
    x=Phaser.Math.Clamp(x,panelW/2+12,w-panelW/2-12);

    const c=this.add.container(x,y).setDepth(1200);
    const panel=this.add.rectangle(0,0,panelW,panelH,0x07140e,.97).setStrokeStyle(2,available?0xe7bd58:unlocked?BRANCH_COLORS[node.branch]:0x777061,.95).setInteractive();
    const icon=this.add.text(-panelW*.42,-panelH*.40,showDetails?NODE_ICONS[node.id]:revealed?'◆':'?',{fontFamily:'Segoe UI Emoji, Segoe UI Symbol, serif',fontSize:`${Math.max(22,panelH*.14)}px`,color:'#fff0ae'}).setOrigin(0,0);
    const status=this.add.text(-panelW*.28,-panelH*.38,unlocked?this.tr('ОТКРЫТО','OPEN'):available?this.tr('ДОСТУПНО','AVAILABLE'):revealed?this.tr('ЗАБЛОКИРОВАНО','LOCKED'):this.tr('НЕИЗВЕСТНО','UNKNOWN'),{fontFamily:'system-ui, sans-serif',fontSize:`${Math.max(10,panelH*.06)}px`,color:unlocked?'#a9f58f':available?'#ffe080':'#c8c2ad',fontStyle:'bold'}).setOrigin(0,0);
    const title=this.add.text(-panelW*.42,-panelH*.20,showDetails?t(this.locale,nodeNameKey(node.id)):'???',{fontFamily:'Georgia, serif',fontSize:`${Math.max(15,panelH*.095)}px`,color:'#f5df9d',fontStyle:'bold',wordWrap:{width:panelW*.84}}).setOrigin(0,0);
    const desc=showDetails?`${t(this.locale,nodeDescriptionKey(node.id))}\n${this.nodeEffectText(node)}`:revealed?this.tr('Сначала открой предыдущие узлы.','Unlock the prerequisite nodes first.'):this.tr('Связь ещё не раскрыта.','This connection is still hidden.');
    const body=this.add.text(-panelW*.42,-panelH*.02,desc,{fontFamily:'system-ui, sans-serif',fontSize:`${Math.max(10,panelH*.054)}px`,color:'#efe9d8',lineSpacing:2,wordWrap:{width:panelW*.84},maxLines:5}).setOrigin(0,0);
    c.add([panel,icon,status,title,body]);

    if (!unlocked && available) {
      const actionW=panelW*.42, actionH=Math.max(28,panelH*.145), actionX=panelW*.22, actionY=panelH/2-actionH/2-10;
      if (affordable) {
        const btn=this.add.rectangle(actionX,actionY,actionW,actionH,0x245f30,1).setStrokeStyle(2,0x83c76b,1).setInteractive({useHandCursor:true});
        const txt=this.add.text(actionX,actionY,this.tr(`Открыть ${this.formatNumber(node.cost)}`,`Open ${this.formatNumber(node.cost)}`),{fontFamily:'Georgia, serif',fontSize:`${Math.max(10,actionH*.34)}px`,color:'#f8efc7'}).setOrigin(.5);
        btn.on('pointerover',()=>this.cancelPopoverHide()); btn.on('pointerout',()=>this.schedulePopoverHide());
        btn.on('pointerdown',(_p,_x,_y,e)=>{e.stopPropagation();if(!buyNode(this.state,node.id))return;saveState(this.state);this.platform.analytics('discovery_unlocked',{node:node.id});if(node.final)void this.platform.achievement('final_bloom');this.showToast(node.final?t(this.locale,'ending_toast'):`${NODE_ICONS[node.id]} ${t(this.locale,nodeNameKey(node.id))}`);this.renderAll();});
        c.add([btn,txt]);
      } else {
        const chip=this.add.rectangle(panelW*.25,actionY,panelW*.34,actionH*.82,0x2b302d,.96).setStrokeStyle(1,0x777061,.9);
        const need=Math.max(0,node.cost-this.state.growth);
        const txt=this.add.text(panelW*.25,actionY,this.tr(`Нужно +${this.formatNumber(need)}`,`Need +${this.formatNumber(need)}`),{fontFamily:'system-ui, sans-serif',fontSize:`${Math.max(9,actionH*.28)}px`,color:'#cfc8b4'}).setOrigin(.5);
        c.add([chip,txt]);
      }
    }

    panel.on('pointerover',()=>this.cancelPopoverHide()); panel.on('pointerout',()=>this.schedulePopoverHide());
    this.treeLayer.add(c); this.popover=c;
  }

  private schedulePopoverHide(): void { this.popoverCloseTimer?.remove(false); this.popoverCloseTimer=this.time.delayedCall(180,()=>this.hidePopover()); }
  private cancelPopoverHide(): void { this.popoverCloseTimer?.remove(false); this.popoverCloseTimer=undefined; }
  private hidePopover(): void { this.popoverCloseTimer?.remove(false); this.popoverCloseTimer=undefined; this.popover?.destroy(true); this.popover=undefined; }
  private isAvailable(node: DiscoveryNode): boolean { return !isUnlocked(this.state,node.id) && node.requires.every(req=>isUnlocked(this.state,req)); }

  private nodeEffectText(node: DiscoveryNode): string {
    const parts:string[]=[];
    if (node.incomePerSecond) {
      const split=getNodeSplit(node);
      if (split.passivePerSecond>0) parts.push(this.tr(`Пассив +${this.formatNumber(split.passivePerSecond)}/с`,`Passive +${this.formatNumber(split.passivePerSecond)}/s`));
      if (split.tapPerTap>0) parts.push(this.tr(`Тап +${this.formatNumber(split.tapPerTap)}`,`Tap +${this.formatNumber(split.tapPerTap)}`));
    }
    if (node.multiplier) parts.push(this.tr(`×${node.multiplier.toFixed(2).replace(/0$/,'')} ко всему росту`,`×${node.multiplier.toFixed(2).replace(/0$/,'')} to all growth`));
    if (node.final) parts.push(this.tr('Финальное преображение и завершение текущего дерева.','Final transformation and ending for this tree.'));
    return parts.join(' • ');
  }

  private renderBranchLabels(): void {
    const w=this.scale.width,h=this.scale.height;
    const labels=[
      {x:.24,y:.19,text:this.tr('Вода','Water')},
      {x:.76,y:.19,text:this.tr('Растения','Plants')},
      {x:.24,y:.88,text:this.tr('Климат','Climate')},
      {x:.50,y:.93,text:this.tr('Механизмы','Mechanisms')},
      {x:.76,y:.88,text:this.tr('Жизнь','Life')},
    ];
    for(const l of labels) this.treeLayer.add(this.add.text(l.x*w,l.y*h,l.text,{fontFamily:'Georgia, serif',fontSize:`${Math.max(11,Math.min(15,w/95))}px`,color:'#fff1bf',backgroundColor:'#0b1711dd',padding:{x:8,y:4}}).setOrigin(.5));
  }

  private renderTreeOnly(): void { this.hidePopover(); this.treeLayer.removeAll(true); this.renderTree(); this.treeLayer.setVisible(true); this.renderHud(); }
  private affordableNodeIds(): NodeId[] { return DISCOVERY_NODES.filter(n=>canBuy(this.state,n.id)).map(n=>n.id); }

  private renderHud(): void {
    this.hudLayer.removeAll(true);
    const w=this.scale.width,h=this.scale.height;
    this.growthText=undefined;this.stageText=undefined;this.menuText=undefined;this.menuAura=undefined;
    if (!this.treeOpen) {
      const panelW=Math.min(385,w*.34),panelH=Math.min(136,h*.19);
      const panel=this.add.rectangle(panelW/2+14,panelH/2+12,panelW,panelH,0x06140d,.92).setStrokeStyle(2,0xc89a4d,.95);
      this.growthText=this.add.text(38,28,'',{fontFamily:'Georgia, serif',fontSize:`${Math.max(15,panelH*.145)}px`,color:'#f8e9b9',lineSpacing:7,stroke:'#1d1309',strokeThickness:2});
      this.hudLayer.add([panel,this.growthText]);
      const menuW=Math.max(190,Math.min(260,w*.21)),menuH=Math.max(54,Math.min(70,h*.09)),menuX=w-menuW/2-18,menuY=menuH/2+16;
      this.menuAura=this.add.rectangle(menuX,menuY,menuW+12,menuH+12,0xffdf79,.03).setStrokeStyle(3,0xffe59c,.28);
      this.tweens.add({targets:this.menuAura,alpha:.12,duration:950,yoyo:true,repeat:-1,ease:'Sine.inOut'});
      const menu=this.add.rectangle(menuX,menuY,menuW,menuH,0x07140e,.95).setStrokeStyle(2,0xc89a4d,1).setInteractive({useHandCursor:true});
      this.menuText=this.add.text(menuX,menuY,'',{fontFamily:'Georgia, serif',fontSize:`${Math.max(15,menuH*.24)}px`,color:'#f8e3a3'}).setOrigin(.5);
      menu.on('pointerdown',(_p,_x,_y,e)=>{e.stopPropagation();this.treeOpen=true;this.clearActiveEvent();this.worldLayer.setVisible(false);this.treeLayer.setVisible(true);this.renderTreeOnly();});
      this.hudLayer.add([this.menuAura,menu,this.menuText]);
    } else {
      const backW=Math.max(190,Math.min(270,w*.21)),backH=Math.max(52,Math.min(66,h*.085)),backX=w-backW/2-18,backY=backH/2+14;
      const back=this.add.rectangle(backX,backY,backW,backH,0x07140e,.95).setStrokeStyle(2,0xc89a4d,1).setInteractive({useHandCursor:true});
      const backText=this.add.text(backX,backY,`←  ${t(this.locale,'back')}`,{fontFamily:'Georgia, serif',fontSize:`${Math.max(14,backH*.23)}px`,color:'#f5dfa2'}).setOrigin(.5);
      back.on('pointerdown',(_p,_x,_y,e)=>{e.stopPropagation();this.treeOpen=false;this.hidePopover();this.treeLayer.setVisible(false);this.worldLayer.setVisible(true);this.renderHud();});
      this.hudLayer.add([back,backText]);
      this.stageText=this.add.text(20,18,'',{fontFamily:'Georgia, serif',fontSize:'14px',color:'#f5dfa2',backgroundColor:'#0c1812dd',padding:{x:12,y:7}});
      this.hudLayer.add(this.stageText);
    }
    const language=this.add.text(w-20,h-18,t(this.locale,'language'),{fontFamily:'Georgia, serif',fontSize:'14px',color:'#f0d899',backgroundColor:'#132219ee',padding:{x:13,y:8}}).setOrigin(1,1).setInteractive({useHandCursor:true});
    language.on('pointerdown',(_p,_x,_y,e)=>{e.stopPropagation();this.locale=this.locale==='ru'?'en':'ru';saveLocale(this.locale);this.renderAll();});
    const reset=this.add.text(18,h-18,t(this.locale,'reset'),{fontFamily:'system-ui, sans-serif',fontSize:'12px',color:'#d8cda9',backgroundColor:'#132219cc',padding:{x:10,y:6}}).setOrigin(0,1).setInteractive({useHandCursor:true});
    reset.on('pointerdown',(_p,_x,_y,e)=>{e.stopPropagation();this.state=resetState();this.treeOpen=false;this.activeEventCountdown=7;this.renderAll();});
    this.hudLayer.add([language,reset]);
    this.updateHudValues();
  }

  private updateHudValues(): void {
    const passive=getIncomePerSecond(this.state),tap=getManualTapValue(this.state),affordable=this.affordableNodeIds().length;
    if(this.growthText)this.growthText.setText(`${t(this.locale,'growth')}  ${this.formatNumber(this.state.growth)}\n${this.tr('Пассив','Passive')} +${this.formatNumber(passive)}/с   •   ${this.tr('Тап','Tap')} +${this.formatNumber(tap)}`);
    if(this.stageText)this.stageText.setText(`${t(this.locale,'stage',{value:this.state.unlocked.length})}   •   ${t(this.locale,'growth')} ${this.formatNumber(this.state.growth)}`);
    if(this.menuText)this.menuText.setText(`✦  ${t(this.locale,'discoveries')}${affordable>0?` (${affordable})`:''}`);
    this.menuAura?.setVisible(affordable>0);
  }

  private pulseCentralTree(x:number,y:number,amount:number): void {
    const pulse=this.add.circle(this.scale.width*.5,this.scale.height*.52,Math.min(this.scale.width,this.scale.height)*.11,0xffdf78,.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(950);
    const reward=this.add.text(x,y-20,`+${this.formatNumber(amount)}`,{fontFamily:'Georgia, serif',fontSize:'22px',color:'#efffbc',fontStyle:'bold',stroke:'#284318',strokeThickness:4}).setOrigin(.5).setDepth(1100);
    this.tweens.add({targets:pulse,scale:1.48,alpha:0,duration:330,onComplete:()=>pulse.destroy()});
    this.tweens.add({targets:reward,y:y-64,alpha:0,duration:650,onComplete:()=>reward.destroy()});
  }

  private spawnActiveEvent(): void {
    if(this.treeOpen||this.state.completed)return;
    const eligible=ACTIVE_EVENTS.filter(e=>isUnlocked(this.state,e.requires)); if(!eligible.length)return;
    const d=Phaser.Utils.Array.GetRandom(eligible),x=d.x*this.scale.width,y=d.y*this.scale.height,size=Math.max(54,Math.min(this.scale.width,this.scale.height)*.078);
    const c=this.add.container(x,y).setDepth(900);
    const shadow=this.add.circle(0,0,size*.69,0x020504,.78).setStrokeStyle(4,0x09120d,.95);
    const halo=this.add.circle(0,0,size*.55,0x0e3a37,.96).setStrokeStyle(4,0xffe59a,1).setInteractive({useHandCursor:true});
    const icon=this.add.text(0,0,d.icon,{fontFamily:'Segoe UI Emoji, Segoe UI Symbol, sans-serif',fontSize:`${size*.38}px`,color:'#fff8d5'}).setOrigin(.5);
    const bang=this.add.text(size*.43,-size*.43,'!',{fontFamily:'system-ui, sans-serif',fontSize:`${size*.24}px`,fontStyle:'bold',color:'#1a1005',backgroundColor:'#ffe07c',padding:{x:6,y:2}}).setOrigin(.5);
    const tag=this.add.text(0,size*.86,`${this.tr('СОБЫТИЕ','EVENT')}: ${uiText(this.locale,d.textKey)}`,{fontFamily:'Georgia, serif',fontSize:`${Math.max(11,size*.16)}px`,color:'#fff6d0',backgroundColor:'#03100dee',padding:{x:10,y:5},stroke:'#000',strokeThickness:2}).setOrigin(.5).setInteractive({useHandCursor:true});
    c.add([shadow,halo,icon,bang,tag]);
    const collect=(_p:Phaser.Input.Pointer,_x:number,_y:number,e:Phaser.Types.Input.EventData)=>{e.stopPropagation();if(!this.activeEvent)return;const reward=collectActiveEvent(this.state);this.showToast(`${uiText(this.locale,d.textKey)}: +${this.formatNumber(reward)}`);this.pulseCentralTree(x,y,reward);this.clearActiveEvent();this.activeEventCountdown=Phaser.Math.Between(8,14);this.updateHudValues();};
    halo.on('pointerdown',collect);tag.on('pointerdown',collect);
    this.tweens.add({targets:halo,scale:1.06,duration:800,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    this.activeEvent=c;
    this.activeEventTimer=this.time.delayedCall(8000,()=>{this.clearActiveEvent();this.activeEventCountdown=Phaser.Math.Between(7,13);});
  }

  private clearActiveEvent(): void { this.activeEventTimer?.remove(false);this.activeEventTimer=undefined;if(this.activeEvent){this.activeEvent.destroy(true);this.activeEvent=undefined;} }
  private showToast(message:string): void { this.toastTimer?.remove(false);this.toast?.destroy();this.toast=this.add.text(this.scale.width/2,92,message,{fontFamily:'Georgia, serif',fontSize:'16px',color:'#fff0b4',backgroundColor:'#152119ee',padding:{x:18,y:10},stroke:'#24160b',strokeThickness:2,wordWrap:{width:Math.max(300,this.scale.width*.68)},align:'center'}).setOrigin(.5).setDepth(2000);this.toastTimer=this.time.delayedCall(1800,()=>{this.toast?.destroy();this.toast=undefined;this.toastTimer=undefined;}); }

  private addAmbientMotion(stage:number): void {
    const w=this.scale.width,h=this.scale.height,has=(id:NodeId)=>isUnlocked(this.state,id);
    if(stage>=1||has('pump'))for(let i=0;i<8;i++){const x=w*(.10+Math.random()*.12),y=h*(.42+Math.random()*.34);const o=this.add.circle(x,y,1.5+Math.random()*2.2,0xbbeeff,.35).setBlendMode(Phaser.BlendModes.ADD);this.worldLayer.add(o);this.ambientDots.push({object:o,vx:0,vy:28+Math.random()*38,baseX:x,baseY:y,phase:Math.random()*Math.PI*2,kind:'water'});}
    if(stage>=2||has('flowers'))for(let i=0;i<10;i++){const x=w*(.34+Math.random()*.48),y=h*(.30+Math.random()*.48);const o=this.add.circle(x,y,1.2+Math.random()*1.8,0xffd979,.28).setBlendMode(Phaser.BlendModes.ADD);this.worldLayer.add(o);this.ambientDots.push({object:o,vx:(Math.random()-.5)*9,vy:-(5+Math.random()*10),baseX:x,baseY:y,phase:Math.random()*Math.PI*2,kind:'pollen'});}
    if(has('bees')||stage>=3)for(let i=0;i<(stage>=5?4:2);i++){const x=w*(.62+Math.random()*.24),y=h*(.34+Math.random()*.30);const o=this.add.text(x,y,'•',{fontSize:`${Math.max(18,w/75)}px`,color:'#ffd34d',stroke:'#4a2b08',strokeThickness:3}).setOrigin(.5).setAlpha(.82);this.worldLayer.add(o);this.ambientDots.push({object:o,vx:8+Math.random()*11,vy:(Math.random()-.5)*7,baseX:x,baseY:y,phase:Math.random()*Math.PI*2,kind:'life'});}
    if(has('ecosystem')||stage>=5)for(let i=0;i<14;i++){const x=w*(.20+Math.random()*.64),y=h*(.20+Math.random()*.58);const o=this.add.circle(x,y,1.5+Math.random()*2,0xeaff91,.24).setBlendMode(Phaser.BlendModes.ADD);this.worldLayer.add(o);this.ambientDots.push({object:o,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*5,baseX:x,baseY:y,phase:Math.random()*Math.PI*2,kind:'firefly'});}
  }

  private animateAmbient(dt:number): void {
    if(this.treeOpen)return;this.ambientClock+=dt;const w=this.scale.width,h=this.scale.height;
    for(const a of this.ambientDots){const o=a.object;if(!o.active)continue;
      if(a.kind==='water'){o.y+=a.vy*dt;o.x=a.baseX+Math.sin(this.ambientClock*2.1+a.phase)*3;if(o.y>h*.82)o.y=h*.42;}
      else if(a.kind==='pollen'){o.y+=a.vy*dt;o.x+=a.vx*dt+Math.sin(this.ambientClock*1.4+a.phase)*.15;o.setAlpha(.18+(Math.sin(this.ambientClock*2+a.phase)+1)*.14);if(o.y<h*.20)o.y=h*.76;}
      else if(a.kind==='life'){o.x+=a.vx*dt;o.y=a.baseY+Math.sin(this.ambientClock*2.6+a.phase)*16;if(o.x>w*.90)o.x=w*.60;}
      else{o.x+=a.vx*dt;o.y+=a.vy*dt;o.setAlpha(.10+(Math.sin(this.ambientClock*3.2+a.phase)+1)*.22);if(o.x<w*.16||o.x>w*.88||o.y<h*.16||o.y>h*.84){o.x=a.baseX;o.y=a.baseY;}}
    }
  }

  private cover(image:Phaser.GameObjects.Image,width:number,height:number): void { const source=image.texture.getSourceImage() as HTMLImageElement;const scale=Math.max(width/source.width,height/source.height);image.setDisplaySize(source.width*scale,source.height*scale); }
  private formatNumber(value:number): string { if(value>=1e9)return`${(value/1e9).toFixed(2)}B`;if(value>=1e6)return`${(value/1e6).toFixed(2)}M`;if(value>=1e3)return`${(value/1e3).toFixed(1)}K`;if(value>=100)return Math.floor(value).toString();if(value>=10)return value.toFixed(1);return value.toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1'); }
}