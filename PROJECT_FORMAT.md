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
Wedding-Puput-Asrofi.afsn
```

The implementation may use a directory/package structure internally, but the user-facing project concept should remain a portable `.afsn` project.

## Structured Data

SQLite should contain structured data such as:
- projects
- pages
- spreads
- photos
- photo_metadata
- elements
- templates
- settings

## Photo Storage

Never store original photo binaries in SQLite.

Store source references and generated thumbnail/preview artifacts separately.

Prefer relative paths when the project structure allows it.

## Schema Versioning

Every persisted project must have a schema version.

Example:

```text
schema_version = 1
```

Schema changes require migrations and migration tests.

## Recovery

Autosave and recovery data must be distinguishable from the primary saved state.

## Compatibility

Future versions must not silently destroy older project data.
