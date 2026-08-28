# AFSNSmartAlbum — Architecture

## Core Architecture

```text
React 19 UI (Zustand Stores, Konva.js Viewport)
   ↓
Application / Domain Layer (Pure TypeScript Business Logic)
   ↓
Tauri 2 IPC Commands
   ↓
Rust Backend
   ├── Local SQLite Embedded Database
   ├── Multi-threaded libvips Image Processing Engine
   ├── Native OS File Dialogs & Shell Plugins
   └── Direct Local Filesystem I/O
```

---

## Responsibilities

### React UI
- Docked workspace layout (Left Filmstrip Tray, Center Canvas Viewport, Right Inspector Panel).
- Interactive editing state (selection, transform handles, live crop HUD overlays).
- Dialogs, modal sheets, and context menus.

### Domain / Application Layer (`src/domain/`)
- Album, Page, and Spread models.
- **2D Topological Spatial Neighbor Graph Multi-Resize Engine** (`calculateMultiFrameResize`).
- Smart Snapping Math and Alignment calculation (`calculateSnapLines`, `applyAlignment`).
- Mathematical Unit conversions (`mm`, `cm`, `inch`, `px` at arbitrary DPI).
- Validation and business rules.

### Tauri 2 / Rust Backend (`src-tauri/`)
- Native file and directory pickers (`rfd` / Tauri plugins).
- Multi-threaded thumbnail (256px) and preview (1200px) generation via `libvips` / `image`.
- Embedded SQLite transaction management with migration support.
- Local filesystem read/write.

### SQLite Database (`afsn_project.db`)
- Structured metadata: projects, settings, folders, folder_photo relations, spreads, elements, and photo records.
- *Strict Rule*: Original photo binary data is NEVER stored in SQLite.

---

## Algorithms & Architectural Invariants

### 1. 2D Topological Spatial Neighbor Graph (Multi-Frame Resize)
When multiple frames are resized simultaneously, simple linear scaling of `x, y` positions results in proportional gap distortion (e.g. shrinking frames makes gaps look wider; enlarging frames compresses gaps).

AFSNSmartAlbum solves this with a **Topological Spatial Neighbor Graph**:
1. Builds a graph of pairwise adjacent neighbors with overlapping projections in orthogonal axes (horizontal neighbor overlap requires $\Delta y > 0$; vertical requires $\Delta x > 0$).
2. Identifies layout chains and columns/rows.
3. Scales pure frame dimensions proportionally by the scale factor $s$.
4. Re-anchors positions using topological chain offsets:
   $$\text{pos}_{\text{target}} = \text{pos}_{\text{anchor}} + \text{dim}_{\text{scaled\_prev}} + \text{GAP}_{\text{constant}}$$
5. Preserves 100% of physical inter-frame gaps across simple rows, 2x2 grids, and asymmetrical 3-photo collages.

### 2. Dynamic Photo Spacing Flow
```text
[User adjusts Spacing in Properties Panel]
   ↓
useProjectStore.updateProjectSpacing(val, unit)
   ├── Local store state updated
   └── Tauri IPC `update_project_spacing` called
          ↓
Rust SQLite DB: UPDATE projects SET spacing_value = ?, spacing_unit = ?
```

### 3. Dual Entity Frame Invariants
- **Frame Geometry**: Position $(x, y)$, Dimensions $(w, h)$, and Rotation $(\theta)$ on the spread.
- **In-Frame Image Transformation**: Crop pan offset $(cx, cy)$ and zoom scale $(s)$ relative to frame bounds.
- Actions:
  - `↺ Reset Ratio`: Updates frame $w, h$ to match photo's native aspect ratio (e.g. 3:2, 4:3) without modifying internal crop.
  - `↺ Reset Crop`: Re-centers the image inside the frame and resets internal crop zoom to 1.0x without changing frame geometry.

---

## Coordinate Systems

Keep strictly separate:
1. **Physical Canvas Coordinates**: Measured in physical units (`mm`, `cm`, `inch`) based on user-defined page dimensions.
2. **Logical Editor Coordinates**: Screen pixels rendered by Konva stage, scaled by viewport zoom factor and device pixel ratio.
3. **Internal Frame Crop Coordinates**: Normalized offset percentages $(-1.0 \dots 1.0)$ and scale factors $(\ge 1.0)$ for photo positioning within a frame.
4. **Export Coordinates**: High-resolution print pixels computed as $\text{Physical} \times \frac{\text{DPI}}{\text{Unit Conversion}}$.

---

## Offline & Local-First

AFSNSmartAlbum is 100% local-first and works entirely offline. Do not add external server dependencies, Express backends, REST APIs, or cloud auth requirements.

