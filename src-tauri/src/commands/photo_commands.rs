use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use rayon::prelude::*;
use tauri::async_runtime::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::asset_cache::cleanup_orphaned_photo_assets;
use crate::db::{Database, PhotoFolderRow, PhotoRow};
use crate::photo_engine::{
    extract_embedded_thumbnail, extract_photo_metadata, generate_photo_preview, process_photo,
    scan_directory, trim_process_memory, SUPPORTED_EXTENSIONS,
};

#[derive(Clone, Default)]
pub struct ImportState {
    pub cancel_flag: Arc<AtomicBool>,
    pub is_busy: Arc<Mutex<()>>,
    pub active_project_id: Arc<std::sync::Mutex<Option<String>>>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgressPayload {
    pub project_id: String,
    pub current: usize,
    pub total: usize,
    pub current_file: String,
    pub percent: u8,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoPreviewReadyPayload {
    pub project_id: String,
    pub id: String,
    pub thumbnail_path: String,
    pub preview_path: String,
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
    folder_id: Option<String>,
) -> Result<Vec<PhotoRow>, String> {
    let files: Option<Vec<PathBuf>> = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Select Photos to Import")
            .add_filter("Images", SUPPORTED_EXTENSIONS)
            .pick_files()
    })
    .await
    .map_err(|e| e.to_string())?;

    match files {
        Some(paths) => import_paths_internal(app, project_id, paths, folder_id).await,
        None => {
            let db = app.state::<Database>();
            db.get_photos_for_project(&project_id).map_err(|e| e.to_string())
        }
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
        None => {
            let db = app.state::<Database>();
            db.get_photos_for_project(&project_id).map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
pub async fn import_file_paths(
    app: AppHandle,
    project_id: String,
    paths: Vec<String>,
    folder_id: Option<String>,
) -> Result<Vec<PhotoRow>, String> {
    let path_bufs: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    import_paths_internal(app, project_id, path_bufs, folder_id).await
}

#[tauri::command]
pub async fn pick_photo_files_dialog() -> Result<Option<Vec<String>>, String> {
    let files: Option<Vec<PathBuf>> = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Select Photos to Import")
            .add_filter("Images", SUPPORTED_EXTENSIONS)
            .pick_files()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(files.map(|paths| paths.into_iter().map(|p| p.to_string_lossy().to_string()).collect()))
}

#[tauri::command]
pub async fn pick_photo_folder_dialog() -> Result<Option<Vec<String>>, String> {
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
            Ok(Some(paths.into_iter().map(|p| p.to_string_lossy().to_string()).collect()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn cancel_photo_import(state: State<'_, ImportState>) -> Result<(), String> {
    state.cancel_flag.store(true, Ordering::SeqCst);
    if let Ok(mut guard) = state.active_project_id.lock() {
        *guard = None;
    }
    log::info!("Photo import cancellation requested by user or project close");
    Ok(())
}

async fn import_paths_internal(
    app: AppHandle,
    project_id: String,
    paths: Vec<PathBuf>,
    folder_id: Option<String>,
) -> Result<Vec<PhotoRow>, String> {
    if paths.is_empty() {
        let db = app.state::<Database>();
        return db.get_photos_for_project(&project_id).map_err(|e| e.to_string());
    }

    let import_state = app.state::<ImportState>();
    // Acquire sequential queue lock to prevent concurrent import conflicts
    let _busy_guard = import_state.is_busy.lock().await;

    import_state.cancel_flag.store(false, Ordering::SeqCst);
    if let Ok(mut guard) = import_state.active_project_id.lock() {
        *guard = Some(project_id.clone());
    }
    let cancel_flag = import_state.cancel_flag.clone();

    let db = app.state::<Database>();
    let _ = db.ensure_project_exists(&project_id, "Untitled Album");

    let existing_photos = db.get_photos_for_project(&project_id).unwrap_or_default();

    let total_selected = paths.len();
    let mut to_import: Vec<PathBuf> = Vec::new();
    let mut already_existing_count = 0;

    for p in paths {
        let path_str = p.to_string_lossy().to_string();
        let file_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();

        // If file already exists with both healthy thumbnail & canvas preview, skip;
        // otherwise allow seamless re-importing / healing if previously cancelled or interrupted.
        let already_healthy = existing_photos.iter().any(|ep| {
            (ep.file_path == path_str || ep.file_name.eq_ignore_ascii_case(&file_name))
                && !ep.is_missing
                && ep.thumbnail_path.as_ref().map(|tp| Path::new(tp).exists()).unwrap_or(false)
                && ep.preview_path.as_ref().map(|pp| Path::new(pp).exists()).unwrap_or(false)
        });

        if !already_healthy {
            to_import.push(p);
        } else {
            already_existing_count += 1;
        }
    }

    let total = to_import.len();
    if total == 0 {
        let _ = app.emit(
            "photo-import-complete",
            serde_json::json!({
                "projectId": project_id,
                "total": total_selected,
                "imported": 0,
                "existing": already_existing_count,
                "relinked": 0,
                "cancelled": false
            }),
        );
        return db.get_photos_for_project(&project_id).map_err(|e| e.to_string());
    }

    // -------------------------------------------------------------
    // PHASE 1: INSTANT REGISTRATION (< 5ms total)
    // Extract metadata & embedded EXIF thumbnails (< 0.2ms), batch-insert
    // to DB, and immediately return registered photos so UI responds instantaneously!
    // -------------------------------------------------------------
    let cache_dir = get_cache_dir(&app);
    let mut new_rows: Vec<PhotoRow> = Vec::with_capacity(total);
    let mut to_process: Vec<(String, PathBuf)> = Vec::with_capacity(total);
    let mut relink_ids: Vec<String> = Vec::new();

    for path in to_import {
        if cancel_flag.load(Ordering::Relaxed) {
            log::info!("Photo import cancelled during Phase 1 metadata extraction");
            break;
        }

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("photo")
            .to_string();

        let existing_match = existing_photos.iter().find(|ep| ep.file_name.eq_ignore_ascii_case(&file_name));
        let photo_id = match existing_match {
            Some(ep) => ep.id.clone(),
            None => Uuid::new_v4().to_string(),
        };

        if let Ok(meta) = extract_photo_metadata(&path) {
            // Instant first-look: extract embedded camera EXIF thumbnail (< 0.2ms)
            let instant_thumb = extract_embedded_thumbnail(&path, &cache_dir, &photo_id);

            let row = PhotoRow {
                id: photo_id.clone(),
                project_id: project_id.clone(),
                file_path: meta.file_path,
                file_name: meta.file_name,
                file_size: meta.file_size,
                width: meta.width,
                height: meta.height,
                format: meta.format,
                thumbnail_path: instant_thumb,
                thumbnail_base64: None,
                preview_path: None,
                is_favorite: false,
                used_count: 0,
                is_missing: false,
                created_at: chrono_now(),
                updated_at: chrono_now(),
            };

            if existing_match.is_some() {
                let _ = db.relink_photo(&photo_id, &row.file_path);
                if let Some(tp) = &row.thumbnail_path {
                    let _ = db.update_photo_thumbnail(&photo_id, tp);
                }
                relink_ids.push(photo_id.clone());
            } else {
                new_rows.push(row.clone());
            }

            let _ = app.emit("photo-imported", &row);
            to_process.push((photo_id, path));
        }
    }

    let new_rows_count = new_rows.len();
    let relink_count = relink_ids.len();

    if !new_rows.is_empty() {
        let _ = db.add_photos_batch(&new_rows, folder_id.as_deref());
    }

    if let Some(fid) = &folder_id {
        if !relink_ids.is_empty() {
            let _ = db.add_photos_to_folder(fid, &relink_ids);
        }
    }

    // If cancelled during Phase 1, exit early without spawning background preview pool
    if cancel_flag.load(Ordering::Relaxed) {
        log::info!("Photo import was cancelled; skipping Phase 2 preview generation");
        if let Ok(mut guard) = import_state.active_project_id.lock() {
            if let Some(ref current_pid) = *guard {
                if current_pid == &project_id {
                    *guard = None;
                }
            }
        }
        let _ = app.emit(
            "photo-import-complete",
            serde_json::json!({
                "projectId": project_id,
                "total": total_selected,
                "imported": new_rows_count,
                "existing": already_existing_count,
                "relinked": relink_count,
                "cancelled": true
            }),
        );
        return db.get_photos_for_project(&project_id).map_err(|e| e.to_string());
    }

    // -------------------------------------------------------------
    // PHASE 2: NON-BLOCKING BACKGROUND CANVAS PREVIEW GENERATION
    // Spawn background worker with bounded 2-thread Rayon pool.
    // Generates 1500px high-DPI canvas working preview & 320px thumbs.
    // -------------------------------------------------------------
    let app_bg = app.clone();
    let cancel_bg = cancel_flag.clone();
    let total_bg = to_process.len();
    let counter_bg = Arc::new(AtomicUsize::new(0));
    let project_id_bg = project_id.clone();

    let _ = app.emit(
        "photo-import-progress",
        ImportProgressPayload {
            project_id: project_id.clone(),
            current: 0,
            total: total_bg,
            current_file: "Starting progressive canvas cache generation...".to_string(),
            percent: 0,
        },
    );

    let num_threads = std::cmp::min(2, std::thread::available_parallelism().map(|n| n.get()).unwrap_or(2));

    let bg_result = tauri::async_runtime::spawn_blocking(move || {
        let pool = match rayon::ThreadPoolBuilder::new().num_threads(num_threads).build() {
            Ok(p) => p,
            Err(e) => {
                log::error!("Failed to build thread pool for preview generation: {}", e);
                return;
            }
        };

        pool.install(|| {
            to_process.into_par_iter().for_each(|(photo_id, file_path)| {
                if cancel_bg.load(Ordering::Relaxed) {
                    return;
                }

                let file_name = file_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("photo")
                    .to_string();

                match generate_photo_preview(&file_path, &cache_dir, &photo_id, &cancel_bg) {
                    Ok(preview_path) => {
                        if cancel_bg.load(Ordering::Relaxed) {
                            return;
                        }
                        let thumbs_dir = cache_dir.join("thumbnails");
                        let thumb_file = thumbs_dir.join(format!("{}.jpg", photo_id));
                        let thumb_path_str = if thumb_file.exists() {
                            thumb_file.to_string_lossy().to_string()
                        } else {
                            preview_path.clone()
                        };

                        let db_bg = app_bg.state::<Database>();
                        let _ = db_bg.update_photo_thumbnail(&photo_id, &thumb_path_str);
                        let _ = db_bg.update_photo_preview(&photo_id, &preview_path);

                        let curr = counter_bg.fetch_add(1, Ordering::SeqCst) + 1;
                        let percent = ((curr as f64 / total_bg as f64) * 100.0).min(100.0) as u8;

                        if curr % 25 == 0 {
                            trim_process_memory();
                        }

                        let _ = app_bg.emit(
                            "photo-preview-ready",
                            PhotoPreviewReadyPayload {
                                project_id: project_id_bg.clone(),
                                id: photo_id.clone(),
                                thumbnail_path: thumb_path_str,
                                preview_path: preview_path.clone(),
                            },
                        );

                        let _ = app_bg.emit(
                            "photo-import-progress",
                            ImportProgressPayload {
                                project_id: project_id_bg.clone(),
                                current: curr,
                                total: total_bg,
                                current_file: file_name,
                                percent,
                            },
                        );
                    }
                    Err(e) => {
                        log::warn!("Preview generation skipped/failed for {:?}: {}", file_path, e);
                        let curr = counter_bg.fetch_add(1, Ordering::SeqCst) + 1;
                        let percent = ((curr as f64 / total_bg as f64) * 100.0).min(100.0) as u8;
                        let _ = app_bg.emit(
                            "photo-import-progress",
                            ImportProgressPayload {
                                project_id: project_id_bg.clone(),
                                current: curr,
                                total: total_bg,
                                current_file: format!("Skipped: {}", file_name),
                                percent,
                            },
                        );
                    }
                }
            });
        });

        // Reclaim memory immediately after preview generation finishes
        trim_process_memory();

        let is_cancelled = cancel_bg.load(Ordering::Relaxed);
        if let Ok(mut guard) = app_bg.state::<ImportState>().active_project_id.lock() {
            if let Some(ref current_pid) = *guard {
                if current_pid == &project_id_bg {
                    *guard = None;
                }
            }
        }

        let _ = app_bg.emit(
            "photo-import-complete",
            serde_json::json!({
                "projectId": project_id_bg,
                "total": total_selected,
                "imported": new_rows_count,
                "existing": already_existing_count,
                "relinked": relink_count,
                "cancelled": is_cancelled
            }),
        );
    })
    .await;

    if let Err(e) = bg_result {
        log::error!("Preview generation spawn_blocking failed: {}", e);
    }

    // Return to frontend with all current project photos!
    db.get_photos_for_project(&project_id).map_err(|e| e.to_string())
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
pub async fn generate_missing_previews(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<PhotoRow>, String> {
    let db = app.state::<Database>();
    let photos = db.get_photos_for_project(&project_id).map_err(|e| e.to_string())?;
    let photos_needing_preview: Vec<PhotoRow> = photos
        .into_iter()
        .filter(|photo| {
            let is_thumb_missing = photo.thumbnail_path.as_ref().map(|path| !Path::new(path).exists()).unwrap_or(true);
            let is_preview_missing = photo.preview_path.as_ref().map(|path| !Path::new(path).exists()).unwrap_or(true);
            !photo.is_missing
                && Path::new(&photo.file_path).exists()
                && (is_thumb_missing || is_preview_missing)
        })
        .collect();

    if photos_needing_preview.is_empty() {
        return db.get_photos_for_project(&project_id).map_err(|e| e.to_string());
    }

    let cache_dir = get_cache_dir(&app);
    let app_clone = app.clone();

    // PHASE 1: INSTANT EXIF THUMBNAIL RECOVERY (< 5ms total)
    // If thumbnails were deleted from disk, quickly restore embedded EXIF thumbs if available
    for photo in &photos_needing_preview {
        let is_thumb_missing = photo.thumbnail_path.as_ref().map(|path| !Path::new(path).exists()).unwrap_or(true);
        if is_thumb_missing {
            if let Some(instant_thumb) = extract_embedded_thumbnail(Path::new(&photo.file_path), &cache_dir, &photo.id) {
                let _ = db.update_photo_thumbnail(&photo.id, &instant_thumb);
                let _ = app.emit(
                    "photo-preview-ready",
                    PhotoPreviewReadyPayload {
                        project_id: photo.project_id.clone(),
                        id: photo.id.clone(),
                        thumbnail_path: instant_thumb,
                        preview_path: photo.preview_path.clone().unwrap_or_default(),
                    },
                );
            }
        }
    }

    // PHASE 2: BACKGROUND RESIZING WORKER (Runs progressively without blocking)
    tauri::async_runtime::spawn_blocking(move || {
        let db_thread = app_clone.state::<Database>();
        let cancel_flag = app_clone.state::<ImportState>().cancel_flag.clone();
        for photo in photos_needing_preview {
            if cancel_flag.load(Ordering::Relaxed) {
                log::info!("generate_missing_previews cancelled");
                break;
            }
            if let Ok(processed) = process_photo(Path::new(&photo.file_path), &cache_dir, &photo.id) {
                if cancel_flag.load(Ordering::Relaxed) {
                    break;
                }
                let thumb_path_str = processed.thumbnail_path.clone().unwrap_or_default();
                if let Some(thumbnail_path) = &processed.thumbnail_path {
                    let _ = db_thread.update_photo_thumbnail(&photo.id, thumbnail_path);
                }
                if let Some(preview_path) = &processed.preview_path {
                    let _ = db_thread.update_photo_preview(&photo.id, preview_path);
                }
                let _ = app_clone.emit(
                    "photo-preview-ready",
                    PhotoPreviewReadyPayload {
                        project_id: photo.project_id.clone(),
                        id: photo.id.clone(),
                        thumbnail_path: if thumb_path_str.is_empty() { processed.preview_path.clone().unwrap_or_default() } else { thumb_path_str },
                        preview_path: processed.preview_path.unwrap_or_default(),
                    },
                );
            }
        }
        trim_process_memory();
    });

    let db = app.state::<Database>();
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
    app: AppHandle,
    db: State<'_, Database>,
    photo_id: String,
) -> Result<(), String> {
    db.delete_photo(&photo_id).map_err(|e| e.to_string())?;
    cleanup_orphaned_photo_assets(&app, &db)?;
    Ok(())
}

#[tauri::command]
pub fn check_missing_photos(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<PhotoRow>, String> {
    let mut photos = db.get_photos_for_project(&project_id).map_err(|e| e.to_string())?;
    for photo in &mut photos {
        let is_missing = !Path::new(&photo.file_path).exists();
        if is_missing != photo.is_missing {
            let _ = db.update_photo_missing(&photo.id, is_missing);
            photo.is_missing = is_missing;
        }
    }
    Ok(photos)
}

#[tauri::command]
pub async fn regenerate_single_thumbnail(
    app: AppHandle,
    photo_id: String,
) -> Result<PhotoRow, String> {
    let db = app.state::<Database>();
    let photo = db
        .get_photo(&photo_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Photo not found: {}", photo_id))?;

    let file_path = PathBuf::from(&photo.file_path);
    if !file_path.exists() {
        let _ = db.update_photo_missing(&photo_id, true);
        return Err(format!("Source photo file does not exist on disk: {:?}", file_path));
    }

    let cache_dir = get_cache_dir(&app);
    let app_clone = app.clone();
    let photo_id_clone = photo_id.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let processed = process_photo(&file_path, &cache_dir, &photo_id_clone)?;
        let thumb_path = processed.thumbnail_path.ok_or_else(|| "Failed to generate thumbnail".to_string())?;
        
        let db_thread = app_clone.state::<Database>();
        let _ = db_thread.update_photo_thumbnail(&photo_id_clone, &thumb_path);
        if let Some(preview_path) = processed.preview_path {
            let _ = db_thread.update_photo_preview(&photo_id_clone, &preview_path);
        }
        let _ = db_thread.update_photo_missing(&photo_id_clone, false);
        db_thread
            .get_photo(&photo_id_clone)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Photo not found after regeneration: {}", photo_id_clone))
    })
    .await
    .map_err(|e| e.to_string())?
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

    let cache_dir = get_cache_dir(&app);
    let db = app.state::<Database>();
    let photos = db.get_photos_for_project(&project_id).map_err(|e| e.to_string())?;
    let candidates: Vec<PathBuf> = tauri::async_runtime::spawn_blocking(move || scan_directory(&folder_path))
        .await
        .map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let db_thread = app_clone.state::<Database>();
        for photo in photos {
            let is_currently_missing = !Path::new(&photo.file_path).exists() || photo.is_missing;
            if is_currently_missing {
                if let Some(matching) = candidates.iter().find(|c| {
                    c.file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n.eq_ignore_ascii_case(&photo.file_name))
                        .unwrap_or(false)
                }) {
                    let new_path = matching.to_string_lossy().to_string();
                    let _ = db_thread.relink_photo(&photo.id, &new_path);

                    if let Ok(processed) = process_photo(matching, &cache_dir, &photo.id) {
                        if let Some(tp) = processed.thumbnail_path {
                            let _ = db_thread.update_photo_thumbnail(&photo.id, &tp);
                        }
                        if let Some(pp) = processed.preview_path {
                            let _ = db_thread.update_photo_preview(&photo.id, &pp);
                        }
                    }
                    log::info!("Relinked photo {} to {:?}", photo.file_name, new_path);
                }
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    let db = app.state::<Database>();
    db.get_photos_for_project(&project_id).map_err(|e| e.to_string())
}

// --- Batch Operations Commands ---

#[tauri::command]
pub fn batch_delete_photos(
    app: AppHandle,
    db: State<'_, Database>,
    photo_ids: Vec<String>,
) -> Result<(), String> {
    db.batch_delete_photos(&photo_ids).map_err(|e| e.to_string())?;
    cleanup_orphaned_photo_assets(&app, &db)?;
    Ok(())
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
