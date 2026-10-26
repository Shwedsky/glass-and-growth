# Glass & Growth — Product Vision

## Status

This document is the source of truth for the MVP concept.

## Product thesis

**Glass & Growth** is a short, finished cozy incremental game designed to be completed in roughly 2–4 hours. The player restores a forgotten automated greenhouse by interacting with the world, unlocking hidden progression nodes, and bringing increasingly complex natural and mechanical systems back to life.

The game is intentionally small in scope, easy to understand internationally, cross-platform by design, and built around visible transformation rather than endless grind.

## Core fantasy

The player starts inside a nearly dead glasshouse:

- broken or dirty glass;
- dry soil;
- dormant pipes and pumps;
- empty planters;
- weak light;
- a large dormant central plant or flower;
- old mechanical infrastructure that can gradually be reactivated.

Over the course of one short playthrough, the same space becomes dense, bright, animated, productive, and alive.

The world should feel like a hybrid of nature and old practical automation: glass, wood, brass, water, light, plants, small mechanisms. It should not read as hard sci-fi or steampunk.

## Player promise

Every meaningful upgrade should do more than increase a number.

Whenever possible, a major progression step should provide all three:

1. **Mechanical effect** — income, multiplier, automation, synergy or efficiency.
2. **Visible world change** — a new object, animation, creature, effect or transformation.
3. **Discovery** — one or more new unknown possibilities become visible in the progression tree.

The core emotional loop is:

**act → restore → automate → discover → transform → finish**

## Game structure

The MVP uses only two primary views.

### 1. Greenhouse view

The main game screen. Nearly all moment-to-moment interaction and all visible transformation happen here.

The scene must remain recognizable from beginning to end so the player can clearly perceive how much it has changed.

### 2. Discovery tree

A branching progression screen or overlay.

Most future nodes begin hidden as `?` rather than exposing their full rewards in advance. The player can see that future possibilities exist but does not always know what they will unlock.

This creates curiosity as a progression mechanic.

## Core mechanics

### Active interaction

The game may begin with a simple tap/click that produces the base resource, but the released experience should avoid relying on repetitive clicking for long periods.

As the greenhouse develops, active interaction should increasingly happen through lightweight world events such as:

- collecting a water droplet;
- touching a sunbeam;
- tending a sprout;
- clearing a dead leaf;
- activating a temporarily highlighted mechanism.

All interactions must be comfortable with mouse or touch.

### Passive production

Restored systems generate resources automatically.

Examples:

- pump;
- rain collector;
- planter;
- bees;
- irrigation;
- ventilation;
- compost;
- mirrors / lighting;
- other natural or mechanical subsystems.

Passive production exists to create visible automation, not to force long idle waits.

### Mystery progression

The discovery tree is one of the defining hooks of the game.

The player sees branches and unknown nodes but not always the result behind the next purchase.

A node may reveal:

- a generator;
- a multiplier;
- a visual transformation;
- a new creature;
- a world interaction;
- a synergy;
- a new branch;
- a hidden cross-branch node.

### Cross-branch synergies

Some discoveries should become available only after combinations of systems exist.

Examples:

- flowers + hive → pollination;
- pond + insects → dragonflies;
- ventilation + flowering plants → stronger growth cycle.

These should feel like discoveries rather than spreadsheet bonuses.

## Progression philosophy

The game has **no prestige system** and no intentionally endless grind.

The economy should be tuned so an actively engaged player can finish without mandatory multi-hour waiting periods.

Target playtime:

- fast player: ~2 hours;
- typical player: ~2.5–3 hours;
- slower/exploratory player: up to ~4 hours.

Short passive accumulation is allowed as convenience, but waiting must not become the primary gameplay gate.

The player should encounter a visible or mechanical payoff roughly every 5–15 minutes.

## Ending

The ending is known visually before it is understood mechanically.

A dormant central organism/object is visible from the beginning and develops throughout the game.

A preferred final sequence:

1. the greenhouse becomes fully functional;
2. the final upgrade opens or transforms the roof / light path;
3. the central plant blooms;
4. seeds, pollen or life escape beyond the greenhouse;
5. the camera reveals signs of new growth outside;
6. short ending / credits.

The game then clearly ends.

No prestige loop is required for the MVP.

## Replayability

Replayability is optional and should not expand MVP scope significantly.

A desirable later design is a tree where a player cannot buy every node in one run, producing slightly different final greenhouses and discoveries. This is valuable for discussion and streamer reactions, but it is secondary to delivering one polished complete playthrough.

## Streamability

The game is deliberately short enough to be completed in one stream or video session.

The design should create regular visible moments suitable for spectators:

- machinery starts;
- a new area becomes active;
- creatures arrive;
- an unexpected hidden node reveals itself;
- lighting/weather changes;
- a major plant transforms;
- the greenhouse reaches a new visual phase.

The mystery tree should repeatedly create the question: **“What is behind that node?”**

## International design

The game should remain understandable with minimal text and without culturally specific knowledge.

Priorities:

- visual communication over prose;
- universal nature/mechanical imagery;
- few text-heavy systems;
- localization-ready strings from the start;
- no gameplay dependent on English wordplay.

## Platform strategy

The canonical implementation is **web-first**.

Initial technical direction:

- TypeScript;
- Phaser for the 2D game layer;
- responsive UI;
- browser build as the canonical runtime;
- thin platform adapters for saves, achievements, payments, ads and analytics.

Expected distribution paths:

- browser / own site;
- itch.io;
- VK Play;
- Yandex Games when appropriate;
- desktop wrapper for Steam;
- Capacitor-based Android/iOS builds if mobile distribution is pursued.

Gameplay code must not depend directly on a specific storefront SDK.

## Platform adapter boundary

Conceptually:

```text
PlatformAdapter
├── save()
├── load()
├── achievement()
├── purchase()
├── rewardedAd()
├── fullscreen()
└── analytics()
```

Platform-specific integrations can be added without changing the economy or core gameplay.

## Monetization philosophy

The base game should remain complete without ads, premium currencies or gameplay purchases.

Preferred models vary by platform:

- very low premium price;
- pay-what-you-want where supported;
- optional supporter content where supported;
- possible mobile rewarded ads or IAP later, isolated behind platform hooks.

Monetization must never require redesigning the core short campaign.

## MVP boundaries

### Included

- one greenhouse;
- one complete 2–4 hour campaign;
- one base resource/economy model, with supporting systems as needed;
- active interaction;
- passive automation;
- branching mystery discovery tree;
- visible scene transformation;
- save/load;
- basic offline accumulation if useful;
- responsive mouse/touch controls;
- localization-ready text;
- complete ending.

### Explicitly excluded from MVP

- multiplayer;
- combat;
- procedural levels;
- prestige;
- endless mode;
- dialogue-heavy story;
- inventory-heavy crafting;
- complex character systems;
- servers required for normal play;
- live-service progression;
- multiple themed campaigns;
- large content packs;
- mobile ads/IAP implementation unless required for a specific release test.

## Quality bar

The project succeeds as a game only if the transformation itself is satisfying.

A technically functioning clicker with changing numbers is not sufficient.

The MVP should feel like a small finished commercial game rather than a mechanics prototype.

## Development principle

Build the smallest convincing vertical slice first.

Before producing the full 2–4 hour economy, prove a **15–20 minute slice** containing:

- dead initial greenhouse;
- active interaction;
- first automation;
- at least one second interacting system;
- hidden discovery nodes;
- several visible scene changes;
- one synergy or surprise;
- one temporary mini-ending / milestone.

Only after that slice is enjoyable should the economy and content be expanded to the full campaign.

## Current decision

**Concept approved for development.**

Working/release name: **Glass & Growth**  
Repository slug: `glass-and-growth`

The next development milestone is **P0 — Playable Vertical Slice Foundation**.
