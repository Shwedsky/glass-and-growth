# Glass & Growth — MVP Roadmap

This roadmap is intentionally short. The goal is to reach a finished playable game quickly, not to create a large pre-production process.

## P0 — Playable Vertical Slice Foundation

Goal: prove that the core idea is fun in 15–20 minutes.

Deliverables:

- TypeScript web project;
- Phaser game shell;
- responsive desktop/mobile layout;
- deterministic economy clock;
- first save/load path;
- main greenhouse view;
- discovery tree overlay/view;
- first active interaction;
- first passive producer;
- 6–10 discovery nodes;
- hidden `?` nodes;
- at least 5 visible greenhouse state changes;
- one cross-system synergy;
- temporary slice ending;
- playable browser build.

Exit criteria:

- game can be completed from fresh save without developer intervention;
- mouse and touch both work;
- no mandatory idle wall;
- player receives a meaningful visible/mechanical change every few minutes;
- the mystery tree creates genuine curiosity;
- save/reload preserves progress;
- 15–20 minute slice is enjoyable enough to justify expanding it.

## P1 — Economy & Full Progression Model

Goal: expand the proven slice into a complete 2–4 hour progression.

Deliverables:

- economy simulation outside the runtime;
- target completion distributions;
- full progression graph;
- 4–5 thematic branches;
- cross-branch synergies;
- pacing milestones;
- active vs passive balance;
- offline progression policy;
- final ending requirements.

Exit criteria:

- simulated typical completion: ~2.5–3 hours;
- fast completion: ~2 hours;
- exploratory completion: up to ~4 hours;
- no prestige requirement;
- no long mandatory waiting wall;
- no obvious dominant branch that invalidates the rest of the tree.

## P2 — Full Greenhouse Content

Goal: turn the progression model into the complete game.

Deliverables:

- full discovery tree;
- all greenhouse visual phases;
- complete automation systems;
- creatures and ambient motion;
- final central bloom progression;
- final sequence;
- complete save migration/versioning baseline;
- localized string structure.

Exit criteria:

- fresh-to-ending playthrough possible;
- all major nodes visibly affect the world or meaningfully change play;
- full campaign fits target duration;
- scene reads clearly at both desktop and mobile sizes.

## P3 — Feel, Art & Audio Pass

Goal: move from functional incremental to polished small commercial game.

Deliverables:

- coherent art direction;
- final/background scene art;
- animation pass;
- particles and feedback;
- sound effects;
- music/ambient audio;
- UI polish;
- accessibility basics;
- performance pass.

Exit criteria:

- screenshots communicate progression without explanation;
- major unlocks feel satisfying on stream/video;
- no placeholder-quality presentation in release path;
- acceptable performance on modest mobile/desktop hardware.

## P4 — Platform & Release Candidate

Goal: prepare one stable core game for multiple storefronts.

Deliverables:

- platform adapter implementations as needed;
- web deployment build;
- itch.io package;
- VK Play-compatible build;
- Yandex-compatible integration path if pursued;
- desktop packaging path for Steam;
- optional Capacitor mobile wrapper proof;
- analytics events for funnel/drop-off measurement;
- release settings and metadata.

Exit criteria:

- storefront-specific code is isolated;
- core campaign behaves identically across supported builds;
- save behavior is validated per platform;
- no platform-specific monetization is required to finish the game.

## P5 — Public Test & Commercial Decision

Goal: test demand before spending heavily on distribution or additional content.

Measure:

- start → 10 min retention;
- start → 30 min retention;
- first-major-restoration completion;
- full ending completion rate;
- median playtime;
- drop-off node/phase;
- store page → start/download/purchase conversion where measurable;
- ratings/reviews;
- voluntary payment/support behavior where supported.

Then decide:

- improve and relaunch test;
- prepare Steam release;
- add mobile distribution;
- stop with a completed small game and reuse the incremental core elsewhere.

## Scope rule

No new system enters the MVP unless it materially improves one of these:

1. curiosity;
2. visible transformation;
3. progression pacing;
4. completion satisfaction;
5. cross-platform usability.

Everything else waits.
