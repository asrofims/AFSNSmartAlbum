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
- [x] Instant Photo Registration & Background Asynchronous Preview Engine
- [x] **Progressive Image Pipeline** (Instant EXIF/Embedded Thumbnail < 0.2ms, Bounded 1500px Canvas Cache, Minimalist Green Bottom Strip, Silent Background Processing, and Automatic Restart Recovery & Healing)
- [x] High-performance SQLite Metadata Indexing
- [x] Used / Unused Photo Count Badges
- [x] Favorite Star Toggle & Filter
- [x] Folder & Collections System (Create, Rename, Delete, Drag to Add)
- [x] Multi-selection Modes: Single, Shift-Range, Ctrl/Cmd-Toggle
- [x] Batch Action Bar (Batch Favorite, Copy, Move/Add to Folder, Batch Delete)
- [x] Right-Click Context Menu for Photo Cards
- [x] Missing Photo Detection & Automatic Relinking Wizard with spread-frame asset recovery
- [x] Automatic Orphaned Thumbnail & Preview Cache Cleanup

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
- [x] Portable `.afsn` Project Packaging & Save As
- [x] Standalone Complete ZIP Archive Packaging (`export_bundled_project_package` with full-res photos)
- [x] SQLite Project Save & Load
- [x] Relaxed Auto-Save Background Timer & Crash Snapshots
- [x] History Manager (Undo / Redo with `Ctrl+Z` / `Ctrl+Y`)
- [x] Modern 2-Column Split-Hero Welcome Screen with Visual Hero Artwork
- [x] Custom Application Branding (`iconafsnsa.png`) & File Association
- [x] Project Migration & Schema Versioning

## Phase 6 — Templates & Layout Generator
- [x] Layout Preset Library (23+ Curated Presets: 1-8+ photos, diptychs, triptychs, grids, collages)
- [x] Dynamic Template Matching based on selected photo count
- [x] 1-Click Layout Apply with Photo Preservation & Undo/Redo integration
- [x] Mini-SVG Wireframe Preview Cards & Right Inspector Templates Tab
- [x] Frame Aspect Ratio Smart Fitting & Gap Preserving Solver

## Phase 7 — Auto Layout Engine (Skipped)
- [x] Auto Layout generation & photo distribution skipped per project requirements

## Phase 8 — High-Resolution Export
- [x] Production Print High-Res JPEG Export (Quality 80%-100%)
- [x] Lossless Production Print PNG Export
- [x] Multi-page Print-Ready PDF with Embedded DCT Streams (sRGB)
- [x] Bleed Allowance Inclusion & Trimmed Page Options
- [x] High-DPI Lab Presets (300 DPI, 240 DPI, 600 DPI, Custom Project DPI)
- [x] Split Spreads into Single Left & Right Pages option (Single-page binding)
- [x] Custom Scope Range Selector (Spreads & Pages syntax)
- [x] Sub-tile Pre-Crop SIMD Coordinate Downsampling Engine (100x speedup, 90% RAM reduction)
- [x] Multi-threaded Export Rendering Engine (`rayon` + hardware thread saturation)
- [x] Advanced Hardware Memory Guard (bounded batch chunking for peak RAM safety)
- [x] Atomic Safe File Writing (Zero file corruption on overwrite/cancel)
- [x] Persistent Last Export Destination Directory
- [x] 2-Way Upfront Pre-Flight Verification (Missing original photo check & Destination overwrite collision warning)
- [x] Real-time Granular Progress Tracking Modal with Direct Destination Folder Launcher
