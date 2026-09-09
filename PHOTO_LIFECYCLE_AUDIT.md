# Audit Impor, Thumbnail, dan Penghapusan Foto

Tanggal: 9 September 2026. Versi yang diperiksa: 1.0.39.

## Kesimpulan

Fondasi arsitektur sudah tepat untuk aplikasi album desktop: foto asli direferensikan, metadata disimpan di SQLite, cache gambar dipisahkan, dan impor memiliki antrean serta worker. Namun, mekanisme saat ini belum cukup andal untuk dinyatakan aman secara menyeluruh bagi pekerjaan profesional. Risiko utama terdapat pada konsistensi library–frame–database–file AFSN, identitas foto, serta koordinasi penghapusan dengan worker cache.

Pada jalur penghapusan library yang diperiksa, aplikasi menghapus record dan cache aplikasi; tidak memanggil penghapusan terhadap `photo.filePath` asli. Ini perlindungan yang baik. Namun, keamanan file asli tidak sama dengan keamanan isi dan status penyimpanan proyek.

Temuan F1–F10 di bawah adalah catatan kondisi sebelum perbaikan, bukan status kode terbaru. Implementasi inti tersedia dalam commit `6d7f7f4`; kelanjutan integrasi UI dan koleksi dijelaskan berikut ini.

## Status implementasi lanjutan — 9 September 2026

- Dialog hapus menyimpan snapshot ID proyek dan foto; indikator menyebut jumlah foto yang sedang dihapus, dan kegagalan tetap terlihat di dalam dialog. Jalur hapus koleksi memakai ID proyek milik koleksi dan mempertahankan dialog ketika gagal.
- Shortcut global workspace dan filmstrip diabaikan ketika dialog terbuka. Page Navigator sudah memiliki perlindungan ini sehingga tidak diubah lagi.
- Perubahan favorit diterapkan ke tampilan setelah database berhasil. Favorit dan perubahan koleksi memakai antrean persistence, memvalidasi proyek aktif, dan menandai data proyek belum disimpan; marker pemulihan tetap dicatat bila proyek sudah berganti selama operasi.
- Penambahan anggota koleksi dan pemindahan antar koleksi memakai transaksi backend, meneruskan kegagalan, dan menolak pencampuran proyek. Kegagalan membaca anggota koleksi tidak lagi mengganti daftar sebelumnya dengan daftar kosong.
- Error library ditampilkan dalam panel yang dapat ditutup pengguna. Toast hasil impor dan hapus tetap dipakai. Permintaan load folder/check-missing yang duplikat dari Filmstrip dihapus karena `loadPhotos` sudah menjalankannya.
- Dokumentasi ROADMAP disesuaikan untuk memisahkan implementasi dari verifikasi yang belum dilakukan.
- Pemeriksaan statis TypeScript (`npx tsc --noEmit`) dan Rust (`cargo check --lib`) berhasil. Tes otomatis, pengujian UI, stress test, dan simulasi kegagalan runtime untuk kelanjutan ini tidak dijalankan sesuai permintaan pengguna. Hasil tes pada bagian bukti berikut berasal dari audit awal sebelum implementasi.
- Verifikasi lanjutan yang masih diperlukan: hapus satu/banyak foto, kegagalan database/cache, impor dan pembatalan batch, relink ambigu, simpan/buka ulang favorit dan koleksi, serta penggunaan memori pada koleksi besar. Ini bukan klaim bahwa seluruh risiko input/konkurensi sudah tertutup.

## Cakupan dan bukti

- Ditinjau: photoStore, FilmstripTray, ConfirmDialog, album/history/project stores, Tauri photo commands, photo_engine, asset_cache, schema dan operasi SQLite, serta konfigurasi keamanan Tauri.
- `npm test`: lulus. Pesan kegagalan penulisan pada tes persistence merupakan kegagalan buatan yang memang diuji.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib --offline`: 26 lulus, 0 gagal.
- Probe sementara menggunakan store aplikasi asli dan Tauri mock mengonfirmasi: batch delete tanpa seleksi tidak memanggil backend; kegagalan single delete tidak diteruskan dan meninggalkan state terhapus; delete dapat mempertahankan `saveStatus=saved`; Undo lama dapat mengembalikan referensi foto tanpa record library. Probe dibuang setelah dijalankan.
- Jalur klik dialog ditelusuri dari source; belum dilakukan reproduksi visual pada aplikasi Tauri yang berjalan. Risiko konkurensi, file rusak, dan penggunaan memori di bawah merupakan temuan source review, bukan hasil stress test.
- Tes antrean yang ada di `tests/importQueue.test.ts:37` sebagian besar menguji simulasi state machine, bukan eksekusi store dan worker sesungguhnya. Kelulusan suite belum menutup celah dalam audit ini.

## Temuan prioritas

### F1 — P1: Konfirmasi hapus massal dapat menghapus seleksi sebelum operasi berjalan

Lokasi: `src/features/photos/FilmstripTray.tsx:109`, `:346`; `src/components/ui/ConfirmDialog.tsx:100`; `src/stores/photoStore.ts:685`.

Listener `pointerdown`/`mousedown` dalam fase capture mengosongkan seleksi saat klik di luar filmstrip. Pengecualian hanya mengenali `[role="dialog"]`, `.modal`, dan context menu. ConfirmDialog memakai `role="alertdialog"`, class CSS Modules, dan portal ke body; karenanya tombolnya berada di luar filmstrip dan tidak cocok dengan pengecualian tersebut.

Dialog sebenarnya sudah menyimpan ID target di `photoToDelete.ids`. Tetapi jalur batch mengabaikan snapshot tersebut dan memanggil `batchDeleteSelected(projectId)`, yang membaca `selectedPhotoIds` terkini. Setelah klik tombol, array sudah kosong dan fungsi langsung return. Dialog lalu ditutup tanpa IPC penghapusan. Ini menjelaskan gejala hapus massal tanpa hasil atau indikator proses yang terlihat. Penghapusan satu foto menggunakan ID snapshot sehingga tidak terkena no-op yang sama.

Perbaikan: teruskan daftar ID yang dikonfirmasi secara eksplisit ke satu operasi remove; lindungi interaksi `alertdialog` dari listener seleksi/shortcut. Jangan menggantungkan target operasi pada seleksi yang masih bisa berubah.

### F2 — P1: State dan frame berubah sebelum delete berhasil; error tidak sampai ke pengguna

Lokasi: `src/stores/photoStore.ts:525`, `:578`, `:589`, `:685`, `:743`, `:755`; `src-tauri/src/db/mod.rs:1296`, `:1351`.

Single dan batch delete terlebih dahulu menghilangkan foto dari state dan mengosongkan referensi foto/crop dalam semua spread. Penyimpanan frame dijalankan tanpa menunggu hasilnya. Baru kemudian record foto dihapus. Error single delete hanya dicetak; batch memuat ulang foto tetapi tidak memulihkan pengosongan frame. Pemanggil tetap menerima promise yang selesai normal.

Penghapusan record dan perubahan frame bukan satu transaksi. `spread_elements.photo_id` tidak memiliki foreign key ke photos. Kegagalan penyimpanan frame atau delete dapat menghasilkan frame kosong meskipun foto masih ada, atau referensi frame ke foto yang record-nya sudah terhapus.

Perbaikan: lakukan detach referensi frame, hapus membership, dan hapus record dalam transaksi backend yang terkoordinasi dengan persistence. Setelah commit, terapkan hasil ke store. Kembalikan error terstruktur; jangan melaporkan sukses bila transaksi gagal. Jangan mengandalkan optimistic mutation tanpa rollback lengkap.

### F3 — P1: Perubahan library dapat tetap berstatus saved; Undo dapat memulihkan referensi usang

Lokasi: `src/stores/photoStore.ts:345`, `:525`, `:685`; `src/stores/albumStore.ts:392`, `:410`; `src/App.tsx:138`.

Delete tidak menandai album sebagai unsaved. Jika proyek sebelumnya saved, checkpoint SQLite mempertahankan status saved. Bila foto belum dipakai di frame, bahkan tidak ada checkpoint album. Impor foto baru juga tidak secara eksplisit menandai perubahan library sebagai unsaved. Guard tutup aplikasi membaca saveStatus album, bukan perbedaan library. Akibatnya perubahan library bisa tidak memicu perlindungan unsaved meskipun file AFSN belum diperbarui.

Delete tidak memperbarui atau membersihkan snapshot Undo/Redo. Snapshot lama menyimpan photoId dan paths; Undo dapat memulihkan frame yang menunjuk foto yang sudah hilang dari library/cache. Ini bukan Undo penghapusan yang lengkap.

Perbaikan: perubahan library harus menaikkan revisi/dirty state proyek. Tentukan kebijakan Undo penghapusan yang konsisten: pemulihan metadata dan referensi terkait secara utuh, atau batas history yang dijelaskan jelas. Jangan meninggalkan snapshot dengan aset yang sudah tidak valid.

### F4 — P1: Nama file dipakai sebagai identitas foto dan dasar relink otomatis

Lokasi: `src-tauri/src/commands/photo_commands.rs:222`, `:274`, `:714`.

Foto sehat dianggap duplikat bila path sama ATAU nama file sama. Contoh: `CameraA/IMG_0001.jpg` dan `CameraB/IMG_0001.jpg` yang isinya berbeda; impor kedua dapat dilewati. Bila foto lama tidak sehat, pencocokan nama bisa memakai ulang ID dan mengganti path ke foto berbeda. Relink folder mengambil kandidat pertama berdasarkan nama; tidak ada resolusi konflik untuk beberapa nama sama. Relink juga tidak menyelaraskan seluruh metadata dimensi/ukuran/format.

Perbaikan: gunakan path kanonis sebagai identitas lokasi dan metadata/fingerprint untuk validasi identitas aset. Nama file hanya kandidat pencarian relink. Tampilkan konflik bila kandidat ambigu, dan perbarui metadata serta cache bersama ketika sumber benar-benar berubah.

### F5 — P1: Kegagalan impor dapat diperlakukan sebagai keberhasilan

Lokasi: `src-tauri/src/commands/photo_commands.rs:313`, `:322`, `:425`; `src-tauri/src/photo_engine/mod.rs:83`, `:307`; `src/domain/photo.ts:39`.

Event `photo-imported` dikirim sebelum transaksi insert berhasil. Hasil `add_photos_batch`, relink, serta update path cache diabaikan dengan `let _ =`. Worker bisa melaporkan preview siap meskipun pencatatan database gagal. Model hasil impor tidak memiliki jumlah/list kegagalan. File yang gagal dibaca dimensinya justru diberi dimensi 1920×1080; `process_photo` juga mengubah kegagalan preview menjadi `None` dan masih mengembalikan `Ok`.

Perbaikan: validasi file, commit registrasi sebelum mengumumkan keberhasilan, teruskan kegagalan database, dan tampilkan hasil per batch: imported, existing, failed, cancelled, beserta detail file gagal. Bedakan registered dari preview ready. Beri retry untuk kegagalan pemrosesan yang dapat dipulihkan.

### F6 — P1: Pembersihan cache tidak dikoordinasikan dengan penulis cache

Lokasi: `src-tauri/src/asset_cache.rs:21`, `:44`, `:74`; `src-tauri/src/commands/photo_commands.rs:645`, `:777`; `src-tauri/src/photo_engine/mod.rs:247`.

Setiap delete memindai direktori thumbnails/previews global. Semua `.tmp` dianggap yatim, termasuk file sementara yang sedang ditulis worker. Snapshot ID hidup dapat menjadi usang selama scan; thumbnail embedded juga dibuat sebelum record dimasukkan. Cleanup dapat mengganggu pemrosesan foto lain. Sebaliknya worker yang sudah berjalan saat foto dihapus dapat membuat kembali cache setelah cleanup selesai.

Database dihapus terlebih dahulu, lalu cleanup dipanggil dengan `?`. Jika file cache terkunci, command dapat mengembalikan error padahal record sudah terhapus. Hasil utama operasi bercampur dengan kegagalan pemeliharaan cache. Command delete masih sinkron dan scan mencakup cache proyek lain; berpotensi menghambat respons aplikasi ketika cache besar.

Perbaikan: cleanup terarah untuk aset yang dilepas, jalankan I/O berat di worker, koordinasikan penulis/penghapus per aset, dan jangan sentuh temporary file yang masih aktif. Pisahkan hasil `removed` dari `cleanupPending`/warning. Lakukan full orphan sweep pada waktu aman dengan pemeriksaan referensi yang valid.

### F7 — P2: Indikator delete belum lengkap dan dialog dapat ditutup ketika operasi berjalan

Lokasi: `src/features/photos/FilmstripTray.tsx:339`, `:753`; `src/components/ui/ConfirmDialog.tsx:96`, `:140`.

Indikator sebenarnya sudah ada: `isDeletingPhoto` mengubah label tombol menjadi `Processing...` dan menonaktifkan tombol. Tetapi tidak ada status tahapan, hasil sukses, maupun pesan gagal khusus delete. Pada no-op F1, status dapat berakhir sebelum sempat terlihat. Klik backdrop masih memanggil onCancel meskipun isLoading, sehingga indikator dapat hilang sementara pekerjaan tetap berjalan. Ini tidak membatalkan pekerjaan backend.

Perbaikan: gunakan label spesifik `Removing photos...`, tampilkan status yang dapat dibaca teknologi bantu, cegah dismissal yang menyesatkan selama commit, dan beri hasil akhir dengan jumlah aktual. Persentase hanya digunakan jika benar-benar diukur; transaksi singkat cukup memakai spinner/status indeterminate.

### F8 — P2: Filmstrip PNG/WebP bisa memakai preview 1500 px; thumbnail lama bisa tidak diperbarui

Lokasi: `src-tauri/src/photo_engine/mod.rs:274`, `:310`; `src-tauri/src/commands/photo_commands.rs:419`; `src/features/photos/FilmstripTray.tsx:580`.

Engine membuat thumbnail `.png` untuk format transparan, tetapi pemilih hasil hanya mencari `.jpg`, lalu fallback ke preview. Filmstrip menerima path preview sehingga dapat mendekode gambar 1500 px padahal tersedia thumbnail 320 px. Tes PNG saat ini hanya memeriksa path thumbnail ada dan ukuran preview; tidak menegaskan ukuran thumbnail yang benar-benar dikembalikan.

Thumbnail yang sudah ada tidak ditulis ulang saat generate preview. Foto relink tanpa embedded thumbnail bisa mempertahankan thumbnail dari sumber lama. Embedded thumbnail juga langsung disalin tanpa penerapan orientasi dan tanpa publication atomic yang dipakai preview.

Perbaikan: kembalikan path thumbnail aktual dari engine untuk semua format; uji dimensi hasil. Gunakan versi/fingerprint sumber untuk invalidasi, orientasi yang konsisten, serta publication atomic.

### F9 — P2: Pemulihan thumbnail menggunakan cancel flag global yang bisa masih aktif

Lokasi: `src-tauri/src/commands/photo_commands.rs:166`, `:600`; `src/stores/projectStore.ts:588`.

`cancelAllImports` dipanggil juga ketika tidak ada impor aktif dan backend menyalakan flag. `generate_missing_previews` memakai flag yang sama; flag baru dimatikan ketika memulai impor berikutnya. Maka pemulihan preview setelah membuka proyek dapat langsung berhenti. Healing satu thumbnail berjalan di jalur lain sehingga tidak membuktikan recovery batch sehat.

Perbaikan: token pembatalan per job/proyek dengan lifecycle eksplisit, dan koordinasikan recovery, relink, import, serta delete terhadap aset yang sama.

### F10 — P2: Batas resource dan validasi input belum cukup ketat

Lokasi: `src-tauri/src/photo_engine/mod.rs:41`, `:187`, `:251`; `src-tauri/tauri.conf.json:30`.

- Pipeline aktif menggunakan crate `image`, bukan libvips. `image::open` mendekode bitmap asli sebelum resize. Batas dua worker membatasi jumlah pekerjaan, belum membatasi total byte memori; batas decoder/default library tidak menggantikan anggaran memori gabungan. Pemanggilan trim working set terjadi setelah alokasi dan tidak mencegah lonjakan tersebut.
- Scan folder mengikuti direktori secara rekursif tanpa visited set, pemeriksaan symlink/junction, token cancel, atau pelaporan error scan. Struktur berulang/tidak dapat diakses membutuhkan penanganan eksplisit.
- Parser embedded EXIF belum menolak panjang segmen APP1 kurang dari 2 sebelum slicing. Data rusak dengan length 0/1 dapat membentuk rentang slice terbalik dan panic. Ini perlu guard serta tes file rusak; belum diuji secara dinamis dalam audit ini.
- Asset protocol memakai scope `**`; pemeriksaan string `/thumbnails/` di frontend bukan validasi akses filesystem. Batasi scope sesuai lokasi aset yang disetujui dan kebutuhan preview/export. Ini temuan least privilege, bukan bukti eksploitasi yang telah terjadi.

Perbaikan bertahap: validasi file/format/dimensi, perbaiki parser, batasi scan dan memori, kemudian evaluasi decoder yang dapat downsample saat membaca tanpa mengganti stack utama secara menyeluruh.

## Bagian yang sudah baik

- Pemisahan original, metadata SQLite, thumbnail, dan preview; UI filmstrip memakai lazy loading dan berusaha memakai cache.
- Antrean impor frontend dan mutex backend mencegah dua impor utama berjalan bersamaan.
- Worker utama dibatasi dua thread; preview memakai temporary file dan rename.
- SQL menggunakan parameter dan insert batch memakai transaksi; relasi folder memakai foreign key cascade.
- Konfirmasi penghapusan menjelaskan bahwa file asli tetap berada di disk.
- Tersedia missing-photo detection, relink, recovery preview, dan orphan cleanup sebagai fondasi; koordinasi dan pelaporan hasilnya perlu diperbaiki.

Catatan dokumentasi: ARCHITECTURE menyebut thumbnail 256 px/preview 1200 px dan libvips, sementara pipeline yang diperiksa memakai 320/1500 px serta crate image. Klaim durasi sub-milidetik dalam komentar/ROADMAP bukan hasil benchmark audit ini. Dokumentasi arsitektur belum diubah.

## Alur profesional yang direkomendasikan

1. Pisahkan istilah `Remove from Folder` dan `Remove from Library`. Jelaskan dampak pada jumlah frame/spread yang memakai foto; file asli tetap tersimpan. Model pemisahan katalog dan disk juga digunakan Lightroom: [Adobe — Common questions about Lightroom Classic](https://www.adobe.com/learn/lightroom-classic/web/common-questions-lightroom-classic).
2. Saat dialog dibuka, simpan project ID dan snapshot target ID. Konfirmasi mengeksekusi snapshot yang sama. Hindari seleksi baru atau perpindahan proyek mengubah target.
3. Tampilkan `Removing 24 photos...` selama operasi. Transaksikan data utama, lalu terapkan hasil dan dirty revision secara konsisten.
4. Setelah commit, tampilkan `24 photos removed from the library. Original files were kept.` Jika gagal, pertahankan state konsisten dan tampilkan pesan serta retry. Cleanup tertunda ditangani sebagai hasil terpisah.
5. Status proses/hasil/error harus tersedia bagi teknologi bantu, misalnya `role="status"` untuk pembaruan normal dan alert untuk kegagalan yang memerlukan perhatian. Acuan: [W3C — Understanding Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html).

Urutan implementasi yang disarankan: F1/F2/F3/F7 untuk memulihkan penghapusan dan integritas proyek; F4/F5 untuk identitas dan hasil impor; F6/F8/F9/F10 untuk lifecycle cache dan ketahanan input. Tambahkan tes integrasi terhadap store/command nyata dengan dependency mock yang terarah, lalu verifikasi klik UI dan stress test menggunakan foto fixture. Jangan menggunakan koleksi foto asli pengguna sebagai bahan uji destructive.
