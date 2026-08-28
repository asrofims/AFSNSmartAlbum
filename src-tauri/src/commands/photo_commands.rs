use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use rayon::prelude::*;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::db::{Database, PhotoRow};
use crate::photo_engine::{is_supported_image, process_photo, scan_directory};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgressPayload {
    pub current: usize,
    pub total: usize,
    pub current_file: String,
    pub percent: u8,
}

fn get_cache_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("afsn_cache"))
}

#[tauri::command]
pub async fn select_and_import_files(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<PhotoRow>, String> {
    // Open native file dialog on blocking pool so the UI thread doesn't freeze
    let files: Option<Vec<PathBuf>> = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Select Photos to Import")
            .add_filter(
                "Image Files (*.jpg, *.jpeg, *.png, *.webp, *.bmp, *.tiff)",
                &["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif"],
            )
            .pick_files()
    })
    .await
    .map_err(|e| e.to_string())?;

    match files {
        Some(paths) => import_paths_internal(app, project_id, paths).await,
        None => Ok(Vec::new()), // User cancelled
    }
}

#[tauri::command]
pub async fn select_and_import_folder(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<PhotoRow>, String> {
    // Open native folder dialog on blocking pool
    let folder: Option<PathBuf> = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Select Folder to Import Photos")
            .pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;

    match folder {
        Some(dir_path) => {
            let paths: Vec<PathBuf> = tauri::async_runtime::spawn_blocking(move || scan_directory(&dir_path))
                .await
                .map_err(|e| e.to_string())?;
            import_paths_internal(app, project_id, paths).await
        }
        None => Ok(Vec::new()), // User cancelled
    }
}

#[tauri::command]
pub async fn import_file_paths(
    app: AppHandle,
    project_id: String,
    paths: Vec<String>,
) -> Result<Vec<PhotoRow>, String> {
    let path_bufs: Vec<PathBuf> = tauri::async_runtime::spawn_blocking(move || {
        let mut result = Vec::new();
        for p in paths {
            let path = PathBuf::from(p);
            if path.is_dir() {
                result.extend(scan_directory(&path));
            } else if is_supported_image(&path) {
                result.push(path);
            }
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?;

    import_paths_internal(app, project_id, path_bufs).await
}

async fn import_paths_internal(
    app: AppHandle,
    project_id: String,
    paths: Vec<PathBuf>,
) -> Result<Vec<PhotoRow>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }

    let db = app.state::<Database>();

    // Filter out duplicates that already exist in this project
    let mut to_import: Vec<PathBuf> = Vec::new();
    for p in paths {
        let path_str = p.to_string_lossy().to_string();
        if let Ok(exists) = db.check_photo_exists_in_project(&project_id, &path_str) {
            if !exists {
                to_import.push(p);
            }
        } else {
            to_import.push(p);
        }
    }

    let total = to_import.len();
    if total == 0 {
        return db.get_photos_for_project(&project_id).map_err(|e| e.to_string());
    }

    let cache_dir = get_cache_dir(&app);
    let counter = Arc::new(AtomicUsize::new(0));

    // Emit initial progress notification
    let _ = app.emit(
        "photo-import-progress",
        ImportProgressPayload {
            current: 0,
            total,
            current_file: "Starting multi-core processing...".to_string(),
            percent: 0,
        },
    );

    let project_id_clone = project_id.clone();
    let app_for_thread = app.clone();

    // Run parallel decoding & thumbnail generation on Rayon thread pool
    let imported_rows: Vec<PhotoRow> = tauri::async_runtime::spawn_blocking(move || {
        let db_thread = app_for_thread.state::<Database>();
        let rows: Vec<PhotoRow> = to_import
            .into_par_iter()
            .filter_map(|path| {
                let photo_id = Uuid::new_v4().to_string();
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("photo")
                    .to_string();

                match process_photo(&path, &cache_dir, &photo_id) {
                    Ok(processed) => {
                        let row = PhotoRow {
                            id: photo_id,
                            project_id: project_id_clone.clone(),
                            file_path: processed.file_path,
                            file_name: processed.file_name,
                            file_size: processed.file_size,
                            width: processed.width,
                            height: processed.height,
                            format: processed.format,
                            thumbnail_path: processed.thumbnail_path,
                            thumbnail_base64: processed.thumbnail_base64,
                            preview_path: None,
                            is_favorite: false,
                            used_count: 0,
                            is_missing: false,
                            created_at: chrono_now(),
                            updated_at: chrono_now(),
                        };

                        // Insert into SQLite database
                        if let Err(e) = db_thread.add_photo(&row) {
                            log::error!("Failed to save photo to DB: {}", e);
                            None
                        } else {
                            let curr = counter.fetch_add(1, Ordering::SeqCst) + 1;
                            let percent = ((curr as f64 / total as f64) * 100.0).min(100.0) as u8;

                            // Emit real-time single item and overall progress
                            let _ = app_for_thread.emit("photo-imported", &row);
                            let _ = app_for_thread.emit(
                                "photo-import-progress",
                                ImportProgressPayload {
                                    current: curr,
                                    total,
                                    current_file: file_name,
                                    percent,
                                },
                            );

                            Some(row)
                        }
                    }
                    Err(e) => {
                        log::warn!("Skipping file {:?}: {}", path, e);
                        let curr = counter.fetch_add(1, Ordering::SeqCst) + 1;
                        let percent = ((curr as f64 / total as f64) * 100.0).min(100.0) as u8;
                        let _ = app_for_thread.emit(
                            "photo-import-progress",
                            ImportProgressPayload {
                                current: curr,
                                total,
                                current_file: format!("Skipped: {}", file_name),
                                percent,
                            },
                        );
                        None
                    }
                }
            })
            .collect();
        rows
    })
    .await
    .map_err(|e| e.to_string())?;

    log::info!("Imported {} new photos into project {}", imported_rows.len(), project_id);
    let _ = app.emit("photo-import-complete", serde_json::json!({ "total": total, "imported": imported_rows.len() }));

    // Re-query database using the managed state
    let db_final = app.state::<Database>();
    db_final.get_photos_for_project(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project_photos(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<PhotoRow>, String> {
    db.get_photos_for_project(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_photo_favorite(
    db: State<'_, Database>,
    photo_id: String,
    is_favorite: bool,
) -> Result<(), String> {
    db.toggle_photo_favorite(&photo_id, is_favorite).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_photo(
    db: State<'_, Database>,
    photo_id: String,
) -> Result<(), String> {
    db.delete_photo(&photo_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_missing_photos(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<PhotoRow>, String> {
    let photos = db.get_photos_for_project(&project_id).map_err(|e| e.to_string())?;
    for photo in &photos {
        let is_missing = !Path::new(&photo.file_path).exists();
        if is_missing != photo.is_missing {
            let _ = db.update_photo_missing(&photo.id, is_missing);
        }
    }
    db.get_photos_for_project(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn relink_folder(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<PhotoRow>, String> {
    let folder: Option<PathBuf> = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Select Folder Containing Missing Photos")
            .pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;

    let folder_path = match folder {
        Some(f) => f,
        None => {
            let db = app.state::<Database>();
            return db.get_photos_for_project(&project_id).map_err(|e| e.to_string());
        }
    };

    let db = app.state::<Database>();
    let photos = db.get_photos_for_project(&project_id).map_err(|e| e.to_string())?;
    let candidates: Vec<PathBuf> = tauri::async_runtime::spawn_blocking(move || scan_directory(&folder_path))
        .await
        .map_err(|e| e.to_string())?;

    for photo in photos {
        if photo.is_missing {
            if let Some(matching) = candidates.iter().find(|c| {
                c.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.eq_ignore_ascii_case(&photo.file_name))
                    .unwrap_or(false)
            }) {
                let new_path = matching.to_string_lossy().to_string();
                let _ = db.relink_photo(&photo.id, &new_path);
                log::info!("Relinked photo {} to {:?}", photo.file_name, new_path);
            }
        }
    }

    db.get_photos_for_project(&project_id).map_err(|e| e.to_string())
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    format!("{}", secs)
}
