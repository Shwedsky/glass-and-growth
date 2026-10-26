const nodes = [
  ['sprout', 20, 0.30, [], 'plants'],
  ['pump', 30, 0.42, ['sprout'], 'water'],
  ['bed', 50, 0.59, ['sprout'], 'plants'],
  ['gutters', 80, 0.82, ['pump'], 'water'],
  ['flowers', 125, 1.15, ['bed'], 'plants'],
  ['glass', 250, 1.61, ['pump'], 'climate'],
  ['cistern', 425, 2.26, ['gutters'], 'water'],
  ['herbs', 675, 3.16, ['flowers'], 'plants'],
  ['gears', 1100, 4.43, ['pump'], 'mechanisms'],
  ['mirrors', 1800, 6.20, ['glass'], 'climate'],
  ['bees', 2900, 8.68, ['flowers'], 'life'],
  ['irrigation', 4600, 12.15, ['cistern', 'bed'], 'water'],
  ['vines', 7300, 17.01, ['herbs'], 'plants'],
  ['timer', 12000, 23.81, ['gears'], 'mechanisms'],
  ['vents', 18000, 33.34, ['mirrors'], 'climate'],
  ['butterflies', 30000, 46.67, ['flowers', 'mirrors'], 'life'],
  ['filter', 48000, 65.34, ['irrigation'], 'water'],
  ['pollination', 77000, 0, ['bees', 'flowers', 'gutters'], 'synergy'],
  ['orchid', 122000, 128.06, ['vines'], 'plants'],
  ['auto_valves', 200000, 179.29, ['timer', 'irrigation'], 'mechanisms'],
  ['heater', 310000, 251.00, ['vents'], 'climate'],
  ['dragonflies', 510000, 351.41, ['pond', 'bees'], 'life'],
  ['pond', 810000, 491.97, ['filter'], 'water'],
  ['humidity', 1300000, 0, ['pond', 'vents'], 'synergy'],
  ['canopy', 2100000, 964.26, ['orchid'], 'plants'],
  ['roof_drive', 3200000, 1349.96, ['auto_valves', 'vents'], 'mechanisms'],
  ['climate', 5300000, 1889.95, ['heater'], 'climate'],
  ['birds', 8500000, 2645.93, ['canopy', 'dragonflies'], 'life'],
  ['ecosystem', 13000000, 0, ['birds', 'climate', 'roof_drive'], 'synergy'],
  ['central_bud', 22000000, 5186.02, ['ecosystem', 'canopy'], 'final'],
  ['open_roof', 35000000, 0, ['central_bud', 'roof_drive'], 'final'],
  ['final_bloom', 56000000, 0, ['open_roof', 'birds', 'pond'], 'final'],
].map(([id, cost, income, requires, branch]) => ({ id, cost, income, requires, branch }));

const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
const multipliers = { pollination: 1.50, humidity: 1.40, ecosystem: 2.00 };

const profiles = [
  { id: 'passive', activeFactor: 0.00, minHours: 2.60, maxHours: 3.20 },
  { id: 'mixed', activeFactor: 0.20, minHours: 2.20, maxHours: 2.80 },
  { id: 'active', activeFactor: 0.35, minHours: 1.95, maxHours: 2.50 },
];

const policies = [
  { id: 'cheapest', rank: (n) => [n.cost, n.id] },
  { id: 'efficiency', rank: (n) => [n.income > 0 ? n.cost / n.income : Number.POSITIVE_INFINITY, n.cost, n.id] },
  { id: 'plants-first', rank: branchRanker(['plants', 'water', 'climate', 'mechanisms', 'life', 'synergy', 'final']) },
  { id: 'mechanisms-first', rank: branchRanker(['mechanisms', 'climate', 'water', 'plants', 'life', 'synergy', 'final']) },
  { id: 'life-first', rank: branchRanker(['life', 'plants', 'water', 'climate', 'mechanisms', 'synergy', 'final']) },
];

function branchRanker(order) {
  const weight = Object.fromEntries(order.map((branch, index) => [branch, index]));
  return (n) => [weight[n.branch] ?? 99, n.cost, n.id];
}

function compareRank(a, b, rank) {
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
    if ((ra[i] ?? 0) < (rb[i] ?? 0)) return -1;
    if ((ra[i] ?? 0) > (rb[i] ?? 0)) return 1;
  }
  return 0;
}

function validateGraph() {
  if (nodes.length !== 32) throw new Error(`expected 32 nodes, found ${nodes.length}`);
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length) throw new Error('duplicate node id');

  for (const node of nodes) {
    for (const req of node.requires) {
      if (!byId[req]) throw new Error(`${node.id}: missing prerequisite ${req}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error(`cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const req of byId[id].requires) visit(req);
    visiting.delete(id);
    visited.add(id);
  }
  for (const node of nodes) visit(node.id);

  const reachable = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (!reachable.has(node.id) && node.requires.every((r) => reachable.has(r))) {
        reachable.add(node.id);
        changed = true;
      }
    }
  }
  if (reachable.size !== nodes.length) throw new Error(`only ${reachable.size}/${nodes.length} nodes reachable`);
}

function passiveIncome(unlocked) {
  let base = 0;
  for (const id of unlocked) base += byId[id].income;
  let multiplier = 1;
  for (const [id, value] of Object.entries(multipliers)) if (unlocked.has(id)) multiplier *= value;
  return base * multiplier;
}

function simulate(profile, policy) {
  const unlocked = new Set();
  const timeline = [];
  let growth = 0;
  let time = 0;
  const maxSeconds = 6 * 60 * 60;

  while (!unlocked.has('final_bloom') && time < maxSeconds) {
    const passive = passiveIncome(unlocked);
    const earlyFloor = time < 600 ? 1 : 0;
    const activeBonus = Math.max(earlyFloor, passive * profile.activeFactor);
    growth += passive + activeBonus;

    while (true) {
      const available = nodes
        .filter((node) => !unlocked.has(node.id))
        .filter((node) => node.requires.every((requirement) => unlocked.has(requirement)))
        .filter((node) => growth >= node.cost)
        .sort((a, b) => compareRank(a, b, policy.rank));
      if (available.length === 0) break;
      const node = available[0];
      growth -= node.cost;
      unlocked.add(node.id);
      timeline.push({ second: time, id: node.id, cost: node.cost });
    }
    time += 1;
  }

  if (!unlocked.has('final_bloom')) throw new Error(`${profile.id}/${policy.id}: did not reach Final Bloom within 6 hours`);

  const waits = timeline.map((event, index) => event.second - (index === 0 ? 0 : timeline[index - 1].second));
  return {
    profile: profile.id,
    policy: policy.id,
    seconds: time,
    hours: time / 3600,
    longestWaitSeconds: Math.max(...waits),
    purchased: timeline.length,
  };
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

validateGraph();
let failed = false;
let globalWorstGap = 0;

for (const profile of profiles) {
  for (const policy of policies) {
    const result = simulate(profile, policy);
    const longestWaitMinutes = result.longestWaitSeconds / 60;
    globalWorstGap = Math.max(globalWorstGap, result.longestWaitSeconds);

    console.log(`\n[${profile.id}/${policy.id}]`);
    console.log(`completion: ${formatTime(result.seconds)} (${result.hours.toFixed(2)}h)`);
    console.log(`longest purchase gap: ${longestWaitMinutes.toFixed(1)} min`);
    console.log(`nodes purchased: ${result.purchased}`);

    if (result.hours < profile.minHours || result.hours > profile.maxHours) {
      console.error(`FAIL: completion ${result.hours.toFixed(2)}h outside ${profile.minHours}-${profile.maxHours}h envelope`);
      failed = true;
    }
    if (result.purchased !== nodes.length) {
      console.error(`FAIL: purchased ${result.purchased}/${nodes.length} nodes`);
      failed = true;
    }
    if (result.longestWaitSeconds > 20 * 60) {
      console.error('FAIL: >20 minute mandatory mathematical purchase gap');
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`\nP1 progression simulation passed across ${profiles.length * policies.length} profile/policy combinations.`);
console.log(`Worst validated purchase gap: ${(globalWorstGap / 60).toFixed(1)} min.`);
