use crate::db::Database;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

// All image jobs and cache cleanup take this lock before database/file work.
// A batch may use its own bounded worker pool while holding the job lock.
pub static PHOTO_ASSET_JOB: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn is_link_directory(path: &Path) -> bool {
    let Ok(metadata) = fs::symlink_metadata(path) else { return false; };
    if metadata.file_type().is_symlink() { return true; }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        return metadata.file_attributes() & 0x400 != 0;
    }
    #[cfg(not(windows))]
    false
}

pub fn prepare_cache_directory(cache_dir: &Path, folder: &str) -> Result<PathBuf, String> {
    let directory = cache_dir.join(folder);
    if is_link_directory(cache_dir) || is_link_directory(&directory) {
        return Err("The image cache must not be a symbolic link or junction.".to_string());
    }
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    Ok(directory)
}

pub fn validate_cache_id(id: &str) -> Result<(), String> {
    if id.is_empty() || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_') {
        return Err("Invalid photo cache identifier".to_string());
    }
    Ok(())
}

/// Caller holds PHOTO_ASSET_JOB. Only generated names for removed IDs are touched.
pub fn cleanup_removed_photo_assets(cache_dir: &Path, ids: &[String]) -> Vec<String> {
    let mut warnings = Vec::new();
    for id in ids {
        if let Err(error) = validate_cache_id(id) { warnings.push(error); continue; }
        for folder in ["thumbnails", "previews"] {
            let directory = cache_dir.join(folder);
            if is_link_directory(cache_dir) || is_link_directory(&directory) {
                warnings.push("Cache directory is a symbolic link; cleanup was skipped.".to_string());
                continue;
            }
            for extension in ["jpg", "jpeg", "png", "webp", "tmp"] {
                let path = directory.join(format!("{}.{}", id, extension));
                if let Err(error) = fs::remove_file(&path) {
                    if error.kind() != std::io::ErrorKind::NotFound {
                        warnings.push(format!("Cache cleanup deferred for {}: {}", path.display(), error));
                    }
                }
            }
        }
    }
    warnings
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct CacheCleanupReport {
    pub removed_files: usize,
    pub reclaimed_bytes: u64,
}

pub fn cleanup_orphaned_photo_assets(
    app: &AppHandle,
    db: &Database,
) -> Result<CacheCleanupReport, String> {
    let _job = PHOTO_ASSET_JOB.lock().map_err(|_| "Photo cache worker is unavailable".to_string())?;
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| format!("Failed to resolve application cache directory: {}", err))?;
    let live_photo_ids: HashSet<String> = db
        .get_photo_ids()
        .map_err(|err| format!("Failed to read photo cache references: {}", err))?
        .into_iter()
        .collect();

    cleanup_asset_directories(
        &[cache_dir.join("thumbnails"), cache_dir.join("previews")],
        &live_photo_ids,
    )
}

pub fn cleanup_asset_directories(
    directories: &[PathBuf],
    live_photo_ids: &HashSet<String>,
) -> Result<CacheCleanupReport, String> {
    let mut report = CacheCleanupReport::default();

    for directory in directories {
        if !directory.exists() {
            continue;
        }
        if is_link_directory(directory) || directory.parent().map(is_link_directory).unwrap_or(true) {
            continue;
        }

        let entries = fs::read_dir(directory)
            .map_err(|err| format!("Failed to read cache directory {}: {}", directory.display(), err))?;
        for entry in entries {
            let entry = entry.map_err(|err| format!("Failed to inspect cache entry: {}", err))?;
            let path = entry.path();
            if !is_generated_cache_asset(&path) || cache_file_is_referenced(&path, live_photo_ids) {
                continue;
            }

            let bytes = entry.metadata().map(|metadata| metadata.len()).unwrap_or(0);
            fs::remove_file(&path)
                .map_err(|err| format!("Failed to remove orphaned cache file {}: {}", path.display(), err))?;
            report.removed_files += 1;
            report.reclaimed_bytes += bytes;
        }
    }

    Ok(report)
}

fn is_generated_cache_asset(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "jpg" | "jpeg" | "png" | "webp" | "tmp"))
            .unwrap_or(false)
}

fn cache_file_is_referenced(path: &Path, live_photo_ids: &HashSet<String>) -> bool {
    // Any .tmp file is an incomplete temporary artifact and should always be cleaned up
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if ext.eq_ignore_ascii_case("tmp") {
            return false;
        }
    }

    path.file_stem()
        .and_then(|file_name| file_name.to_str())
        .map(|photo_id| live_photo_ids.contains(photo_id))
        .unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_only_orphaned_generated_photo_assets() {
        let temp_dir = std::env::temp_dir().join("afsn_asset_cache_cleanup_test");
        let _ = fs::remove_dir_all(&temp_dir);
        let thumbnails = temp_dir.join("thumbnails");
        let previews = temp_dir.join("previews");
        fs::create_dir_all(&thumbnails).unwrap();
        fs::create_dir_all(&previews).unwrap();

        fs::write(thumbnails.join("photo-live.jpg"), b"thumb").unwrap();
        fs::write(previews.join("photo-orphan.jpg"), b"preview").unwrap();
        fs::write(previews.join("photo-interrupted.tmp"), b"junk_tmp_bytes").unwrap();
        fs::write(previews.join("readme.txt"), b"keep").unwrap();

        let live_photo_ids = HashSet::from(["photo-live".to_string()]);
        let report = cleanup_asset_directories(&[thumbnails.clone(), previews.clone()], &live_photo_ids)
            .expect("Cache cleanup should succeed");

        assert_eq!(report.removed_files, 2);
        assert_eq!(report.reclaimed_bytes, 7 + 14);
        assert!(thumbnails.join("photo-live.jpg").exists());
        assert!(!previews.join("photo-orphan.jpg").exists());
        assert!(!previews.join("photo-interrupted.tmp").exists());
        assert!(previews.join("readme.txt").exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
