# AFSNSmartAlbum — Agent Rules

## Product
AFSNSmartAlbum is a professional offline desktop photo album layout application.

## Core Stack
- React
- TypeScript
- Vite
- Tauri 2
- Rust
- SQLite
- Zustand
- Konva.js
- libvips

## Priority
Always prioritize:
1. Correctness
2. Safety
3. Performance
4. Consistency
5. Maintainability
6. Professional UX

## Before Coding
Always:
1. Read AGENTS.md.
2. Read the relevant skill files in `.agents/skills/`.
3. Read ROADMAP.md.
4. Check ARCHITECTURE.md.
5. Understand existing implementation.
6. Make an implementation plan.
7. Implement the smallest appropriate change.
8. Test (`npm test`).
9. Update documentation when necessary.
10. Update ROADMAP.md.

## Architecture Rules
Do not:
- introduce Node.js/Express for local operations
- introduce a server dependency
- replace Tauri without approval
- replace SQLite without approval
- introduce major dependencies without justification
- rewrite working systems unnecessarily

## UI & Language Rules
- Always follow `DESIGN_SYSTEM.md` and the `ui-design` skill.
- All user-facing UI text, menus, buttons, dialogues, tooltips, and snapping HUD indicators MUST be in **Standard Professional English** (matching Adobe InDesign, Lightroom, and Pixellu SmartAlbums).
- Do not create random or non-standard UI patterns.

## Album & Layout Rules
- Page and Spread are separate domain concepts (Spreads contain Left Page, Center Gutter/Spine, Right Page).
- Physical units (`mm`, `cm`, `inch`, `px`) must remain mathematically accurate at configured project DPI.

## Multi-Frame Resize & Spacing Rules
- **Multi-Frame Resize**: When resizing a multi-selection of photo frames on the canvas, NEVER apply uniform position scaling that distorts inter-frame gaps. Always use the **2D Topological Spatial Neighbor Graph** algorithm (`calculateMultiFrameResize`) to preserve exact physical gap spacing between adjacent frames across rows, columns, and asymmetrical collages.
- **Photo Spacing**: Project default photo spacing is dynamic and configurable via SQLite, Tauri commands, and the workspace Properties panel.

## Photo & Asset Rules
- Never unnecessarily load original full-resolution images into memory.
- Follow the pipeline: Original $\to$ Preview $\to$ Thumbnail.
- Support Dual Entity Reset:
  - `↺ Reset Ratio`: Restores frame geometry to the original photo's native aspect ratio (e.g. 3:2, 4:3, 1:1) without resetting pan/zoom crop.
  - `↺ Reset Crop`: Re-centers the image inside the frame and resets crop zoom to 1.0x.

## Security
- Follow `SECURITY.md` and security guidelines.
- Use least privilege for all Tauri native commands and filesystem access.

## Planning
- Do not implement future phases prematurely.
- If a new requirement conflicts with architecture or roadmap, explain the conflict and propose a solution before making major changes.

## Changes to Rules
Do not silently modify:
- AGENTS.md
- ARCHITECTURE.md
- ROADMAP.md
- DESIGN_SYSTEM.md
- PROJECT_FORMAT.md
- security rules
- core skills in `.agents/skills/`
without explaining why the change is required.

## Definition of Done
"Build berhasil" is not sufficient.
A feature must be tested, consistent with architecture, and not introduce unnecessary technical debt.

