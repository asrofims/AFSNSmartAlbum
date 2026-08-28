use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use rayon::prelude::*;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::db::{Database, PhotoFolderRow, PhotoRow};
use crate::photo_engine::{is_supported_image, process_photo, scan_directory};

#[derive(Clone, Default)]
pub struct ImportState {
    pub cancel_flag: Arc<AtomicBool>,
}

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
pub fn cancel_photo_import(state: State<'_, ImportState>) {
    log::info!("User requested cancellation of photo import");
    state.cancel_flag.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub async fn select_and_import_files(
    app: AppHandle,
    project_id: String,
    folder_id: Option<String>,
) -> Result<Vec<PhotoRow>, String> {
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
        Some(paths) => import_paths_internal(app, project_id, paths, folder_id).await,
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn select_and_import_folder(
    app: AppHandle,
    project_id: String,
    folder_id: Option<String>,
) -> Result<Vec<PhotoRow>, String> {
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
            import_paths_internal(app, project_id, paths, folder_id).await
        }
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn import_file_paths(
    app: AppHandle,
    project_id: String,
    paths: Vec<String>,
    folder_id: Option<String>,
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

    import_paths_internal(app, project_id, path_bufs, folder_id).await
}

async fn import_paths_internal(
    app: AppHandle,
    project_id: String,
    paths: Vec<PathBuf>,
    folder_id: Option<String>,
) -> Result<Vec<PhotoRow>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }

    let import_state = app.state::<ImportState>();
    import_state.cancel_flag.store(false, Ordering::SeqCst);
    let cancel_flag = import_state.cancel_flag.clone();

    let db = app.state::<Database>();
    let _ = db.ensure_project_exists(&project_id, "Untitled Album");

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

    let _ = app.emit(
        "photo-import-progress",
        ImportProgressPayload {
            current: 0,
            total,
            current_file: "Preparing photos...".to_string(),
            percent: 0,
        },
    );

    let project_id_clone = project_id.clone();
    let app_for_thread = app.clone();
    let cancel_for_thread = cancel_flag.clone();

    let imported_rows: Vec<PhotoRow> = tauri::async_runtime::spawn_blocking(move || {
        let db_thread = app_for_thread.state::<Database>();
        let rows: Vec<PhotoRow> = to_import
            .into_par_iter()
            .filter_map(|path| {
                if cancel_for_thread.load(Ordering::Relaxed) {
                    return None;
                }

                let photo_id = Uuid::new_v4().to_string();
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("photo")
                    .to_string();

                match process_photo(&path, &cache_dir, &photo_id) {
                    Ok(processed) => {
                        if cancel_for_thread.load(Ordering::Relaxed) {
                            return None;
                        }

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

                        if let Err(e) = db_thread.add_photo(&row) {
                            log::error!("Failed to save photo to DB: {}", e);
                            None
                        } else {
                            let curr = counter.fetch_add(1, Ordering::SeqCst) + 1;
                            let percent = ((curr as f64 / total as f64) * 100.0).min(100.0) as u8;

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

    let db_final = app.state::<Database>();

    // If a folder_id was specified, link all imported photos to that folder
    if let Some(fid) = folder_id {
        let imported_ids: Vec<String> = imported_rows.iter().map(|p| p.id.clone()).collect();
        if !imported_ids.is_empty() {
            let _ = db_final.add_photos_to_folder(&fid, &imported_ids);
        }
    }

    let is_cancelled = cancel_flag.load(Ordering::Relaxed);
    log::info!(
        "Import complete: {} photos added (cancelled: {})",
        imported_rows.len(),
        is_cancelled
    );

    let _ = app.emit(
        "photo-import-complete",
        serde_json::json!({
            "total": total,
            "imported": imported_rows.len(),
            "cancelled": is_cancelled
        }),
    );

    db_final.get_photos_for_project(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project_photos(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<PhotoRow>, String> {
    let _ = db.ensure_project_exists(&project_id, "Untitled Album");
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

// --- Batch Operations Commands ---

#[tauri::command]
pub fn batch_delete_photos(
    db: State<'_, Database>,
    photo_ids: Vec<String>,
) -> Result<(), String> {
    db.batch_delete_photos(&photo_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn batch_toggle_favorites(
    db: State<'_, Database>,
    photo_ids: Vec<String>,
    is_favorite: bool,
) -> Result<(), String> {
    db.batch_toggle_favorites(&photo_ids, is_favorite).map_err(|e| e.to_string())
}

// --- Photo Folder Commands ---

#[tauri::command]
pub fn create_photo_folder(
    db: State<'_, Database>,
    project_id: String,
    name: String,
) -> Result<PhotoFolderRow, String> {
    let folder_id = Uuid::new_v4().to_string();
    log::info!("Creating photo folder '{}' (id: {}) for project {}", name, folder_id, project_id);
    let _ = db.ensure_project_exists(&project_id, "Untitled Album");
    db.create_folder(&folder_id, &project_id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_photo_folders(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<PhotoFolderRow>, String> {
    let _ = db.ensure_project_exists(&project_id, "Untitled Album");
    db.get_folders_for_project(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_photo_folder(
    db: State<'_, Database>,
    folder_id: String,
    name: String,
) -> Result<(), String> {
    db.rename_folder(&folder_id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_photo_folder(
    db: State<'_, Database>,
    folder_id: String,
) -> Result<(), String> {
    db.delete_folder(&folder_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_photos_to_folder(
    db: State<'_, Database>,
    folder_id: String,
    photo_ids: Vec<String>,
) -> Result<(), String> {
    db.add_photos_to_folder(&folder_id, &photo_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_photos_from_folder(
    db: State<'_, Database>,
    folder_id: String,
    photo_ids: Vec<String>,
) -> Result<(), String> {
    db.remove_photos_from_folder(&folder_id, &photo_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_photos_between_folders(
    db: State<'_, Database>,
    from_folder_id: String,
    to_folder_id: String,
    photo_ids: Vec<String>,
) -> Result<(), String> {
    db.move_photos_between_folders(&from_folder_id, &to_folder_id, &photo_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_photos_for_folder(
    db: State<'_, Database>,
    folder_id: String,
) -> Result<Vec<PhotoRow>, String> {
    db.get_photos_for_folder(&folder_id).map_err(|e| e.to_string())
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    format!("{}", secs)
}
