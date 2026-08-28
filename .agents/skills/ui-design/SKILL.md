---
name: ui-design
description: >-
  Expert guide for AFSNSmartAlbum user interface design, standard English terminology, dark theme
  design tokens, and desktop ergonomics.
---

# UI Design & Design System Skill

This skill contains the design principles, component patterns, and English language standards for AFSNSmartAlbum.

---

## 1. Professional English Language Standard

All text rendered in the user interface (labels, buttons, tooltips, dialogs, snapping indicators) MUST be in **Standard Professional English** (matching Adobe InDesign, Lightroom, and Pixellu SmartAlbums).

### Vocabulary Reference Table

| Category | Standard English UI Term | Meaning / Usage |
| :--- | :--- | :--- |
| **Project Setup** | `Safe Zone Margins` | Inward margin guide for text/photo safety. |
| | `Photo Spacing` | Inter-frame distance setting. |
| | `Resolution (DPI)` | Print resolution setting. |
| **Properties** | `Margins & Guides` | Margin and crease visibility toggles. |
| | `Safe Zone Margin (Blue)` | Blue dashed safe area line. |
| | `Bleed Cut Line (Red)` | Red dashed trim/bleed line. |
| | `Center Gutter Crease` | Center fold line indicator. |
| | `Smart Magnetic Snapping` | Edge/center alignment magnet. |
| **Alignment** | `Alignment` | Left, Center H, Right, Top, Center V, Bottom. |
| | `Match Size` | Match Width, Match Height, Match Both. |
| | `Distribute Spacing` | Distribute Horizontally, Distribute Vertically. |
| **Frame Inspector** | `Width (W)` / `Height (H)` | Frame width and height inputs. |
| | `Position X` / `Position Y` | Frame position inputs. |
| | `Rotation Angle` | Rotation in degrees. |
| | `↺ Reset Ratio` | Restores frame to original image aspect ratio. |
| | `↺ Reset Crop` | Re-centers image and resets zoom to 1.0x. |
| **Context Menu** | `Paste Photo`, `Delete Photo`, `Copy Photo`, `Bring to Front`, `Send to Back`, `Rotate 90° Clockwise`, `Deselect All` | Standard context menu items. |

---

## 2. Design Tokens & Styling

- Color Palette: Deep Slate workspace (`#12141a`, `#181b22`, `#212631`) with Electric Cyan accents (`#38bdf8`) and Crimson warnings (`#f43f5e`).
- All interactive controls (buttons, inputs, dropdowns) must provide visual `:hover`, `:active`, and `:focus-visible` feedback.
- Every modal or dialog action must be cancelable with the `Esc` key and confirmable with the `Enter` key.
- Destructive operations require confirmation via `ConfirmDialog.tsx`.
