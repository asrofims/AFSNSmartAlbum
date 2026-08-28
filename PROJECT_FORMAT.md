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

The implementation uses an embedded SQLite database internally, while the user-facing project concept remains a portable `.afsn` project.

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

