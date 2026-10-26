export type Branch = 'water' | 'plants' | 'climate' | 'life' | 'mechanisms' | 'synergy' | 'final';

export type NodeId =
  | 'sprout'
  | 'pump'
  | 'bed'
  | 'gutters'
  | 'flowers'
  | 'glass'
  | 'cistern'
  | 'herbs'
  | 'gears'
  | 'mirrors'
  | 'bees'
  | 'irrigation'
  | 'vines'
  | 'timer'
  | 'vents'
  | 'butterflies'
  | 'filter'
  | 'pollination'
  | 'orchid'
  | 'auto_valves'
  | 'heater'
  | 'dragonflies'
  | 'pond'
  | 'humidity'
  | 'canopy'
  | 'roof_drive'
  | 'climate'
  | 'birds'
  | 'ecosystem'
  | 'central_bud'
  | 'open_roof'
  | 'final_bloom';

export interface DiscoveryNode {
  id: NodeId;
  cost: number;
  requires: NodeId[];
  branch: Branch;
  stage: number;
  incomePerSecond?: number;
  multiplier?: number;
  final?: boolean;
}

// Owner playtest showed that passive production felt more important than playing.
// Costs are intentionally ~20% above the first P1 curve so scaled tapping can be
// the primary accelerator without collapsing the full campaign below ~2 hours.
export const DISCOVERY_NODES: DiscoveryNode[] = [
  { id: 'sprout', cost: 24, incomePerSecond: 0.30, requires: [], branch: 'plants', stage: 0 },
  { id: 'pump', cost: 36, incomePerSecond: 0.42, requires: ['sprout'], branch: 'water', stage: 1 },
  { id: 'bed', cost: 60, incomePerSecond: 0.59, requires: ['sprout'], branch: 'plants', stage: 1 },
  { id: 'gutters', cost: 96, incomePerSecond: 0.82, requires: ['pump'], branch: 'water', stage: 2 },
  { id: 'flowers', cost: 150, incomePerSecond: 1.15, requires: ['bed'], branch: 'plants', stage: 2 },
  { id: 'glass', cost: 300, incomePerSecond: 1.61, requires: ['pump'], branch: 'climate', stage: 2 },
  { id: 'cistern', cost: 510, incomePerSecond: 2.26, requires: ['gutters'], branch: 'water', stage: 3 },
  { id: 'herbs', cost: 810, incomePerSecond: 3.16, requires: ['flowers'], branch: 'plants', stage: 3 },
  { id: 'gears', cost: 1320, incomePerSecond: 4.43, requires: ['pump'], branch: 'mechanisms', stage: 3 },
  { id: 'mirrors', cost: 2160, incomePerSecond: 6.20, requires: ['glass'], branch: 'climate', stage: 3 },
  { id: 'bees', cost: 3480, incomePerSecond: 8.68, requires: ['flowers'], branch: 'life', stage: 3 },
  { id: 'irrigation', cost: 5520, incomePerSecond: 12.15, requires: ['cistern', 'bed'], branch: 'water', stage: 4 },
  { id: 'vines', cost: 8760, incomePerSecond: 17.01, requires: ['herbs'], branch: 'plants', stage: 4 },
  { id: 'timer', cost: 14400, incomePerSecond: 23.81, requires: ['gears'], branch: 'mechanisms', stage: 4 },
  { id: 'vents', cost: 21600, incomePerSecond: 33.34, requires: ['mirrors'], branch: 'climate', stage: 4 },
  { id: 'butterflies', cost: 36000, incomePerSecond: 46.67, requires: ['flowers', 'mirrors'], branch: 'life', stage: 4 },
  { id: 'filter', cost: 57600, incomePerSecond: 65.34, requires: ['irrigation'], branch: 'water', stage: 5 },
  { id: 'pollination', cost: 92400, multiplier: 1.50, requires: ['bees', 'flowers', 'gutters'], branch: 'synergy', stage: 5 },
  { id: 'orchid', cost: 146400, incomePerSecond: 128.06, requires: ['vines'], branch: 'plants', stage: 5 },
  { id: 'auto_valves', cost: 240000, incomePerSecond: 179.29, requires: ['timer', 'irrigation'], branch: 'mechanisms', stage: 5 },
  { id: 'heater', cost: 372000, incomePerSecond: 251.00, requires: ['vents'], branch: 'climate', stage: 5 },
  { id: 'pond', cost: 972000, incomePerSecond: 491.97, requires: ['filter'], branch: 'water', stage: 6 },
  { id: 'dragonflies', cost: 612000, incomePerSecond: 351.41, requires: ['pond', 'bees'], branch: 'life', stage: 7 },
  { id: 'humidity', cost: 1560000, multiplier: 1.40, requires: ['pond', 'vents'], branch: 'synergy', stage: 7 },
  { id: 'canopy', cost: 2520000, incomePerSecond: 964.26, requires: ['orchid'], branch: 'plants', stage: 7 },
  { id: 'roof_drive', cost: 3840000, incomePerSecond: 1349.96, requires: ['auto_valves', 'vents'], branch: 'mechanisms', stage: 7 },
  { id: 'climate', cost: 6360000, incomePerSecond: 1889.95, requires: ['heater'], branch: 'climate', stage: 7 },
  { id: 'birds', cost: 10200000, incomePerSecond: 2645.93, requires: ['canopy', 'dragonflies'], branch: 'life', stage: 8 },
  { id: 'ecosystem', cost: 15600000, multiplier: 2.00, requires: ['birds', 'climate', 'roof_drive'], branch: 'synergy', stage: 9 },
  { id: 'central_bud', cost: 26400000, incomePerSecond: 5186.02, requires: ['ecosystem', 'canopy'], branch: 'final', stage: 10 },
  { id: 'open_roof', cost: 42000000, requires: ['central_bud', 'roof_drive'], branch: 'final', stage: 11 },
  { id: 'final_bloom', cost: 67200000, requires: ['open_roof', 'birds', 'pond'], branch: 'final', stage: 12, final: true },
];

export const NODE_BY_ID = Object.fromEntries(
  DISCOVERY_NODES.map((node) => [node.id, node]),
) as Record<NodeId, DiscoveryNode>;

export const BRANCH_X: Record<Branch, number> = {
  water: 0.10,
  plants: 0.30,
  climate: 0.50,
  mechanisms: 0.70,
  life: 0.90,
  synergy: 0.50,
  final: 0.50,
};
