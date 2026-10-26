import { DISCOVERY_NODES, NODE_BY_ID, type NodeId } from './content';

export interface GameState {
  version: 1;
  growth: number;
  lifetimeGrowth: number;
  unlocked: NodeId[];
  lastUpdatedAt: number;
  completed: boolean;
}

const SAVE_KEY = 'glass-and-growth:p0';

export function createInitialState(now = Date.now()): GameState {
  return {
    version: 1,
    growth: 0,
    lifetimeGrowth: 0,
    unlocked: [],
    lastUpdatedAt: now,
    completed: false,
  };
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.unlocked)) return createInitialState();
    return {
      version: 1,
      growth: Math.max(0, Number(parsed.growth) || 0),
      lifetimeGrowth: Math.max(0, Number(parsed.lifetimeGrowth) || 0),
      unlocked: parsed.unlocked.filter((id): id is NodeId => id in NODE_BY_ID),
      lastUpdatedAt: Number(parsed.lastUpdatedAt) || Date.now(),
      completed: Boolean(parsed.completed),
    };
  } catch {
    return createInitialState();
  }
}

export function saveState(state: GameState): void {
  state.lastUpdatedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function resetState(): GameState {
  localStorage.removeItem(SAVE_KEY);
  return createInitialState();
}

export function isUnlocked(state: GameState, id: NodeId): boolean {
  return state.unlocked.includes(id);
}

export function isRevealed(state: GameState, id: NodeId): boolean {
  const node = NODE_BY_ID[id];
  if (node.requires.length === 0) return true;
  return node.requires.some((requirement) => state.unlocked.includes(requirement));
}

export function canBuy(state: GameState, id: NodeId): boolean {
  const node = NODE_BY_ID[id];
  return (
    !isUnlocked(state, id) &&
    node.requires.every((requirement) => isUnlocked(state, requirement)) &&
    state.growth >= node.cost
  );
}

export function buyNode(state: GameState, id: NodeId): boolean {
  if (!canBuy(state, id)) return false;
  const node = NODE_BY_ID[id];
  state.growth -= node.cost;
  state.unlocked.push(id);
  if (node.final) state.completed = true;
  return true;
}

export function getClickValue(state: GameState): number {
  return 1 + DISCOVERY_NODES.reduce(
    (sum, node) => sum + (isUnlocked(state, node.id) ? node.clickBonus ?? 0 : 0),
    0,
  );
}

export function getIncomePerSecond(state: GameState): number {
  const base = DISCOVERY_NODES.reduce(
    (sum, node) => sum + (isUnlocked(state, node.id) ? node.incomePerSecond ?? 0 : 0),
    0,
  );
  const multiplier = DISCOVERY_NODES.reduce(
    (value, node) => value * (isUnlocked(state, node.id) ? node.multiplier ?? 1 : 1),
    1,
  );
  return base * multiplier;
}

export function grantGrowth(state: GameState, amount: number): void {
  if (amount <= 0 || !Number.isFinite(amount)) return;
  state.growth += amount;
  state.lifetimeGrowth += amount;
}

export function simulate(state: GameState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  grantGrowth(state, getIncomePerSecond(state) * deltaSeconds);
}

export function applyOfflineProgress(state: GameState, now = Date.now()): number {
  const elapsedSeconds = Math.max(0, (now - state.lastUpdatedAt) / 1000);
  const creditedSeconds = Math.min(elapsedSeconds, 10 * 60);
  const before = state.growth;
  simulate(state, creditedSeconds);
  state.lastUpdatedAt = now;
  return state.growth - before;
}
