const nodes = [
  ['sprout', 20, 0.30, []],
  ['pump', 30, 0.42, ['sprout']],
  ['bed', 50, 0.59, ['sprout']],
  ['gutters', 80, 0.82, ['pump']],
  ['flowers', 125, 1.15, ['bed']],
  ['glass', 250, 1.61, ['pump']],
  ['cistern', 425, 2.26, ['gutters']],
  ['herbs', 675, 3.16, ['flowers']],
  ['gears', 1100, 4.43, ['pump']],
  ['mirrors', 1800, 6.20, ['glass']],
  ['bees', 2900, 8.68, ['flowers']],
  ['irrigation', 4600, 12.15, ['cistern', 'bed']],
  ['vines', 7300, 17.01, ['herbs']],
  ['timer', 12000, 23.81, ['gears']],
  ['vents', 18000, 33.34, ['mirrors']],
  ['butterflies', 30000, 46.67, ['flowers', 'mirrors']],
  ['filter', 48000, 65.34, ['irrigation']],
  ['pollination', 77000, 0, ['bees', 'flowers', 'gutters']],
  ['orchid', 122000, 128.06, ['vines']],
  ['auto_valves', 200000, 179.29, ['timer', 'irrigation']],
  ['heater', 310000, 251.00, ['vents']],
  ['dragonflies', 510000, 351.41, ['pond', 'bees']],
  ['pond', 810000, 491.97, ['filter']],
  ['humidity', 1300000, 0, ['pond', 'vents']],
  ['canopy', 2100000, 964.26, ['orchid']],
  ['roof_drive', 3200000, 1349.96, ['auto_valves', 'vents']],
  ['climate', 5300000, 1889.95, ['heater']],
  ['birds', 8500000, 2645.93, ['canopy', 'dragonflies']],
  ['ecosystem', 13000000, 0, ['birds', 'climate', 'roof_drive']],
  ['central_bud', 22000000, 5186.02, ['ecosystem', 'canopy']],
  ['open_roof', 35000000, 0, ['central_bud', 'roof_drive']],
  ['final_bloom', 56000000, 0, ['open_roof', 'birds', 'pond']],
].map(([id, cost, income, requires]) => ({ id, cost, income, requires }));

const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
const multipliers = {
  pollination: 1.50,
  humidity: 1.40,
  ecosystem: 2.00,
};

const profiles = [
  { id: 'passive', activeFactor: 0.00, minHours: 2.60, maxHours: 3.20 },
  { id: 'mixed', activeFactor: 0.20, minHours: 2.20, maxHours: 2.80 },
  { id: 'active', activeFactor: 0.35, minHours: 1.95, maxHours: 2.50 },
];

function passiveIncome(unlocked) {
  let base = 0;
  for (const id of unlocked) base += byId[id].income;

  let multiplier = 1;
  for (const [id, value] of Object.entries(multipliers)) {
    if (unlocked.has(id)) multiplier *= value;
  }

  return base * multiplier;
}

function simulate(profile) {
  const unlocked = new Set();
  const timeline = [];
  let growth = 0;
  let time = 0;
  const maxSeconds = 6 * 60 * 60;

  while (!unlocked.has('final_bloom') && time < maxSeconds) {
    const passive = passiveIncome(unlocked);

    // The first minutes model direct tapping before automation carries the loop.
    // Later active play is represented as a scalable bonus produced by world events.
    const earlyFloor = time < 600 ? 1 : 0;
    const activeBonus = Math.max(earlyFloor, passive * profile.activeFactor);

    growth += passive + activeBonus;

    // Greedy cheapest-available purchase policy is intentionally deterministic.
    // It is not a perfect human strategy; it is a stable balance baseline.
    while (true) {
      const available = nodes
        .filter((node) => !unlocked.has(node.id))
        .filter((node) => node.requires.every((requirement) => unlocked.has(requirement)))
        .filter((node) => growth >= node.cost)
        .sort((a, b) => a.cost - b.cost);

      if (available.length === 0) break;

      const node = available[0];
      growth -= node.cost;
      unlocked.add(node.id);
      timeline.push({ second: time, id: node.id, cost: node.cost, passiveBefore: passive });
    }

    time += 1;
  }

  if (!unlocked.has('final_bloom')) {
    throw new Error(`${profile.id}: progression did not reach Final Bloom within 6 hours`);
  }

  const waits = timeline.map((event, index) => {
    const previous = index === 0 ? 0 : timeline[index - 1].second;
    return event.second - previous;
  });

  return {
    profile: profile.id,
    seconds: time,
    hours: time / 3600,
    longestWaitSeconds: Math.max(...waits),
    timeline,
  };
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

let failed = false;

for (const profile of profiles) {
  const result = simulate(profile);
  const longestWaitMinutes = result.longestWaitSeconds / 60;

  console.log(`\n[${profile.id}]`);
  console.log(`completion: ${formatTime(result.seconds)} (${result.hours.toFixed(2)}h)`);
  console.log(`longest purchase gap: ${longestWaitMinutes.toFixed(1)} min`);
  console.log(`nodes purchased: ${result.timeline.length}`);

  if (result.hours < profile.minHours || result.hours > profile.maxHours) {
    console.error(
      `FAIL: ${profile.id} completion ${result.hours.toFixed(2)}h outside ${profile.minHours}-${profile.maxHours}h envelope`,
    );
    failed = true;
  }

  if (result.timeline.length !== nodes.length) {
    console.error(`FAIL: ${profile.id} purchased ${result.timeline.length}/${nodes.length} nodes`);
    failed = true;
  }

  // A 20-minute deterministic gap indicates a real mathematical idle wall.
  // Human exploratory play can take longer, but the economy itself should not require it.
  if (result.longestWaitSeconds > 20 * 60) {
    console.error(`FAIL: ${profile.id} has a >20 minute mandatory mathematical purchase gap`);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log('\nP1 progression simulation passed.');
