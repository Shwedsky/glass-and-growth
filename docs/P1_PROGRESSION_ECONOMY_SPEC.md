# P1 — Full Progression & Economy Model

## Purpose

Turn the proven P0 curiosity loop into a complete **2–4 hour finished campaign** without prestige, mandatory long waits, or meaningless late-game clicking.

This document is the source of truth for P1 balancing before the full tree is integrated into the runtime.

## Target completion envelope

The economy is tuned around three practical play styles:

- **active / efficient:** about 2.2–2.5 hours;
- **typical mixed play:** about 2.4–3.0 hours;
- **slow / exploratory:** up to about 4 hours including reading, choices and idle gaps.

A pure passive mathematical path should still finish in roughly 3 hours once the first automation is online. The player must never need to leave the game for hours to cross a mandatory wall.

## Core balancing rule: active play must scale

P0 proved the loop, but it also exposed a bad long-term pattern: a fixed `tap +2` becomes irrelevant once passive production reaches tens or hundreds per second.

The release economy must not solve that by making the player click thousands of times.

Instead, active interactions evolve into **world events** whose reward scales with the current system output.

Examples:

- collect a water pulse;
- redirect a sunbeam;
- clear a clogged valve;
- tend a rare sprout;
- catch a falling seed;
- briefly tune a mechanical system.

Target effect of engaged active play:

- early game: active play is the main source of Growth;
- early automation: active play remains a large accelerator;
- mid game: active events add roughly 15–30% effective production when engaged;
- late game: active events remain useful but are optional; automation carries the campaign.

The simulator represents this as an average effective-income bonus. Runtime implementation can express it through discrete events rather than a permanent multiplier.

## Tree size

Initial P1 target: **32 meaningful nodes**.

This is intentionally smaller than a giant 100+ node idle tree. Glass & Growth is a short game; most purchases should matter visually or systemically.

The 32-node model is large enough to create mystery and branch choice while remaining realistic for a small commercial production.

## Branches

The tree has five conceptual families. Their labels do not need to be fully exposed to the player at the beginning.

### 1. Water

Restores the physical water cycle.

Key chain:

`Old Pump → Roof Gutters → Cistern → Irrigation → Filter → Pond`

Visual language:

- dry pipes start moving water;
- gutters drip;
- reservoir fills;
- irrigation lines animate;
- water becomes clearer;
- a pond appears and becomes inhabited.

### 2. Plants

Builds the living biomass of the greenhouse.

Key chain:

`First Sprout → Warm Bed → Flowers → Herbs → Vines → Orchid → Canopy`

Visual language:

- first green point;
- beds fill;
- colour returns;
- vertical growth appears;
- rare plants emerge;
- the upper greenhouse fills with leaves.

### 3. Climate & Light

Restores the greenhouse itself as a controlled environment.

Key chain:

`Clean Glass → Mirrors → Vents → Heater → Stable Climate`

Visual language:

- dirty glass clears;
- sunbeams become visible;
- vents begin moving;
- warm air / condensation appears;
- lighting and atmosphere shift to a healthy state.

### 4. Life

Brings creatures into the restored ecosystem.

Key chain:

`Bees → Butterflies → Dragonflies → Birds`

This branch intentionally depends on other systems. Life cannot be purchased in isolation; the greenhouse must become suitable for it.

### 5. Mechanisms

Restores old practical automation.

Key chain:

`Gears → Timing Mechanism → Automatic Valves → Roof Drive`

The machinery should read as old utilitarian greenhouse equipment, not hard sci-fi or heavy steampunk.

## Cross-branch discoveries

Cross-branch nodes are central to the mystery-tree fantasy.

### Pollination

Requirements:

- Flowers;
- Bees;
- Roof Gutters / working water cycle.

Effect target:

- global production multiplier around ×1.5;
- stronger flower/bee ambient activity;
- visually obvious discovery.

### Humidity Cycle

Requirements:

- Pond;
- Vents.

Effect target:

- global multiplier around ×1.4;
- visible condensation / mist / richer plant movement.

### Living Ecosystem

Requirements:

- Birds;
- Stable Climate;
- Roof Drive.

Effect target:

- global multiplier around ×2;
- transition into the final campaign phase.

## Final chain

The final chain should become visually obvious before the player understands its exact cost.

`Living Ecosystem → Central Bud → Open Roof → Final Bloom`

The final bloom is a true ending, not prestige.

Preferred ending sequence remains:

1. mechanisms synchronize;
2. roof opens;
3. central plant blooms;
4. seeds/pollen escape;
5. camera reveals growth beginning outside;
6. short credits / completion state.

## P1 economy table

Values below are modelling values, not sacred final numbers. They exist to establish pacing and relative importance.

| # | Node | Cost | Base passive / sec | Requirements |
|---:|---|---:|---:|---|
| 1 | First Sprout | 20 | 0.30 | — |
| 2 | Old Pump | 30 | 0.42 | First Sprout |
| 3 | Warm Bed | 50 | 0.59 | First Sprout |
| 4 | Roof Gutters | 80 | 0.82 | Old Pump |
| 5 | Flowers | 125 | 1.15 | Warm Bed |
| 6 | Clean Glass | 250 | 1.61 | Old Pump |
| 7 | Cistern | 425 | 2.26 | Roof Gutters |
| 8 | Herbs | 675 | 3.16 | Flowers |
| 9 | Gears | 1,100 | 4.43 | Old Pump |
| 10 | Mirrors | 1,800 | 6.20 | Clean Glass |
| 11 | Bees | 2,900 | 8.68 | Flowers |
| 12 | Irrigation | 4,600 | 12.15 | Cistern + Warm Bed |
| 13 | Vines | 7,300 | 17.01 | Herbs |
| 14 | Timing Mechanism | 12,000 | 23.81 | Gears |
| 15 | Vents | 18,000 | 33.34 | Mirrors |
| 16 | Butterflies | 30,000 | 46.67 | Flowers + Mirrors |
| 17 | Filter | 48,000 | 65.34 | Irrigation |
| 18 | Pollination | 77,000 | ×1.50 global | Bees + Flowers + Roof Gutters |
| 19 | Orchid | 122,000 | 128.06 | Vines |
| 20 | Automatic Valves | 200,000 | 179.29 | Timing Mechanism + Irrigation |
| 21 | Heater | 310,000 | 251.00 | Vents |
| 22 | Dragonflies | 510,000 | 351.41 | Pond + Bees |
| 23 | Pond | 810,000 | 491.97 | Filter |
| 24 | Humidity Cycle | 1,300,000 | ×1.40 global | Pond + Vents |
| 25 | Canopy | 2,100,000 | 964.26 | Orchid |
| 26 | Roof Drive | 3,200,000 | 1,349.96 | Automatic Valves + Vents |
| 27 | Stable Climate | 5,300,000 | 1,889.95 | Heater |
| 28 | Birds | 8,500,000 | 2,645.93 | Canopy + Dragonflies |
| 29 | Living Ecosystem | 13,000,000 | ×2.00 global | Birds + Stable Climate + Roof Drive |
| 30 | Central Bud | 22,000,000 | 5,186.02 | Living Ecosystem + Canopy |
| 31 | Open Roof | 35,000,000 | — | Central Bud + Roof Drive |
| 32 | Final Bloom | 56,000,000 | — | Open Roof + Birds + Pond |

## Purchase cadence

Pacing should not be uniform.

Desired feel:

- first 10 minutes: frequent unlocks, usually 30–120 seconds apart;
- 10–45 minutes: 2–5 minutes between meaningful purchases;
- 45–120 minutes: larger projects, roughly 3–8 minutes between meaningful changes;
- final phase: several expensive, highly visible goals rather than many tiny purchases.

A cost increase is acceptable only when the player has something new to watch, interact with, decide, or anticipate during the wait.

## Mystery rules

The tree must not reveal every reward in advance.

Rules:

1. locked future nodes may appear as `?`;
2. a node becomes purchasable only when prerequisites exist;
3. price may be shown before content is revealed;
4. purchased nodes reveal their real name/effect;
5. some cross-branch nodes should appear only after the required combination exists;
6. final-chain silhouettes may be visible early to create long-term anticipation.

## Choice philosophy

P1 does **not** require mutually exclusive permanent choices yet.

The full 32-node campaign should be completable in one run so the first commercial version has a clear authored ending and remains easy to balance.

Optional incomplete-tree replayability can be evaluated after the full campaign is fun.

## Validation

P1 is not accepted because the spreadsheet looks plausible.

Acceptance requires a deterministic simulation that reports:

- completion time for passive, mixed and highly active profiles;
- unlock timeline;
- longest wait between purchases;
- final cost/income curve;
- proof that every prerequisite chain can complete;
- no mandatory idle wall.

The simulation should run in CI and fail if target completion leaves the agreed envelope.
