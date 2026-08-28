# Testing Skill

## Purpose
Prevent regressions and protect editor/project correctness.

## Layers
- Unit tests
- Integration tests
- UI tests
- Regression tests

## Unit Tests
Test:
- unit conversion
- coordinate conversion
- layout calculations
- crop calculations
- DPI calculations
- serialization
- validation

## Integration Tests
Test:
- project creation
- photo import
- save/load
- autosave
- recovery
- relink

## Editor Tests
Test:
- move
- resize
- crop
- rotate
- delete
- undo
- redo
- multi-select

## Image Tests
Test valid, corrupted, unsupported, missing, large, and duplicate files.

## Migration
Every schema migration should have migration coverage.

## Regression
Turn important fixed bugs into regression tests where practical.

## Definition of Done
A feature is not done merely because it compiles. Relevant tests must pass and existing behavior must remain intact.
