use std::fs;
use std::path::{Path, PathBuf};
use image::ImageFormat;

#[derive(Debug, Clone)]
pub struct PhotoMetadata {
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

#[allow(dead_code)]
pub struct ProcessedPhoto {
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub thumbnail_path: Option<String>,
    pub preview_path: Option<String>,
    pub thumbnail_base64: Option<String>,
}

pub const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif"];
/// Working image for the canvas: 1500 px maximum dimension. Decoded memory depends on pixel format.
pub const CANVAS_PREVIEW_MAX_SIZE: u32 = 1500;
/// Filmstrip and spread thumbnail: 320 px maximum dimension.
pub const FILMSTRIP_THUMBNAIL_MAX_SIZE: u32 = 320;
// Keep only one original bitmap in the decode/resize stage. Encoding small
// derivatives still runs concurrently in the import pool.
static ORIGINAL_DECODE: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn scan_directory(dir_path: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let mut pending = vec![dir_path.to_path_buf()];
    let mut visited = std::collections::HashSet::new();
    while let Some(directory) = pending.pop() {
        let canonical = fs::canonicalize(&directory).map_err(|e| format!("Cannot access {}: {}", directory.display(), e))?;
        if !visited.insert(canonical) { continue; }
        let entries = fs::read_dir(&directory).map_err(|e| format!("Cannot read {}: {}", directory.display(), e))?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
            if metadata.file_type().is_symlink() { continue; }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if metadata.file_attributes() & 0x400 != 0 { continue; } // Junction/reparse point
            }
            if metadata.is_dir() {
                pending.push(path);
            } else if metadata.is_file() && is_supported_image(&path) {
                files.push(path);
            }
            if files.len() + pending.len() + visited.len() > 100_000 {
                return Err("This folder is too large to scan at once. Import smaller subfolders.".to_string());
            }
        }
    }
    files.sort();
    Ok(files)
}

/// Read dimensions and EXIF metadata without decoding the original bitmap.
pub fn extract_photo_metadata(file_path: &Path) -> Result<PhotoMetadata, String> {
    if !file_path.is_file() || !is_supported_image(file_path) {
        return Err(format!("Not a supported image file: {}", file_path.display()));
    }

    let file_size = fs::metadata(file_path)
        .map_err(|e| e.to_string())?.len() as i64;

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let format_str = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    // Fast header-only dimension check
    let (mut width, mut height) = image::image_dimensions(file_path)
        .map_err(|e| format!("Cannot read image dimensions for {}: {}", file_path.display(), e))?;
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > 100_000_000 {
        return Err("Image dimensions exceed the supported 100 megapixel working limit.".to_string());
    }

    let orientation = crate::export_engine::get_image_exif_orientation(file_path);
    if matches!(orientation, 5..=8) {
        std::mem::swap(&mut width, &mut height);
    }

    Ok(PhotoMetadata {
        file_path: file_path.to_string_lossy().to_string(),
        file_name,
        file_size,
        width,
        height,
        format: format_str,
    })
}

/// Helper to parse IFD1 JPEG thumbnail offset & length from raw TIFF header bytes.
fn parse_ifd1_thumbnail_offset_and_len(tiff: &[u8]) -> Option<(usize, usize)> {
    if tiff.len() < 8 {
        return None;
    }
    let is_little_endian = match &tiff[0..4] {
        [b'I', b'I', 0x2A, 0x00] => true,
        [b'M', b'M', 0x00, 0x2A] => false,
        _ => return None,
    };

    let read_u16 = |buf: &[u8], offset: usize| -> Option<u16> {
        if offset + 2 > buf.len() { return None; }
        let b = [buf[offset], buf[offset + 1]];
        Some(if is_little_endian { u16::from_le_bytes(b) } else { u16::from_be_bytes(b) })
    };
    let read_u32 = |buf: &[u8], offset: usize| -> Option<u32> {
        if offset + 4 > buf.len() { return None; }
        let b = [buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]];
        Some(if is_little_endian { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
    };

    let ifd0_offset = read_u32(tiff, 4)? as usize;
    if ifd0_offset >= tiff.len() { return None; }

    let ifd0_entries = read_u16(tiff, ifd0_offset)? as usize;
    let next_ifd_offset_pos = ifd0_offset + 2 + ifd0_entries * 12;
    let ifd1_offset = read_u32(tiff, next_ifd_offset_pos)? as usize;
    if ifd1_offset == 0 || ifd1_offset >= tiff.len() {
        return None;
    }

    let ifd1_entries = read_u16(tiff, ifd1_offset)? as usize;
    let mut thumb_offset = None;
    let mut thumb_len = None;

    for i in 0..ifd1_entries {
        let entry_pos = ifd1_offset + 2 + i * 12;
        if entry_pos + 12 > tiff.len() { break; }
        let tag = read_u16(tiff, entry_pos)?;
        let val_offset = read_u32(tiff, entry_pos + 8)?;

        if tag == 0x0201 { // JPEGInterchangeFormat
            thumb_offset = Some(val_offset as usize);
        } else if tag == 0x0202 { // JPEGInterchangeFormatLength
            thumb_len = Some(val_offset as usize);
        }
    }

    match (thumb_offset, thumb_len) {
        (Some(off), Some(len)) if off > 0 && len > 0 => Some((off, len)),
        _ => None,
    }
}

/// Decode only the embedded JPEG thumbnail, normalize orientation, and publish a bounded first look.
pub fn extract_embedded_thumbnail(file_path: &Path, cache_dir: &Path, photo_id: &str) -> Option<String> {
    crate::asset_cache::validate_cache_id(photo_id).ok()?;
    use std::io::Read;
    let mut file = fs::File::open(file_path).ok()?;
    let mut buffer = vec![0u8; 131072]; // Read first 128KB header
    let bytes_read = file.read(&mut buffer).ok()?;
    if bytes_read < 16 || buffer[0] != 0xFF || buffer[1] != 0xD8 {
        return None;
    }
    buffer.truncate(bytes_read);

    let mut cursor = 2;
    while cursor + 4 < buffer.len() {
        if buffer[cursor] != 0xFF {
            break;
        }
        let marker = buffer[cursor + 1];
        if marker == 0xDA || marker == 0xD9 {
            break;
        }
        let length = u16::from_be_bytes([buffer[cursor + 2], buffer[cursor + 3]]) as usize;
        if length < 2 || cursor + 2 + length > buffer.len() { break; }
        if marker == 0xE1 {
            let app1_data = &buffer[cursor + 4 .. cursor + 2 + length];
            if app1_data.len() > 14 && &app1_data[0..6] == b"Exif\0\0" {
                let tiff_data = &app1_data[6..];
                if let Some((offset, len)) = parse_ifd1_thumbnail_offset_and_len(tiff_data) {
                    if offset + len <= tiff_data.len() {
                        let thumb_bytes = &tiff_data[offset .. offset + len];
                        if thumb_bytes.len() >= 4 && thumb_bytes[0] == 0xFF && thumb_bytes[1] == 0xD8 {
                            let thumbs_dir = crate::asset_cache::prepare_cache_directory(cache_dir, "thumbnails").ok()?;
                            let target_path = thumbs_dir.join(format!("{}.jpg", photo_id));
                            let temporary = thumbs_dir.join(format!("{}.tmp", photo_id));
                            let mut reader = image::ImageReader::new(std::io::Cursor::new(thumb_bytes)).with_guessed_format().ok()?;
                            let mut limits = image::Limits::default();
                            limits.max_alloc = Some(16 * 1024 * 1024);
                            reader.limits(limits);
                            let mut thumbnail = reader.decode().ok()?;
                            let orientation = crate::export_engine::get_image_exif_orientation(file_path);
                            if orientation > 1 { thumbnail = crate::export_engine::apply_exif_orientation(thumbnail, orientation); }
                            let thumbnail = thumbnail.resize(FILMSTRIP_THUMBNAIL_MAX_SIZE, FILMSTRIP_THUMBNAIL_MAX_SIZE, image::imageops::FilterType::Triangle);
                            if thumbnail.save_with_format(&temporary, ImageFormat::Jpeg).is_ok() && fs::rename(&temporary, &target_path).is_ok() {
                                return Some(target_path.to_string_lossy().to_string());
                            }
                            let _ = fs::remove_file(&temporary);
                        }
                    }
                }
            }
        }
        cursor += 2 + length;
    }
    None
}

/// Generates a lightweight 1500px JPEG/PNG canvas preview file in the background.
/// Uses atomic write via .tmp file and drops uncompressed source bitmap from RAM immediately.
pub fn generate_photo_preview(
    file_path: &Path,
    cache_dir: &Path,
    photo_id: &str,
    is_cancelled: &std::sync::atomic::AtomicBool,
) -> Result<String, String> {
    use std::sync::atomic::Ordering;
    crate::asset_cache::validate_cache_id(photo_id)?;
    extract_photo_metadata(file_path)?;

    if is_cancelled.load(Ordering::Relaxed) {
        return Err("Cancelled".to_string());
    }

    if !file_path.exists() {
        return Err(format!("File does not exist: {:?}", file_path));
    }

    let format_str = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    let is_transparent_format = matches!(
        format_str.as_str(),
        "png" | "webp" | "gif" | "svg" | "ico"
    );

    let (ext, target_format) = if is_transparent_format {
        ("png", ImageFormat::Png)
    } else {
        ("jpg", ImageFormat::Jpeg)
    };

    let previews_dir = crate::asset_cache::prepare_cache_directory(cache_dir, "previews")?;
    let preview_file_path = previews_dir.join(format!("{}.{}", photo_id, ext));
    let tmp_file_path = previews_dir.join(format!("{}.tmp", photo_id));

    let decode_guard = ORIGINAL_DECODE.lock().map_err(|_| "Image decoder is unavailable".to_string())?;
    if is_cancelled.load(Ordering::Relaxed) { return Err("Cancelled".to_string()); }
    let mut reader = image::ImageReader::open(file_path).map_err(|e| e.to_string())?;
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(512 * 1024 * 1024);
    reader.limits(limits);
    let mut img = reader.decode().map_err(|e| format!("Failed to decode image within memory limits: {}", e))?;
    let orientation = crate::export_engine::get_image_exif_orientation(file_path);
    if orientation > 1 {
        img = crate::export_engine::apply_exif_orientation(img, orientation);
    }

    if is_cancelled.load(Ordering::Relaxed) {
        return Err("Cancelled".to_string());
    }

    // 1500px max dimension for Canvas Editor working image
    let resized = img.resize(
        CANVAS_PREVIEW_MAX_SIZE,
        CANVAS_PREVIEW_MAX_SIZE,
        image::imageops::FilterType::Triangle,
    );

    // Instantly drop full-resolution uncompressed source bitmap from RAM immediately!
    drop(img);
    drop(decode_guard);

    // Always replace the thumbnail after decoding; embedded/stale previews are only a first look.
    let thumbs_dir = crate::asset_cache::prepare_cache_directory(cache_dir, "thumbnails")?;
    let thumb_file_path = thumbs_dir.join(format!("{}.{}", photo_id, ext));
    {
        fs::create_dir_all(&thumbs_dir).map_err(|e| e.to_string())?;
        let thumb_resized = resized.resize(
            FILMSTRIP_THUMBNAIL_MAX_SIZE,
            FILMSTRIP_THUMBNAIL_MAX_SIZE,
            image::imageops::FilterType::Triangle,
        );
        let thumb_tmp_path = thumbs_dir.join(format!("{}.tmp", photo_id));
        let result = thumb_resized.save_with_format(&thumb_tmp_path, target_format)
            .map_err(|e| e.to_string()).and_then(|_| fs::rename(&thumb_tmp_path, &thumb_file_path).map_err(|e| e.to_string()));
        let _ = fs::remove_file(&thumb_tmp_path);
        result?;
    }

    if is_cancelled.load(Ordering::Relaxed) { return Err("Cancelled".to_string()); }

    // Atomic write for canvas preview: write to .tmp then atomic rename
    if let Err(e) = resized.save_with_format(&tmp_file_path, target_format) {
        let _ = fs::remove_file(&tmp_file_path);
        return Err(format!("Failed to save preview: {}", e));
    }

    if let Err(e) = fs::rename(&tmp_file_path, &preview_file_path) {
        let _ = fs::remove_file(&tmp_file_path);
        return Err(format!("Failed to finalize preview file: {}", e));
    }

    Ok(preview_file_path.to_string_lossy().to_string())
}

/// Single Universal Compressed Preview Engine (Full synchronous helper for single-item healing/relinking):
pub fn process_photo(file_path: &Path, cache_dir: &Path, photo_id: &str) -> Result<ProcessedPhoto, String> {
    let meta = extract_photo_metadata(file_path)?;
    let dummy_cancel = std::sync::atomic::AtomicBool::new(false);
    let preview_path_str = generate_photo_preview(file_path, cache_dir, photo_id, &dummy_cancel)?;
    let final_thumb = thumbnail_for_preview(cache_dir, photo_id, &preview_path_str)?;

    Ok(ProcessedPhoto {
        file_path: meta.file_path,
        file_name: meta.file_name,
        file_size: meta.file_size,
        width: meta.width,
        height: meta.height,
        format: meta.format,
        thumbnail_path: Some(final_thumb),
        preview_path: Some(preview_path_str),
        thumbnail_base64: None,
    })
}

pub fn thumbnail_for_preview(cache_dir: &Path, photo_id: &str, preview: &str) -> Result<String, String> {
    crate::asset_cache::validate_cache_id(photo_id)?;
    let extension = Path::new(preview).extension().and_then(|e| e.to_str()).ok_or("Invalid preview format")?;
    let path = cache_dir.join("thumbnails").join(format!("{}.{}", photo_id, extension));
    if !path.is_file() { return Err("The thumbnail could not be generated.".to_string()); }
    Ok(path.to_string_lossy().to_string())
}

/// Forcefully trims and returns unused virtual memory pages from the process working set back to the OS.
/// Crucial after large image-processing workloads on Windows to prevent allocator memory retention.
pub fn trim_process_memory() {
    #[cfg(target_os = "windows")]
    {
        extern "system" {
            fn GetCurrentProcess() -> isize;
            fn EmptyWorkingSet(hProcess: isize) -> i32;
            fn SetProcessWorkingSetSize(hProcess: isize, dwMinimumWorkingSetSize: usize, dwMaximumWorkingSetSize: usize) -> i32;
        }
        unsafe {
            let process = GetCurrentProcess();
            EmptyWorkingSet(process);
            SetProcessWorkingSetSize(process, usize::MAX, usize::MAX);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    #[test]
    fn test_photo_processing() {
        let temp_dir = std::env::temp_dir().join("afsn_test_photo_engine_stable");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let sample_img_path = temp_dir.join("sample.png");
        let mut img = RgbImage::new(1600, 800);
        for pixel in img.pixels_mut() {
            *pixel = Rgb([200, 100, 50]);
        }
        img.save(&sample_img_path).unwrap();

        assert!(is_supported_image(&sample_img_path));

        let processed = process_photo(&sample_img_path, &temp_dir, "test-p1").expect("Processing failed");
        assert_eq!(processed.width, 1600);
        assert_eq!(processed.height, 800);
        assert_eq!(processed.format, "png");
        assert!(processed.thumbnail_path.is_some());
        let preview_path = processed.preview_path.expect("Canvas preview should be generated");
        let preview_dimensions = image::image_dimensions(preview_path).expect("Preview should be readable");
        assert_eq!(preview_dimensions, (1500, 750));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_png_transparency_preservation() {
        use image::{Rgba, RgbaImage};

        let temp_dir = std::env::temp_dir().join("afsn_test_png_transparency");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let sample_png_path = temp_dir.join("transparent_logo.png");
        let mut img = RgbaImage::new(400, 400);
        // Half opaque, half fully transparent
        for (x, _y, pixel) in img.enumerate_pixels_mut() {
            if x < 200 {
                *pixel = Rgba([255, 0, 0, 255]); // Red opaque
            } else {
                *pixel = Rgba([0, 0, 0, 0]); // Fully transparent
            }
        }
        img.save(&sample_png_path).unwrap();

        let processed = process_photo(&sample_png_path, &temp_dir, "test-trans-1").expect("Processing failed");
        let preview_path = processed.preview_path.expect("Preview should exist");
        assert!(preview_path.ends_with(".png"), "Preview for transparent PNG must be .png");

        let loaded_preview = image::open(&preview_path).expect("Must open preview").to_rgba8();
        // Check transparent half
        let transparent_pixel = loaded_preview.get_pixel(loaded_preview.width() - 10, loaded_preview.height() / 2);
        assert_eq!(transparent_pixel[3], 0, "Alpha must be 0 for transparent region in preview");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_extract_metadata_and_cancelable_preview() {
        let temp_dir = std::env::temp_dir().join("afsn_test_meta_cancel");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let sample_img_path = temp_dir.join("sample_meta.jpg");
        let mut img = RgbImage::new(1200, 900);
        for pixel in img.pixels_mut() {
            *pixel = Rgb([50, 100, 150]);
        }
        img.save(&sample_img_path).unwrap();

        let meta = extract_photo_metadata(&sample_img_path).expect("Metadata extraction failed");
        assert_eq!(meta.width, 1200);
        assert_eq!(meta.height, 900);
        assert_eq!(meta.format, "jpg");
        assert!(meta.file_size > 0);

        // Test normal preview generation
        let cancel_flag = std::sync::atomic::AtomicBool::new(false);
        let preview = generate_photo_preview(&sample_img_path, &temp_dir, "test-meta-p1", &cancel_flag)
            .expect("Preview generation failed");
        assert!(Path::new(&preview).exists());

        // Test cancellation before execution
        let cancel_flag_cancelled = std::sync::atomic::AtomicBool::new(true);
        let cancel_res = generate_photo_preview(&sample_img_path, &temp_dir, "test-meta-p2", &cancel_flag_cancelled);
        assert!(cancel_res.is_err());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
