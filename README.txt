================================================================================
AFSNSmartAlbum — Professional Photo Album Layout Software
Version: 1.0.12
Website / Repository: https://github.com/asrofims/AFSNSmartAlbum
Author: Afsunmedia - Asrofims
================================================================================

[ 1. OVERVIEW ]
--------------------------------------------------------------------------------
AFSNSmartAlbum is a blazing-fast, offline-first desktop application engineered 
specifically for professional wedding, portrait, and commercial photographers, 
as well as album printing labs.

Built with a high-performance Rust core (Tauri 2) and an interactive React/Konva 
design canvas, AFSNSmartAlbum streamlines multi-page photo book creation with 
sub-millimeter precision, smart magnetic snapping, and instantaneous layout 
generation.


[ 2. SYSTEM REQUIREMENTS ]
--------------------------------------------------------------------------------
Minimum Requirements:
  * Operating System: Windows 10 (64-bit) or Windows 11 (64-bit)
  * Processor: Dual-Core 2.0 GHz Intel / AMD 64-bit processor
  * RAM: 4 GB
  * Display: 1280 x 800 minimum resolution
  * Storage: 200 MB free disk space for application

Recommended Requirements:
  * Operating System: Windows 11 (64-bit)
  * Processor: Quad-Core 3.0 GHz Intel Core i5 / AMD Ryzen 5 or better
  * RAM: 8 GB or 16 GB for heavy RAW / high-resolution image libraries
  * Display: Full HD (1920 x 1080) or 4K Ultra HD display


[ 3. KEY FEATURES ]
--------------------------------------------------------------------------------
* 2D Topological Spatial Neighbor Graph Multi-Resize:
  Resizing multiple selected photo frames preserves exact physical gap spacing 
  across complex multi-row, multi-column, and asymmetrical collages without 
  position distortion.

* Smart Magnetic Snapping Engine:
  Millimeter-accurate magnetic snapping aligning to Left/Right Blue Safe Margin 
  Boxes, Center Spine Gutter, Outer Bleed Boundaries, and Inter-Frame Equal Gaps 
  with real-time visual HUD measurement guides.

* Dynamic Adaptive Multi-Photo Partitioning Engine:
  Instantly organize 1 to 12+ photos onto spreads with a single click. Choose 
  from dozens of mathematical layout variations that automatically adapt to native 
  photo aspect ratios while strictly honoring configured safe print margins.

* Dual Entity Reset System:
  - ↺ Reset Ratio: Restores frame geometry to the photo's native aspect ratio 
    (3:2, 4:3, 1:1, etc.) without losing custom pan/zoom crop coordinates.
  - ↺ Reset Crop: Re-centers the image inside the frame and resets zoom to 1.0x.

* High-Performance Photo Pipeline:
  Lightweight background thumbnail and preview generation powered by native Rust 
  image engines. Original multi-megabyte image files remain untouched and are only 
  accessed during final high-resolution export.

* Dual-Format Project Persistence:
  - Compressed Single-File Archive (.afsn): Ultra-compact project package with 
    embedded previews and SQLite database.
  - Self-Contained Project Folder: Complete project directory bundle including 
    copied original photos for 100% offline archival and sharing across workstations.

* High-Resolution Print Export:
  Export album spreads at true 300 DPI in uncompressed TIFF, maximum quality JPEG, 
  or Multi-Page PDF. Supports Full Panoramic Spreads, Left/Right Page Splitting, 
  and custom color profiles.

* In-App Update Checker:
  Check for software updates directly through GitHub Releases with changelog 
  previews and one-click installer downloads.


[ 4. KEYBOARD SHORTCUTS REFERENCE ]
--------------------------------------------------------------------------------
Canvas & Navigation:
  * Spacebar + Drag            : Pan / Move Canvas
  * Ctrl + Mouse Wheel         : Zoom In / Zoom Out Canvas
  * Ctrl + 0                   : Fit Spread to Screen (100% View)
  * Left / Right Arrow         : Previous / Next Spread

Selection & Editing:
  * Click                      : Select Frame
  * Shift + Click              : Multi-Select Additional Frames
  * Ctrl + A                   : Select All Frames on Spread
  * Shift + Drag Frame         : Orthogonal Constraint Drag (Straight Horizontal / Vertical)
  * Arrow Keys                 : Nudge Selected Frame(s) by 1mm
  * Shift + Arrow Keys         : Nudge Selected Frame(s) by 10mm
  * Ctrl + C / Ctrl + V        : Copy & Paste Frame(s)
  * Ctrl + D                   : Duplicate Selected Frame(s)
  * Delete / Backspace         : Delete Selected Frame(s)
  * Ctrl + G / Ctrl + Shift + G: Group / Ungroup Selected Frames

Drag & Drop Photo Actions:
  * Drag photo to empty canvas : Add new photo frame
  * Drag photo onto frame      : Overlay / Stack photo freely
  * Hold ALT + Drag onto frame : 🔄 Replace existing photo with new photo
  * Double-Click Frame         : Enter In-Frame Interactive Crop Mode
  * Enter / Esc                : Exit Crop Mode


[ 5. UPDATES & SUPPORT ]
--------------------------------------------------------------------------------
Software Updates:
  To check for the latest releases, open AFSNSmartAlbum and click "Updates" on 
  the top header or "Check Updates" in the About dialog.
  Releases are published at: https://github.com/asrofims/AFSNSmartAlbum/releases

Contribution & Donations:
  AFSNSmartAlbum is an independently developed application. If this tool helps 
  your photography business or print production workflow, voluntary contributions 
  can be made via QRIS in the "About" dialog or "Support Developer" modal.


[ 6. LICENSE & CREDITS ]
--------------------------------------------------------------------------------
AFSNSmartAlbum is copyright © Afsunmedia - Asrofims. All rights reserved.

Built with Open Source technologies:
  * Tauri (MIT / Apache-2.0)
  * React & TypeScript (MIT)
  * Konva.js (MIT)
  * SQLite (Public Domain)
  * Vite (MIT)
  * libvips / Rust Image (LGPL-2.1 / MIT)

================================================================================
Thank you for using AFSNSmartAlbum!
================================================================================
