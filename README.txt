================================================================================
AFSNSmartAlbum — Professional Photo Album Layout Software
Version: 1.4.6
Website / Repository: https://github.com/asrofims/AFSNSmartAlbum
Author: Afsunmedia - Asrofims
================================================================================

[ WHAT'S NEW IN 1.4.6 ]
--------------------------------------------------------------------------------
* Strict PRO Graphic Design Export Protection: Gated export of graphic design
  assets with PRO status identically to PRO frames. Free tier accounts cannot
  export projects containing PRO graphics unless they have an active PRO
  subscription or the workspace is under Global Promo / Launch Promo.
* PRO Graphic Detachment Workflow: Updated the "Detach PRO Assets" action in the
  export dialog to automatically remove PRO graphic elements alongside PRO frame
  detachment, immediately unblocking export.
* SQLite Database Persistence for PRO Graphics: Preserved is_pro status across
  project save and load cycles so PRO status survives restarts and reloads
  without degradation.
* Rust High-Res Export Engine Enforcement: Added native backend verification in
  export_commands.rs to validate non-pro accounts against projects with PRO
  graphic elements.

[ PREVIOUS HIGHLIGHTS (1.4.5) ]
--------------------------------------------------------------------------------
* Safe Graphic Vector Icon in Layers Panel: Replaced failing image elements in
  the Layers panel for Graphic Design assets with a clean, safe vector star
  glyph in warm amber/gold styling (#fbbf24), completely eliminating broken
  image icons and thumbnail loading latency.
* Aligned Graphic Design PRO Badge: Replaced the overlapping "PRO" text on
  graphic cards with an elegant, precise diamond vector icon glassmorphism
  badge, perfectly matching the design language of the Frame catalog.

[ PREVIOUS HIGHLIGHTS (1.4.4) ]
--------------------------------------------------------------------------------
* Loading Skeleton & Broken Image Elimination: Eliminated native browser broken
  image visual icons during asset fetching and fallback transitions in both
  Frames and Graphic Design panels.
* Dark-Slate Animated Shimmer: Introduced smooth, pulsating skeleton placeholders
  with centered placeholder glyphs covering transparent preview stages until
  assets are fully downloaded and decoded.
* Instant Memory Cache Verification: Added fast image cache detection so already
  cached frames and graphics render instantly without visual flicker.
* 6-Card Initial Loading Skeleton: Replaced static text with an animated 6-card
  skeleton grid when catalogs are loading for the first time.

[ PREVIOUS HIGHLIGHTS (1.4.3) ]
--------------------------------------------------------------------------------
* Offline UI Notification Clutter Fix: Resolved issue where redundant offline
  notification cards, empty states, and bottom status alerts were stacked
  simultaneously in the Assets Panel upon network disruption.
* Filtered Frame & Graphic Connectivity States: Fixed duplicated error
  notifications on catalog refresh failures by eliminating overlapping error
  notices in the bottom cache bar.
* Simplified & Minimalist Connection Status UX: Redesigned the Assets Panel
  offline indicator to display a single, compact 1-line bar when cached assets
  are ready, and a friendly centered empty state when empty.
* Modern Cloud Off Iconography: Replaced legacy WiFi-off glyphs with the clean,
  modern Cloud Off vector icon matching the application design language.
* Relaxed & Friendly Phrasing: Updated connection disturbance messaging to
  clear, casual, and friendly English.

[ PREVIOUS HIGHLIGHTS (1.4.2) ]
--------------------------------------------------------------------------------
* Grayscale & Photo Effects in Export Preview: Resolved an issue where photos
  with grayscale, blur, or noise filters disappeared from the Export Dialog
  preview snapshot. Configured cross-origin permissions on preview image
  loading to prevent canvas tainting (SecurityError) and introduced graceful
  native canvas filter fallbacks for robust rendering under all browser
  environments.
* Resilient Photo Effect Pipeline: Implemented multi-layered safety fallbacks
  in renderPhotoEffectsBitmap and ExportPreviewSnapshotCanvas ensuring seamless
  rendering even under strict cross-origin browser sandbox restrictions.

[ PREVIOUS HIGHLIGHTS (1.4.1) ]
--------------------------------------------------------------------------------
* Graphic Asset SQLite Persistence & Self-Healing Disk Cache: Resolved an issue
  where graphic design assets failed to render after saving and reopening a
  project. Guaranteed filePath, fileUrl, and asset ID persist reliably across
  SQLite save cycles with automatic disk cache recovery on load.
* Graphic Asset Rendering in Export Snapshot & 300 DPI Output: Resolved an issue
  where graphic assets were omitted from the export navigation preview snapshot
  canvas and final exported print files. Integrated background disk caching in
  graphicAssetService, pre-resolved local file paths for export, and enabled
  native Rust export engine rendering at full print resolution.
* Decorative Frame Slot Geometry & Adaptive Layout Border Controls: Decorative
  transparent frame assets with detected photo placement windows now seamlessly
  preserve fixed slot aspect ratios during adaptive layout generation. Border
  styling controls and layout frame toggles are cleanly hidden when decorative
  frame assets are present to prevent unintentional styling overrides.
* Remote Catalog Reliability & Offline Banner: Eliminated perpetual loading loops
  and duplicate toast notifications when refreshing catalog assets; replaced false
  timeouts with clear, actionable offline indicators and smooth spinner transitions.
* Proportional Watermark Scaling: Watermark font sizes, margins, and shadow offsets
  scale proportionally across all canvas pixel resolutions and DPI export targets.
* Integrated Graphic Design Assets Catalog: Added dedicated Graphic Design asset
  catalog with category browsing, search, transparent PNG/WebP support, live
  canvas placement, and interactive transformation.
* Unified Shared Asset Cache Architecture: Synchronized graphic design asset
  versioning and storage with the existing frame cache pipeline, avoiding
  redundant network downloads or separate cache configurations.
* Background Color Noise Effect: Introduced a subtle noise texture slider and
  procedural shader to solid background colors, perfectly matched across canvas
  editing, live preview, and final 300 DPI export.

[ 1. OVERVIEW ]
--------------------------------------------------------------------------------
AFSNSmartAlbum is a blazing-fast, offline-first desktop application engineered 
specifically for professional wedding, portrait, and commercial photographers, 
as well as album printing labs.

Built with a high-performance Rust core (Tauri 2) and an interactive React/Konva 
design canvas, AFSNSmartAlbum streamlines multi-page photo book creation with 
sub-millimeter precision, smart magnetic snapping, and instantaneous layout 
generation.


[ 2. SYSTEM REQUIREMENTS ]
--------------------------------------------------------------------------------
Minimum Requirements:
  * Operating System: Windows 10 (64-bit) or Windows 11 (64-bit)
  * Processor: Dual-Core 2.0 GHz Intel / AMD 64-bit processor
  * RAM: 4 GB
  * Display: 1280 x 800 minimum resolution
  * Storage: 200 MB free disk space for application

Recommended Requirements:
  * Operating System: Windows 11 (64-bit)
  * Processor: Quad-Core 3.0 GHz Intel Core i5 / AMD Ryzen 5 or better
  * RAM: 8 GB or 16 GB for heavy RAW / high-resolution image libraries
  * Display: Full HD (1920 x 1080) or 4K Ultra HD display


[ 3. KEY FEATURES ]
--------------------------------------------------------------------------------
* 2D Topological Spatial Neighbor Graph Multi-Resize:
  Resizing multiple selected photo frames preserves exact physical gap spacing 
  across complex multi-row, multi-column, and asymmetrical collages without 
  position distortion.

* Smart Magnetic Snapping Engine:
  Millimeter-accurate magnetic snapping aligning to Left/Right Blue Safe Margin 
  Boxes, Center Spine Gutter, Outer Bleed Boundaries, and Inter-Frame Equal Gaps 
  with real-time visual HUD measurement guides.

* Dynamic Adaptive Multi-Photo Partitioning Engine:
  Instantly organize 1 to 12+ photos onto spreads with a single click. Choose 
  from dozens of mathematical layout variations that automatically adapt to native 
  photo aspect ratios while strictly honoring configured safe print margins.

* Dual Entity Reset System:
  - ↺ Reset Ratio: Restores frame geometry to the photo's native aspect ratio 
    (3:2, 4:3, 1:1, etc.) without losing custom pan/zoom crop coordinates.
  - ↺ Reset Crop: Re-centers the image inside the frame and resets zoom to 1.0x.

* High-Performance Photo Pipeline:
  Lightweight background thumbnail and preview generation powered by native Rust 
  image engines. Original multi-megabyte image files remain untouched and are only 
  accessed during final high-resolution export.

* Dual-Format Project Persistence:
  - Compressed Single-File Archive (.afsn): Ultra-compact project package with 
    embedded previews and SQLite database.
  - Self-Contained Project Folder: Complete project directory bundle including 
    copied original photos for 100% offline archival and sharing across workstations.

* High-Resolution Print Export:
  Export album spreads at true 300 DPI in uncompressed TIFF, maximum quality JPEG, 
  or Multi-Page PDF. Supports Full Panoramic Spreads, Left/Right Page Splitting, 
  and custom color profiles.

* In-App Update Checker:
  Check for software updates directly through GitHub Releases with changelog 
  previews and one-click installer downloads.


[ 4. KEYBOARD SHORTCUTS REFERENCE ]
--------------------------------------------------------------------------------
Canvas & Navigation:
  * Spacebar + Drag            : Pan / Move Canvas
  * Ctrl + Mouse Wheel         : Zoom In / Zoom Out Canvas
  * Ctrl + 0                   : Fit Spread to Screen (100% View)
  * Left / Right Arrow         : Previous / Next Spread

Selection & Editing:
  * Click                      : Select Frame
  * Shift + Click              : Multi-Select Additional Frames
  * Ctrl + A                   : Select All Frames on Spread
  * Shift + Drag Frame         : Orthogonal Constraint Drag (Straight Horizontal / Vertical)
  * Arrow Keys                 : Nudge Selected Frame(s) by 1mm
  * Shift + Arrow Keys         : Nudge Selected Frame(s) by 10mm
  * Ctrl + C / Ctrl + V        : Copy & Paste Frame(s)
  * Ctrl + D                   : Duplicate Selected Frame(s)
  * Delete / Backspace         : Delete Selected Frame(s)
  * Ctrl + G / Ctrl + Shift + G: Group / Ungroup Selected Frames

Drag & Drop Photo Actions:
  * Drag photo to empty canvas : Add new photo frame
  * Drag photo onto frame      : Overlay / Stack photo freely
  * Hold ALT + Drag onto frame : 🔄 Replace existing photo with new photo
  * Double-Click Frame         : Enter In-Frame Interactive Crop Mode
  * Enter / Esc                : Exit Crop Mode


[ 5. UPDATES & SUPPORT ]
--------------------------------------------------------------------------------
Software Updates:
  To check for the latest releases, open AFSNSmartAlbum and click "Updates" on 
  the top header or "Check Updates" in the About dialog.
  Releases are published at: https://github.com/asrofims/AFSNSmartAlbum/releases

Contribution & Donations:
  AFSNSmartAlbum is an independently developed application. If this tool helps 
  your photography business or print production workflow, voluntary contributions 
  can be made via QRIS in the "About" dialog or "Support Developer" modal.


[ 6. LICENSE & CREDITS ]
--------------------------------------------------------------------------------
AFSNSmartAlbum is copyright © Afsunmedia - Asrofims. All rights reserved.

Built with Open Source technologies:
  * Tauri (MIT / Apache-2.0)
  * React & TypeScript (MIT)
  * Konva.js (MIT)
  * SQLite (Public Domain)
  * Vite (MIT)
  * libvips / Rust Image (LGPL-2.1 / MIT)

================================================================================
Thank you for using AFSNSmartAlbum!
================================================================================
