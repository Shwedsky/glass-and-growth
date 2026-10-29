export interface P4MetaState {
  version: 1;
  generation: 1 | 2 | 3;
  bloomsCompleted: number;
  treeVigor: number;
}

const META_KEY = 'glass-and-growth:p4-meta';

const DEFAULT_META: P4MetaState = {
  version: 1,
  generation: 1,
  bloomsCompleted: 0,
  treeVigor: 0,
};

let cachedMeta: P4MetaState | undefined;

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function cloneMeta(meta: P4MetaState): P4MetaState {
  return { ...meta };
}

function readMetaFromStorage(): P4MetaState {
  if (!hasStorage()) return cloneMeta(DEFAULT_META);
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return cloneMeta(DEFAULT_META);
    const parsed = JSON.parse(raw) as Partial<P4MetaState>;
    const generation = Math.min(3, Math.max(1, Math.floor(Number(parsed.generation) || 1))) as 1 | 2 | 3;
    return {
      version: 1,
      generation,
      bloomsCompleted: Math.max(0, Math.floor(Number(parsed.bloomsCompleted) || 0)),
      treeVigor: Math.min(100, Math.max(0, Number(parsed.treeVigor) || 0)),
    };
  } catch {
    return cloneMeta(DEFAULT_META);
  }
}

/**
 * Returns a defensive copy of the cached generation state.
 * Storage is read once per page lifecycle instead of once per simulation frame.
 */
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

/** Pure tap update; callers choose when to persist. */
export function applyManualTap(meta: P4MetaState, amount: number): P4MetaState {
  const next = cloneMeta(meta);
  const gain = 0.32 + Math.min(0.85, Math.log10(Math.max(1, amount) + 1) * 0.18);
  next.treeVigor = Math.min(100, next.treeVigor + gain);
  cachedMeta = cloneMeta(next);
  return next;
}

/** Pure world-event update; callers choose when to persist. */
export function applyWorldEvent(meta: P4MetaState): P4MetaState {
  const next = cloneMeta(meta);
  next.treeVigor = Math.min(100, next.treeVigor + 3.5);
  cachedMeta = cloneMeta(next);
  return next;
}

export function getGenerationBonuses(meta = loadP4Meta()): {
  passiveMultiplier: number;
  tapMultiplier: number;
  helperPassive: number;
  startingGrowth: number;
  helperName: 'none' | 'gardener' | 'fountain';
} {
  if (meta.generation === 2) {
    return { passiveMultiplier: 1.12, tapMultiplier: 1.18, helperPassive: 4, startingGrowth: 2_000, helperName: 'gardener' };
  }
  if (meta.generation === 3) {
    return { passiveMultiplier: 1.28, tapMultiplier: 1.38, helperPassive: 35, startingGrowth: 60_000, helperName: 'fountain' };
  }
  return { passiveMultiplier: 1, tapMultiplier: 1, helperPassive: 0, startingGrowth: 0, helperName: 'none' };
}

export function advanceGeneration(): { meta: P4MetaState; advanced: boolean; startingGrowth: number } {
  const meta = loadP4Meta();
  meta.bloomsCompleted += 1;
  if (meta.generation >= 3) {
    saveP4Meta(meta);
    return { meta, advanced: false, startingGrowth: 0 };
  }
  meta.generation = (meta.generation + 1) as 2 | 3;
  meta.treeVigor = meta.generation === 2 ? 18 : 32;
  saveP4Meta(meta);
  return { meta, advanced: true, startingGrowth: getGenerationBonuses(meta).startingGrowth };
}
