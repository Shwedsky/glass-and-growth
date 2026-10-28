# P5B — Animated Illustration

Status: implementation proof in progress.

## Product rule

The greenhouse world uses one coherent painterly visual language.

Release-world restrictions:
- no emoji or cartoon creature sprites;
- no flat placeholder characters;
- no mixed-style raster cutouts;
- no transparent next-stage ghost tree overlays;
- no text labels pretending a helper exists visually.

## Current proof

The runtime uses the authored greenhouse frame itself as the source for local motion:
- central tree area responds physically to taps using a masked copy of the same frame;
- restored water region drifts subtly using same-frame masked projections;
- foliage and flower regions sway very slightly without introducing foreign art;
- restored glass adds restrained warm light movement;
- late-life states use tiny painterly-scale moving life motes rather than cartoon bees;
- helper text from P4 is removed from the world until a production-quality authored character exists.

Major progression may still switch between authored full greenhouse states, but local animation never blends a transparent next-stage tree over the current scene.

## Acceptance test

The proof passes only if owner review says:
1. motion reads as part of the illustration rather than stickers layered on top;
2. tapping the tree feels visibly satisfying;
3. water / foliage / light add life without damaging the artwork;
4. no visible element looks like it belongs to a different game.

Do not expand to gardener / birds / detailed insects until this proof passes.
