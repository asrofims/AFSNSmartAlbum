# AFSNSmartAlbum — Security

## Principle
Use least privilege.

## Tauri
Use the minimum filesystem and native permissions required.

## Filesystem
Validate all user-controlled paths.
Handle:
- invalid filenames
- path traversal
- symlink behavior
- permission failures
- inaccessible files
- corrupted files

## Commands
Tauri commands must:
- use typed arguments
- validate input
- return controlled errors
- never execute arbitrary commands

Never execute shell commands from user-controlled values.

## Input
Do not use eval().
Do not inject untrusted HTML.
Validate structured data with schemas where appropriate.

## Secrets
Never store secrets in source code or project files.
If credentials are ever needed, use secure OS storage.

## Dependencies
Avoid unnecessary dependencies. Consider maintenance, security, licensing, and bundle impact.

## Project Safety
Prefer atomic writes and recovery mechanisms for project persistence.
