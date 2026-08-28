# AFSNSmartAlbum — Architecture

## Core Architecture

```text
React UI
   ↓
Application / Domain Layer
   ↓
Tauri Commands
   ↓
Rust
   ├── Filesystem
   ├── SQLite
   ├── Image Processing
   └── Native Operations
```

## Responsibilities

React:
- UI
- interaction
- view state
- editor presentation

Domain/Application:
- album model
- page/spread model
- commands and workflows
- business rules

Tauri/Rust:
- filesystem
- native dialogs
- SQLite access
- image processing
- heavy local operations

SQLite:
- structured project data

Filesystem:
- original photos
- thumbnails
- previews
- project artifacts

## Rendering

Konva.js is the initial rendering implementation. Domain data must not depend directly on Konva APIs.

Use a rendering abstraction so future Canvas/WebGL optimization is possible.

## Core Domain

```text
Album
 ├── Cover
 ├── Spread
 │    ├── Left Page
 │    └── Right Page
 └── Back Cover
```

Page and Spread are separate concepts.

## Coordinates

Keep separate:
- physical coordinates
- logical editor coordinates
- screen coordinates
- export coordinates

## Persistence

SQLite is the local persistence layer. Original image binaries must not be stored in SQLite.

## No Server

The core application is offline and local-first. Do not add Express, REST APIs, MySQL, PostgreSQL, or other server infrastructure unless explicitly approved for a future non-core feature.
