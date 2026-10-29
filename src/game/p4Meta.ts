export type CrewUpgradeId =
  | 'sharp_tools'
  | 'assistant_gardener'
  | 'watering_rounds'
  | 'quick_hands'
  | 'foreman'
  | 'greenhouse_rhythm';

export interface CrewUpgradeDef {
  id: CrewUpgradeId;
  cost: number;
  requires: CrewUpgradeId[];
  ru: string;
  en: string;
  ruDescription: string;
  enDescription: string;
}

export const CREW_UPGRADES: CrewUpgradeDef[] = [
  {
    id: 'sharp_tools', cost: 1, requires: [], ru: 'Острые инструменты', en: 'Sharp Tools',
    ruDescription: '+12% к силе тапа навсегда.', enDescription: '+12% tap power permanently.',
  },
  {
    id: 'assistant_gardener', cost: 2, requires: [], ru: 'Помощник садовника', en: 'Garden Assistant',
    ruDescription: 'В оранжерее появляется второй работник. +12% пассивного роста.', enDescription: 'A second worker joins the greenhouse. +12% passive growth.',
  },
  {
    id: 'watering_rounds', cost: 1, requires: ['assistant_gardener'], ru: 'Обход с поливом', en: 'Watering Rounds',
    ruDescription: '+10% пассивного роста. Садовники чаще работают у грядок.', enDescription: '+10% passive growth. Gardeners spend more time tending beds.',
  },
  {
    id: 'quick_hands', cost: 2, requires: ['sharp_tools'], ru: 'Быстрые руки', en: 'Quick Hands',
    ruDescription: 'Ещё +15% к силе тапа.', enDescription: 'Another +15% tap power.',
  },
  {
    id: 'foreman', cost: 3, requires: ['assistant_gardener', 'watering_rounds'], ru: 'Бригадир', en: 'Foreman',
    ruDescription: 'Третий садовник и +15% пассивного роста.', enDescription: 'A third gardener and +15% passive growth.',
  },
  {
    id: 'greenhouse_rhythm', cost: 3, requires: ['quick_hands', 'foreman'], ru: 'Ритм оранжереи', en: 'Greenhouse Rhythm',
    ruDescription: '+8% к тапу и пассиву. Команда работает как единая система.', enDescription: '+8% tap and passive. The crew works as one system.',
  },
];

const CREW_BY_ID = Object.fromEntries(CREW_UPGRADES.map((upgrade) => [upgrade.id, upgrade])) as Record<CrewUpgradeId, CrewUpgradeDef>;

export interface P4MetaState {
  version: 2;
  generation: 1 | 2 | 3;
  bloomsCompleted: number;
  treeVigor: number;
  crewPoints: number;
  crewUpgrades: CrewUpgradeId[];
}

const META_KEY = 'glass-and-growth:p4-meta';

const DEFAULT_META: P4MetaState = {
  version: 2,
  generation: 1,
  bloomsCompleted: 0,
  treeVigor: 0,
  crewPoints: 0,
  crewUpgrades: [],
};

let cachedMeta: P4MetaState | undefined;

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function cloneMeta(meta: P4MetaState): P4MetaState {
  return { ...meta, crewUpgrades: [...meta.crewUpgrades] };
}

function readMetaFromStorage(): P4MetaState {
  if (!hasStorage()) return cloneMeta(DEFAULT_META);
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return cloneMeta(DEFAULT_META);
    const parsed = JSON.parse(raw) as Partial<P4MetaState> & { version?: number };
    const generation = Math.min(3, Math.max(1, Math.floor(Number(parsed.generation) || 1))) as 1 | 2 | 3;
    const crewUpgrades = Array.isArray(parsed.crewUpgrades)
      ? parsed.crewUpgrades.filter((id): id is CrewUpgradeId => typeof id === 'string' && id in CREW_BY_ID)
      : [];
    return {
      version: 2,
      generation,
      bloomsCompleted: Math.max(0, Math.floor(Number(parsed.bloomsCompleted) || 0)),
      treeVigor: Math.min(100, Math.max(0, Number(parsed.treeVigor) || 0)),
      crewPoints: Math.max(0, Math.floor(Number(parsed.crewPoints) || 0)),
      crewUpgrades: [...new Set(crewUpgrades)],
    };
  } catch {
    return cloneMeta(DEFAULT_META);
  }
}

export function loadP4Meta(): P4MetaState {
  if (!cachedMeta) cachedMeta = readMetaFromStorage();
  return cloneMeta(cachedMeta);
}

export function saveP4Meta(meta: P4MetaState): void {
  cachedMeta = cloneMeta(meta);
  if (!hasStorage()) return;
  localStorage.setItem(META_KEY, JSON.stringify(cachedMeta));
}

export function resetP4Meta(): void {
  cachedMeta = undefined;
  if (hasStorage()) localStorage.removeItem(META_KEY);
}

export function applyManualTap(meta: P4MetaState, amount: number): P4MetaState {
  const next = cloneMeta(meta);
  const gain = 0.32 + Math.min(0.85, Math.log10(Math.max(1, amount) + 1) * 0.18);
  next.treeVigor = Math.min(100, next.treeVigor + gain);
  cachedMeta = cloneMeta(next);
  return next;
}

export function applyWorldEvent(meta: P4MetaState): P4MetaState {
  const next = cloneMeta(meta);
  next.treeVigor = Math.min(100, next.treeVigor + 3.5);
  cachedMeta = cloneMeta(next);
  return next;
}

export function canBuyCrewUpgrade(meta: P4MetaState, id: CrewUpgradeId): boolean {
  const upgrade = CREW_BY_ID[id];
  return meta.generation >= 2
    && !meta.crewUpgrades.includes(id)
    && upgrade.requires.every((required) => meta.crewUpgrades.includes(required))
    && meta.crewPoints >= upgrade.cost;
}

export function buyCrewUpgrade(meta: P4MetaState, id: CrewUpgradeId): P4MetaState {
  if (!canBuyCrewUpgrade(meta, id)) return cloneMeta(meta);
  const next = cloneMeta(meta);
  next.crewPoints -= CREW_BY_ID[id].cost;
  next.crewUpgrades.push(id);
  saveP4Meta(next);
  return next;
}

export function getCrewUpgrade(id: CrewUpgradeId): CrewUpgradeDef {
  return CREW_BY_ID[id];
}

export function getCrewGardenerCount(meta = loadP4Meta()): number {
  if (meta.generation < 2) return 0;
  let count = 1;
  if (meta.crewUpgrades.includes('assistant_gardener')) count += 1;
  if (meta.crewUpgrades.includes('foreman')) count += 1;
  return count;
}

export function getGenerationBonuses(meta = loadP4Meta()): {
  passiveMultiplier: number;
  tapMultiplier: number;
  helperPassive: number;
  startingGrowth: number;
  helperName: 'none' | 'gardener' | 'fountain';
} {
  let passiveMultiplier = meta.generation === 3 ? 1.28 : meta.generation === 2 ? 1.12 : 1;
  let tapMultiplier = meta.generation === 3 ? 1.38 : meta.generation === 2 ? 1.18 : 1;
  let helperPassive = meta.generation === 3 ? 35 : meta.generation === 2 ? 4 : 0;
  const startingGrowth = meta.generation === 3 ? 60_000 : meta.generation === 2 ? 2_000 : 0;
  const helperName = meta.generation === 3 ? 'fountain' : meta.generation === 2 ? 'gardener' : 'none';

  if (meta.crewUpgrades.includes('sharp_tools')) tapMultiplier *= 1.12;
  if (meta.crewUpgrades.includes('assistant_gardener')) { passiveMultiplier *= 1.12; helperPassive += 2; }
  if (meta.crewUpgrades.includes('watering_rounds')) passiveMultiplier *= 1.10;
  if (meta.crewUpgrades.includes('quick_hands')) tapMultiplier *= 1.15;
  if (meta.crewUpgrades.includes('foreman')) { passiveMultiplier *= 1.15; helperPassive += 6; }
  if (meta.crewUpgrades.includes('greenhouse_rhythm')) { passiveMultiplier *= 1.08; tapMultiplier *= 1.08; }

  return { passiveMultiplier, tapMultiplier, helperPassive, startingGrowth, helperName };
}

export function advanceGeneration(): { meta: P4MetaState; advanced: boolean; startingGrowth: number } {
  const meta = loadP4Meta();
  meta.bloomsCompleted += 1;
  if (meta.generation >= 3) {
    saveP4Meta(meta);
    return { meta, advanced: false, startingGrowth: 0 };
  }
  meta.crewPoints += meta.generation === 1 ? 3 : 4;
  meta.generation = (meta.generation + 1) as 2 | 3;
  meta.treeVigor = meta.generation === 2 ? 18 : 32;
  saveP4Meta(meta);
  return { meta, advanced: true, startingGrowth: getGenerationBonuses(meta).startingGrowth };
}
