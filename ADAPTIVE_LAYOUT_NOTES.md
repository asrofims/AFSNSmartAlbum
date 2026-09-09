# Adaptive Layout Refinement — 9 September 2026

Scope: points 1–4 of the adaptive layout review, applied to user-invoked layout changes on the active spread. This does not introduce whole-album automatic distribution (the roadmap's skipped Phase 7).

## Candidate validity

- Require one finite, positive frame per unlocked photo, within the physical canvas and its page's safe area. The existing explicitly named full-bleed single-photo variation may span the safe margins/gutter.
- Require inter-frame clearance of at least the configured spacing. Reject collisions and insufficient clearance around text and locked photos. Their rotated top-left-origin rectangles are converted to conservative axis-aligned bounds for free-space calculation and validation; corner space inside these bounds is intentionally unavailable.
- Minimum frame side: the larger of 1.5 times spacing and 5% of the smaller usable-page dimension. Coordinate comparisons allow 0.0003 canvas units for existing four-decimal geometry rounding.
- Reject any final candidate with estimated crop loss above 65% for any newly placed photo. This is a geometry-based initial policy, not face/subject detection. Heavy crop receives a strong assignment penalty so a feasible lower-crop matching is preferred.
- Never reinstate rejected candidates when no valid layout remains. Application leaves the current layout unchanged; the Templates panel explains that the size/spacing/margin/crop limits could not be met.

## Composition score

The 0–100 display is a heuristic composition score, not a percentage of photo content retained. Its penalty combines average crop (38%), worst crop (25%), edge alignment (12%), left/right area balance (10%), favorite prominence (10%), and sparse coverage (5%). Sparse coverage is penalized below 55% usable-page coverage. Locked photo bounds contribute to alignment/coverage/balance; existing locked crops are not changed or evaluated as new crops.

Crop loss is derived only from source versus frame aspect ratio. It is reported separately as average and largest estimated crop, without subtracting a hero bonus. Weights and thresholds need manual aesthetic review; compilation does not validate visual quality.

## Ratio-aware geometry

Keep valid existing patterns and add refinements of the 32 highest-ranked geometry-valid candidates, using a partial and full ratio adjustment. Reconstruct complete horizontal/vertical slicing patterns per page, combine the assigned source ratios into subtree ratios, then move subdivision boundaries while keeping the original outer box and exact internal gaps. Single-frame groups can fit the source ratio within their box.

Non-slicing or disconnected free-space patterns remain unchanged when they cannot be safely reconstructed. Every refined candidate is independently validated, rematched, and scored. Duplicate geometry is removed. Refinement is bounded to avoid multiplying the existing candidate search without limit.

## Photo prominence and integration

The library's favorite flag supplies hero priority through one shared metadata adapter used by the Templates panel, keyboard HUD, and album store. The first photo no longer receives implicit hero priority. Direct domain callers may also provide a rating of four or five. The assignment cost favors larger slots for preferred photos while retaining crop costs and the final crop ceiling.

Cover previews now use the same active-cover lookup and dimensions as application. Text obstacles and favorite metadata are passed consistently through all three entry points. First-time Next Layout starts with the highest-ranked candidate.

## Verification and remaining limits

- `npx tsc --noEmit` passed; runtime/visual tests were not run, as requested.
- Manually inspect portrait/landscape/panorama combinations; one and multiple favorites; locked photos on one page; rotated photos/text; four-sided margins; large spacing; and cases with insufficient room. Verify preview/application agreement and no changes to protected objects.
- The existing exact assignment search for up to seven photos and greedy matching for eight or more remain. Stable layout identity across cycling and preservation of crop/style while rebuilding frames were not part of this implementation.
- Scoring and clearance use geometry, not image semantics or facial positions. A passing crop threshold does not guarantee preservation of a subject.
