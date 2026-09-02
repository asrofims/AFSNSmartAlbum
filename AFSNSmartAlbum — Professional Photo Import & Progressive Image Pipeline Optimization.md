# AFSNSmartAlbum — Professional Photo Import & Progressive Image Pipeline Optimization

Kamu bertindak sebagai **Senior Rust + Tauri + Frontend Image Pipeline Engineer**.

AFSNSmartAlbum adalah aplikasi desktop photo management/album berbasis **Rust + Tauri**.

Saat ini terdapat dua masalah performa yang saling berkaitan:

1. **Import 1 foto dari folder lokal terasa berat/lambat.**
2. **Thumbnail/gallery masih terlalu bergantung pada file original**, sehingga image loading, decoding, resize, dan processing terasa berat.

Saya ingin kamu **mengaudit dan memperbaiki mekanisme existing secara langsung pada project**, bukan membuat ulang sistem import dari nol.

Tujuan akhirnya adalah membuat pengalaman import seperti aplikasi photo management profesional:

> **Foto langsung terlihat menggunakan embedded thumbnail, sementara image processing berkualitas lebih tinggi berjalan di background tanpa memblokir UI.**

---

# 1. PRINSIP UTAMA

Pisahkan antara:

```text
ORIGINAL
    │
    ├── Embedded Thumbnail
    │       ├── Filmstrip
    │       └── Spread
    │
    └── Background Processing
            │
            ▼
       Compressed Cache
            │
            └── Canvas
```

Jangan menganggap:

> Import selesai = compression selesai.

Import harus dianggap berhasil ketika foto sudah **terdaftar dan dapat langsung ditampilkan**.

Compression adalah proses background.

---

# 2. AUDIT EXISTING TERLEBIH DAHULU

Sebelum mengubah kode, telusuri implementasi aktual project.

Cari seluruh bagian yang berkaitan dengan:

### Import

- folder picker
- file picker
- drag & drop
- import command
- folder scanner
- filesystem access
- `invoke()`
- Tauri commands
- event system

### Image processing

- image decoder
- JPEG decoder
- RAW decoder jika ada
- EXIF
- embedded thumbnail
- image resize
- compression
- encoding
- hashing
- duplicate detection

### Cache

- thumbnail cache
- preview cache
- compressed image cache
- cache invalidation
- cache cleanup

### Database

- photo table/model
- original path
- thumbnail information
- compressed image information
- processing status

### UI

- Filmstrip
- Spread
- Canvas
- image component
- gallery
- lazy loading
- virtualization
- loading state
- progress state

Buat terlebih dahulu gambaran alur aktual project sebelum melakukan perubahan.

Jangan berasumsi bahwa implementasi menggunakan library atau arsitektur tertentu. **Periksa kode existing.**

---

# 3. CARI ROOT CAUSE IMPORT YANG BERAT

Periksa apakah import saat ini melakukan:

```text
Select file
    ↓
Read full original
    ↓
Decode full resolution
    ↓
Resize
    ↓
Compress
    ↓
Generate thumbnail
    ↓
Database
    ↓
Gallery reload
    ↓
Return
```

Jika iya, ini harus diubah.

Target:

```text
Select file
    ↓
Register photo
    ↓
Read/extract embedded thumbnail
    ↓
Immediately show Filmstrip/Spread
    ↓
Return control to UI
    ↓
Background compression
```

---

# 4. JANGAN KIRIM BINARY FOTO BESAR MELALUI IPC

Periksa apakah frontend membaca foto menjadi:

- ArrayBuffer
- Uint8Array
- Blob
- base64

kemudian mengirim binary besar melalui Tauri IPC.

Jika foto berasal dari filesystem lokal, prioritaskan mekanisme berbasis:

```text
Frontend
    ↓
file path
    ↓
Rust
    ↓
filesystem
```

Rust harus membaca file langsung dari filesystem bila memungkinkan.

Jangan memindahkan binary foto besar melalui IPC tanpa alasan kuat.

---

# 5. EMBEDDED THUMBNAIL SEBAGAI FIRST-LOOK IMAGE

Ini adalah perubahan utama.

Saat foto di-import, periksa apakah original memiliki:

- embedded thumbnail
- embedded preview
- EXIF thumbnail
- JPEG preview
- camera-generated preview

Jika tersedia dan kualitasnya memadai:

> **Gunakan embedded thumbnail langsung.**

Jangan decode full-resolution original hanya untuk membuat Filmstrip/Spread.

Target:

```text
Original
   ↓
Embedded Thumbnail
   ↓
Filmstrip
   ↓
Spread
```

Dengan demikian foto dapat terlihat hampir segera setelah import.

---

# 6. FILMSTRIP

Filmstrip harus menjadi bagian paling responsif.

Gunakan:

```text
Embedded Thumbnail
```

sebagai source utama.

Jika embedded thumbnail sudah tersedia:

- jangan generate thumbnail baru
- jangan decode original
- jangan menunggu compression
- jangan menunggu Canvas cache

Jika embedded thumbnail tidak tersedia:

```text
Original
   ↓
Generate lightweight Filmstrip cache
   ↓
320px
   ↓
Filmstrip
```

---

# 7. SPREAD

Spread juga menggunakan embedded thumbnail sebagai source utama jika cukup.

Target:

```text
Embedded Thumbnail
      ↓
Spread
```

Jika kualitas embedded thumbnail tidak cukup:

```text
Compressed cache jika sudah tersedia
```

atau generate lightweight Spread cache sesuai kebutuhan.

**Jangan membuat user menunggu background compression hanya agar Spread dapat menampilkan foto kecil.**

---

# 8. CANVAS

Canvas memiliki kebutuhan kualitas lebih tinggi.

Canvas harus menggunakan:

```text
Compressed Image Cache
```

sebagai source utama.

Alur:

```text
Import
   ↓
Embedded thumbnail
   ↓
Filmstrip + Spread langsung tampil
   ↓
Background compression
   ↓
Compressed cache ready
   ↓
Canvas menggunakan compressed image
```

---

# 9. CANVAS SAAT COMPRESSION BELUM SELESAI

Jika user membuka Canvas sebelum compressed image tersedia:

```text
Compressed image unavailable
          ↓
Embedded thumbnail temporary fallback
          ↓
Canvas tetap dapat tampil
          ↓
Background compression continues
          ↓
Compressed image ready
          ↓
Canvas automatically switches source
```

Jangan membuat Canvas blank hanya karena background processing belum selesai.

Namun embedded thumbnail hanya temporary fallback.

Setelah compressed cache tersedia, Canvas wajib menggunakan compressed image.

---

# 10. BACKGROUND COMPRESSION

Compression harus dipisahkan dari proses import utama.

Target:

```text
IMPORT
   ↓
Register photo
   ↓
Extract embedded thumbnail
   ↓
Show UI
   ↓
Queue background job
   ↓
Compression
   ↓
Save compressed cache
   ↓
Update status
```

Operasi CPU-heavy tidak boleh memblokir UI/main thread.

Jika project menggunakan Tokio/Tauri, evaluasi penggunaan:

```text
spawn_blocking
```

atau worker pool yang sesuai.

Jika project sudah menggunakan Rayon, manfaatkan arsitektur existing.

Jangan menambahkan dependency hanya karena terlihat lebih modern.

---

# 11. IMAGE PROCESSING HARUS BOUNDED

Jangan membuat task/thread tanpa batas untuk setiap foto.

Gunakan:

```text
Import Queue
      ↓
Bounded Worker Pool
      ↓
Image Processing
```

Tujuannya menjaga:

- CPU
- RAM
- disk I/O
- UI responsiveness

tetap stabil.

---

# 12. PRIORITY PROCESSING

Background compression harus memiliki prioritas.

Prioritas:

```text
1. Foto yang sedang dibutuhkan Canvas
2. Foto yang terlihat di Spread
3. Foto yang terlihat/dekat viewport Filmstrip
4. Foto lain yang belum diproses
```

Contoh:

```text
User sedang membuka photo #1520
       ↓
Photo #1520
       ↓
HIGH PRIORITY
```

Jangan memproses ribuan foto secara FIFO jika user sedang membutuhkan foto tertentu.

Jika memungkinkan, job yang sudah tidak relevan karena user berpindah jauh dapat diturunkan prioritasnya atau dibatalkan dengan aman.

---

# 13. PROCESSING STATUS

Setiap foto yang sedang diproses harus memiliki state.

Minimal:

```text
pending
processing
ready
failed
```

Contoh:

```text
pending
   ↓
processing
   ↓
ready
```

atau:

```text
processing
   ↓
failed
```

Status ini digunakan frontend untuk menampilkan indikator.

---

# 14. FILMSTRIP PROCESSING INDICATOR

Indikator harus **sangat minimal dan tidak mengganggu foto**.

Jangan gunakan:

- spinner
- badge
- teks
- icon besar
- modal
- overlay tengah
- progress circle

Gunakan hanya:

> **garis strip hijau tipis di bagian bawah thumbnail Filmstrip.**

Contoh:

```text
┌──────────────────┐
│                  │
│      PHOTO       │
│                  │
├──────             │
└──────────────────┘
```

Strip menunjukkan progress compression.

### Aturan visual

Strip:

- sangat tipis
- berada di edge paling bawah thumbnail
- tidak mengubah ukuran/layout thumbnail
- tidak menutupi area foto
- tidak mengganggu scrolling
- menggunakan styling existing application jika tersedia

Ketika compression selesai:

```text
processing → ready
```

strip dapat hilang secara halus.

---

# 15. PROGRESS HARUS AKURAT

Jangan membuat progress palsu.

Jika compression process dapat memberikan progress aktual:

```text
0%
25%
50%
75%
100%
```

gunakan nilai aktual.

Jika tidak dapat mengetahui progress secara akurat:

> gunakan **indeterminate green bottom strip**.

Tetap jangan menggunakan spinner atau indikator lain.

Jangan mengarang angka progress hanya agar terlihat bergerak.

---

# 16. CACHE ARCHITECTURE

Gunakan persistent local cache.

Konsep:

```text
AFSNSmartAlbum/
├── database/
│
└── cache/
    └── images/
        ├── embedded/
        ├── filmstrip/
        ├── spread/
        └── canvas/
```

Namun **jangan otomatis membuat semua jenis cache untuk setiap foto jika tidak diperlukan**.

Embedded thumbnail dapat digunakan langsung atau disimpan ke cache jika itu meningkatkan performa.

---

# 17. CACHE PRIORITY

Prioritas image source:

## Filmstrip

```text
Embedded Thumbnail
      ↓
Filmstrip Cache
      ↓
Placeholder
```

## Spread

```text
Embedded Thumbnail
      ↓
Spread Cache
      ↓
Compressed Cache
      ↓
Placeholder
```

## Canvas

```text
Compressed Cache
      ↓
Embedded Thumbnail temporary fallback
```

Jangan gunakan original sebagai default source untuk Filmstrip.

Jangan gunakan original sebagai default source untuk Spread.

---

# 18. CACHE QUALITY & SIZE POLICY

Gunakan baseline berikut.

## Embedded Thumbnail

Jika tersedia:

```text
Use original embedded thumbnail
```

Jangan upscale.

Jangan recompress tanpa kebutuhan.

---

## Filmstrip Cache

Jika diperlukan:

```text
Max dimension:
320 px sisi terpanjang

JPEG quality:
75

Target:
≤ 100 KB/image
```

Jika original lebih kecil dari 320 px:

> jangan upscale.

---

## Spread Cache

Jika embedded thumbnail tidak mencukupi:

```text
Max dimension:
800 px sisi terpanjang

JPEG quality:
80

Target:
≤ 300 KB/image
```

Jangan upscale.

---

## Canvas Cache

```text
Max dimension:
2560 px sisi terpanjang

JPEG quality:
88

Target:
≤ 2 MB/image

Minimum quality:
75
```

Contoh:

```text
Original:
6000 × 4000

Canvas cache:
2560 × 1707
```

Portrait:

```text
Original:
4000 × 6000

Canvas cache:
1707 × 2560
```

Jangan membuat Canvas cache sebesar resolusi original kamera jika tidak diperlukan.

---

# 19. QUALITY FALLBACK

Target ukuran cache bukan alasan untuk menghancurkan kualitas.

Jika Canvas image melebihi target:

```text
Q88
 ↓
Q86
 ↓
Q84
 ↓
Q82
...
```

Turunkan quality secara bertahap.

Jangan langsung menggunakan quality sangat rendah.

Untuk Canvas:

```text
minimum Q75
```

Jika masih lebih besar dari target setelah mencapai Q75:

> pertahankan Q75 dan gunakan hasil tersebut.

Jangan menurunkan kualitas lebih jauh hanya untuk memenuhi target ukuran.

---

# 20. DIMENSION LIMIT

Dimension limit lebih penting daripada menyimpan resolusi kamera penuh.

Contoh:

```text
Original
8000 × 5333
```

Tidak perlu menghasilkan:

```text
8000 × 5333 JPEG Q95
```

untuk Canvas.

Gunakan:

```text
2560 × 1707 JPEG Q88
```

sebagai baseline.

---

# 21. CACHE KEY

Jangan menggunakan filename sebagai cache key.

Hindari:

```text
IMG_0001.jpg
```

karena nama file dapat sama di folder berbeda.

Gunakan photo ID/UUID yang sudah ada di database.

Contoh:

```text
filmstrip/{photo_id}.jpg
spread/{photo_id}.jpg
canvas/{photo_id}.jpg
```

Jika architecture existing memiliki mekanisme cache key yang lebih baik, gunakan itu.

---

# 22. CACHE INVALIDATION

Cache adalah derived data.

Original adalah source-of-truth.

Jika original tidak berubah:

```text
reuse cache
```

Jika original berubah:

```text
invalidate cache
     ↓
queue regeneration
```

Gunakan mekanisme yang sesuai dengan project, misalnya:

- modified time
- file size
- content hash
- version
- kombinasi metadata

Jangan melakukan compression ulang setiap kali aplikasi dibuka.

---

# 23. APPLICATION RESTART

Jika aplikasi ditutup ketika compression berjalan:

```text
Photo:
processing
```

jangan dianggap gagal secara permanen.

Saat aplikasi dibuka kembali:

```text
compressed cache exists?
     │
     ├── YES → ready
     │
     └── NO → queue again
```

Embedded thumbnail tetap dapat digunakan segera.

---

# 24. ATOMIC CACHE WRITE

Jangan menulis hasil compression langsung ke final cache path jika proses dapat gagal.

Gunakan konsep:

```text
Generate
   ↓
Temporary file
   ↓
Flush / close
   ↓
Atomic rename
   ↓
Final cache
```

Dengan demikian aplikasi tidak mendapatkan file cache setengah jadi ketika terjadi crash/interruption.

---

# 25. MEMORY MANAGEMENT

Hindari menyimpan full-resolution image dalam memory terlalu lama.

Hindari:

```text
Original 24MP
   ↓
decode
   ↓
clone
   ↓
clone
   ↓
resize
```

Target:

```text
Read
 ↓
Decode
 ↓
Process
 ↓
Encode
 ↓
Write cache
 ↓
Release memory
```

Concurrency harus dibatasi agar beberapa foto besar tidak didecode bersamaan secara berlebihan.

---

# 26. EXIF & ORIENTATION

Pastikan embedded thumbnail maupun compressed cache memiliki orientasi yang benar.

Perhatikan:

- EXIF orientation
- rotation
- portrait
- landscape

Foto tidak boleh tampil miring hanya karena orientation tersimpan dalam EXIF.

Jangan membaca EXIF berulang kali jika metadata sudah tersedia di database.

---

# 27. DATABASE

Audit database existing.

Jika diperlukan, database harus dapat mengetahui:

```text
original path
processing status
cache availability
```

Konsep:

```text
Photo
├── original_path
├── processing_status
├── embedded_thumbnail_available
├── compressed_cache_available
└── ...
```

Tidak harus persis seperti struktur tersebut.

**Jangan mengubah schema database jika mekanisme existing dapat digunakan.**

Jika perubahan schema benar-benar diperlukan:

- buat migration aman
- jangan merusak data lama
- pertahankan backward compatibility

---

# 28. FRONTEND HARUS CACHE-FIRST

Frontend jangan melakukan:

```text
Image component
   ↓
Original file
   ↓
Browser decode
   ↓
Resize
```

untuk Filmstrip atau Spread.

Gunakan:

```text
Filmstrip → embedded/cache
Spread    → embedded/cache
Canvas    → compressed cache
```

---

# 29. JANGAN FULL GALLERY RELOAD

Setelah satu foto selesai diproses:

Jangan:

```text
Compression complete
      ↓
Reload entire library
      ↓
Query thousands of photos
      ↓
Re-render entire gallery
```

Lakukan:

```text
Photo #153
processing
   ↓
ready
   ↓
update only Photo #153
```

UI harus melakukan incremental update.

---

# 30. LAZY LOADING & VIRTUALIZATION

Audit apakah Filmstrip/Spread menggunakan lazy loading.

Jika terdapat ribuan foto:

```text
5.000 photos
      ↓
Only visible/near-visible images
      ↓
loaded/rendered
```

Jangan memuat seluruh image sekaligus.

Jika project sudah menggunakan virtualization, pertahankan dan optimalkan.

Jika belum, pertimbangkan virtualization hanya jika memang terbukti menjadi bottleneck.

Jangan menambahkan kompleksitas tanpa bukti kebutuhan.

---

# 31. IMPORT BANYAK FOTO

Untuk import folder:

```text
Folder
 ↓
Discover files
 ↓
Register photos quickly
 ↓
Extract embedded thumbnails
 ↓
Filmstrip/Spread immediately usable
 ↓
Queue background compression
```

Contoh:

```text
Import:
100 / 100 ✓

Compression:
37 / 100
```

User tetap dapat menggunakan aplikasi selama compression berlangsung.

---

# 32. ERROR HANDLING

Jika compression gagal:

```text
Filmstrip:
Embedded thumbnail ✓

Spread:
Embedded thumbnail ✓

Canvas:
Fallback thumbnail atau error state ringan
```

Import tidak boleh dianggap gagal hanya karena compression background gagal.

Original tetap aman.

Jangan menggunakan `unwrap()` pada operasi file/image processing yang dapat gagal.

---

# 33. DUPLICATE IMPORT

Pastikan perubahan tidak merusak duplicate detection.

Jika foto sudah terdaftar:

```text
Existing photo
      ↓
reuse existing cache
```

Jangan membuat cache baru secara tidak perlu.

Audit mekanisme hash existing sebelum mengubahnya.

Jika full-file hashing ternyata menjadi bottleneck, optimalkan dengan hati-hati tanpa menghilangkan correctness duplicate detection.

---

# 34. CANCEL / INTERRUPTION

Jika existing system memiliki cancel import, pertahankan.

Background compression harus dapat dihentikan dengan aman jika memungkinkan.

Jangan meninggalkan:

- temporary cache
- corrupt image
- database record setengah jadi
- orphan processing state

---

# 35. PERFORMANCE MEASUREMENT

Tambahkan logging/measurement yang sesuai untuk mengukur:

```text
File discovery
Photo registration
Embedded thumbnail extraction
Compression
Cache write
Database update
Canvas load
Total import response time
```

Contoh:

```text
Import response:
...

Embedded thumbnail:
...

Compression:
...

Cache:
...

Canvas:
...
```

Jangan mengarang angka.

Jika dapat melakukan benchmark, tampilkan hasil aktual sebelum dan sesudah.

---

# 36. TEST WAJIB

Lakukan test:

### Test 1
1 JPEG normal.

### Test 2
JPEG 24MP.

### Test 3
JPEG 50MB.

### Test 4
JPEG dengan embedded thumbnail.

### Test 5
File tanpa embedded thumbnail.

### Test 6
Portrait dengan EXIF orientation.

### Test 7
100+ foto import.

### Test 8
1000+ foto gallery.

### Test 9
Scroll cepat Filmstrip.

### Test 10
Spread dibuka ketika compression masih berjalan.

### Test 11
Canvas dibuka ketika compression masih berjalan.

### Test 12
Canvas otomatis berpindah ke compressed image setelah processing selesai.

### Test 13
Application restart saat compression berlangsung.

### Test 14
Cache dihapus.

### Test 15
Original berubah.

### Test 16
Compression gagal.

### Test 17
Duplicate import.

### Test 18
Cancel import jika fitur tersedia.

---

# 37. ACCEPTANCE CRITERIA

Implementasi dianggap berhasil jika:

## IMPORT

- memilih 1 foto tidak menyebabkan UI freeze
- foto segera terdaftar
- embedded thumbnail segera dapat digunakan
- compression tidak blocking

## FILMSTRIP

- menggunakan embedded thumbnail/cache
- tidak membaca original setiap render
- langsung terlihat
- memiliki **green bottom strip tipis** ketika compression berjalan
- strip tidak mengganggu UI

## SPREAD

- menggunakan embedded thumbnail/cache
- tidak menunggu compression
- tetap responsif

## CANVAS

- menggunakan compressed cache ketika tersedia
- memiliki embedded thumbnail sebagai temporary fallback
- otomatis mengganti ke compressed image setelah ready

## CACHE

Filmstrip fallback:

```text
320px
Q75
≤100KB target
```

Spread fallback:

```text
800px
Q80
≤300KB target
```

Canvas:

```text
2560px max dimension
Q88
≤2MB target
minimum Q75
```

Semua cache:

- tidak upscale
- tidak mengubah original
- persistent
- memiliki cache key stabil
- dapat diregenerate
- tidak dibuat ulang tanpa alasan

## BACKGROUND PROCESSING

- bounded concurrency
- tidak memblokir UI
- memiliki processing state
- memiliki priority
- dapat recover setelah restart

## DATABASE

- tetap konsisten
- tidak duplicate record
- migration aman jika diperlukan

## UI

- tidak ada blocking modal
- tidak ada spinner besar
- tidak ada progress text
- indikator processing hanya green bottom strip
- incremental update, bukan full gallery reload

---

# 38. ARSITEKTUR TARGET

Hasil akhir harus mendekati:

```text
                         ORIGINAL
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
   Embedded Thumbnail              Background Worker
             │                             │
       ┌─────┴─────┐                       │
       │           │                       ▼
       ▼           ▼               Compressed Cache
   FILMSTRIP     SPREAD                    │
       │           │                       │
       │           │                       ▼
       │           │                    CANVAS
       │           │
       └─────┬─────┘
             │
      Green Bottom Strip
      while processing
```

---

# 39. PRINSIP UX AKHIR

Pengalaman user harus seperti:

```text
User memilih foto
        ↓
Foto langsung muncul di Filmstrip
        ↓
Foto langsung tersedia di Spread
        ↓
Green strip tipis muncul
        ↓
Background compression berjalan
        ↓
Green strip menunjukkan progress
        ↓
Compression selesai
        ↓
Green strip hilang
        ↓
Canvas menggunakan compressed image
```

Tidak boleh:

```text
User memilih foto
        ↓
Loading
        ↓
Decode
        ↓
Compress
        ↓
Wait
        ↓
Foto baru muncul
```

---

# 40. ATURAN IMPLEMENTASI TERAKHIR

**Jangan hanya memberikan rekomendasi. Implementasikan perbaikannya langsung pada project existing.**

Urutan kerja wajib:

1. Audit code existing.
2. Identifikasi root cause.
3. Jelaskan bottleneck sebelum perubahan.
4. Implementasikan progressive image pipeline.
5. Pisahkan import cepat dari background compression.
6. Implementasikan embedded thumbnail untuk Filmstrip/Spread.
7. Implementasikan compressed cache untuk Canvas.
8. Implementasikan processing status.
9. Implementasikan green bottom progress strip.
10. Implementasikan cache policy.
11. Implementasikan background worker dengan bounded concurrency.
12. Implementasikan priority processing.
13. Pastikan cache tidak dibuat ulang tanpa alasan.
14. Pastikan original tidak pernah dimodifikasi.
15. Optimalkan frontend agar tidak full reload.
16. Build/check/test project.
17. Perbaiki regression/error yang ditemukan.

**Jangan melakukan rewrite besar-besaran tanpa alasan.**

Gunakan dependency dan architecture existing sebanyak mungkin.

Jika ada beberapa kemungkinan solusi, pilih solusi yang:

1. paling ringan,
2. paling responsif,
3. paling sederhana,
4. paling mudah dipelihara,
5. paling aman terhadap data original.

---

# HASIL YANG SAYA INGINKAN

Pada akhirnya AFSNSmartAlbum harus menerapkan prinsip:

> **Original is the source-of-truth. Embedded thumbnail is the instant visual representation. Compressed cache is the working image for Canvas. Heavy processing happens in the background.**

Prioritas utama:

> **Instant visual feedback → responsive UI → efficient memory → efficient disk → reasonable image quality.**