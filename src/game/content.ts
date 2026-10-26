export type NodeId =
  | 'sprout'
  | 'pump'
  | 'planter'
  | 'rain'
  | 'flowers'
  | 'hive'
  | 'pollination'
  | 'roof';

export interface DiscoveryNode {
  id: NodeId;
  name: string;
  description: string;
  cost: number;
  requires: NodeId[];
  incomePerSecond?: number;
  clickBonus?: number;
  multiplier?: number;
  final?: boolean;
}

export const DISCOVERY_NODES: DiscoveryNode[] = [
  {
    id: 'sprout',
    name: 'First Sprout',
    description: 'A stubborn green shoot pushes through the dry soil.',
    cost: 20,
    requires: [],
    clickBonus: 1,
  },
  {
    id: 'pump',
    name: 'Old Pump',
    description: 'Water returns to the greenhouse pipes.',
    cost: 55,
    requires: ['sprout'],
    incomePerSecond: 1.2,
  },
  {
    id: 'planter',
    name: 'Warm Planter',
    description: 'A dormant planting bed becomes productive again.',
    cost: 80,
    requires: ['sprout'],
    incomePerSecond: 1.8,
  },
  {
    id: 'rain',
    name: 'Rain Collector',
    description: 'The glass roof starts feeding a simple reservoir.',
    cost: 145,
    requires: ['pump'],
    incomePerSecond: 3.2,
  },
  {
    id: 'flowers',
    name: 'First Flowers',
    description: 'Colour returns to the beds and the air feels different.',
    cost: 180,
    requires: ['planter'],
    incomePerSecond: 4.4,
  },
  {
    id: 'hive',
    name: 'A Quiet Buzz',
    description: 'Small visitors make the greenhouse their home.',
    cost: 310,
    requires: ['flowers'],
    incomePerSecond: 6.5,
  },
  {
    id: 'pollination',
    name: 'Pollination',
    description: 'Flowers and bees begin amplifying one another.',
    cost: 420,
    requires: ['flowers', 'hive', 'rain'],
    multiplier: 1.75,
  },
  {
    id: 'roof',
    name: 'Open the Roof',
    description: 'Let the restored greenhouse breathe again.',
    cost: 1150,
    requires: ['pollination'],
    final: true,
  },
];

export const NODE_BY_ID = Object.fromEntries(
  DISCOVERY_NODES.map((node) => [node.id, node]),
) as Record<NodeId, DiscoveryNode>;
