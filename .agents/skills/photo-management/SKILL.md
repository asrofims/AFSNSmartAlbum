---
name: photo-management
description: >-
  Expert guide for AFSNSmartAlbum photo library management, folder collections, Lightroom-style
  multi-selection, background thumbnail/preview pipeline, and missing photo relinking.
---

# Photo Library Management Domain Skill

This skill contains the domain rules, data structures, and workflows for managing photo assets in AFSNSmartAlbum.

---

## 1. Lightroom-Style Multi-Selection & Range Model

Photo cards in the filmstrip tray support three distinct interaction paradigms:
1. **Single Click**: Selects only the target photo and resets selection to `[photoId]`.
2. **Ctrl / Cmd + Click (`toggle`)**: Toggles the target photo in or out of `selectedPhotoIds`.
3. **Shift + Click (`range`)**: Selects all photos between `lastSelectedPhotoId` and the clicked photo index within the currently sorted & filtered list.
4. **`Ctrl + A`**: Selects all photos in the current active folder/filter pool.
5. **`Esc` or `Ctrl + D`**: Deselects all photos.

---

## 2. Folder Collections Architecture

- Projects can contain multiple user-created folders / collections (e.g. `Akad Nikah`, `Reception`, `Portraits`).
- Stored in SQLite tables: `photo_folders` and `folder_photos`.
- Folder actions:
  - **Add Photos to Folder**: Links photos without removing them from previous collections (non-destructive).
  - **Move Photos to Folder**: Translocates photos from one folder to another.
  - **Remove from Folder**: Unlinks photo from current folder; original photo remains in the library (`All Photos`).
  - **Delete Folder**: Removes folder collection tag; all photos remain safely in the project library.

---

## 3. Batch Action Bar

When $N \ge 2$ photos are selected:
- A floating dark banner dock appears above the filmstrip tray (`BatchActionBar.tsx`).
- Provides quick actions:
  - **★ Favorite All / Unfavorite All**
  - **📋 Copy Selected to Clipboard**
  - **📂 To Folder Dropdown** (`Copy to...` or `Move to...`)
  - **🗑 Delete Selected** (with modern `ConfirmDialog` confirmation)

---

## 4. Missing Photo Detection & Relinking

- If an original photo file is moved or deleted from disk, `checkMissing` flags `isMissing = true`.
- Missing photos display a warning badge in the filmstrip.
- Clicking the warning or the header `⚠️ Missing (Relink)` opens `RelinkDialog.tsx`.
- User selects the new directory; the backend matches files by `fileName` and updates paths in SQLite atomically.
