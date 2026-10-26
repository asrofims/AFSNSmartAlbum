<div align="center">
  <img src="assets/app-icon.png" width="132" alt="AFSNSmartAlbum application icon" />

  # AFSNSmartAlbum

  **Professional offline desktop layout software for photo albums and social media content.**

  Design faster with adaptive layouts, precise physical geometry, non-destructive photo cropping, and native high-resolution export—all without sending client photos to the cloud.

  [![Release](https://img.shields.io/badge/Release-v1.5.6-38bdf8?style=for-the-badge)](https://github.com/asrofims/AFSNSmartAlbum/releases)
  [![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D6?style=for-the-badge&logo=windows)](https://github.com/asrofims/AFSNSmartAlbum/releases)
  [![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=for-the-badge&logo=tauri&logoColor=111827)](https://tauri.app/)
  [![License](https://img.shields.io/badge/License-Proprietary-64748b?style=for-the-badge)](#license)

  [Download the latest version](https://github.com/asrofims/AFSNSmartAlbum/releases) · [Visit the website](https://afsn.afsun.my.id)
</div>

---

## Two focused design modes

| Photo Album | Social Media |
| :--- | :--- |
| Professional layflat spreads with Left Page, Center Gutter/Spine, and Right Page geometry. | True single-post canvas with no album spine or facing-page assumptions. |
| Physical units in `mm`, `cm`, `inch`, or `px`, calculated at the configured project DPI. | Built-in presets for Instagram, Facebook, Pinterest, YouTube, TikTok, and LinkedIn. |
| Full-spread or split-page print export with bleed-aware geometry. | Every post can have an independent width and height within the same project. |

## Current release highlights — v1.5.6

- **Freemium Adaptive Layout Experience** — Free users can now freely explore the Adaptive Layout panel and apply the first 4 variations for their selected photos; variations 5 and above display subtle dimmed previews with pure diamond indicators.
- **Seamless Panel Access for All Users** — Removed the full-panel paywall modal that previously locked Free users out of the Adaptive Layout tab, enabling everyone to test layouts interactively.
- **Unified Pro Diamond Branding** — Replaced all inconsistent "PRO" text badges with clean, standardized cyan diamond icons across My Templates, Dynamic Mode, and premium layout cards.
- **Dynamic Mode Pro Gating** — Designated Dynamic variations and mood tuning as Pro features with non-intrusive diamond indicators and clear inline feedback.
- **Responsive & Uncluttered Workspace** — Shortened notice messages to eliminate text clipping (`...`) in narrow sidebars, removed redundant diamond icons from the primary inspector toolbar, and eliminated repetitive upgrade buttons.
## Highlights

### Adaptive layouts that respect the design

Generate layout variations for one or many photos using their native aspect ratios. Safe Zone Margins, locked objects, crop state, and configured Photo Spacing remain part of the layout calculation.

### Exact multi-frame resizing

The 2D Topological Spatial Neighbor Graph preserves physical gaps across rows, columns, and asymmetric collages when a multi-selection is resized—without uniform-position scaling that distorts spacing.

### Smart Magnetic Snapping

Align objects against canvas edges, centers, Safe Zone Margins, neighboring frames, equal gaps, and—when working on albums—the center spine. Rotation-aware and multi-selection snapping provide precise feedback directly on the canvas.

### Non-destructive photo editing

- Interactive in-frame pan, zoom, and crop rotation
- Drag-and-drop photo replacement and on-canvas photo swapping
- Per-corner frame rounding, borders, opacity, rotation, and layer ordering
- `Reset Ratio` restores native photo proportions without discarding the crop
- `Reset Crop` recenters the photo and restores `1.0x` crop zoom

### Professional object workflow

- Multi-select, group, lock, align, distribute, and match frame sizes
- Unified Layers panel with drag-and-drop stack ordering and grouped folders
- Rich text frames with presets, styling ranges, rotation, opacity, and content fitting
- Undo/Redo coverage for normal editing and layout operations

### Fast offline photo management

AFSNSmartAlbum uses an `Original → Preview → Thumbnail` pipeline, keeping full-resolution decoding out of routine canvas interaction. Folder collections, Lightroom-style multi-selection, missing-photo relinking, and generated-cache maintenance are built into the desktop workflow.

## Export and project safety

| Capability | Details |
| :--- | :--- |
| **Raster export** | High-quality JPEG and PNG with project-aware DPI metadata and optional print sharpening. |
| **PDF export** | Multi-page PDF output, including projects whose Social Media posts use different dimensions. |
| **Album output** | Full layflat spreads or individual Left/Right pages with bleed-aware slicing. |
| **Project files** | Portable `.afsn` archives with SQLite project data and managed image assets. |
| **Recovery** | Crash-recovery snapshots, configurable auto-save, and guarded file replacement. |
| **Privacy** | Local-first processing with no server dependency for editing or export. |

## Core workflow

1. Create a **Photo Album** or **Social Media** project and choose a preset.
2. Import folders or photos into the local library.
3. Drag photos onto the canvas or generate Adaptive Layout variations.
4. Refine frames, crops, text, layers, spacing, and Safe Zone Margins.
5. Export production-ready JPEG, PNG, or PDF files.

## Essential shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Spacebar</kbd> + Drag | Pan the canvas |
| <kbd>Ctrl</kbd> + Mouse Wheel | Zoom in or out |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Fit and center the active canvas |
| <kbd>P</kbd> | Open the Properties panel |
| <kbd>L</kbd> | Open the Layers panel |
| <kbd>G</kbd> | Open the Smart Layout panel |
| <kbd>T</kbd> | Add a text frame |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | Select all canvas objects |
| <kbd>Ctrl</kbd> + <kbd>G</kbd> | Group selected objects |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd> | Ungroup selected objects |
| <kbd>Ctrl</kbd> + <kbd>L</kbd> | Lock selected objects |
| <kbd>Alt</kbd> + Drag | Duplicate while dragging |
| <kbd>S</kbd> | Swap two selected photos |
| <kbd>R</kbd> / <kbd>Shift</kbd> + <kbd>R</kbd> | Rotate clockwise / counterclockwise |

The in-app shortcut reference provides the complete, context-aware list.

## Technology

| Area | Stack |
| :--- | :--- |
| Desktop runtime | Tauri 2 + Rust |
| Interface | React 18 + TypeScript + Vite |
| Canvas | Konva.js + React-Konva |
| State | Zustand |
| Persistence | SQLite + Rusqlite |
| Image processing | Native Rust image pipeline + Rayon |

## System requirements

| | Minimum | Recommended |
| :--- | :--- | :--- |
| Operating system | Windows 10, 64-bit | Windows 11, 64-bit |
| Processor | Dual-core 2.0 GHz | Modern quad-core Intel Core i5 / AMD Ryzen 5 or better |
| Memory | 4 GB RAM | 8–16 GB RAM for large projects |
| Display | 1280 × 800 | 1920 × 1080 or higher |
| Storage | 200 MB for the application | SSD storage for previews, cache, and project assets |

## Updates and support

Use **About AFSNSmartAlbum → Check Updates** to check for a newer signed application release. Project work remains available offline.

AFSNSmartAlbum is independently developed by **Afsunmedia**. The application includes an optional QRIS contribution entry for users who want to support continued development.

## License

Copyright © 2026 **Afsunmedia**. All rights reserved.

AFSNSmartAlbum is proprietary software. Its open-source foundations include [Tauri](https://tauri.app/), [React](https://react.dev/), [Konva](https://konvajs.org/), [SQLite](https://www.sqlite.org/), and [Rayon](https://github.com/rayon-rs/rayon).
