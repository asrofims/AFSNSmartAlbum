# Performance Skill

## Purpose
Keep AFSNSmartAlbum responsive with large photo libraries and complex album layouts.

## Principle
Measure before optimizing.

## Photo Performance
Use:
- thumbnails
- previews
- lazy loading
- virtualization
- caching
- background processing

## UI Performance
Avoid:
- unnecessary React re-renders
- giant global state updates
- rendering the entire photo library at once
- rebuilding the whole canvas for one object change

## State Separation
Keep distinct:
- Document State
- View State
- Rendering State

## Native Work
Use Rust/native processing for CPU-intensive, filesystem-intensive, and image-processing operations when beneficial.

## Memory
Monitor image memory, cache size, canvas objects, and database behavior.

## Library Tests
Consider:
100, 500, 1000, and 3000+ photos.

## Definition of Done
New features should not cause noticeable blocking, unnecessary memory growth, or avoidable full-library/full-canvas work.
