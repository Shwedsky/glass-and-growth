# P5B — Animated Illustration

Status: implementation proof ready for owner visual test.

## Product rule

The greenhouse world uses one coherent painterly visual language.

Release-world restrictions:
- no emoji or cartoon creature sprites;
- no flat placeholder characters;
- no mixed-style raster cutouts;
- no transparent next-stage ghost tree overlays;
- no text labels pretending a helper exists visually.

## Implemented proof

The runtime now uses the authored greenhouse frame itself as the source for local motion:
- the central tree is re-projected from the **same current frame** through a local mask and reacts physically to taps;
- tap response sends restrained warm sap/light pulses upward through the tree;
- restored water uses two tiny-offset same-frame projections inside the real water/pump region;
- foliage and flower regions sway by only a few pixels using the same-frame source;
- restored glass gets subtle moving warm beams rather than a foreign light sprite;
- late-life states use tiny painterly-scale moving motes rather than cartoon bee/butterfly sprites;
- P4 placeholder helper labels are removed from the world until a production-quality authored character exists;
- no next-stage raster is ever overlaid transparently on the current tree.

Major progression can still switch between authored full greenhouse states. Local animation stays inside the current authored state and therefore keeps one art language.

## Test controls

Normal Windows launcher starts the player build.
DEV launcher opens `?dev=1` with RESET / +1B / FINISH controls.

## Acceptance test

The proof passes only if owner review says:
1. motion reads as part of the illustration rather than stickers layered on top;
2. tapping the tree feels visibly satisfying;
3. water / foliage / light add life without damaging the artwork;
4. no visible element looks like it belongs to a different game.

Do not expand to gardener / birds / detailed insects until this proof passes.
