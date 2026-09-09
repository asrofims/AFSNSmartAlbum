# Project persistence audit — 8 September 2026

## Result and intended workflow

The reported ZIP corruption was reproducible from the source: ZIP import assigned the archive path to `project.filePath`, while Save and autosave always wrote JSON project data to that path. This replaced ZIP contents with an AFSN document.

The supported editing format is now **.afsn**. A **.zip** is an exported transport/backup package, containing `project.afsn` and a `photos/` directory. Extract the entire ZIP first, open the extracted `project.afsn`, then edit and save that file. The archive remains unchanged. Re-export a package to create an updated ZIP.

An AFSN document stores layout and photo references; it does not embed the original photos. Keep the extracted photo directory with the project. Save As copies the project document and its project identity, while retaining references to the same photo files. Use Export Project Package when moving everything to another computer.

## Findings and implemented corrections

| Severity | Previous behavior / case | Correction |
| --- | --- | --- |
| Critical | ZIP opened as a working project; Save or autosave overwrote it with JSON. | Open dialog and backend accept AFSN only. CLI associations accept AFSN only. Native AFSN writer rejects every other extension. Old database entries pointing at ZIP get a new AFSN destination on manual Save. |
| High | Project and ZIP writers truncated an existing destination before finishing. | Write to a unique adjacent temporary file, flush and sync, then replace the destination. Pre-publication failures retain the previous file and clean up temporary output. |
| High | A failed database write was reported as successful if a localStorage snapshot succeeded. | Recovery checkpoints return failure on native write errors. Save stops before export and reports the error. Recovery snapshots remain a separate fallback. |
| High | In-flight saves replaced the active album with an older sanitized copy. | Database writes are serialized. Completion never replaces newer edits or another project's album. A file save marks clean only when the active album still matches the captured revision. |
| High | Save & Continue only checkpointed SQLite; it could leave without writing AFSN. | Save & Continue and Save & Exit invoke the full save pipeline and stop on cancellation, failure, or newer unsaved edits. |
| High | Save As bound the destination before writing; failed copies could remain in recents. | Associate a path after successful file publication; failed Save As removes the incomplete database copy. Saving to the current path keeps the original identity. |
| High | ZIP export ignored missing/read/write errors and could report an incomplete archive as complete. | Stream original assets and propagate all errors. Package placed assets even when their library entry is absent. Abort without replacing an existing archive on missing/unreadable originals. |
| High | Import ignored photo/folder insert failures and committed portions of the project. | Validate format version and ownership; replace the complete project in one SQLite transaction. Any failed record or membership rolls back the import. |
| Medium | Reopening could keep stale library rows; an independently copied document could reuse the original workspace identity. | Replace the imported project's rows transactionally. Remap project, photo, folder, spread, page, element and group identities when opening a different copy already known to the database. |
| Medium | Collection names were exported but their photo membership was lost. | Include optional `folderMembers`, preserve collection order, and restore memberships. Existing version-1 files without this optional field still open. |
| Medium | Extracted photo paths were relative but AFSN import did not resolve them. | Resolve relative paths against the opened AFSN directory, validate cached preview paths, and flag missing originals for relinking. |
| Medium | Multiple Save / Save As / autosave operations could overlap; file failures were silent. | Share a guarded save pipeline, serialize database writes, prevent conflicting open/close during saves, and show actionable errors. |
| Medium | External file-open events bypassed unsaved-change confirmation. | Prompt Save & Open / Don't Save / Cancel before replacing a dirty active project. |
| Medium | Cover-only documents were treated as having no album. | Accept a valid cover and an empty interior spread list when loading. |
| High | Independent Top, Bottom, Outside, and Spine margins existed only in frontend memory; SQLite and AFSN retained the single legacy margin. | Persist all four project defaults and all four per-spread safe-area values through Tauri, SQLite migration v13, Save, Save As, package export, and AFSN reopen. |

## Validation

- `npm test`: complete TypeScript suite, including new persistence regressions using the real stores and a mocked native transport.
- `npm run build`: TypeScript and production frontend bundle.
- `cargo test --lib db:: -- --skip test_inspect_actual_db`: isolated test databases and real filesystem operations. The excluded diagnostic reads a user's installed database and is not a regression fixture.
- Native regressions cover ZIP export → extract → open AFSN → edit collection → save → reopen, byte-for-byte ZIP preservation, original project isolation, collection membership, failed write preservation, missing-photo export failures, transactional rollback, unsupported format versions, same-path Save As, and failed destination cleanup.
- Frontend regressions cover database errors despite snapshot availability, locked destinations, cancel, legacy ZIP save paths, overlapping operations, edits during saves, project switching during database failures, direct ZIP rejection, and newer edits during a Save As dialog.

The tests exercise real native persistence and simulated I/O failures. They do not simulate sudden power loss or automate the operating system's file picker.

## Save destination ownership correction — 2026-09-09

- Normal Save validates both the project's bound path and the document identity currently on disk. A missing, unreadable, or replaced document cannot be silently reclaimed through Save/autosave.
- Explicit Save As can replace the selected destination after the native save dialog confirmation. Its database transaction transfers that destination to the saved project and detaches other projects pointing to the same resolved location. Their photo and album recovery records remain intact. Failed file publication rolls back the database changes.
- SQLite migration v14 records the on-disk document identity separately from the local project identity, allowing independently copied/imported files to save correctly before their first identity rewrite. Reopening a known copy reuses its local project identity.
- Loading Recent Projects or fetching a project reconciles legacy associations against readable on-disk identities. Mismatched entries lose their save path and remain available as recovery data. Missing/offline files retain their path; normal Save still refuses them. Older copies with remapped IDs but no identity record are conservatively detached and require Save As.
- The frontend refreshes native project paths after save/open/rename operations, persists the repaired recent list, and labels entries without a destination `Not Saved to File`. Native project lookup failures no longer open a stale localStorage snapshot.
- File-changing project commands are serialized within the application process, including rename. Identity checks do not provide an operating-system lock against other processes modifying a document concurrently, or detect edits that retain the same document ID.
- Filesystem publication and SQLite commit cannot form a single cross-resource transaction. If publication succeeds but SQLite commit fails, the operation reports failure; identity validation prevents the displaced project from silently overwriting the published file afterward.
- The test runs documented above predate this correction. Automated and manual tests for this correction were not run at the user's request; manual verification remains pending in ROADMAP.md.
- Static verification passed: `npx tsc --noEmit` and `cargo check --lib`. These checks do not verify runtime save/replace behavior.

## Compatibility and recovery limits

- These changes prevent future ZIP overwrites. They cannot reconstruct photo bytes already removed when an older release overwrote an archive.
- If the project remains in Recent Projects or the local recovery database, open it and use Save to select a new AFSN destination. Existing extracted originals can still be referenced or relinked. Keep any original ZIP backups.
- ZIP files are no longer directly importable. This also removes the former unchecked archive-extraction path from the application.
- Files from older versions that never recorded folder membership cannot reconstruct that missing information automatically.
- The AFSN payload remains version 1; collection membership and the four per-side margin fields are optional and backward compatible. Older files fall back from each missing side to their stored uniform margin.
- This audit does not certify serialization coverage for every optional editor setting. Per-side project and spread margins are now covered by the native schema and regression tests; other optional project properties still require field-by-field review.
