# AFSNSmartAlbum Roadmap

## Phase 0 — Foundation
- [x] Tauri 2 (Desktop IPC & Window Management)
- [x] React 19 + TypeScript + Vite
- [x] Rust Backend with multi-threaded libvips
- [x] SQLite Embedded Database (Atomic transactions & queries)
- [x] Project structure & Clean Domain Layer
- [x] Workspace Antigravity Skills (`.agents/skills/`)
- [x] Architecture & Rules Documentation (`AGENTS.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `PROJECT_FORMAT.md`, `SECURITY.md`)
- [x] Modern Desktop Application Shell & Dock Layout
- [x] About AFSNSmartAlbum Modal

## Phase 1 — Project Creation
- [x] New Project Dialog & Creation Wizard
- [x] Canvas size & Custom Dimensions
- [x] Mathematical Unit System: `mm` / `cm` / `inch` / `px`
- [x] Resolution / DPI management (72 to 1200 DPI)
- [x] Dynamic Photo Spacing & Gap Configuration
- [x] Photo Border (Width, Unit, Color swatch)
- [x] Solid Spread Background Color
- [x] Industry Standard Presets (Square, Portrait, Landscape)

## Phase 2 — Photo Library (Lightroom-Style Management)
- [x] Native File & Directory Import via Tauri dialogs
- [x] Drag & Drop Import from Windows Explorer
- [x] Background Multi-threaded Thumbnail & Preview Generation
- [x] High-performance SQLite Metadata Indexing
- [x] Used / Unused Photo Count Badges
- [x] Favorite Star Toggle & Filter
- [x] Folder & Collections System (Create, Rename, Delete, Drag to Add)
- [x] Multi-selection Modes: Single, Shift-Range, Ctrl/Cmd-Toggle
- [x] Batch Action Bar (Batch Favorite, Copy, Move/Add to Folder, Batch Delete)
- [x] Right-Click Context Menu for Photo Cards
- [x] Missing Photo Detection & Automatic Relinking Wizard

## Phase 3 — Album Structure
- [x] Spread Model (Left Page, Center Gutter/Crease, Spine Width, Right Page)
- [x] Bleed Cut Line Guides (Red overlay)
- [x] Safe Zone Margin Guides (Blue overlay)
- [x] Spread Navigator (Bottom bar, jump selector, thumbnail drawer)
- [x] Keyboard Navigation (PageUp/PageDown, Alt+Left/Right)
- [x] Duplicate & Delete Spreads with Safe Confirmation

## Phase 4 — Canvas Editor & Smart Alignment
- [x] Konva.js Hardware-Accelerated Viewport
- [x] Selection Box & Click Selection
- [x] Drag & Move with Real-time Coordinates
- [x] Single Frame Resize with Corner & Edge Anchors
- [x] **2D Topological Spatial Neighbor Graph Multi-Frame Resize** (100% gap preservation)
- [x] **Dynamic Project Photo Spacing** (Live Property Inspector adjustment & quick apply)
- [x] In-Frame Cropping (Double-click, Pan, Zoom Slider HUD, Done)
- [x] **Dual Entity Reset System** (`↺ Reset Ratio` & `↺ Reset Crop`)
- [x] 90° Clockwise & Counter-Clockwise Frame Rotation
- [x] Viewport Zoom & Smooth Pan Navigation
- [x] Smart Magnetic Snapping with Visual HUD Distance Lines & Match Dimensions Badges
- [x] Multi-Selection Alignment Tools (Left, Center H, Right, Top, Middle V, Bottom)
- [x] Match Dimensions (Match Width, Match Height, Match Both)
- [x] Distribute Spacing (Horizontal & Vertical)
- [x] Layer Ordering (Bring to Front, Send to Back)
- [x] Copy & Paste Frames (`Ctrl+C` / `Ctrl+V`)
- [x] **Standard Professional English UI** across all panels, menus, and HUD overlays

## Phase 5 — Persistence & Project Package
- [ ] Portable `.afsn` Project Packaging
- [ ] SQLite Project Save & Load
- [ ] Auto-Save Background Timer
- [ ] Crash Recovery & Temporary Snapshot
- [ ] History Manager (Undo / Redo with `Ctrl+Z` / `Ctrl+Y`)
- [ ] Project Migration & Schema Versioning

## Phase 6 — Templates & Layout Generator
- [ ] Layout Preset Library (Single, 2-photo, 3-photo, collage grids)
- [ ] Dynamic Template Matching based on selected photo count
- [ ] Custom User Template Saver
- [ ] Frame Aspect Ratio Smart Fitting

## Phase 7 — Auto Layout Engine
- [ ] Photo Orientation Analysis (Landscape vs Portrait vs Square)
- [ ] Visual Balance & Focal Point Scoring
- [ ] 1-Click Auto Album Layout Generation
- [ ] Storyboard Grouping & Chronological Clustering

## Phase 8 — High-Resolution Export
- [ ] Production Print JPEG / PNG Export
- [ ] Multi-page Print-Ready PDF with Embedded Color Profiles (sRGB / CMYK)
- [ ] Bleed Allowance & Crop Mark Generation
- [ ] High-DPI Lab Presets (Photobook, Flush Mount, Layflat)

## Phase 9 — RAW Image Support
- [ ] Camera RAW Decoding (ARW, CR3, NEF, RAF, DNG) via Rust/Libraw
- [ ] Background RAW Preview Extraction without UI blocking

