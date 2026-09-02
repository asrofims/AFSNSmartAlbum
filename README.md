# 📸 AFSNSmartAlbum

[![Release](https://img.shields.io/badge/Release-v1.0.16-blue.svg?style=flat-square)](https://github.com/asrofims/AFSNSmartAlbum/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(64--bit)-0078D6.svg?style=flat-square&logo=windows)](https://github.com/asrofims/AFSNSmartAlbum/releases)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131.svg?style=flat-square&logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-High%20Performance-DEA584.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-gray.svg?style=flat-square)](https://github.com/asrofims/AFSNSmartAlbum)

> **Professional Offline Desktop Photo Album Layout Software**  
> Engineered specifically for wedding photographers, commercial studios, and professional print labs.

---

## 🌟 Overview

**AFSNSmartAlbum** is a blazing-fast, offline-first desktop application designed to streamline the creation of high-end wedding and portrait photo books. Built with a native **Rust core (Tauri 2)** and a hardware-accelerated **React / Konva** design canvas, AFSNSmartAlbum delivers sub-millimeter precision, smart magnetic snapping, and instantaneous layout generation with zero cloud latency.

---

## ✨ Key Features

### 📐 2D Topological Spatial Neighbor Graph Multi-Resize
When resizing multiple selected photo frames simultaneously, the layout engine calculates inter-frame spatial adjacency vectors to preserve exact physical gap spacing across complex rows, columns, and asymmetrical collages without distortion.

### 🧲 Smart Magnetic Snapping Engine
Millimeter-accurate magnetic snapping with real-time HUD visual dimension guides:
- **Left / Right Page Safe Margin Boxes** (Blue dashed print-safe boundary)
- **Center Spine Crease Line** (Book spine fold alignment)
- **Outer Bleed Boundaries** (Full-bleed trimming safety)
- **Equal Inter-Frame Spacing Guides**

### 🧩 Dynamic Adaptive Multi-Photo Partitioning Engine
Instantly organize **1 to 12+ photos** onto spreads with a single click. Browse dozens of mathematically calculated layout variations that automatically adapt to native photo aspect ratios (3:2, 4:3, 1:1, 16:9).

### ↺ Dual Entity Reset Architecture
- **↺ Reset Ratio**: Restores frame geometry to the photo's native aspect ratio without altering custom pan/zoom crop coordinates.
- **↺ Reset Crop**: Re-centers the image inside the frame and resets zoom to `1.0x`.

### 🚀 Ultra-Fast Parallel Print Sharpening Engine
Export album spreads at true **300 DPI** print resolution:
- **Multi-Threaded Parallel Unsharp Masking**: Fast SIMD/Rayon Laplacian filter enhancement (~30ms per spread).
- **Multi-Stage Realtime Progress Tracking**: Live status updates across decoding, layout composition, print sharpening, and disk encoding.
- **Multi-Format Output**: Maximum Quality JPEG, Uncompressed PNG, or Print-Ready Multi-Page PDF.
- **Full Spread & Split Page Modes**: Export as panoramic 2-page spreads or individual Left/Right print files.

### 💾 Dual-Format Project Persistence
- **Compressed Single-File Archive (`.afsn`)**: Ultra-compact project package with embedded previews and SQLite database.
- **Self-Contained Project Folder**: Complete project bundle with copied original photos for 100% offline archival and multi-workstation sharing.

---

## 💻 System Requirements

| Specification | Minimum Requirement | Recommended Specification |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 (64-bit) | Windows 11 (64-bit) |
| **Processor** | Dual-Core 2.0 GHz Intel / AMD | Quad-Core 3.0 GHz Intel Core i5 / AMD Ryzen 5 or higher |
| **RAM** | 4 GB | 8 GB – 16 GB (for large RAW/high-res libraries) |
| **Display Resolution** | 1280 × 800 | 1920 × 1080 (Full HD) or 4K UHD |
| **Disk Space** | 200 MB for installation | SSD storage recommended for project caching |

---

## ⌨️ Keyboard Shortcuts Reference

### Canvas Navigation
| Shortcut | Action |
| :--- | :--- |
| <kbd>Spacebar</kbd> + Drag | Pan / Move Canvas |
| <kbd>Ctrl</kbd> + Scroll Wheel | Zoom In / Zoom Out |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Fit Spread to Screen (100% View) |
| <kbd>←</kbd> / <kbd>→</kbd> | Previous / Next Spread |

### Frame Selection & Manipulation
| Shortcut | Action |
| :--- | :--- |
| <kbd>Click</kbd> | Select Frame |
| <kbd>Shift</kbd> + <kbd>Click</kbd> | Multi-Select Additional Frames |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | Select All Frames on Spread |
| <kbd>Shift</kbd> + Drag Frame | Orthogonal Axis-Lock Drag (Straight Horizontal / Vertical) |
| Arrow Keys (<kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd>) | Nudge Selected Frame(s) by 1 mm |
| <kbd>Shift</kbd> + Arrow Keys | Nudge Selected Frame(s) by 10 mm |
| <kbd>Ctrl</kbd> + <kbd>C</kbd> / <kbd>Ctrl</kbd> + <kbd>V</kbd> | Copy & Paste Selected Frame(s) |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Duplicate Selected Frame(s) |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete Selected Frame(s) |
| <kbd>Ctrl</kbd> + <kbd>G</kbd> | Group Selected Frames |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd> | Ungroup Selected Frames |

### Photo Placement & Crop
| Action | Description |
| :--- | :--- |
| Drag photo to empty canvas | Create a new photo frame |
| Drag photo onto existing frame | Overlay / Stack photo freely |
| <kbd>Alt</kbd> + Drag onto frame | 🔄 Replace existing photo with new photo |
| Double-Click Frame | Enter In-Frame Interactive Pan & Zoom Crop Mode |
| <kbd>Enter</kbd> / <kbd>Esc</kbd> | Exit Crop Mode |

---

## 🛠️ Technology Stack

- **Desktop Framework**: Tauri 2 (Rust)
- **Frontend Architecture**: React 18, TypeScript, Vite
- **Canvas Rendering**: Konva.js, React-Konva
- **Database & Storage**: SQLite, Rusqlite
- **State Management**: Zustand
- **Image Processing**: Rust `image` & `rayon` parallel engine

---

## 🔄 Software Updates & Support

### In-App Update Checker
To check for the latest releases, open **AFSNSmartAlbum**, navigate to **About AFSNSmartAlbum**, and click **🔄 Check Updates**.

### Support Independent Development
AFSNSmartAlbum is actively developed as an independent professional tool. If this software empowers your photography business, voluntary contributions can be made via **QRIS** directly inside the application.

---

## 📄 License & Acknowledgements

Copyright © 2026 **Afsunmedia - Asrofims**. All rights reserved.

Built with gratitude upon open-source foundations:
- [Tauri](https://tauri.app/) (MIT / Apache-2.0)
- [React](https://reactjs.org/) (MIT)
- [Konva](https://konvajs.org/) (MIT)
- [SQLite](https://www.sqlite.org/) (Public Domain)
- [Rayon](https://github.com/rayon-rs/rayon) (MIT / Apache-2.0)
