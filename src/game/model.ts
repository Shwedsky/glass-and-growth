import { DISCOVERY_NODES, NODE_BY_ID, type Branch, type DiscoveryNode, type NodeId } from './content';
import { getGenerationBonuses, resetP4Meta } from './p4Meta';

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

export const BRANCH_ACTIVE_SHARE: Record<Branch, number> = {
  water: 0.00,
  plants: 1.00,
  mechanisms: 0.50,
  climate: 0.30,
  life: 0.70,
  synergy: 0.50,
  final: 0.50,
};

export function createInitialState(now = Date.now()): GameState {
  return { version: 2, growth: 0, lifetimeGrowth: 0, unlocked: [], lastUpdatedAt: now, completed: false, activeEventsCollected: 0 };
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
  } catch { return createInitialState(); }
}

export function saveState(state: GameState): void {
  state.lastUpdatedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function resetState(): GameState {
  localStorage.removeItem(SAVE_KEY);
  resetP4Meta();
  return createInitialState();
}

export function isUnlocked(state: GameState, id: NodeId): boolean { return state.unlocked.includes(id); }

export function isRevealed(state: GameState, id: NodeId): boolean {
  const node = NODE_BY_ID[id];
  if (node.requires.length === 0) return true;
  if (node.branch === 'synergy' || node.branch === 'final') return node.requires.every((r) => state.unlocked.includes(r));
  return node.requires.some((r) => state.unlocked.includes(r));
}

export function canBuy(state: GameState, id: NodeId): boolean {
  const node = NODE_BY_ID[id];
  return !isUnlocked(state, id) && node.requires.every((r) => isUnlocked(state, r)) && state.growth >= node.cost;
}

export function buyNode(state: GameState, id: NodeId): boolean {
  if (!canBuy(state, id)) return false;
  const node = NODE_BY_ID[id];
  state.growth -= node.cost;
  state.unlocked.push(id);
  if (node.final) state.completed = true;
  return true;
}

function productionMultiplier(state: GameState): number {
  return DISCOVERY_NODES.reduce((value, node) => value * (isUnlocked(state, node.id) ? node.multiplier ?? 1 : 1), 1);
}

function rawSplit(node: DiscoveryNode): { passive: number; active: number } {
  const output = node.incomePerSecond ?? 0;
  const activeShare = BRANCH_ACTIVE_SHARE[node.branch];
  return { passive: output * (1 - activeShare), active: output * activeShare };
}

export function getPassiveIncomePerSecond(state: GameState): number {
  const base = DISCOVERY_NODES.reduce((sum, node) => sum + (isUnlocked(state, node.id) ? rawSplit(node).passive : 0), 0);
  const bonus = getGenerationBonuses();
  return base * productionMultiplier(state) * bonus.passiveMultiplier + bonus.helperPassive;
}

export function getActiveContributionPerSecond(state: GameState): number {
  const base = DISCOVERY_NODES.reduce((sum, node) => sum + (isUnlocked(state, node.id) ? rawSplit(node).active : 0), 0);
  return base * productionMultiplier(state) * getGenerationBonuses().tapMultiplier;
}

export function getIncomePerSecond(state: GameState): number { return getPassiveIncomePerSecond(state); }
export function canManualTap(state: GameState): boolean { return !state.completed; }

export function getManualTapValue(state: GameState): number {
  const active = getActiveContributionPerSecond(state);
  return Math.max(1, active / 2);
}

export function getNodeSplit(node: DiscoveryNode): { passivePerSecond: number; tapPerTap: number } {
  const split = rawSplit(node);
  return { passivePerSecond: split.passive, tapPerTap: split.active / 2 };
}

export function getActiveEventReward(state: GameState): number {
  const totalCapacity = getPassiveIncomePerSecond(state) + getActiveContributionPerSecond(state);
  return Math.max(5, Math.round(totalCapacity * 4));
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
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gg-world-event', { detail: { reward } }));
  return reward;
}

export function simulate(state: GameState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  grantGrowth(state, getPassiveIncomePerSecond(state) * deltaSeconds);
}

export function applyOfflineProgress(state: GameState, now = Date.now()): number {
  const elapsedSeconds = Math.max(0, (now - state.lastUpdatedAt) / 1000);
  const creditedSeconds = Math.min(elapsedSeconds, 20 * 60);
  const before = state.growth;
  simulate(state, creditedSeconds);
  state.lastUpdatedAt = now;
  return state.growth - before;
}
