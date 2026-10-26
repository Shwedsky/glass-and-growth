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

export const DISCOVERY_NODES: DiscoveryNode[] = [
  { id: 'sprout', cost: 20, incomePerSecond: 0.30, requires: [], branch: 'plants', stage: 0 },
  { id: 'pump', cost: 30, incomePerSecond: 0.42, requires: ['sprout'], branch: 'water', stage: 1 },
  { id: 'bed', cost: 50, incomePerSecond: 0.59, requires: ['sprout'], branch: 'plants', stage: 1 },
  { id: 'gutters', cost: 80, incomePerSecond: 0.82, requires: ['pump'], branch: 'water', stage: 2 },
  { id: 'flowers', cost: 125, incomePerSecond: 1.15, requires: ['bed'], branch: 'plants', stage: 2 },
  { id: 'glass', cost: 250, incomePerSecond: 1.61, requires: ['pump'], branch: 'climate', stage: 2 },
  { id: 'cistern', cost: 425, incomePerSecond: 2.26, requires: ['gutters'], branch: 'water', stage: 3 },
  { id: 'herbs', cost: 675, incomePerSecond: 3.16, requires: ['flowers'], branch: 'plants', stage: 3 },
  { id: 'gears', cost: 1100, incomePerSecond: 4.43, requires: ['pump'], branch: 'mechanisms', stage: 3 },
  { id: 'mirrors', cost: 1800, incomePerSecond: 6.20, requires: ['glass'], branch: 'climate', stage: 3 },
  { id: 'bees', cost: 2900, incomePerSecond: 8.68, requires: ['flowers'], branch: 'life', stage: 3 },
  { id: 'irrigation', cost: 4600, incomePerSecond: 12.15, requires: ['cistern', 'bed'], branch: 'water', stage: 4 },
  { id: 'vines', cost: 7300, incomePerSecond: 17.01, requires: ['herbs'], branch: 'plants', stage: 4 },
  { id: 'timer', cost: 12000, incomePerSecond: 23.81, requires: ['gears'], branch: 'mechanisms', stage: 4 },
  { id: 'vents', cost: 18000, incomePerSecond: 33.34, requires: ['mirrors'], branch: 'climate', stage: 4 },
  { id: 'butterflies', cost: 30000, incomePerSecond: 46.67, requires: ['flowers', 'mirrors'], branch: 'life', stage: 4 },
  { id: 'filter', cost: 48000, incomePerSecond: 65.34, requires: ['irrigation'], branch: 'water', stage: 5 },
  { id: 'pollination', cost: 77000, multiplier: 1.50, requires: ['bees', 'flowers', 'gutters'], branch: 'synergy', stage: 5 },
  { id: 'orchid', cost: 122000, incomePerSecond: 128.06, requires: ['vines'], branch: 'plants', stage: 5 },
  { id: 'auto_valves', cost: 200000, incomePerSecond: 179.29, requires: ['timer', 'irrigation'], branch: 'mechanisms', stage: 5 },
  { id: 'heater', cost: 310000, incomePerSecond: 251.00, requires: ['vents'], branch: 'climate', stage: 5 },
  { id: 'dragonflies', cost: 510000, incomePerSecond: 351.41, requires: ['pond', 'bees'], branch: 'life', stage: 7 },
  { id: 'pond', cost: 810000, incomePerSecond: 491.97, requires: ['filter'], branch: 'water', stage: 6 },
  { id: 'humidity', cost: 1300000, multiplier: 1.40, requires: ['pond', 'vents'], branch: 'synergy', stage: 7 },
  { id: 'canopy', cost: 2100000, incomePerSecond: 964.26, requires: ['orchid'], branch: 'plants', stage: 7 },
  { id: 'roof_drive', cost: 3200000, incomePerSecond: 1349.96, requires: ['auto_valves', 'vents'], branch: 'mechanisms', stage: 7 },
  { id: 'climate', cost: 5300000, incomePerSecond: 1889.95, requires: ['heater'], branch: 'climate', stage: 7 },
  { id: 'birds', cost: 8500000, incomePerSecond: 2645.93, requires: ['canopy', 'dragonflies'], branch: 'life', stage: 8 },
  { id: 'ecosystem', cost: 13000000, multiplier: 2.00, requires: ['birds', 'climate', 'roof_drive'], branch: 'synergy', stage: 9 },
  { id: 'central_bud', cost: 22000000, incomePerSecond: 5186.02, requires: ['ecosystem', 'canopy'], branch: 'final', stage: 10 },
  { id: 'open_roof', cost: 35000000, requires: ['central_bud', 'roof_drive'], branch: 'final', stage: 11 },
  { id: 'final_bloom', cost: 56000000, requires: ['open_roof', 'birds', 'pond'], branch: 'final', stage: 12, final: true },
];

export const NODE_BY_ID = Object.fromEntries(
  DISCOVERY_NODES.map((node) => [node.id, node]),
) as Record<NodeId, DiscoveryNode>;

export const BRANCH_X: Record<Branch, number> = {
  water: 0.14,
  plants: 0.31,
  climate: 0.48,
  mechanisms: 0.65,
  life: 0.82,
  synergy: 0.48,
  final: 0.48,
};
