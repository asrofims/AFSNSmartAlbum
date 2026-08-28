# Photo Engine Skill

## Purpose
Handle photo import and rendering efficiently for large local libraries.

## Pipeline

```text
Original
   ↓
Preview
   ↓
Thumbnail
```

Photo Library uses thumbnails. Editor uses previews. Export uses original/high-resolution sources.

## Rules
1. Do not load the entire original library into memory.
2. Do not decode every image at full resolution at once.
3. Use lazy loading.
4. Cache thumbnails and previews.
5. Use asynchronous/background processing for expensive operations.

## Original Files
Do not store original photo binaries in SQLite. Store references and metadata.

## Import
Support:
- files
- folders
- multiple selection
- drag & drop

Pipeline:
Select → Scan → Validate → Metadata → Thumbnail → Preview → Library

## Missing Files
Provide a clear Missing Photo state and Relink Folder workflow.

## Duplicate Handling
Use deterministic duplicate detection/handling. Do not silently duplicate originals.

## RAW
RAW support is a later phase. Target formats may include ARW, CR3, NEF, RAF, DNG.

## Definition of Done
Large operations need progress/error handling, caching, missing-file handling, and appropriate tests.
