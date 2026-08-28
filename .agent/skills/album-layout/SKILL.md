# Album Layout Skill

## Purpose
Define Page, Spread, physical dimensions, canvas behavior, pagination standards, and layout rules consistently across AFSNSmartAlbum.

## Model

```text
Album
 ├── Cover Spread (Back Cover + Spine/Gutter + Front Cover)
 ├── Spread 1 (Page 1 + Page 2)
 ├── Spread 2 (Page 3 + Page 4)
 ├── Spread 3 (Page 5 + Page 6)
 └── ...
```

Page and Spread are distinct domain concepts:
- **Page**: A single printable side (physical width/height, margins, background, elements).
- **Spread**: Two facing pages joined at the center fold line (exported as 1 full print sheet).

## Photobook Pagination Standard (1–2 Model)
In modern lab/photobook printing, each spread is designed and exported as 1 complete panoramic file:
- **Cover Spread**: Back Cover & Front Cover (with center Spine/Gutter).
- **Spread 1**: Page 1 (Left Page) & Page 2 (Right Page) $\rightarrow$ `Spread 1 (Pages 1-2)`
- **Spread 2**: Page 3 (Left Page) & Page 4 (Right Page) $\rightarrow$ `Spread 2 (Pages 3-4)`
- **Spread 3**: Page 5 (Left Page) & Page 6 (Right Page) $\rightarrow$ `Spread 3 (Pages 5-6)`
- **Formula for Spread $N$**: Left Page = $(2N - 1)$, Right Page = $(2N)$.

> [!IMPORTANT]
> **DO NOT** use traditional book pagination where Spread 1 starts on Pages 2–3.
> Always follow the **1–2, 3–4, 5–6** sequential spread model.

## Workspace Layout & Panel Separation
- **Bottom Navigation Bar (`PageNavigator`)**:
  - Full-width bar below the central canvas.
  - Controls: `[◀ Prev]`, Spread Selector dropdown, `[Next ▶]`, `+ Add Spread`, and thumbnail drawer toggle (`⊞ Spreads`).
  - **No Duplicate in Sidebar**: Spread navigation and spread list must NOT be duplicated in the right sidebar.
- **Right Sidebar Panel**:
  - Focused strictly on **Project Properties**, **Dimensions**, **Margins & Guides Controls** (live `NumberInput` for Safe Area, Bleed, Gutter, and guide toggles), and **Photo Styling**.
- **Canvas Cleanliness (Auto-Hide Overlays)**:
  - Floating canvas badges (e.g. spread name & dimension badges) must automatically hide when bottom drawers/panels open, ensuring an unobstructed canvas.

## Physical Units & Safe Margin Scaling
Support physical units: `mm`, `cm`, `inch`, `px`.
- All margins (Safe Area, Bleed, Gutter) must support fine decimal values (e.g., `0.5 cm`, `0.1 cm`, `0.125 inch`).
- **No Artificial Pixel Clamping**: Calculations must scale exact physical values to screen pixels without artificial minimum clamps (e.g. do not clamp to `Math.max(6, ...)`), so a `0.5 cm` margin accurately renders visibly thinner and closer to the page boundary than `1.0 cm`.

## Bleed, Gutter, and Safe Area
- **Bleed**: Outer boundary beyond the page trim line (Red dashed guide).
- **Gutter**: Center crease / fold line or cover spine width.
- **Safe Area**: Inner margin guide (Blue dashed guide) ensuring vital content/text is safe from trimming.

## Definition of Done
Layout calculations must be physically consistent, unit conversions tested with automated tests, zoom must not alter physical dimensions, pagination strictly follows the 1–2 model, and export preserves true physical size.
