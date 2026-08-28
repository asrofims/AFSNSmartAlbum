---
name: album-editor
description: >-
  Expert guide for the AFSNSmartAlbum album editor canvas, Konva rendering, 2D Topological
  Spatial Neighbor Graph multi-resize, smart magnetic snapping math, and crop interactions.
---

# Album Editor & Canvas Domain Skill

This skill contains the domain rules, mathematical models, and architectural specifications for the interactive album layout editor in AFSNSmartAlbum.

---

## 1. 2D Topological Spatial Neighbor Graph Multi-Resize

### The Problem with Linear Scaling
Applying a uniform affine transform $(x' = x_0 + (x - x_0) \cdot s)$ to a multi-frame selection shrinks or stretches inter-frame gaps proportionally to the distance from the origin.

### The Invariant
**When resizing multiple selected frames on the canvas, the physical gap distances between adjacent frames MUST remain 100% constant.**

### The Topological Algorithm (`src/domain/editor.ts` -> `calculateMultiFrameResize`)
1. **Overlap Projection**:
   - Two frames $A$ and $B$ are considered *horizontal neighbors* if $A$ is to the left of $B$ ($A.x < B.x$) AND their vertical projections overlap ($\max(A.y, B.y) < \min(A.y + A.h, B.y + B.h)$).
   - Similarly, $A$ and $B$ are *vertical neighbors* if $A$ is above $B$ ($A.y < B.y$) AND their horizontal projections overlap ($\max(A.x, B.x) < \min(A.x + A.w, B.x + B.w)$).
2. **Neighbor Identification**:
   - For each frame, find immediate `leftNeighbors` (the rightmost among those to its left with vertical overlap) and immediate `topNeighbors` (the bottommost among those above with horizontal overlap).
3. **Proportional Dimension Scaling**:
   - Scale each frame's pure width and height: $w_i' = w_i \cdot s$, $h_i' = h_i \cdot s$.
4. **Topological Chain Positioning**:
   - If frame $i$ has no left neighbor, it anchors at the left edge: $x_i' = \text{anchorX}$.
   - If frame $i$ has a left neighbor $L$, its position is derived strictly from $L$'s scaled right edge plus the preserved original gap:
     $$x_i' = L.x' + L.w' + (i.x - (L.x + L.w))$$
   - Same topological positioning applies along the vertical axis using top neighbor $T$:
     $$y_i' = T.y' + T.h' + (i.y - (T.y + T.h))$$
5. **Universal Layout Compatibility**:
   - Validated across single rows, single columns, 2x2 grids, and asymmetric 3-photo collages.

---

## 2. Smart Magnetic Snapping Math

### Guidelines Calculation (`calculateSnapLines`)
When dragging or single-frame resizing:
1. Candidate snap lines are generated from spread boundaries (left, center crease, right, margins) and all inactive frame edges/centers.
2. Snap threshold is typically $5\text{px}$ to $8\text{px}$ in screen coordinates.
3. Dimension matching (`"Match Width"`, `"Match Height"`) detects when a frame's width or height matches a nearby frame within $\pm 0.5\text{mm}$.
4. Distance dimension lines with cyan pill badges display the exact physical gap between aligned frames.

---

## 3. Dual Entity Frame Invariants

Frames hold two independent transformation entities:
1. **Outer Frame Geometry**: `(x, y, width, height, rotation)`.
2. **Inner Photo Crop**: `(cropX, cropY, cropScale)`.

### Actions:
- **`↺ Reset Ratio`** (`resetToOriginalRatio`): Adjusts frame dimensions $(w, h)$ to match the original image's aspect ratio (3:2, 4:3, 1:1, 16:9) centered at current position, leaving crop untouched.
- **`↺ Reset Crop`** (`resetCrop`): Resets internal `cropX = 0`, `cropY = 0`, `cropScale = 1.0` (center-fitted) without altering frame bounds.
