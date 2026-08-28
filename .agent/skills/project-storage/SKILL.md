# Project Storage Skill

## Purpose
Keep album projects portable, recoverable, versioned, and safe.

## Persistence
SQLite is the structured local persistence layer.

Suggested entities:
- projects
- pages
- spreads
- photos
- photo_metadata
- elements
- templates
- settings

## Original Photos
Never store original image binaries in SQLite.

## Paths
Prefer relative references when possible. Handle absolute paths when necessary.

## Autosave
Autosave should be:
- asynchronous
- debounced
- non-blocking
- atomic where possible

UI states:
- Saving...
- Saved
- Save failed

## Recovery
Provide recovery after crashes or interrupted saves.

## Migration
Persist schema version and create migrations for schema changes.

## Corruption
Prefer atomic writes and backup/recovery strategies.

## Definition of Done
Test create, save, load, autosave, recovery, migration, missing photos, and incomplete/corrupt states.
