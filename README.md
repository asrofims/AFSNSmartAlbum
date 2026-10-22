<div align="center">
  <img src="assets/app-icon.png" width="132" alt="AFSNSmartAlbum application icon" />

  # AFSNSmartAlbum

  **Professional offline desktop layout software for photo albums and social media content.**

  Design faster with adaptive layouts, precise physical geometry, non-destructive photo cropping, and native high-resolution export—all without sending client photos to the cloud.

  [![Release](https://img.shields.io/badge/Release-v1.4.8-38bdf8?style=for-the-badge)](https://github.com/asrofims/AFSNSmartAlbum/releases)
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

## Current release highlights — v1.4.8

- **Safe Cancellation for Project Package Export** — Resolved missing stop/cancel mechanism in Export Project Package (`.zip`), allowing users to safely abort export at any point without crashes, UI lockups, or orphaned files.
- **Atomic File Cleanup on Abort** — Ensured that cancelling export immediately stops compression, frees all file handles, and cleanly removes temporary files (`.afsn-*.tmp`) without leaving corrupt or incomplete zip archives in the target folder.
- **Interactive Cancel Control in Progress Toast** — Added an interactive "Batal" (Cancel) button directly inside the export package real-time progress toast with immediate visual feedback ("Membatalkan...").
- **Graceful Project Store State Recovery** — Suppressed disruptive global red error banners upon user-initiated cancellation and immediately released the saving lock (`isSaving`) to preserve smooth canvas editing.
- **Accessible Cancelled Notification** — Enhanced the progress toast to display a calm, accessible "Export Dibatalkan" amber banner with auto-dismiss and manual dismissal controls.

## Highlights from v1.4.7

- **Live Update Verification without Restart** — Resolved an issue where checking for updates got stuck displaying cached "Up to Date" status even when newer recommended releases were published. Opening the update modal or clicking "Check Now" now always performs a fresh, live network query.
- **Dynamic Toolbar Update Button** — Resolved an issue where the green "Update" button in the top toolbar only showed up after restarting the application. The button now lights up dynamically during active album design sessions as soon as telemetry signals a recommended version or an update is detected.
- **"Check Again" Verification Control** — Added a dedicated "Check Again" button in the update modal so users can re-verify update status on demand at any time.
- **Continuous Periodic Background Update Checks** — Added automatic background update polling every 15 minutes, as well as upon window focus and network reconnection, ensuring users are promptly notified of new releases while working.
- **Cache-Busting for Manifest & Release Assets** — Integrated HTTP `no-cache` directives and cache-busting query timestamps to prevent Windows network caches, proxies, or CDNs from returning stale `latest.json` or release metadata.

## Highlights from v1.4.6

- **Strict PRO Graphic Design Export Protection** — Gated export of graphic design assets with PRO status identically to PRO frames. Free tier accounts cannot export projects containing PRO graphics unless they have an active PRO subscription or the workspace is under Global Promo / Launch Promo.
- **PRO Graphic Detachment Workflow** — Updated the "Detach PRO Assets" action in the export dialog to automatically remove PRO graphic elements alongside PRO frame detachment, immediately unblocking export.
- **SQLite Database Persistence for PRO Graphics** — Preserved `is_pro` status across project save and load cycles so PRO status survives restarts and reloads without degradation.
- **Rust High-Res Export Engine Enforcement** — Added native backend verification in `export_commands.rs` to validate non-pro accounts against projects with PRO graphic elements.

## Highlights from v1.4.5

- **Safe Graphic Vector Icon in Layers Panel** — Replaced failing image loading (`<img>`) on the Layers Panel with a dedicated, safe vector design icon (`GraphicThumbnailIcon`) with amber/gold styling (`#fbbf24`), completely eliminating broken image icon visuals and disk/network latency when inspecting graphic layers.
- **Graphic Design PRO Badge Alignment** — Replaced the overflowing `"PRO"` text on graphic cards with a sleek, precise diamond vector icon glassmorphism badge (`badgePro`), identical in design, dimensions, and styling to the Frame catalog PRO badge.
- **Photo Thumbnail Fallback Concealment** — Added protective `onError` fallback concealing for photo frame thumbnails in the Layers Panel.

## Highlights from v1.4.4

- **Loading Skeleton & Broken Image Elimination** — Completely eliminated native browser broken image visual icons during network asset loading and fallback transitions in both Frames and Graphic Design panels. Image elements are hidden until successfully loaded and then smoothly faded in.
- **Dark-Slate Animated Shimmer Skeleton** — Overlaid loading card preview boxes with an elegant dark-slate animated shimmer sweep and pulsing placeholder glyphs, masking the checkerboard background during image downloading and decoding.
- **Instant Memory Cache Verification** — Added fast image cache detection so already cached frames and graphics render instantly without visual flicker.
- **6-Card Initial Loading Skeleton Grid** — Replaced plain loading text with an animated 6-card skeleton grid when asset catalogs are being fetched for the first time.

## Highlights from v1.4.3

- **Offline UI Notification Clutter Fix** — Resolved an issue where redundant offline notification cards, empty states, and bottom status alerts were stacked simultaneously in the Assets Panel upon network disruption.
- **Simplified & Minimalist Connection Status UX** — Redesigned the Assets Panel offline indicator to display a single, compact 1-line bar when cached assets are ready, and a friendly centered empty state when empty.
- **Modern Cloud Off Iconography** — Replaced legacy WiFi-off glyphs with the clean, modern Cloud Off vector icon matching the application design language.
- **Relaxed & Friendly Phrasing** — Updated connection disturbance messaging to clear, casual, and friendly English.

## Highlights from v1.4.2

- **Grayscale & Photo Effects in Export Preview** — Resolved an issue where photos with grayscale, blur, or noise filters disappeared from the Export Dialog preview snapshot. Configured cross-origin permissions on preview image loading to prevent canvas tainting (`SecurityError`) and introduced graceful native canvas filter fallbacks for robust rendering under all browser environments.
- **Resilient Photo Effect Pipeline** — Implemented multi-layered safety fallbacks in `renderPhotoEffectsBitmap` and `ExportPreviewSnapshotCanvas` ensuring seamless rendering even under strict cross-origin browser sandbox restrictions.

## Highlights from v1.4.1

- **Graphic Asset SQLite Persistence & Self-Healing Disk Cache** — Resolved an issue where graphic design assets failed to render after saving and reopening a project. Guaranteed `filePath`, `fileUrl`, and asset ID persist reliably across SQLite save cycles with automatic disk cache recovery on load.
- **Graphic Asset Rendering in Export Snapshot & 300 DPI Output** — Resolved an issue where graphic assets were omitted from the export navigation preview snapshot canvas and the final exported print files. Integrated background disk caching in `graphicAssetService`, pre-resolved local file paths for export, and enabled native Rust export engine rendering at full print resolution.
- **Decorative Frame Slot Geometry & Adaptive Layout Border Controls** — Decorative transparent frame assets with detected photo placement windows now seamlessly preserve fixed slot aspect ratios during adaptive layout generation. Border styling controls and layout frame toggles are cleanly hidden when decorative frame assets are present to prevent unintentional styling overrides.
- **Remote Catalog Reliability & Offline Banner** — Eliminated perpetual loading loops and duplicate toast notifications when refreshing catalog assets; replaced false timeouts with clear, actionable offline indicators and smooth spinner transitions.
- **Proportional Watermark Scaling** — Watermark font sizes, margins, and shadow offsets scale proportionally across all canvas pixel resolutions and DPI export targets.
- **Integrated Graphic Design Assets Catalog** — Added dedicated Graphic Design asset catalog with category browsing, search, transparent PNG/WebP support, live canvas placement, and interactive transformation.
- **Unified Shared Asset Cache Architecture** — Synchronized graphic design asset versioning and storage with the existing frame cache pipeline, avoiding redundant network downloads or separate cache configurations.
- **Background Color Noise Effect** — Introduced a subtle noise texture slider and procedural shader to solid background colors, perfectly matched across canvas editing, live preview, and final 300 DPI export.

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
