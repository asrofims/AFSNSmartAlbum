# Album Layout Skill

## Purpose
Define Page, Spread, physical dimensions, canvas behavior, and layout rules consistently.

## Model

```text
Album
 ├── Cover
 ├── Spread
 │    ├── Left Page
 │    └── Right Page
 └── Back Cover
```

Page and Spread are distinct domain concepts.

## Page
A Page may contain:
- width
- height
- unit
- DPI
- background
- bleed
- safe area
- elements

## Spread
A Spread contains:
- left page
- gutter
- right page
- center line

## Units
Support:
- mm
- cm
- inch
- px

Keep physical dimensions separate from logical editor and screen coordinates.

## DPI
DPI converts physical dimensions to export dimensions. Do not create screen canvas sizes from full-resolution export dimensions.

## Spacing
Photo spacing must preserve physical meaning regardless of zoom.

## Border
Support:
- enabled
- width
- unit
- color

## Background
At minimum support solid color. Keep architecture extensible for gradients and image backgrounds.

## Bleed and Safe Area
Bleed is outside the safe/content area. Safe area is a guide and should not automatically become exported content.

## Snapping
Snapping should use logical/physical coordinates, not raw screen pixels.

## Definition of Done
Layout calculations must be physically consistent, unit conversion must be tested, zoom must not change physical dimensions, and export must preserve intended size.
