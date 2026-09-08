# AFSNSmartAlbum — Project Format

## Goal

The project format must be:
- portable
- versioned
- recoverable
- migratable
- local-first

## Concept

A project may be represented as:

```text
Wedding-Puput-Asrofi.afsn (or internal afsn_project.db SQLite package)
```

The implementation uses an embedded SQLite database internally. The user-facing `.afsn` file is a UTF-8 JSON document with payload version `1`, containing project metadata, photos, folder collections, optional `folderMembers`, and the album layout. It is not a SQLite database or ZIP archive.

## File Operations

- **Open Project** accepts `.afsn` only, including launch/file-association requests. Relative photo references resolve against the document's directory.
- **Save** writes the current `.afsn`; a new project or a legacy ZIP-backed project first asks for an `.afsn` destination.
- **Save As** creates an independent project identity at a different destination. Selecting the current destination saves the existing identity. Photo originals are referenced, not duplicated.
- **Export Project Package** creates a `.zip` containing `project.afsn` and `photos/`. It does not change the active save destination. Extract the complete archive, then open its `.afsn` file. Editing never writes back into the ZIP.
- File publication stages a complete file in the destination directory, flushes/syncs it, then replaces the destination. An unsuccessful write preserves the previous destination.
- Database recovery checkpoints and crash snapshots do not count as successful saves to `.afsn`. Save failures and cancellation keep unsaved changes visible.
- Import validates the payload version and applies project, photo, collection, membership and layout records in one transaction. Opening a different copy of an existing identity creates an independent local identity.

See `PROJECT_PERSISTENCE_AUDIT.md` for regression cases and compatibility limits.

## Structured SQLite Schema

The local SQLite database contains structured relations:
1. `projects`:
   - `id`, `name`, `canvas_width`, `canvas_height`, `canvas_unit`, `canvas_dpi`, `spacing_value`, `spacing_unit`, `margin_enabled`, `margin_value`, `margin_unit`, `border_enabled`, `border_width`, `border_unit`, `border_color`, `background_color`, `created_at`, `updated_at`.
2. `photos`:
   - `id`, `project_id`, `file_name`, `file_path`, `file_size`, `width`, `height`, `format`, `thumbnail_path`, `preview_path`, `orientation`, `dpi`, `color_space`, `is_favorite`, `used_count`, `is_missing`, `imported_at`.
3. `photo_folders`:
   - `id`, `project_id`, `name`, `sort_order`, `created_at`.
4. `folder_photos`:
   - `folder_id`, `photo_id`, `added_at`.
5. `spreads` & `elements`:
   - Spread geometry and photo frame placements with crop transformation matrices.

## Photo Storage

- **Strict Invariant**: NEVER store original photo binaries in SQLite.
- Store source references and generated thumbnail/preview artifacts in the project cache directory.
- Relinking allows seamless recovery if original image directories move on disk.

## Schema Versioning

Every persisted project must have a schema version:

```sql
PRAGMA user_version = 1;
```

Schema changes require migrations and automated migration tests.
