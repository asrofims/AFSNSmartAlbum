# Audit penanganan teks — 7 September 2026

Audit implementasi TypeScript/React/Konva, penyimpanan album, dan renderer ekspor Rust. Kode aplikasi, aturan proyek, dan ROADMAP tidak diubah. Dokumen ini mencatat temuan, bukan menyatakan perbaikan telah selesai.

## Kesimpulan

Mekanisme teks belum konsisten untuk pekerjaan layout presisi. Fondasi yang tersedia cukup untuk dikembangkan: elemen teks tersendiri, ukuran font dalam point, transform berdasarkan handle, styled ranges, dua perintah fitting, serta penyimpanan payload. Masalah utamanya adalah aturan geometri, pengukuran teks, editing, history, dan ekspor yang belum memakai kontrak perilaku yang sama.

Konva tidak perlu diganti untuk memperbaiki temuan ini. Pemisahan resize frame dari scaling teks sesuai dengan contoh resmi [Konva Resize Text](https://konvajs.org/docs/select_and_transform/Resize_Text.html). Overlay DOM juga merupakan pola yang didokumentasikan [Konva Editable Text](https://konvajs.org/docs/sandbox/Editable_Text.html), tetapi contoh textarea bukan mesin editing rich text lengkap. Sebagai acuan UX, Adobe membedakan pembuatan/resize text frame, fitting, dan auto-sizing pada [Create text and text frames](https://helpx.adobe.com/africa/indesign/using/creating-text-text-frames.html). Tidak semua aplikasi profesional harus memiliki gesture identik; perilaku harus eksplisit dan dapat diprediksi.

## Temuan prioritas tinggi

### 1. Format per kata tidak dipulihkan saat load album — P1

Lokasi: `src/stores/albumStore.ts:151`, `src/domain/text.ts:532`.

Serializer dan deserializer menyertakan `styledRanges`, tetapi `loadAlbumFromDb` hanya mengambil `text`, `style`, dan `textRuns`. Objek hasil hidrasi tidak memiliki `styledRanges`.

Dampak: bold, italic, warna, highlight, dan ukuran per rentang yang sudah disimpan tidak masuk ke state saat proyek dibuka kembali. Save berikutnya dapat menulis ulang payload tanpa rentang tersebut. Test serialization yang sekarang lulus hanya menguji helper, bukan jalur load store.

Verifikasi lanjutan untuk perbaikan: save → load lewat command database → bandingkan styled ranges → save/load sekali lagi.

### 2. Ukuran teks plain salah pada canvas bersatuan inch — P1

Lokasi: `src/features/editor/TextNode.tsx:100`, `src/domain/units.ts:99`.

`TextNode` memanggil `ptToScreenPx(..., scaleFactor=1)` sebelum mengalikan base resolution 10. Helper tersebut memaksa hasil minimum 1. Pada inch, 24 pt seharusnya 0,3333 inch, tetapi menjadi 1 sebelum dikalikan 10.

Diagnostik terjalankan: ukuran internal aktual 10; seharusnya 3,3333. Akibat jalur ini, plain text 24 pt memiliki ukuran visual setara 72 pt. Nilai inch di bawah 72 pt terkena clamp yang sama. Rich text dan overlay memakai urutan scaling lain sehingga pergantian mode dapat menimbulkan perbedaan ukuran.

Perbaikan: pertahankan konversi unit fisik tanpa clamp piksel; batas kenyamanan interaksi hanya diterapkan pada hit target/UI, bukan ukuran glyph.

### 3. Add Text dapat menempatkan objek di luar halaman inch — P1

Lokasi: `src/stores/editorStore.ts:450–502`.

Posisi awal memakai `Math.max(10, ...)` dalam unit proyek. Pada halaman setinggi 8 inch, Y awal menjadi 10 inch. Pada cover, X juga dibatasi minimum 10 inch. Pada proyek cm, angka yang sama berarti 10 cm.

Diagnostik terjalankan: halaman 8 inch menghasilkan Y=10. Ini bukan margin fisik 10 mm.

Penambahan lewat toolbar/T langsung membuat objek di posisi tetap dan membuka editor dengan seluruh placeholder dipilih. Pemanggilan berulang menumpuk objek di lokasi yang sama. Escape membatalkan editing, tetapi objek baru tetap ada. Dua perilaku terakhir adalah keputusan UX yang perlu dipertegas, bukan otomatis bug.

Ada pula ketidakkonsistenan API preset: ukuran awal dihitung dari style default/options sebelum style preset diterapkan, dan ukuran `options.width` belum dipakai untuk menghitung tinggi awal. Jalur toolbar saat ini tidak mengirim preset.

### 4. Renderer dan Fit menggunakan aturan layout berbeda — P1

Lokasi: `src/domain/text.ts:310–469`, `src/domain/richTextRenderer.ts:56`, `src/features/editor/TextNode.tsx:438`.

Fitting tidak mengukur hasil layout yang benar-benar dirender:

- Font terbesar pada satu styled range digunakan untuk mengukur seluruh paragraf, bukan hanya range tersebut.
- Font family/weight/style per range tidak diukur sesuai rentangnya.
- `wordWrap: none` dan `char` tidak dihormati; fitting selalu memecah berdasarkan kata.
- Spasi berulang dinormalisasi oleh split/filter.
- Kata panjang tanpa spasi tidak dipecah oleh fitting, sedangkan Konva plain text dapat memecah kata yang terlalu panjang.
- Lebar isi minimum 30 pt dapat lebih besar daripada ruang nyata frame yang sempit.
- Tracking di fitting ditambahkan sebagai CSS px, sedangkan renderer plain text memperlakukannya sebagai point. Tracking negatif tidak masuk pengukuran fit.
- Tambahan tetap 8 pt horizontal dan 5 pt vertikal menggantikan pengukuran metrik font. Hasilnya tidak benar-benar rapat pada semua ukuran dan font.

Diagnostik terjalankan: kalimat yang sama dalam frame 30 mm menghasilkan 8 baris untuk `wordWrap: none` maupun `wordWrap: word`.

Perbaikan: satu kontrak hasil layout yang memberi baris, posisi glyph/run, ukuran isi, dan status overflow; Fit dan renderer menggunakan hasil tersebut. Untuk Rust diperlukan aturan dan fixtures yang setara, meskipun implementasinya lintas bahasa.

### 5. Canvas dan ekspor cetak tidak memiliki jaminan kesamaan tipografi — P1

Lokasi: `index.html:8`, `src/domain/richTextRenderer.ts:99`, `src-tauri/src/export_engine/text_rasterizer.rs:289`, `:520`, `:979`, `:1129`.

- Canvas mengunduh beberapa font melalui Google Fonts. Export mencari file font sistem dan dapat mengganti Playfair dengan Georgia atau Cinzel dengan Times. Jika font web tidak dipasang lokal, kedua jalur dapat memakai wajah font berbeda. Kondisi offline juga bergantung ketersediaan/cache font.
- Tracking diterapkan pada plain Konva text, tetapi tidak diterapkan pada pengukuran/drawing rich text maupun glyph advance Rust. `letter_spacing` tersedia di payload Rust, tetapi tidak digunakan untuk advance.
- Rust menjumlahkan advance dan merasterisasi karakter satu per satu tanpa langkah shaping/kerning. Hasil untuk pasangan huruf, ligature, script bersambung, dan aksara kompleks belum setara dengan browser.
- Styled range frontend menggunakan indeks UTF-16 dari textarea/JavaScript. Rust menggunakan indeks `Vec<char>`. Emoji sebelum rentang menggeser penerapan style saat export; misalnya pada `😀ABC`, rentang JS untuk `A` adalah [2,3), tetapi indeks Rust 2 menunjuk `B`.

Ini temuan struktural dari kode; audit belum menjalankan export visual end-to-end. Perbaikan harus mencakup identitas/font asset lokal yang sama, konvensi indeks yang jelas, serta pembandingan canvas–export untuk font dan Unicode yang didukung.

## Temuan interaksi dan geometri

### 6. Frame manual selalu dilawan auto-expand — P2

Lokasi: `src/features/editor/TextNode.tsx:149–168`, `:282–389`, `src/features/editor/KonvaEditorCanvas.tsx:3765`.

Side handle mengubah frame, corner mengubah font berdasarkan rasio lebar, tetapi akhir transform selalu memaksakan `height >= fittedH`. Effect render juga dapat mengubah tinggi dengan `skipHistory=true`; tidak ada guard `locked` pada effect. Commit inline selalu mengganti tinggi dengan fitted height, termasuk ketika isi tidak berubah.

Dampak: frame yang sengaja dibuat pendek membesar kembali; frame yang sengaja tinggi bisa menyusut sesudah membuka lalu mengakhiri editing. Pengguna tidak diberi pilihan frame tetap vs auto-size atau indikator overset. Koreksi tinggi ke bawah tidak mengoreksi origin untuk mempertahankan anchor lawan saat handle atas ditarik.

`getTextHeight()` digunakan sebagai tinggi total teks live. Implementasi Konva terpasang (`node_modules/konva/lib/shapes/Text.js:230,375`) mengembalikan `textHeight` yang diisi `fontSize`, bukan total tinggi paragraf. Perhitungan live ini tidak membuktikan seluruh baris tertampung. Konstanta `4 * baseResolution` juga berarti 4 unit proyek, bukan padding fisik yang sama lintas unit.

Minimum 20/12 screen pixels dan pembulatan ukuran saat drag membuat batas ukuran fisik bergantung zoom. Corner scaling juga mempertahankan padding/tracking, sehingga proporsi layout keseluruhan belum sepenuhnya terjaga.

### 7. Fit bisa menggeser teks; anchor belum benar untuk rotasi — P2

Lokasi: `src/features/editor/TypographyPanel.tsx:167–220`, `src/features/editor/KonvaEditorCanvas.tsx:1490–1515`.

Fit Height menahan Y frame, tetapi default vertical alignment adalah middle. Menyusutkan tinggi mengubah offset vertikal isi, sehingga posisi teks tetap bergeser walau Y frame tidak berubah. Bottom alignment juga membutuhkan aturan anchor yang jelas.

Fit Frame mengoreksi X dengan delta lebar/2 atau delta lebar tanpa transform rotasi. Pada teks berotasi 90°, offset lokal horizontal seharusnya memengaruhi Y dunia. Koreksi X saja tidak mempertahankan pusat/ujung visual yang dimaksud.

Tombol dan shortcut menduplikasi logika fitting. Pilih kebijakan reference point eksplisit dan satukan operasinya dalam domain agar keduanya identik.

### 8. Inline editor belum WYSIWYG untuk rich text — P2

Lokasi: `src/features/editor/TextInlineEditor.tsx:105–222`.

Overlay menggunakan textarea biasa dengan satu style global. Rentang bold/italic/warna/highlight tidak ditampilkan; teks Konva disembunyikan saat editing. Vertical alignment middle/bottom tidak direplikasi. Ukuran minimum overlay 40×30 px, padding minimum, dan border 2 px mengubah ruang isi relatif terhadap canvas.

Textarea menyediakan resize vertikal browser, tetapi ukuran DOM hasil drag tidak dikomit ke geometri elemen. Ukuran font berubah per viewport tetapi layout DOM dan Konva tidak memiliki metrik bersama. Untuk teks dalam grup berotasi, posisi memakai absolute position, sedangkan rotasi dibaca dari rotasi lokal node saja.

Pilihan perbaikan: editor teks polos yang dinyatakan jelas dan konsisten, atau editor DOM rich text yang memetakan rentang, caret, selection, serta style ke layout canvas. Keduanya perlu perilaku Enter/Ctrl+Enter/Escape dan composition input yang teruji.

### 9. Undo panel/slider menyimpan snapshot setelah perubahan — P2

Lokasi: `src/features/editor/TypographyPanel.tsx:398–417`, `:743–746`, `src/stores/historyStore.ts:48`.

Panel mengetik/slider mengubah state dengan skipHistory, kemudian mendorong album yang sudah berubah saat blur/pointer-up. History mengasumsikan snapshot adalah keadaan sebelum operasi.

Diagnostik store terjalankan: push before → push after → undo(after) mengembalikan after. Undo pertama tidak terlihat bekerja, dan langkah berikutnya bisa kembali ke operasi yang terlalu jauh karena baseline awal sesi tidak dicatat. Slider melalui keyboard juga tidak menjalankan onPointerUp.

Perbaikan: transaksi begin/update/commit, snapshot sebelum perubahan pertama, satu undo per gesture/sesi, dan discard saat cancel.

### 10. Pergantian plain text ke rich text mengubah whitespace dan tracking — P2

Lokasi: `src/domain/richTextRenderer.ts:99`, `:192`, `:300`.

Regex `split(/(\n|\s+)/)` dapat menggabungkan spasi sebelum newline ke token whitespace; hanya token yang persis newline dikenali sebagai baris baru. Diagnostik terjalankan: `A\nB` menghasilkan 2 baris, tetapi `A \nB` hanya 1 baris. Karena renderer berganti saat ada styled range, menambahkan bold bisa mengubah pemenggalan baris yang sebelumnya benar.

Rich renderer juga tidak menerapkan letterSpacing, tidak memiliki pemecahan karakter untuk wordWrap char, dan menggambar custom shape tanpa kebijakan clip/ellipsis yang setara dengan plain Konva text. Konten panjang dapat meluber pada jalur rich sementara export memotong pada batas buffer frame.

### 11. Perubahan teks tidak dihitung sebagai operasi edit yang sebenarnya — P2

Lokasi: `src/features/editor/TextInlineEditor.tsx:68–75`, `src/features/editor/TypographyPanel.tsx:381–387`, `src/domain/styledRanges.ts:208`.

Handler memakai caret sesudah edit sebagai titik awal edit, serta selisih panjang total sebagai jumlah insert/delete. Ini tidak mendeskripsikan replace selection yang memiliki penghapusan dan penambahan sekaligus. Kebijakan style pada batas rentang juga tidak eksplisit.

Diagnostik terjalankan: menyisipkan X sebelum rentang bold Hello dengan parameter handler membuat range [0,5) menjadi [0,6), sehingga X ikut bold. Apakah karakter baru harus mewarisi bold merupakan keputusan UX; yang perlu diperbaiki adalah model operasi edit dan kebijakan boundary yang konsisten, termasuk paste, replace, undo native, dan IME.

### 12. Lock tidak konsisten untuk editing teks — P2

Lokasi: `src/features/editor/TextNode.tsx:163`, `src/features/editor/KonvaEditorCanvas.tsx:2841`, `src/stores/editorStore.ts:543`.

Locked menonaktifkan dragging/transformer, tetapi double-click tetap membuka editor; updateTextElement tidak memeriksa locked. Shortcut Fit juga tidak memeriksa lock. Jika lock dimaksudkan melindungi elemen sebagaimana interaksi lainnya, jalur edit/fit ini perlu mengikuti kebijakan yang sama.

## Usulan kontrak perilaku

| Operasi | Perilaku yang disarankan |
| --- | --- |
| Add Text | Posisi di area aman halaman aktif; unit fisik konsisten; mode klik/drag untuk menentukan frame dapat ditambahkan terpisah |
| Resize frame | Ubah frame/reflow tanpa mengubah ukuran huruf; pertahankan handle lawan |
| Scale text | Aksi/modifier yang jelas untuk scaling proporsional; kebijakan padding, tracking, dan ukuran range terdefinisi |
| Fit Height to Text | Lebar tetap, tinggi sesuai layout aktual, reference point eksplisit |
| Fit Frame to Content | Ukuran mengikuti layout aktual; rotasi dan alignment dihitung pada koordinat lokal |
| Auto Size | Pilihan Off / Height / Width and Height, tersimpan per elemen; bukan effect yang selalu aktif |
| Overflow | Indikator overset saat auto-size off; kebijakan export/preflight yang jelas |
| Edit | Preview sesuai format yang dijanjikan; satu undo per sesi; cancel tidak menulis perubahan |
| Save / Load / Export | Rentang dan font sama; unit dan indeks karakter konsisten |

Urutan pengerjaan yang disarankan: perbaiki kehilangan styled ranges, konversi inch, dan posisi Add Text; benahi history; satukan layout/fitting; tetapkan resize/auto-size/anchor; kemudian samakan editor inline dan ekspor. Tidak perlu mengganti Tauri, SQLite, atau Konva. Perubahan schema untuk kebijakan auto-size baru perlu direncanakan dan didokumentasikan saat implementasi benar-benar dimulai.

## Verifikasi dan batas audit

- `npm test`: seluruh 10 berkas suite berhasil. Awalnya tsx gagal mengakses informasi pengguna Windows di sandbox; rerun di luar sandbox berhasil.
- Diagnostik terpisah menjalankan helper asli untuk unit font, rumus posisi, wordWrap fitting, newline rich text, shift ranges, dan history. Tidak mengubah album pengguna atau database.
- Pengukuran teks pada test Node menggunakan fallback `length × fontSize × 0.55` karena tidak ada DOM/canvas. Test tersebut tidak membuktikan ukuran glyph pada WebView sebenarnya.
- Belum dilakukan interaksi drag/caret di aplikasi desktop, load database end-to-end, atau pembandingan raster ekspor. Temuan persistence/export ditelusuri dari kode; hasil visual spesifik perlu diuji saat perbaikan.
- Test yang dibutuhkan: project mm/cm/inch/px dengan ukuran fisik sama; font 11/24/72 pt; plain/rich; frame berotasi; side/corner resize pada beberapa zoom; Fit berulang; whitespace/Unicode/IME; panel/slider undo; save/load asli; font offline; serta canvas dibanding hasil export.

ROADMAP menandai sejumlah kemampuan WYSIWYG, viewport invariance, dan fitting selesai. Bukti audit ini menunjukkan perlunya tiket koreksi dan acceptance tests sebelum klaim tersebut dianggap terverifikasi. ROADMAP tidak diubah dalam audit ini.
