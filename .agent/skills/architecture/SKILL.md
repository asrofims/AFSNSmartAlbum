# Architecture Skill

## Purpose
Keep AFSNSmartAlbum modular, safe, maintainable, and aligned with its desktop-only architecture.

## Stack
- React
- TypeScript
- Vite
- Tauri 2
- Rust
- SQLite
- Zustand
- Konva.js
- libvips/native image processing

## Rules
1. Do not introduce Node.js/Express for local operations.
2. Do not create HTTP APIs just to connect React to Rust.
3. Do not use a database server for the core application.
4. Rust handles native/heavy operations.
5. React handles UI and interaction.
6. Domain logic must not live inside presentation components.
7. Avoid giant files/components.
8. Keep clear module boundaries.
9. Do not replace Tauri or SQLite without explicit approval.
10. Do not rewrite working systems for small features.

## Rendering
Keep the domain model independent from Konva. Use a rendering adapter/abstraction so future Canvas/WebGL optimization remains possible.

## Change Protocol
Before architectural changes:
1. inspect existing architecture
2. identify impact
3. propose the smallest solution
4. implement only after consistency is established
5. update documentation if architecture changes

## Definition of Done
Architecture changes require tests where relevant, clear boundaries, reasonable dependencies, and updated documentation.
