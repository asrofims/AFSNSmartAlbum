# AFSNSmartAlbum — Design System

## Product Character

AFSNSmartAlbum is professional desktop creative software (inspired by Pixellu SmartAlbums, Adobe InDesign, and Adobe Lightroom), not a generic web dashboard.

Design goals:
- **Modern**: Clean dark workspace with high contrast for photo appraisal.
- **Professional**: Precision layout tools with exact physical units (`mm`, `cm`, `inch`).
- **Photo-First**: Photos are hero elements; UI fades into the background.
- **Calm & Predictable**: Consistent keyboard shortcuts and non-intrusive HUD overlays.

---

## Standard English UI Vocabulary

All user-facing text across panels, buttons, tooltips, dialogs, and HUD indicators MUST use standard industry terminology:

| Domain Area | Standard English Label | Description / Notes |
| :--- | :--- | :--- |
| **Album Structure** | `Spread` | Two facing pages side-by-side with center gutter. |
| | `Center Gutter Crease` | The folding line between left and right pages. |
| | `Spine Width` | The width of the album spine / fold. |
| | `Safe Zone Margin` | Inward guide (dashed blue) indicating safe printing boundaries. |
| | `Bleed Allowance / Cut Line` | Outward trim margin (dashed red) cut during binding. |
| **Spacing & Gap** | `Photo Spacing` | Project-level default gap distance between adjacent photos. |
| | `Apply Gap H` / `Apply Gap V` | Re-aligns selected frames to exactly match project spacing. |
| | `Distribute Spacing` | Equidistant distribution across 3+ selected frames. |
| **Snapping & HUD** | `Smart Magnetic Snapping` | Alignment snapping with automatic guidelines. |
| | `Match Width` / `Match Height` | Snapping badge when dimensions align with a neighbor. |
| **Transform & Crop** | `Width (W)` / `Height (H)` | Physical frame dimensions. |
| | `Position X` / `Position Y` | Frame top-left coordinates. |
| | `Rotation Angle` | Frame rotation in degrees (0° to 360°). |
| | `↺ Reset Ratio` | 1-Click restoration of frame geometry to native photo ratio (3:2 / 4:3). |
| | `↺ Reset Crop` | 1-Click re-centering of photo inside frame at 1.0x scale. |
| **Library** | `Folder Collections` | User-created organization groups in photo filmstrip. |

---

## Workspace Layout

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Top App Header (Brand, Project Title, DPI, Quick Actions, About)         │
├────────────────────────────────────────┬─────────────────────────────────┤
│                                        │ Properties Inspector            │
│   Center Canvas Viewport               │ ├── Spacing & Dynamic Gap       │
│   ├── Konva Hardware Accelerated Stage │ ├── Margins & Guides            │
│   ├── Smart Snapping & Distance HUD    │ ├── Multi-Selection Alignment   │
│   └── In-Frame Crop Floating Toolbar   │ └── Position & Dimension (W, H) │
│                                        │                                 │
├────────────────────────────────────────┴─────────────────────────────────┤
│ Photo Filmstrip Tray (Collapsible)                                       │
│ ├── Folder Tabs (All Photos, Collections, + New Folder)                  │
│ ├── Filter (All, Unused, Used, Favorites) & Sort (Name, Date, Size)      │
│ ├── Batch Action Bar (Appears on multi-selection: 2+ photos)             │
│ └── Photo Cards with Used Count Badge & Favorite Star                    │
├──────────────────────────────────────────────────────────────────────────┤
│ Bottom Spread Navigator Bar (Spreads Drawer, Prev, Jump Selector, Next)  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Design Tokens

Use centralized CSS custom properties in `src/styles/design-tokens.css`:
- **Background Colors**: Deep slate/charcoal tones (`#12141a`, `#181b22`, `#212631`).
- **Accent Color**: Electric Cyan/Blue (`#38bdf8`, `#0284c7`) for active tools, selection borders, and snapping highlights.
- **Danger Color**: Crimson/Rose (`#f43f5e`, `#e11d48`) for deletion confirmation and bleed cut lines.
- **Typography**: Clean system sans-serif (`Inter`, `-apple-system`, `Segoe UI`, `sans-serif`) with strict font sizes:
  - Micro / Badges: `9px – 10px`
  - Body / Inputs: `11px – 12px`
  - Section Headers: `12px – 13px` (Bold / Semi-bold)
  - Dialog Titles: `15px – 18px`

---

## Component Guidelines

1. **NumberInput**:
   - Supports numeric scrubbing/stepping with formatted suffixes (`mm`, `cm`, `inch`, `px`, `°`).
2. **ConfirmDialog**:
   - Every destructive operation (deleting spreads, deleting photos from library, deleting folder collections) MUST prompt via modern `ConfirmDialog` with safety-focused cancel button.
3. **ContextMenu & Batch Action Bar**:
   - Right-click anywhere on photo cards or canvas frames provides full desktop-grade action menus with keyboard shortcuts displayed.

