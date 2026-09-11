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
- [x] Sequential Photo Import Queue, Cancel Rollback Purge, Modal Picker Protection, Ref-Counted Singleton Event Listeners, and Accurate Count Tracking

## Phase 3 — Album Structure
- [x] Spread Model (Left Page, Center Gutter/Crease, Spine Width, Right Page)
- [x] **Dynamic Multi-Scope Background Color System** (Full Spread Canvas, Left Page Only, Right Page Only, and Global Album Propagation)
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
- [x] Viewport Zoom & Smooth Pan Navigation with Auto-Center Spine Focus & Full Left/Right Page Accessibility
- [x] Granular 1% Sequential Photo Crop Zoom (`0.01` step / 100%-350% range across Toolbar, Slider HUD, and Mouse Wheel)
- [x] Smart Magnetic Snapping with Visual HUD Distance Lines & Match Dimensions Badges
- [x] Multi-Selection Alignment Tools (Left, Center H, Right, Top, Middle V, Bottom)
- [x] Match Dimensions (Match Width, Match Height, Match Both)
- [x] Distribute Spacing (Horizontal & Vertical)
- [x] Layer Ordering (Bring to Front, Send to Back)
- [x] Copy & Paste Frames (`Ctrl+C` / `Ctrl+V`)
- [x] Standard Professional English UI across all panels, menus, and HUD overlays
- [x] Exact Zero-Spill Spine Snapping & Clamping (0.01mm coordinate precision, spine alignment, and zero-drift boundary locking across drag and resize)

## Phase 5 — Persistence & Project Package
- [x] Portable `.afsn` Project Packaging & Save As
- [x] Standalone Complete ZIP Archive Packaging (`export_bundled_project_package` with full-res photos)
- [x] SQLite Project Save & Load
- [x] Relaxed Auto-Save Background Timer & Crash Snapshots
- [x] History Manager (Undo / Redo with `Ctrl+Z` / `Ctrl+Y`)
- [x] Modern 2-Column Split-Hero Welcome Screen with Visual Hero Artwork
- [x] Custom Application Branding (`logosmartalbumafsn2.png`) & File Association
- [x] Project Migration & Schema Versioning
- [x] Exclusive `.afsn` save ownership, file identity validation, and recovery preservation when Save As replaces another project's file (SQLite v14).
- [x] Robust Photo Gap & Spread Spacing Persistence across SQLite migrations, .afsn packages, project reloads, and Inspector panels (SQLite v15).
- [ ] Manual verification of same-destination Save As, displaced Recent Projects, copied-file reopen, cancellation, and failed save after the ownership fix (automated tests deferred at user request).

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
- [x] Zero-Overlap Single Page Slicing & Boundary Clamping (Prevents cross-spine bleed and cross-seam sharpening convolution leakage)
- [x] Custom Scope Range Selector (Spreads & Pages syntax)
- [x] Sub-tile Pre-Crop SIMD Coordinate Downsampling Engine (100x speedup, 90% RAM reduction)
- [x] Multi-threaded Export Rendering Engine (`rayon` + hardware thread saturation)
- [x] Advanced Hardware Memory Guard (bounded batch chunking for peak RAM safety)
- [x] Atomic Safe File Writing (Zero file corruption on overwrite/cancel)
- [x] Persistent Last Export Destination Directory
- [x] 2-Way Upfront Pre-Flight Verification (Missing original photo check & Destination overwrite collision warning)
- [x] Real-time Granular Progress Tracking Modal with Direct Destination Folder Launcher

## Phase 9 — Text & Typography Engine
- [x] Polymorphic Album Element Schema (`AlbumElement = PhotoFrameElement | TextNodeElement`)
- [x] SQLite Migration v10 (`text_payload TEXT` column) & Atomic Album Persistence
- [x] Konva Interactive Text Node (`TextNode.tsx` with physical point-to-pixel math, drag, resize, rotate)
- [x] Double-Click WYSIWYG Inline Text Editor (`TextInlineEditor.tsx` overlay with live sync, multi-line support, and idempotent commit)
- [x] Typography Inspector Panel (`TypographyPanel.tsx` with quick presets, font picker, live 60 FPS size slider & stepper, formatting, color swatches, line height, and letter spacing)
- [x] Universal Unit-Aware Typographic Sizing Math (`ptToScreenPx` & `convertPtToUnit` supporting mm, cm, inch, and px)
- [x] Professional Initial Text Placement & Bounding Box Sizing (non-overlapping spine fold, clean page alignment)
- [x] Free Text Box Resize without Aspect Ratio Lock (`Transformer keepRatio={false}` for single text frames)
- [x] Top Toolbar "Add Text" Tool & Global Shortcut <kbd>T</kbd>
- [x] Proportional Font Size Scaling on Canvas Corner Resize (with granular 1pt minimum font size support)
- [x] Content-Aware Auto-Fit Bounding Box (`calculateTextFitHeight` & "Fit Box" action)
- [x] Dual InDesign-Style Text Frame Fitting: `↕ Fit Height to Text` (Preserve Column Width) & `⤢ Fit Frame to Content` (Hug Width & Height, <kbd>Ctrl+Alt+C</kbd>)
- [x] Handle-Aware Text Transformations: Free vertical resizing via top/bottom center handles, column word-wrapping via side handles, and zero-jump proportional diagonal scaling
- [x] Typographic Safety Breathing Buffer (`safetyBufferPt = 6` / ~2.1mm) & ceiling rounding preventing accidental sub-pixel line drops
- [x] Vertical Middle Alignment (`verticalAlign: 'middle'` default with Top/Middle/Bottom segmented controls)
- [x] Dynamic Style Preset Auto-Fitting (tight content wrapping without empty bottom space)
- [x] Centralized Smooth Auto-Scroll to Top of Properties Panel for Selected Photos & Text
- [x] WebView2 D3D11 Crash Guard & Idempotent Auto-Save SQLite Persistence
- [x] Advanced Per-Word Tokenized Rich Text Layout & Styling (per-word bold, italic, underline, strike, custom colors, background highlights, multi-line wrapping, floating mini format bar, and keyboard shortcuts)
- [x] High-Resolution Print Export Text Rasterization in Rust Backend (SIMD-accelerated fontdue glyph rasterization, system font fallback mapping, styled ranges, word-wrapping, baseline alignment, and alpha compositing)

## Phase 10 — Studio Polish & System Lifecycle (v1.0.24)
- [x] Live Scaled Canvas Preview for Export Studio (Spread & Single Page views with guides)
- [x] True-to-Canvas Export Preview (Elimination of artificial border and shadows)
- [x] Fixed Action Footer & Scrollable Middle Content in Export Dialog
- [x] Safe Identity Forking for "Save As" (Independent project clones in SQLite & Recent Projects)
- [x] Non-Shuffling In-Place Photo Gap Spacing Engine
- [x] Asynchronous FIFO Photo Import Queue with Thread-Safe Rayon Worker
- [x] Coordinated Photo Import Cancellation & Safe Project Close Cleanup
- [x] Project ID Event Isolation & Cross-Project Contamination Discard
- [x] Visual Cancel Rollback Purge and Modal File Picker Protection
- [x] Ref-Counted Singleton Tauri Listeners & Accurate Registration Counting
- [x] Custom Preset Name Input Ergonomics & Global Browser Context Menu Suppression
- [x] Floating Toast Import Feedback & Spread Canvas Optimization (repositioned success, cancel, duplicate, and relink notices to click-to-dismiss toast)
- [x] Dynamic Clipboard-Aware Context Menu Paste Labels (`Paste Text`, `Paste Photo`, `Paste Elements`) with Toast Feedback
- [x] Alt+Drag Duplication Conflict Resolution (Elimination of accidental drag-swap aborts near adjacent frames, dedicated key listener, normalized threshold)
- [x] High-Fidelity Font Rendering Pipeline (Proportional unit-aware font scaling and flex vertical alignment in Export Preview; Windows 8.3 filename mapping, bold/italic registry variant lookup, and .ttc font support in Rust exporter)
- [x] Expanded Guaranteed Windows Album Typography in Curated Font Library (`Century Gothic`, `Palatino Linotype`, `Gabriola`, `Segoe Script`, `Constantia`, `Garamond`, `Lucida Calligraphy`, `Monotype Corsiva`)
- [x] Miniature Spread Navigator Font Preview Fidelity (Virtual supersampling scaling in PageNavigator and ExportSpreadPreview bypassing browser min-font-size clamping with full font family fallback support)
- [x] Official Tauri v2 Signed Auto Updater with Ed25519 Cryptographic Signature Verification

## Phase 11 — Modern Creative Desktop Preferences & Studio Ergonomics (v1.0.25)
- [x] Complete Preferences / Settings Dialog Modernization (220px desktop sidebar with glowing accent capsules, responsive card layouts, inline vector SVGs)
- [x] Granular Snapping Configuration & Sensitivity Presets (0.1mm Subtle to 2.0mm Strong with precision number input and 5 target switches)
- [x] Interactive Multi-Frame Resize Gap Mode Selection (Proportional Visual Gap vs Strict Fixed Physical Gap with generous card layout)
- [x] Real-Time Searchable Keyboard Shortcuts Engine (Action/key/category search, filter chips, and tactile desktop `<kbd>` keycaps)
- [x] Modern About AFSNSmartAlbum Dialog (76px squircle app logo with ambient glow, system technical specs, QRIS support, and interactive open source chips)
- [x] Workspace Properties Panel Lifecycle Optimization (Closed by default on initial launch / Welcome Screen, automatically opens when entering or creating a project)

- [x] Resilient Dual-Flow Update Engine (Tauri `check()` with graceful fallback to GitHub Releases REST API)
- [x] Real-Time Streaming Download Progress Tracking (% and MB / Total MB) with Non-Blocking Background Download
- [x] Native In-App Restart Action (`app.restart()`) & Zero-Disruption Offline Launch Resilience
- [x] Permanent Fallback Manual `.exe` Download Option Preserved Across All Update States
- [x] Smart GitHub Actions Release Workflow (Asset completeness existence check, redundant run skipping, dynamic version tag resolution, and automated commit-based changelog generation)

## Phase 12 — Single-Page Precision Print Export & Selective Spread Splitting (v1.0.26)
- [x] Dedicated Single-Page Export Selection (Seamlessly export specific single page numbers from any spread without forced opposite page emission)
- [x] Auto-Splitting Mode Synchronization (Switching custom range to `Pages` mode automatically enables and locks page-level splitting)
- [x] Granular Preflight Collision Detection (Export disk check selectively evaluates only explicitly targeted page files)
- [x] Rust High-Res Splitting Gate (`selected_page_numbers` filter for left and right page worker emission across JPEG, PNG, and PDF)
- [x] Descriptive Feedback Indicator in Export Dialog (Real-time single vs multi-page export target summary with active page number badges)

## Phase 13 — Responsive Typography Engine, Real-Time Dynamic Text Fitting, Viewport Invariance & Subpixel Edge-Clamping (v1.0.30)
- [x] Zoom-Independent Canvas Typography (Precise unquantized subpixel font scaling and linear padding eliminate paragraph re-wrapping and position shifting on zoom in/out)
- [x] Real-Time Auto-Expanding Text Box Geometry (Dynamic text height calculation without canvas clipping or downward jumping on Fit operations)
- [x] Streamlined InDesign-Style Typography Toolbar (Clean 'Fit Height to Text' and 'Fit Frame to Content' controls with removed redundant actions)
- [x] Translucent Canvas Inline Text Editor (Reduced 80% opacity dark overlay and refined glow for seamless in-situ photo composing)
- [x] High-Contrast Mouse Selection Highlight (Vivid Royal Blue `#2563eb` with crisp white text for instantaneous editing clarity)
- [x] Web Typography Font Embeds (Google Web Fonts loaded for true Inter, Playfair Display, Cinzel, Montserrat, Cormorant Garamond, and Great Vibes canvas rendering)
- [x] Export Spread Preview Subpixel Edge-Clamping (Exact container height mapping and frame boundary snapping eliminate 1px white border gaps)

## Phase 14 — Batch Spread Deletion Isolation, Auto-Empty Spread Reset & Clean Package Archiving (v1.0.31)
- [x] Canvas Object Protection on Spread Deletion (Shortcut isolation guards canvas from accidental element deletion when interacting with spread drawer or confirmation modals)
- [x] Unrestricted Multi-Spread Batch Deletion (Allowed deleting all spreads simultaneously with intuitive confirmation dialog)
- [x] Automatic Blank Spread Fallback (Deleting all spreads instantly provisions a fresh, clean Spread 1 to preserve album integrity and design readiness)
- [x] Clean Export Packaged Filter (Simplified file save filter to pure `ZIP Archive (*.zip)`, removing confusing legacy `.afsnz` label)
- [x] Enhanced Project Import Filter (Open dialog now supports both single `.afsn` files and bundled `.zip` archives)

## Phase 15 — Canvas Keyboard Deletion Restored & Standard Formal Date Localization (v1.0.32)
- [x] Unhindered Canvas Object Keyboard Deletion (Eliminated drawer-based Delete/Backspace interception so selected canvas photo/text frames are deleted instantly via keyboard even when spread drawer is open)
- [x] Context-Aware Drawer vs Canvas Keyboard Routing (Keyboard Delete strictly prioritizes active canvas objects; drawer deletion only fires when drawer is hovered or multi-spreads are explicitly targeted)
- [x] Synchronized Ctrl+A Selection Hierarchy (Context-sensitive shortcut routing between canvas elements, photo filmstrip, and spread drawer)
- [x] Standard Formal Date Formatting (Implemented `formatStandardDate` conforming to Indonesian formal standard / PUEBI "D MMMM YYYY", resolving raw/informal timestamps in update dialogues)

## Phase 16 — Native Window Close Interception, Unsaved Changes Alert & Global Filmstrip Selection Clearance
- [x] Native OS Window Close Interception (Rust `.on_window_event` intercepts `CloseRequested` cleanly without IPC security rejections)
- [x] Unsaved Changes Protection Alert (Automatic dirty state synchronization from Zustand store to Rust backend prevents accidental application closing when changes are unsaved)
- [x] Direct Native Force Exit Command (`exit_app` in Rust with `app.exit(0)` and `std::process::exit(0)` for clean, non-hanging shutdown on "Exit Without Saving")
- [x] Uninhibited Window Close for Saved Projects (Native OS window close button 'X' closes immediately with 0 delay when project is saved or on Welcome screen)
- [x] Global Filmstrip Selection Dismissal (Capturing pointerdown listener and spread drawer capture ensure clicking anywhere outside the filmstrip immediately deselects photos)
- [x] Professional Topbar Alignment & Help Menu (Dedicated 'Help ▾' dropdown containing Settings and About, with centered project action controls)

## Phase 17 — Dynamic Per-Corner Rounded Corners & In-Frame Crop Rotation (v1.0.33)
- [x] Dynamic Per-Corner Frame Rounded Corners (Physical unit normalization, independent TL, TR, BR, BL radii, Konva clipping & border geometry)
- [x] High-Resolution Rust Export Anti-Aliased Rounded Corners (Subpixel $\alpha$-masking for photo clipping and rounded borders)
- [x] SQLite Migration v12 (`corner_radius_tl`, `corner_radius_tr`, `corner_radius_br`, `corner_radius_bl` persistence)
- [x] Spread Previews Synchronization (`PageNavigator` & `ExportSpreadPreview` reflecting rounded frame geometry)
- [x] Minimalist Properties Inspector (Clean slider, precision numeric input, icon-only Reset `↺` and Link `🔗`/`🔓` toggles, zero template clutter)
- [x] In-Frame Photo Crop Rotation & Canvas Previews (White void backing, unified rotation button, angle synchronization across preview & export)

## Phase 18 — Safe Margin Zero-Value Consistency & Falsy Logic Elimination
- [x] Zero Safe Margin Preservation (Fixed `min={0.1}` clamping in `NewProjectDialog` allowing exact `0` safe margin for full-bleed and borderless layouts)
- [x] Falsy Logical OR Fix (Replaced `project.marginValue || 10` with nullish coalescing `?? 10` across album creation, spreads, and workspace properties)
- [x] Initial Spread 4-Sided Margin Binding (`createInitialAlbum` now binds `safeAreaTop`, `safeAreaBottom`, `safeAreaOutside`, `safeAreaSpine` to Cover and Spread 1)
- [x] Whole Pixel Stepping & Precision (`px` canvas units now use `step=1` and `precision=0` across wizard, workspace properties, and structure panels)
- [x] Zero-Value Guide Clamping Removal (`SpreadCanvas` and `AlbumStructurePanel` updated to support `0px` safe area margins cleanly)
- [x] Test Suite Assertion Consistency (Resolved legacy test assertions and added comprehensive Section 12 unit tests for zero safe margins and seamless spine folds)
- [x] Dynamic Template Dropdown Unit Synchronization (`formatPresetLabel` dynamically converts template dropdown dimensions to match the active project unit `mm`/`cm`/`inch`/`px`)
- [x] Smart Cross-Unit Preset Matching (`findMatchingPreset` tolerance matching prevents active preset from resetting to "Custom Dimensions" when changing units)
- [x] Active Unit Preservation on Preset Select (`handlePresetSelect` converts template dimensions to the user's active unit instead of forcibly resetting `canvasUnit`)

## Phase 19 — Release v1.0.36: Typography & Text Engine Recovery
- [x] Restored the complete typography and text engine implementation from Git snapshot `660de5deb9e6b4f9c7051d10e33e762eb8eb6542`.
- [x] Core text placement, physical measurement, frame resizing, dynamic height/content fitting, inline editing, previews, and bundled font assets verified.
- [x] Rust export text rasterizer and high-resolution export synchronization restored.
- [x] Full test suite validation: all 62 restored files verified; unit tests (`npm test`), production build (`npm run build`), Rust text rasterizer tests, and 240 canvas browser assertions passing.
- [x] Application version metadata bumped to `v1.0.36`.

## Phase 20 — Release v1.0.37: Text Frame Resize Jitter Elimination & Transform Stability
- [x] Fractional Font-Size Preservation: Preserved fractional font sizes during corner resizing so fitted lines do not alternate between wrapping and unwrapping at 0.1 pt rounding boundaries.
- [x] Styled-Range Font Release Consistency: Committed styled-range font sizes with the exact scale used by the live preview, eliminating changes on mouse release.
- [x] Text Frame Overflow Indicator Clipping: Kept the overflow indicator, including its stroke, safely inside the text frame even for frames smaller than the indicator. Its appearance no longer alters bounds used by Konva Transformer.
- [x] Comprehensive Browser Regression Suite: Added `Run Resize Regression` in `tests/typography-browser.html` covering eight handles at 0°/45°, direction reversal, fractional corner resizing of fitted text, release consistency, and overflow bounds (all 547 resize assertions pass).
- [x] Application version metadata bumped to `v1.0.37`.

### Text Resize and Auto Size Follow-up — 8 September 2026

- [x] Keep the frame transform under Konva ownership throughout a resize; update text drawing synchronously, use frame-only transform bounds, and normalize geometry once on release.
- [x] Measure live corner-resize text at its starting font size to preserve line wrapping and glyph alignment during continuous scaling.
- [x] Preserve Auto Size selection across single and group resizing. Height Only continues fitting text through the document update operation.
- [x] Fit Frame to Content can expand a narrow column up to the page width; Fit buttons read committed text and report when the frame already fits.
- Validation: code review, whitespace check, and TypeScript `tsc --noEmit` passed; tests and interactive verification were not run, as requested.

### Inter-Object Gap Guide Accuracy — 8 September 2026

- [x] Restrict gap guides to strictly facing neighbors with overlapping projections; position dimension lines in the shared overlapping span rather than pairing diagonal objects.
- [x] Apply a 25 mm proximity threshold for displaying individual adjacent gap indicators, eliminating cluttered guides between distant objects across the canvas.
- [x] Derive gap values from snapped geometry, remove obsolete collinear snap lines superseded by equidistant snapping, and account for rotated frame bounds.
- [x] Position distance badges beside dimension lines to keep narrow gaps and endpoint tick marks visible.

## Project Save/Open Integrity — 8 September 2026
- [x] Restrict editable documents to AFSN; ZIP packages are extracted before opening and never become Save/autosave targets.
- [x] Atomic AFSN/ZIP file publication, strict asset-copy error handling, and unchanged destination files after failed writes.
- [x] Transactional project imports, independent copy identities, preserved photo collection membership, and relative asset resolution.
- [x] Guarded Save/Save As/autosave pipeline, serialized recovery writes, honest failure/dirty state, and protection for edits made during saves.
- [x] Full file save for Save & Continue / Save & Exit, unsaved protection for external opens, and explicit save/open errors.
- [x] Regression tests for real ZIP extraction/edit/save/reopen, failure rollback, cancellation, and concurrent edits. Details and compatibility limits are recorded in `PROJECT_PERSISTENCE_AUDIT.md`.

### Missing Project File Recovery — 9 September 2026

- [x] Mark cached recent projects unsaved when their AFSN file is missing; explain the location choice in the recovery dialog.
- [x] Prompt for a destination on manual Save when the original file is missing, retaining the recovered project identity and updating its recent entry after successful publication.
- [x] Keep autosave limited to recovery checkpoints for missing files; preserve the existing path and unsaved state on cancellation or failure.
- [x] Add regression coverage for missing recent files, autosave, destination selection, cancellation, failed writes, subsequent saves, and edits during the recovery picker.

## Four-Sided Margin Persistence — 8 September 2026

- [x] Persist Top, Bottom, Outside, and Spine project defaults through the Tauri command and SQLite project schema.
- [x] Persist independent safe-area values on every cover and interior spread through Save, Save As, AFSN, and packaged export workflows.
- [x] SQLite migration v13 backfills existing projects and spreads from the legacy uniform margin while older AFSN documents retain the same fallback behavior.
- [x] Add native regression coverage for asymmetric project and spread margin round trips.

### Phase 21 — Release v1.0.39: Multi-Select Text Proportional Font Scaling & Overflow Fix
- [x] Preserve exact unrounded floating-point font sizes and styled-range sizes during multi-selection resize in `calculateRotatedMultiFrameResize` and `calculateMultiFrameResize`.
- [x] Use ceiled hundredth rounding (`Math.ceil`) for text element dimensions so continuous multi-selection scaling never shrinks frame boundaries below tightly fitted text content.
- [x] Relax layout engine word-wrap and overflow detection tolerance to `0.05 pt` in `richTextRenderer.ts`, eliminating false rewraps and false red `+` overflow badges caused by unit conversion float drift.
- [x] Route multi-frame updates for text elements through `updateTextNode` in `batchUpdateFrames` to guarantee clean style normalization and height auto-sizing.
- [x] Application version metadata bumped to `v1.0.39`.

### Phase 22 — Release v1.0.40: Photo Lifecycle, Import Reliability & Cache Cleanup Hardening

- [x] Audit import, thumbnail/preview generation, and library removal; record evidence and priorities in `PHOTO_LIFECYCLE_AUDIT.md`.
- [x] Preserve confirmed removal IDs across dialog interactions and provide reliable busy, success, and error feedback (F1/F7).
- [x] Coordinate transactional photo/frame removal, project dirty state, and Undo/Redo asset validity (F2/F3).
- [x] Replace filename-only duplicate/relink identity checks and propagate import/processing failures accurately (F4/F5).
- [x] Coordinate cache writers with cleanup; separate committed library removal from deferred cache maintenance (F6).
- [x] Return correct thumbnail paths for all formats, invalidate stale caches, and isolate recovery cancellation per job (F8/F9).
- [x] Implement image/EXIF validation, recursive folder scanning limits, decoder memory limits, and restricted asset filesystem scope (F10).
- [x] Application version metadata bumped to `v1.0.40`.

### Phase 23 — Release v1.0.41: Photo Collection Consistency & Transactional Membership

- [x] Complete photo/collection removal dialog feedback and project snapshots, modal shortcut guards, committed favorite updates, and dirty-state tracking for collection changes.
- [x] Make collection membership additions and moves transactional, reject cross-project membership, and surface library errors without replacing failed collection reads with empty results.
- [x] Application version metadata bumped to `v1.0.41`.

### Phase 24 — Release v1.0.42: Compact Icon-Only Lock Controls & UI Space Optimization

- [x] Streamline Multi-Selection, Selected Text Box, and Selected Photo Frame lock controls in the right Properties panel.
- [x] Replace text-heavy labels with compact 24×24 px icon-only SVG buttons to eliminate horizontal header overcrowding.
- [x] Replace emoji lock/unlock glyphs with crisp, accessible vector SVG paths and informative tooltips.
- [x] Application version metadata bumped to `v1.0.42`.

### Phase 25 — Release v1.0.43: Non-Uniform Corner Radius Save Fix & 4-Corner Inspector Redesign

- [x] Fix SQLite save error when photo frames have independent (non-uniform) per-corner radii using `CornerRadiusPayload` serde untagged enum.
- [x] Redesign right inspector Corner Radius panel into a sleek 2x2 physical grid with dynamic vector corner glyph indicators and canvas unit suffix.
- [x] Application version metadata bumped to `v1.0.43`.

### Phase 26 — Release v1.0.44: Adaptive Layout Engine Restoration & Full Template Variety

- [x] Revert experimental adaptive layout constraints and ratio-warping transformations back to the rich, stable `edf0c62` baseline.
- [x] Restore full diversity of geometric templates (1 to 12+ photos, diptychs, triptychs, multi-row, collages, and grids).
- [x] Application version metadata bumped to `v1.0.44`.

### Phase 27 — Release v1.0.45: Adaptive Layout Edge Confinement, Canvas Edge Alignment & Save Status Synchronization

- [x] Fix canvas edge measurement and perimeter gaps in adaptive layout engine: `getProjectDimensionsInCanvasUnit` now respects `project.marginEnabled` (margins evaluate to 0 when disabled), allowing layouts to expand cleanly to canvas boundaries.
- [x] Eliminate sub-pixel / sub-millimeter perimeter gaps in `partitionPageBoxIntoKRects` by absorbing fractional column and row dimensions into terminal partitions, guaranteeing 0 gap against page boundaries.
- [x] Partition Count 1 now produces full-bleed flush rectangles filling 100% of the usable box.
- [x] Add dual alignment modes: **Align to Canvas Edge** (`targetMode: 'page_edge'`) and **Align to Safe Margin** (`targetMode: 'safe_margin'`) in Single-Frame Inspector, Multi-Selection Inspector, and Canvas Right-Click context menus.
- [x] Multi-selection alignment to canvas edges moves the composite bounding box flush to the target edge while preserving exact internal relative spacing and gaps.
- [x] Fix toolbar Save button staying orange after save: implement `isAlbumDesignEqual` / `isSpreadDesignEqual` / `isElementDesignEqual` to distinguish runtime thumbnail/preview cache updates from user design edits, preventing background asset generation from resetting `saveStatus` to `unsaved`.
- [x] Enhance `calculateSnapping` to magnetically snap to the center spine / fold line on layflat albums with zero gutter width.
- [x] Application version metadata bumped to `v1.0.45`.

### Phase 28 — Release v1.0.46: Full-Bleed Adaptive Layout Variations (Edge-to-Edge)

- [x] Fix persistent gap between photo frames and canvas edge in adaptive layout engine: all photo counts (1–6+) now generate **full-bleed variations** that place frames flush to the physical page edge `(0, 0)` → `(pageWidth, spreadHeight)`, with zero gap to canvas boundaries.
- [x] Single-photo (count=1) full-bleed variations (`Right Page Full Bleed`, `Left Page Full Bleed`, `Full Bleed Panoramic Spread`) now appear as the first/highest-priority layout options, before safe-margin-confined variations.
- [x] Multi-photo (count ≥ 2) full-bleed per-page split variations: `partitionPageBoxIntoKRects` operates on page-edge bounding boxes instead of safe-margin-inset boxes, producing layouts flush to canvas edge on all 4 sides.
- [x] Multi-photo (count ≥ 2) full-bleed spread-wide variations: photos span the entire spread edge-to-edge as a single collage, tagged with `'full-bleed'` and `'spread'`.
- [x] Existing safe-margin-confined variations are preserved alongside full-bleed options, giving users both edge-to-edge and margin-respecting layout choices.
- [x] Test suite updated: safe-margin confinement test now correctly excludes full-bleed tagged variations; new tests verify full-bleed presence and canvas-edge contact for counts 1–6.
- [x] Application version metadata bumped to `v1.0.46`.

### Canvas Edge Precision Follow-Up — 9 September 2026

- [x] Preserve fractional physical positions during canvas, safe-margin, and selection alignment so edge contact and relative frame spacing survive the alignment operation.
- [x] Remove tenth-unit rounding from photo cover dimensions and crop offsets; photos now cover fractional adaptive-layout frames without exposing thin background strips.
- [x] Use one physical-to-screen scale for the Konva sheet, frame geometry, facing-page boundary, and safe-area guides, avoiding independent pixel rounding at different zoom levels.
- [x] Preserve exact resize-snap bounds and photo geometry on pointer release; use converted four-sided margins consistently with canvas guides instead of the raw spread margin.
- [x] Add resize regressions for fractional bottom/corner and side snapping, stationary opposite edges, zero/asymmetric bottom margins, and viewport conversion at multiple zoom levels.
- [x] Add strict regression assertions for fractional alignment in mm/cm/inch/print-pixel scales, photo coverage at pan/zoom limits, and adaptive layout through frame creation and viewport projection (1–12 photos).
- [x] Validate with `npm test` and `npx tsc --noEmit`; native desktop visual verification remains manual.

### Save Status After Photo Cache Refresh — 9 September 2026

- [x] Preserve the prior document save status when synchronizing generated photo assets; let the queued database checkpoint manage its own saving transition so a successful file save does not become unsaved after cache refresh.
- [x] Reproduce and cover post-save preview refresh, sequential queued cache writes, existing unsaved edits, and frame edits made during a background checkpoint.
- [x] Validate with `npm test` and `npx tsc --noEmit`; native desktop visual verification remains manual.
- [x] Application version metadata bumped to `v1.0.47`.

### Phase 29 — Release v1.0.48: Adaptive Layout Safe Margin Enforcement & Global Version Alignment

- [x] Restrict full-bleed suggestions to zero effective margins, superseding Phase 28's unconditional full-bleed alternatives. Positive margins now constrain every suggested adaptive layout.
- [x] Keep single-photo spread panoramas available only when the spine margin is zero; positive spine margins keep frames within individual page safe areas.
- [x] Resolve spread margin overrides before project defaults, including explicit zero values, and retain four-sided unit conversion and disabled-margin behavior.
- [x] Add regression coverage for every suggested layout with 1–12 photos, cover/spread modes, asymmetric and partially zero margins, and project-zero/spread-positive overrides.
- [x] Unify versioning metadata across all system components (`package.json`, `Cargo.toml`, `Cargo.lock`, `tauri.conf.json`, `app_commands.rs`, `useTauriInfo.ts`, `appStore.ts`, `README.md`, `README.txt`, `LICENSE.txt`).
- [x] Validate with `npm test` and `npx tsc --noEmit`; native desktop visual verification remains manual.
- [x] Application version metadata bumped to `v1.0.48`.

### Phase 30 — Release v1.0.49: Interactive Pasteboard & Off-Page Staging Canvas

- [x] Extend the scrollable workspace around the spread, including off-page objects and crop handles; keep the Konva bitmap limited to the visible viewport for bounded rendering memory.
- [x] Preserve the document point at the viewport center during zoom and workspace extent changes, and translate selection, drop, context-menu paste, and resize snapping coordinates consistently.
- [x] Allow photo placement and paste outside the page, including negative coordinates; retain these objects in the saved spread.
- [x] Keep export bounded to the page and configured bleed. Only extend trim-aligned photo edges into bleed, without pulling pasteboard objects or shifting frames that cross the trim line.
- [x] Validate with `npm test`, `npx tsc --noEmit`, and the native pasteboard/bleed export regression test.
- [x] Verify crop-handle dragging outside the page, moving a parked object onto the page, bottom-edge resize snapping after scrolling, and zoom in the browser fixture (`/tests/pasteboard.preview.html`). Native desktop interaction verification remains manual.
- [x] Application version metadata bumped to `v1.0.49`.

### Phase 31 — Release v1.0.50: Exact Center Spine Snapping & Canvas Boundary Contrast

- [x] Implement `alignElementPositionToSpine` for exact zero-spill snapping when moving or resizing photo frames adjacent to the center spine / fold line on layflat albums.
- [x] Prevent slight floating-point overhangs into facing pages by clamping edge contacts within 0.05 physical unit tolerance to the exact spine boundary.
- [x] Add high-contrast solid black outer perimeter border around the canvas spread sheet, providing crystal-clear visual delineation against the interactive pasteboard backdrop.
- [x] Add regression test coverage for spine alignment, single-page clamping, panorama traversal preservation, and spine resize snapping.
- [x] Application version metadata bumped to `v1.0.50`.

### Phase 32 — Release v1.0.51: Real-Time Adaptive Safe Margin Scaling & Multi-Spread Application

- [x] Implement `applyAdaptiveSafeAreaToSpread`: adaptively resize and reposition photo frames when safe margins change (uniform or 4-sided asymmetric: top, bottom, outside, spine).
- [x] Preserve exact physical inter-frame gaps, crop scale, and pan offsets during safe margin scaling.
- [x] Add `applySafeAreaToAllSpreads` in `useAlbumStore`: batch apply uniform or asymmetric margin changes across the cover and all spreads with full undo/redo history tracking.
- [x] Add regression test coverage for safe area scaling, ID preservation, crop preservation, and asymmetric 4-sided margin confinement in `tests/album.test.ts`.
- [x] Application version metadata bumped to `v1.0.51`.

### Phase 33 — Release v1.0.52: Responsive Toolbar Layout & Workspace Ergonomics

- [x] Modernize editor toolbar with dedicated `.toolbarLeftSection` and `.toolbarRightSection` flex alignments, eliminating overflow on compact laptop displays.
- [x] Implement compact responsive breakpoints down to 840px screen width with label folding, compact separators, and optimized zoom buttons.
- [x] Elevate dropdown menus and dropdown container z-indices (`z-index: 99999`) to prevent clipping beneath canvas layers or modal overlays.
- [x] Application version metadata bumped to `v1.0.52`.

### Phase 34 — Release v1.0.53: Snapping UX Corrections, Panel Hierarchy & Single Photo Safe Margin Real-Time Scaling

- [x] Fix Bypass Magnetic Snapping shortcut display from `Alt + Drag` to `Ctrl + Drag` to match actual implementation (`ctrlKey`).
- [x] Fix snapping settings tooltip from "hold Alt to bypass" to "hold Ctrl to bypass".
- [x] Recalibrate Level 2 (Normal) snapping distance threshold from 20 px / 1.69 mm to 15 px / 1.27 mm.
- [x] Update all default threshold fallback values to match new Level 2 calibration.
- [x] Restyle Photo Spacing panel to match Safe Margin card UI: bordered card container, amber icon header, and `suffix`-based NumberInput for visual consistency.
- [x] Reorder workspace properties panel sections for professional workflow ergonomics:
  - `Spacing & Margins` section: Photo Spacing card on top, Safe Margin card directly below.
  - `Background Color` section with scope switcher and color palette in the middle.
  - `Guides & Snapping` section: Guide Overlay Toggles, Bleed Cut card, and Smart Snapping card at the very bottom.
- [x] Harmonize Safe Margin "Set Default" button visual (`styles.propActionButtonPrimary`) and action icons for visual parity across all property cards.
- [x] Fix Single Photo Safe Margin Real-Time Scaling in `applyAdaptiveLayoutToSpread`:
  - Eliminate the `isFullBleedFrame` bypass that prevented full-bleed or page-flush single photos from resizing when Safe Margin is adjusted.
  - Fully synchronize 4-sided `leftPage` and `rightPage` safe area properties (`safeAreaTop`, `safeAreaBottom`, `safeAreaOutside`, `safeAreaSpine`).
  - Guarantee single photos and asymmetric spreads (e.g. 1 photo on left page, 2 on right page) adapt strictly to safe area boundaries in real-time.
- [x] Application version metadata bumped to `v1.0.53`.

### Phase 35 — Release v1.0.55: True Multi-Sample SSAA Rotated Text Rasterization & Anti-Aliasing

- [x] Eliminate rotated text jagged staircase artifacts ("pecah bergerigi") during spread export.
- [x] Implement subpixel premultiplied bilinear anti-aliasing to prevent color fringing and harsh integer-stepping pixel jumps on high-contrast text.
- [x] Upgrade rotated text rasterization buffer to 4x Supersample Anti-Aliasing (4x SSAA).
- [x] Fix SSAA compositing to use **true multi-sample averaging** (4×4 = 16 bilinear sub-samples per destination pixel) instead of single-point sampling that wasted the supersampled buffer.
- [x] Preserve zero-overhead direct 1:1 pixel blit for unrotated text elements (`rotation == 0`).
- [x] Application version metadata bumped to `v1.0.55`.

### Phase 36 — Strict Fixed Physical Gap Canvas Multi-Frame Resize Integration

- [x] Integrate `multiResizeGapMode` into `KonvaEditorCanvas.tsx` for real-time dragging (`onTransform`) and mouse-up commit (`onTransformEnd`).
- [x] Connect the 2D Topological Spatial Neighbor Graph algorithm into `calculateRotatedMultiFrameResize` in `src/domain/editor.ts` for `'fixed_gap'` mode.
- [x] Guarantee inter-frame physical millimeter gaps remain 100% constant during multi-selection resize across rows, columns, and asymmetric layouts.
- [x] Maintain full backward compatibility for `'proportional'` mode (Harmonious Proportional Scaling).
- [x] Add comprehensive regression test suite in `tests/editor.test.ts` for fixed gap and proportional mode multi-frame resizing on both unrotated and rotated selections.

### Phase 37 — Spread Card & Navigator UI Ergonomics Overhaul

- [x] Redesign spread cards in bottom drawer (`PageNavigator.tsx`) with pure spread number labeling (`1`, `2`, `Cover`) and no narrative clutter.
- [x] Keep navigation and action buttons permanently visible with clear disabled styling instead of hiding them or leaving hollow gaps.
- [x] Eliminate split-second border glow/flash on disabled buttons by removing default browser outline and disabling transition on `:disabled`.
- [x] Add pure domain helper `getSpreadNumberLabel` and comprehensive unit tests in `tests/album.test.ts`.

### Phase 38 — Real-Time Export Project Package (.zip) Progress Bar & Percentage Toast

- [x] Add real-time event reporting (`export-zip-progress`) in Rust backend during project packaging:
  - Calculate total files to compress (photo library assets + unreferenced placed frames + project descriptor `project.afsn`).
  - Stream monotonic progress events (`current`, `total`, `percent`, `status`, `isFinished`, `targetPath`).
  - Maintain 100% backward compatibility for `export_bundled_project_package`.
- [x] Build dedicated real-time floating progress toast in `WorkspaceLayout.tsx` and `WorkspaceLayout.module.css`:
  - Animated spinning package / success checkmark / warning error icon.
  - Percentage badge indicator (0% to 100%).
  - Smooth animated progress bar fill with subtle background track.
  - Status text displaying current file name and counter `(X/Y)`.
  - Auto-dismiss after 6 seconds on completion, or instant dismissal via `✕`.
  - Prevent collisions with standard notification toasts.

### Phase 39 — Text Box Inspector Rotation Angle Controls Parity

- [x] Add Rotation Angle controls to `TypographyPanel.tsx` in the right inspector panel for selected text frames:
  - Exact visual parity with photo frame rotation controls (label, `NumberInput` with `°` degree suffix, and `↺ 0°` quick reset button).
  - Connected directly to `rotateSelectedFrames` in `editorStore.ts` with center-rotated geometry math (`calculateCenterRotatedPosition`).
  - Supports full undo/redo history tracking and lock state protection (`fieldset disabled`).

### Phase 40 — Release v1.0.56: Lock Panel Multi-Selection, Unselect on Click, Contextual Batch Actions & Canvas Preview Harmonization

- [x] Locked Photos & Elements Panel Multi-Selection Engine:
  - Full desktop multi-selection support (`Ctrl/Cmd + Click` toggle, `Shift + Click` range selection, `Ctrl + Shift + Click` range addition).
  - Unselect on click: clicking an already-selected card immediately deselects it from the selection list.
  - Group-aware selection preserves group integrity across all multi-selection operations.
  - Contextual batch action bar with clean, single relevant action button (`🔒 Lock (N)` or `🔓 Unlock (N)`) that expands to full width and adapts dynamically to current selection state.
  - Dedicated "Select All" actions for active spread, locked items section, and unlocked items section.
- [x] Fix Right Inspector Collapse/Hide Glitch:
  - Eliminated the infinite reopen loop caused by `isPropertiesOpen` dependency in `WorkspaceLayout.tsx`, allowing the sidebar to be collapsed/expanded freely even when items are selected.
- [x] Spread Preview & Real Canvas Harmonization:
  - Removed artificial `1px solid rgba(0,0,0,0.15)` border fallback on photo frames in bottom spread cards (`PageNavigator.tsx`) so previews match the real canvas 100%.
  - Upgraded preview aspect ratio calculation to `getPhotoAspect(hydratedElement)` to prevent distortion on portrait, square, and panorama photos.
  - Synchronized border box-sizing and corner radii.
- [x] Application version metadata bumped to `v1.0.56`.

### Phase 41 — Release v1.0.57: Canvas Workspace Zoom (Ctrl + Wheel), 1% Step Precision, 350% Max Zoom & Smooth Fit-to-Center Animation

- [x] Interactive Canvas Workspace Zoom via `Ctrl + Scroll Wheel`:
  - Native non-passive `{ passive: false }` wheel listener directly on the canvas viewport container to prevent unwanted Tauri window zoom.
  - Fine-grained 1% increments per mouse wheel notch, matching the precision feel of in-frame photo crop mode.
  - Cursor-anchored zooming (*Zoom to Pointer*): keeps the object/point directly under the mouse cursor stationary during zoom in and zoom out.
  - Maximum zoom limit extended from 250% to **350%** (3.5x magnification).
- [x] Silky Smooth "Fit to Screen & Center" Animation (*Zero Glitch / Jump*):
  - Replaced abrupt instantaneous coordinate snapping with continuous `requestAnimationFrame` cubic ease-out interpolation (280ms).
  - Concurrently interpolates zoom scale and scroll coordinates to glide the spread gracefully into the exact horizontal and vertical center of the workspace (`targetX`, `targetY`).
  - Automatic collision and layout-effect protection: yields scroll control during active animation and provides instant cancel safety on user mouse down/pan/scroll.
- [x] Quick 15% Jump Controls & Keyboard Shortcuts Parity:
  - Top toolbar `-` and `+` buttons and keyboard shortcuts (`Ctrl + +` / `Ctrl + -`) operate in 15% steps up to 350% for fast navigation across spreads.
  - `Ctrl + 0` triggers smooth fit-to-center animation.
  - Registered all canvas zoom and fit shortcuts in Keyboard Shortcuts cheat sheet (`SettingsDialog.tsx`, F1) and updated toolbar tooltips.
- [x] Application version metadata bumped to `v1.0.57`.


