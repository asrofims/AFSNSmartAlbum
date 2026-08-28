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
2. Read the relevant skill files.
3. Read ROADMAP.md.
4. Check ARCHITECTURE.md.
5. Understand existing implementation.
6. Make an implementation plan.
7. Implement the smallest appropriate change.
8. Test.
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

## UI Rules
Always follow DESIGN_SYSTEM.md and ui-design skill.
Do not create random UI patterns.

## Album Rules
Page and Spread are separate domain concepts.
Physical units must remain accurate.

## Photo Rules
Never unnecessarily load original full-resolution images into memory.
Use Original → Preview → Thumbnail.

## Security
Follow SECURITY.md and security skill.
Use least privilege.

## Planning
Do not implement future phases prematurely.
If a new requirement conflicts with architecture or roadmap, explain the conflict and propose a solution before making major changes.

## Changes to Rules
Do not silently modify:
- AGENTS.md
- ARCHITECTURE.md
- ROADMAP.md
- DESIGN_SYSTEM.md
- security rules
- core skills

without explaining why the change is required.

## Definition of Done
"Build berhasil" is not sufficient.
A feature must be tested, consistent with architecture, and not introduce unnecessary technical debt.
