# Security Skill

## Purpose
Protect the desktop application and local user data.

## Principle
Least privilege.

## Tauri
Use minimum required capabilities/permissions.

## Filesystem
Validate user-controlled paths. Handle invalid paths, traversal, symlinks, permissions, inaccessible files, and corrupted files.

## Commands
Tauri commands must:
- use typed arguments
- validate input
- return controlled errors
- never execute arbitrary commands

Never construct shell commands from user input.

## Input
Never use eval(). Avoid unsafe HTML injection. Validate structured input.

## Secrets
Do not store secrets in source code or project files. Use secure OS storage if credentials are ever required.

## Dependencies
Do not add unnecessary dependencies. Consider security, maintenance, licensing, and bundle size.

## Definition of Done
No feature should introduce arbitrary execution, excessive permissions, unsafe path handling, or avoidable secret exposure.
