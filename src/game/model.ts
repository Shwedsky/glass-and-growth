import { DISCOVERY_NODES, NODE_BY_ID, type NodeId } from './content';

export interface GameState {
  version: 2;
  growth: number;
  lifetimeGrowth: number;
  unlocked: NodeId[];
  lastUpdatedAt: number;
  completed: boolean;
  activeEventsCollected: number;
}

const SAVE_KEY = 'glass-and-growth:p2';

export function createInitialState(now = Date.now()): GameState {
  return {
    version: 2,
    growth: 0,
    lifetimeGrowth: 0,
    unlocked: [],
    lastUpdatedAt: now,
    completed: false,
    activeEventsCollected: 0,
  };
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (parsed.version !== 2 || !Array.isArray(parsed.unlocked)) return createInitialState();
    return {
      version: 2,
      growth: Math.max(0, Number(parsed.growth) || 0),
      lifetimeGrowth: Math.max(0, Number(parsed.lifetimeGrowth) || 0),
      unlocked: parsed.unlocked.filter((id): id is NodeId => id in NODE_BY_ID),
      lastUpdatedAt: Number(parsed.lastUpdatedAt) || Date.now(),
      completed: Boolean(parsed.completed),
      activeEventsCollected: Math.max(0, Math.floor(Number(parsed.activeEventsCollected) || 0)),
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
  if (node.branch === 'synergy' || node.branch === 'final') {
    return node.requires.every((requirement) => state.unlocked.includes(requirement));
  }
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

export function canManualTap(state: GameState): boolean {
  return !state.completed;
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

/**
 * Active play is deliberately stronger than passive play while the player is engaged.
 * Before automation a tap is the bootstrap source. Afterwards each tap is worth roughly
 * half a second of the current automated economy, so its value grows with the greenhouse.
 * At ~2 taps/sec the active contribution slightly exceeds passive production.
 */
export function getManualTapValue(state: GameState): number {
  const passive = getIncomePerSecond(state);
  if (passive <= 0) return 1;
  return Math.max(1, passive * 0.55);
}

export function getActiveEventReward(state: GameState): number {
  const income = getIncomePerSecond(state);
  return Math.max(5, Math.round(income * 5));
}

export function grantGrowth(state: GameState, amount: number): void {
  if (amount <= 0 || !Number.isFinite(amount)) return;
  state.growth += amount;
  state.lifetimeGrowth += amount;
}

export function collectActiveEvent(state: GameState): number {
  const reward = getActiveEventReward(state);
  grantGrowth(state, reward);
  state.activeEventsCollected += 1;
  return reward;
}

export function simulate(state: GameState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  grantGrowth(state, getIncomePerSecond(state) * deltaSeconds);
}

export function applyOfflineProgress(state: GameState, now = Date.now()): number {
  const elapsedSeconds = Math.max(0, (now - state.lastUpdatedAt) / 1000);
  const creditedSeconds = Math.min(elapsedSeconds, 20 * 60);
  const before = state.growth;
  simulate(state, creditedSeconds);
  state.lastUpdatedAt = now;
  return state.growth - before;
}
