# AFSNSmartAlbum — Text Features Implementation Prompt

Saya sedang mengembangkan AFSNSmartAlbum — desktop photo album layout app (React + TypeScript + Vite + Tauri + Konva.js + Zustand). Saya perlu menambahkan fitur text editing pada canvas Konva untuk album layout.

## Konteks Proyek
- State management: Zustand
- Canvas: Konva.js (Stage, Layer, Group, Transformer)
- Multi-frame resize: Sudah ada `calculateMultiFrameResize` (2D Topological Spatial Neighbor Graph)
- Snapping: Sudah ada smart magnetic snapping
- Database: SQLite (via Tauri)
- Tema: Dark theme (DESIGN_SYSTEM.md)

## Spesifikasi Fitur Text

### 1. Text Node di Canvas
- Buat `Konva.RichText` atau `Konva.Text` node yang bisa diatur seperti photo frame
- Drag, resize, rotate melalui Transformer
- Snap ke grid dan ke frame lain (meng sistem snapping yang ada)

### 2. Rich Text Styling per Kata
- Bold, italic, underline per kata/phrase
- Font size, font family, warna per kata
- Background highlight per kata

### 3. Multi-line & Word Wrap
- Dukungan newline (`\n`)
- Auto wrap pada kata (wrap: 'word')
- LineHeight konfigurasi

### 4. Text Alignment
- Horizontal: left, center, right
- Vertical: top, middle, bottom
- Padding dari border text box

### 5. Ellipsis
- Otomatis potong teks terlalu panjang dengan `...`
- Bisa diatur aktif/non-aktif

### 6. Font Controls
- Font size (px), font family, font weight, font style
- Preview font sebelum apply

### 7. Text Metrics
- `measureText()` untuk hitung lebar/tinggi teks
- `getTextWidth()` untuk auto-size text box

### 8. Double-Click to Edit
- Double-click pada text node → buka text editor (HTML textarea atau custom input)
- Apply perubahan ke text node
- Escape untuk batal, Enter untuk submit

### 9. Text Style Preset
- Simpan preset style (heading, body, caption, title)
- Load preset dalam satu click

### 10. Persist ke Database
- Simpan text node properties ke SQLite
- Load text node saat buka album

## Keluaran
- Komponen React: `<TextTool />` untuk toolbar
- Komponen: `<TextEditor />` untuk inline editing
- Hook: `useTextNodes()` untuk manage text state (Zustand store)
- Utilitas: `textNodeHelpers.ts` untuk create/update/delete text node
- Tipe TypeScript: `TextNodeData`, `TextPreset`, `TextStyle`

## Aturan
- Jangan ubah arsitektur yang ada
- Ikuti AGENTS.md, ARCHITECTURE.md, DESIGN_SYSTEM.md
- Gunakan Standard Professional English untuk UI text
- Prioritaskan correctness, safety, performance
- Tambahkan ke `ROADMAP.md` jika perlu

## Contoh Penggunaan
```tsx
// Tambah text node
const textNode = createTextNode({
  text: 'Album Title',
  x: 100, y: 100,
  style: {
    fontSize: 32,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fill: '#ffffff',
    align: 'center',
    verticalAlign: 'middle',
  },
});

// Edit text
editTextNode(textNode, 'New Text Content');

// Apply preset
applyTextPreset(textNode, 'heading');
```

## Acceptance Criteria
- Text node bisa ditambah, diedit, diubah ukuran, dirotasikan
- Rich text styling bekerja per kata
- Word wrap berfungsi otomatis
- Double-click mengaktifkan editor
- Text state tersimpan ke Zustand dan SQLite
- Snap berfungsi untuk text node
- Tidak ada regression pada fitur existing

---

Saya siap menerima langkah-langkah implementasi yang terstruktur, file-file yang harus dibuat/dimodifikasi, dan code snippets untuk setiap fitur. Saya ingin implementasi yang siap pakai dan teruji dengan `npm test`.