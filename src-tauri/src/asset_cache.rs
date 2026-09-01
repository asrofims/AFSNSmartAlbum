use crate::db::Database;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, PartialEq, Eq)]
pub struct CacheCleanupReport {
    pub removed_files: usize,
    pub reclaimed_bytes: u64,
}

pub fn cleanup_orphaned_photo_assets(
    app: &AppHandle,
    db: &Database,
) -> Result<CacheCleanupReport, String> {
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
            .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "jpg" | "jpeg" | "png" | "webp"))
            .unwrap_or(false)
}

fn cache_file_is_referenced(path: &Path, live_photo_ids: &HashSet<String>) -> bool {
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
        fs::write(previews.join("readme.txt"), b"keep").unwrap();

        let live_photo_ids = HashSet::from(["photo-live".to_string()]);
        let report = cleanup_asset_directories(&[thumbnails.clone(), previews.clone()], &live_photo_ids)
            .expect("Cache cleanup should succeed");

        assert_eq!(report.removed_files, 1);
        assert_eq!(report.reclaimed_bytes, 7);
        assert!(thumbnails.join("photo-live.jpg").exists());
        assert!(!previews.join("photo-orphan.jpg").exists());
        assert!(previews.join("readme.txt").exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
