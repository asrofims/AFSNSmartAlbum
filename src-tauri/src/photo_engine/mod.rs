use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::ImageFormat;

pub struct ProcessedPhoto {
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub thumbnail_path: Option<String>,
    pub thumbnail_base64: Option<String>,
}

const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif"];

pub fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Recursively scans a directory for supported image files.
pub fn scan_directory(dir_path: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                files.extend(scan_directory(&path));
            } else if is_supported_image(&path) {
                files.push(path);
            }
        }
    }
    files
}

/// Inspects image metadata and generates a thumbnail cache + compact base64 preview.
/// Optimized for maximum throughput and minimal memory overhead.
pub fn process_photo(file_path: &Path, cache_dir: &Path, photo_id: &str) -> Result<ProcessedPhoto, String> {
    if !file_path.exists() {
        return Err(format!("File does not exist: {:?}", file_path));
    }

    let file_size = fs::metadata(file_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

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

    // Fast header-only dimension check first (reads only first few bytes of file)
    let (width, height) = match image::image_dimensions(file_path) {
        Ok(dims) => dims,
        Err(_) => {
            // Fallback: try opening image
            let img = image::open(file_path).map_err(|e| format!("Failed to decode image {}: {}", file_name, e))?;
            (img.width(), img.height())
        }
    };

    // Prepare thumbnail directory in cache
    let thumbs_dir = cache_dir.join("thumbnails");
    let _ = fs::create_dir_all(&thumbs_dir);
    let thumb_file_path = thumbs_dir.join(format!("{}.jpg", photo_id));

    // Generate thumbnail (max 220px) using fast downsampling
    let (thumb_path_str, base64_str) = match image::open(file_path) {
        Ok(img) => {
            let thumb = img.thumbnail(220, 220);

            // Encode to JPEG buffer once in memory
            let mut buffer = Cursor::new(Vec::with_capacity(16 * 1024));
            let base64_data = if thumb.write_to(&mut buffer, ImageFormat::Jpeg).is_ok() {
                let bytes = buffer.get_ref();
                // Write already-encoded JPEG bytes to disk cache in one fast I/O operation
                let _ = fs::write(&thumb_file_path, bytes);
                Some(format!("data:image/jpeg;base64,{}", BASE64.encode(bytes)))
            } else {
                None
            };

            (
                Some(thumb_file_path.to_string_lossy().to_string()),
                base64_data,
            )
        }
        Err(e) => {
            log::warn!("Could not generate thumbnail for {}: {}", file_name, e);
            (None, None)
        }
    };

    Ok(ProcessedPhoto {
        file_path: file_path.to_string_lossy().to_string(),
        file_name,
        file_size,
        width,
        height,
        format: format_str,
        thumbnail_path: thumb_path_str,
        thumbnail_base64: base64_str,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    #[test]
    fn test_photo_processing() {
        let temp_dir = std::env::temp_dir().join("afsn_test_photo_engine_opt");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let sample_img_path = temp_dir.join("sample.png");
        let mut img = RgbImage::new(400, 300);
        for pixel in img.pixels_mut() {
            *pixel = Rgb([200, 100, 50]);
        }
        img.save(&sample_img_path).unwrap();

        assert!(is_supported_image(&sample_img_path));

        let processed = process_photo(&sample_img_path, &temp_dir, "test-p1").expect("Processing failed");
        assert_eq!(processed.width, 400);
        assert_eq!(processed.height, 300);
        assert_eq!(processed.format, "png");
        assert!(processed.thumbnail_base64.is_some());
        assert!(processed.thumbnail_path.is_some());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
