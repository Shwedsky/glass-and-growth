const nodes = [
  ['sprout', 24, 0.30, [], 'plants'],
  ['pump', 36, 0.42, ['sprout'], 'water'],
  ['bed', 60, 0.59, ['sprout'], 'plants'],
  ['gutters', 96, 0.82, ['pump'], 'water'],
  ['flowers', 150, 1.15, ['bed'], 'plants'],
  ['glass', 300, 1.61, ['pump'], 'climate'],
  ['cistern', 510, 2.26, ['gutters'], 'water'],
  ['herbs', 810, 3.16, ['flowers'], 'plants'],
  ['gears', 1320, 4.43, ['pump'], 'mechanisms'],
  ['mirrors', 2160, 6.20, ['glass'], 'climate'],
  ['bees', 3480, 8.68, ['flowers'], 'life'],
  ['irrigation', 5520, 12.15, ['cistern', 'bed'], 'water'],
  ['vines', 8760, 17.01, ['herbs'], 'plants'],
  ['timer', 14400, 23.81, ['gears'], 'mechanisms'],
  ['vents', 21600, 33.34, ['mirrors'], 'climate'],
  ['butterflies', 36000, 46.67, ['flowers', 'mirrors'], 'life'],
  ['filter', 57600, 65.34, ['irrigation'], 'water'],
  ['pollination', 92400, 0, ['bees', 'flowers', 'gutters'], 'synergy'],
  ['orchid', 146400, 128.06, ['vines'], 'plants'],
  ['auto_valves', 240000, 179.29, ['timer', 'irrigation'], 'mechanisms'],
  ['heater', 372000, 251.00, ['vents'], 'climate'],
  ['dragonflies', 612000, 351.41, ['pond', 'bees'], 'life'],
  ['pond', 972000, 491.97, ['filter'], 'water'],
  ['humidity', 1560000, 0, ['pond', 'vents'], 'synergy'],
  ['canopy', 2520000, 964.26, ['orchid'], 'plants'],
  ['roof_drive', 3840000, 1349.96, ['auto_valves', 'vents'], 'mechanisms'],
  ['climate', 6360000, 1889.95, ['heater'], 'climate'],
  ['birds', 10200000, 2645.93, ['canopy', 'dragonflies'], 'life'],
  ['ecosystem', 15600000, 0, ['birds', 'climate', 'roof_drive'], 'synergy'],
  ['central_bud', 26400000, 5186.02, ['ecosystem', 'canopy'], 'final'],
  ['open_roof', 42000000, 0, ['central_bud', 'roof_drive'], 'final'],
  ['final_bloom', 67200000, 0, ['open_roof', 'birds', 'pond'], 'final'],
].map(([id, cost, income, requires, branch]) => ({ id, cost, income, requires, branch }));

const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
const multipliers = { pollination: 1.50, humidity: 1.40, ecosystem: 2.00 };

// Owner playtest established the final philosophy:
// passive = safety net, mixed = intended baseline, active = fastest intended play.
// The active factors model average contribution over the whole session, not raw tapping bursts.
const profiles = [
  { id: 'passive', activeFactor: 0.00, minHours: 3.20, maxHours: 4.00 },
  { id: 'mixed', activeFactor: 0.45, minHours: 2.20, maxHours: 2.80 },
  { id: 'active', activeFactor: 0.80, minHours: 1.80, maxHours: 2.30 },
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
  for (const node of nodes) for (const req of node.requires) if (!byId[req]) throw new Error(`${node.id}: missing prerequisite ${req}`);

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
    const bootstrap = passive <= 0 ? 1 : 0;
    const activeBonus = Math.max(bootstrap, passive * profile.activeFactor);
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
  return { profile: profile.id, policy: policy.id, seconds: time, hours: time / 3600, longestWaitSeconds: Math.max(...waits), purchased: timeline.length };
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
console.log(`\nP2 active-first progression passed across ${profiles.length * policies.length} profile/policy combinations.`);
console.log(`Worst validated purchase gap: ${(globalWorstGap / 60).toFixed(1)} min.`);
