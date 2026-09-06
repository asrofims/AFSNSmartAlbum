# IMPLEMENTASI AUTO UPDATE AFSNSMARTALBUM

Saya memiliki aplikasi desktop **AFSNSmartAlbum** yang dibuat menggunakan **Tauri + React**.

Saat ini aplikasi sudah memiliki mekanisme **manual update**, yaitu pengguna mendownload file `.exe` versi terbaru secara manual.

Saya ingin meningkatkan sistem tersebut menjadi:

> **AUTO UPDATE sebagai metode utama + MANUAL UPDATE sebagai fallback.**

Implementasi harus dilakukan secara aman dan **tidak boleh mengganggu fungsi aplikasi yang sudah berjalan**.

---

# 1. TUJUAN AKHIR

Target pengalaman pengguna:

```text
AFSNSmartAlbum
      │
      ▼
Cek versi terbaru
      │
      ├── Tidak ada update
      │       ↓
      │   Aplikasi berjalan normal
      │
      └── Ada update
              ↓
       Tampilkan notifikasi
              ↓
       [Nanti] [Update Sekarang]
                    │
                    ▼
             Download otomatis
                    │
                    ▼
           Verifikasi signature
                    │
                    ▼
             Install update
                    │
                    ▼
             Restart aplikasi
```

Pengguna **tidak perlu membuka browser atau mendownload EXE secara manual** dalam kondisi normal.

Namun mekanisme manual download `.exe` yang sudah ada **WAJIB tetap tersedia sebagai fallback**.

---

# 2. PRIORITAS UTAMA: JANGAN MERUSAK APLIKASI

Sebelum mengubah kode:

1. Analisis project secara menyeluruh.
2. Identifikasi versi Tauri.
3. Identifikasi versi React.
4. Identifikasi package manager.
5. Identifikasi struktur project.
6. Identifikasi konfigurasi Tauri.
7. Identifikasi mekanisme build saat ini.
8. Identifikasi mekanisme update manual yang saat ini digunakan.
9. Identifikasi halaman/menu About atau Settings yang relevan.
10. Identifikasi GitHub repository dan workflow yang sudah ada jika tersedia.

**JANGAN langsung mengubah kode sebelum memahami struktur project.**

Existing functionality harus dianggap sebagai **protected functionality**.

Jangan:

- melakukan refactor besar;
- mengganti framework;
- mengganti package manager;
- mengubah database;
- mengubah struktur penyimpanan file;
- mengubah sistem album;
- mengubah import foto;
- mengubah Filmstrip;
- mengubah Spread/Page;
- mengubah Canvas;
- mengubah rendering;
- mengubah routing;
- mengubah UI yang tidak berkaitan dengan updater.

Updater harus ditambahkan sebagai **modul yang terisolasi**.

---

# 3. PERTAHANKAN MANUAL UPDATE

Ini sangat penting.

Saat ini sudah ada sistem:

```text
User
 ↓
Download EXE
 ↓
Install versi baru
```

**JANGAN HAPUS SISTEM INI.**

Auto-update menjadi metode utama, sedangkan manual update menjadi fallback.

Target:

```text
                 GitHub Release
                       │
              ┌────────┴────────┐
              │                 │
         Auto Update       Manual Download
              │                 │
       Tauri Updater          Existing
              │                 │
              └────────┬────────┘
                       ↓
                AFSNSmartAlbum
```

Jika auto-update gagal, pengguna tetap dapat melakukan manual update.

---

# 4. GUNAKAN TAURI UPDATER RESMI

Gunakan mekanisme updater resmi yang kompatibel dengan versi Tauri yang digunakan project.

Jika project menggunakan Tauri v2, gunakan implementation Tauri v2 yang sesuai dengan versi package yang digunakan.

Jangan membuat updater custom menggunakan:

- PowerShell;
- Node.js downloader;
- fetch manual untuk EXE;
- menjalankan EXE hasil download secara langsung;
- atau mekanisme lain yang melewati signature verification Tauri.

Tujuannya adalah:

**secure signed update.**

---

# 5. SIGNING KEY

Updater harus menggunakan **Tauri updater signing**.

Jika signing key belum ada:

JANGAN membuat key palsu.

JANGAN commit private key.

JANGAN menyimpan private key di source code.

JANGAN memasukkan private key ke JavaScript bundle.

Berikan instruksi untuk membuat signing key menggunakan Tauri CLI.

Konsep:

```text
Private key
    ↓
Digunakan saat build/release
    ↓
Generate signed update
```

Public key:

```text
Public key
    ↓
Disimpan pada konfigurasi aplikasi
    ↓
Digunakan untuk verifikasi update
```

Private key harus disimpan secara aman dan, untuk GitHub Actions, menggunakan **GitHub Actions Secret**.

---

# 6. GITHUB RELEASE

Gunakan **GitHub Releases** sebagai server distribusi update.

Target:

```text
AFSNSmartAlbum
      ↓
GitHub Release
      ↓
Signed update artifact
      ↓
Update metadata
      ↓
Tauri Updater
```

Jangan menambahkan VPS atau server update khusus jika GitHub Releases sudah mencukupi.

Gunakan format release dan endpoint yang sesuai dengan versi Tauri Updater yang digunakan.

Jika repository owner/name belum diketahui dari project, gunakan placeholder dan jangan mengarang informasi.

---

# 7. AUTO CHECK UPDATE

Aplikasi harus dapat mengecek update secara otomatis.

Rekomendasi:

```text
Application startup
        ↓
Application initialization selesai
        ↓
Background check
        ↓
Update tersedia?
```

**Jangan membuat startup aplikasi menunggu GitHub.**

Jika GitHub lambat:

```text
Application starts normally
        +
Update check berjalan di background
```

Jika GitHub tidak dapat diakses:

```text
Update check failed
        ↓
Ignore gracefully
        ↓
Application continues normally
```

Jangan sampai kegagalan updater menyebabkan aplikasi crash.

---

# 8. JANGAN TERLALU SERING CHECK

Jangan melakukan polling terus-menerus.

Gunakan mekanisme yang wajar:

- check saat startup;
- manual "Check for Updates";
- optional cooldown/cache agar tidak request berulang.

Jangan melakukan request GitHub setiap beberapa detik.

---

# 9. MANUAL CHECK UPDATE

Tambahkan:

**About → Check for Updates**

Contoh:

```text
AFSNSmartAlbum

Version 1.5.0

[ Check for Updates ]
```

Jika sudah terbaru:

```text
You're using the latest version.
```

Jika tersedia:

```text
New version available: 1.6.0

[ Later ]    [ Update Now ]
```

Gunakan style UI AFSNSmartAlbum yang sudah ada.

Jangan membuat UI updater yang terlihat seperti aplikasi berbeda.

---

# 10. UPDATE UI

Jika update tersedia, tampilkan UI yang jelas tetapi tidak mengganggu pekerjaan pengguna.

Contoh:

```text
┌────────────────────────────────────┐
│ Update Available                   │
│                                    │
│ AFSNSmartAlbum 1.6.0 is available.│
│ Current version: 1.5.0             │
│                                    │
│ [ Later ]       [ Update Now ]     │
└────────────────────────────────────┘
```

Jika download:

```text
┌────────────────────────────────────┐
│ Downloading update...              │
│                                    │
│ ███████████████░░░░ 72%            │
│                                    │
│ 72 MB / 100 MB                     │
└────────────────────────────────────┘
```

Jika selesai:

```text
Update ready.

AFSNSmartAlbum will restart to complete
the update.

[ Restart Now ]
```

Jangan memaksa restart tanpa konfirmasi pengguna kecuali mekanisme updater Tauri mengharuskan behavior tertentu.

---

# 11. MANUAL UPDATE SEBAGAI FALLBACK

Ini wajib.

Jika auto-update gagal:

```text
Unable to install the update.

You can download the latest version manually.

[ Try Again ]    [ Manual Download ]
```

Tombol:

**Manual Download**

harus menggunakan mekanisme/manual download URL yang saat ini sudah digunakan aplikasi.

Jangan mengganti URL lama tanpa alasan.

Jangan menghapus mekanisme lama sebelum auto-update terbukti berfungsi.

---

# 12. AUTO UPDATE TIDAK BOLEH MEMBLOKIR APLIKASI

Contoh:

```text
GitHub unavailable
        ↓
No update information
        ↓
Continue application
```

```text
Download failed
        ↓
Cancel update
        ↓
Continue application
```

```text
User clicks Later
        ↓
Continue application
```

```text
User cancels
        ↓
Continue application
```

Semua kegagalan updater harus isolated dari aplikasi utama.

---

# 13. SECURITY

Update harus diverifikasi menggunakan signature.

Jangan hanya mengandalkan HTTPS.

Update harus ditolak jika:

- signature invalid;
- artifact corrupt;
- metadata invalid;
- download gagal;
- verification gagal.

Jika verification gagal:

```text
Update rejected
        ↓
Keep current version
```

Jangan pernah menjalankan update yang gagal diverifikasi.

---

# 14. VERSION MANAGEMENT

Periksa bagaimana project saat ini mengelola version.

Pastikan tidak terjadi:

```text
package.json     1.5.0
Cargo.toml       1.4.0
Tauri config     1.6.0
```

Gunakan mekanisme versioning existing jika memungkinkan.

Jangan membuat sistem versioning baru yang tidak diperlukan.

---

# 15. BUILD SYSTEM

Jangan merusak build `.exe` yang saat ini sudah berjalan.

Existing command:

```text
existing build command
```

harus tetap bekerja.

Tambahkan kebutuhan updater secara minimal.

Pastikan production build menghasilkan artifact yang diperlukan Tauri Updater.

---

# 16. GITHUB ACTIONS

Pertama-tama periksa apakah project sudah memiliki GitHub Actions.

Jika sudah:

- jangan mengganti workflow yang sudah ada secara agresif;
- tambahkan proses updater secara minimal;
- pertahankan existing release/build workflow.

Jika belum:

buat workflow release yang terpisah atau minimal.

Target:

```text
Git Tag
   ↓
GitHub Actions
   ↓
Build Tauri
   ↓
Sign updater artifact
   ↓
Generate update metadata
   ↓
Create GitHub Release
   ↓
Upload artifacts
```

Private signing key harus berasal dari GitHub Secret.

Jangan print secret ke log.

---

# 17. RELEASE MANUAL PERTAMA

Jangan langsung mengubah semuanya menjadi fully automated release.

Implementasikan terlebih dahulu agar dapat melakukan test:

```text
Installed:
AFSNSmartAlbum 1.0.0

GitHub Release:
AFSNSmartAlbum 1.0.1

Old application:
Check for Update
       ↓
Detect 1.0.1
       ↓
Download
       ↓
Verify
       ↓
Install
       ↓
Restart
       ↓
1.0.1
```

Setelah mekanisme ini terbukti stabil, baru optimalkan automation GitHub Actions.

---

# 18. ERROR HANDLING

Updater harus memiliki error handling yang aman.

Minimal handle:

- GitHub unavailable;
- no internet;
- timeout;
- update not found;
- download interrupted;
- signature verification failed;
- invalid metadata;
- user cancellation;
- installation failure.

Contoh:

```text
[Updater] Check failed
```

tidak boleh menyebabkan:

```text
Application crash
```

---

# 19. LOGGING

Tambahkan logging updater yang berguna untuk debugging:

```text
[Updater] Checking for updates...
[Updater] Current version: 1.5.0
[Updater] Latest version: 1.6.0
[Updater] Update available
[Updater] Download started
[Updater] Download progress: 50%
[Updater] Signature verified
[Updater] Update installed
```

Jangan pernah log:

- private key;
- GitHub token;
- GitHub Actions secret;
- credential.

---

# 20. TEST KOMPATIBILITAS

Setelah implementasi, lakukan test:

### Existing application

- aplikasi dapat dibuka;
- project dapat dibuka;
- album dapat dibuka;
- import foto tetap berfungsi;
- Filmstrip tetap berfungsi;
- Spread/Page tetap berfungsi;
- Canvas tetap berfungsi;
- existing save/load tetap berfungsi;
- existing export tetap berfungsi.

### Updater

- check update;
- update tersedia;
- tidak ada update;
- download progress;
- signature verification;
- install;
- restart;
- user memilih Later;
- user cancel;
- internet tidak tersedia;
- GitHub tidak tersedia;
- download gagal;
- signature invalid;
- manual fallback.

---

# 21. JANGAN HAPUS MANUAL UPDATE

Ini merupakan requirement permanen.

Setelah auto-update berhasil sekalipun:

**Jangan menghapus manual update.**

Manual update boleh dibuat lebih tersembunyi.

Contoh:

Normal:

```text
About

Version 1.5.0

[ Check for Updates ]
```

Jika auto-update gagal:

```text
Update failed.

[ Retry ]

More options:
[ Download manually ]
```

Dengan demikian:

**Auto-update = primary**

**Manual update = fallback**

---

# 22. SEBELUM IMPLEMENTASI

Sebelum mengubah file, tampilkan kepada saya:

## A. Project Analysis

```text
Tauri version:
React version:
Package manager:
Build system:
Existing update mechanism:
GitHub repository:
Existing GitHub Actions:
```

## B. Files to change

Tampilkan:

```text
File
Purpose
Expected change
Risk
```

## C. Dependencies

Tampilkan dependency yang akan ditambahkan dan alasannya.

Jangan menambahkan dependency jika tidak diperlukan.

## D. Signing setup

Jelaskan:

- bagaimana membuat signing key;
- file mana yang public;
- file mana yang private;
- di mana private key disimpan;
- bagaimana GitHub Actions menggunakan secret.

**Setelah analisis selesai, baru lakukan implementasi.**

---

# 23. ACCEPTANCE CRITERIA

Implementasi dianggap berhasil jika:

```text
✓ Existing application still works
✓ Existing manual update still works
✓ Auto update detects GitHub release
✓ Update is downloaded automatically
✓ Signature is verified
✓ Update installs correctly
✓ Application restarts correctly
✓ Failed update does not crash application
✓ GitHub unavailable does not crash application
✓ Manual fallback remains available
✓ Private signing key is never committed
✓ Existing build process remains functional
```

---

# 24. HASIL AKHIR YANG SAYA INGINKAN

Setelah selesai, berikan laporan:

```text
AFSNSmartAlbum Auto Update
==========================

Implementation:
✓ Tauri Updater
✓ GitHub Releases
✓ Signed updates
✓ Automatic update check
✓ Manual check
✓ Download progress
✓ Install/restart
✓ Error handling
✓ Manual fallback

Files changed:
- ...

Files added:
- ...

Dependencies:
- ...

Commands:
- Development: ...
- Production build: ...
- Release: ...

GitHub Secrets:
- ...

GitHub Release requirements:
- ...

Testing:
✓ ...
✓ ...
✓ ...

Remaining manual configuration:
- ...
```

Jika ada bagian yang belum dapat diverifikasi, **jangan menyatakan berhasil**. Jelaskan bagian tersebut secara jelas.

---

# FINAL PRINCIPLE

**STABILITY FIRST.**

AFSNSmartAlbum sudah memiliki fungsi yang berjalan.

Jangan melakukan perubahan besar hanya demi updater.

Updater harus menjadi fitur tambahan yang terisolasi.

**Auto-update harus menjadi jalur utama.**

**Manual EXE download harus tetap menjadi fallback.**

Jika terjadi konflik antara updater dan existing functionality:

> **Existing functionality harus selalu diprioritaskan.**

Hentikan perubahan yang berisiko dan jelaskan masalahnya sebelum melakukan refactor besar.