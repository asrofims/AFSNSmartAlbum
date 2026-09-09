use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use rayon::prelude::*;
use tauri::async_runtime::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::asset_cache::{PHOTO_ASSET_JOB, cleanup_removed_photo_assets};
use crate::db::{Database, PhotoFolderRow, PhotoRow};
use crate::photo_engine::{
    extract_embedded_thumbnail, extract_photo_metadata, generate_photo_preview, process_photo,
    scan_directory, thumbnail_for_preview, trim_process_memory, SUPPORTED_EXTENSIONS,
};

#[derive(Clone, Default)]
pub struct ImportState {
    pub cancel_flag: Arc<AtomicBool>,
    pub is_busy: Arc<Mutex<()>>,
    pub active_project_id: Arc<std::sync::Mutex<Option<String>>>,
    pub generation: Arc<AtomicUsize>,
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

fn get_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_cache_dir().map_err(|e| format!("Cannot access the image cache: {}", e))
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
                .map_err(|e| e.to_string())??;
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

static IS_FILE_PICKER_OPEN: AtomicBool = AtomicBool::new(false);

struct PickerGuard;
impl Drop for PickerGuard {
    fn drop(&mut self) {
        IS_FILE_PICKER_OPEN.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub async fn pick_photo_files_dialog(window: tauri::Window) -> Result<Option<Vec<String>>, String> {
    if IS_FILE_PICKER_OPEN.swap(true, Ordering::SeqCst) {
        log::warn!("File picker is already open; ignoring duplicate request");
        return Ok(None);
    }
    let _guard = PickerGuard;

    let files: Option<Vec<PathBuf>> = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_parent(&window)
            .set_title("Select Photos to Import")
            .add_filter("Images", SUPPORTED_EXTENSIONS)
            .pick_files()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(files.map(|paths| paths.into_iter().map(|p| p.to_string_lossy().to_string()).collect()))
}

#[tauri::command]
pub async fn pick_photo_folder_dialog(window: tauri::Window) -> Result<Option<Vec<String>>, String> {
    if IS_FILE_PICKER_OPEN.swap(true, Ordering::SeqCst) {
        log::warn!("Folder picker is already open; ignoring duplicate request");
        return Ok(None);
    }
    let _guard = PickerGuard;

    let folder: Option<PathBuf> = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_parent(&window)
            .set_title("Select Folder to Import Photos")
            .pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;

    match folder {
        Some(dir_path) => {
            let paths: Vec<PathBuf> = tauri::async_runtime::spawn_blocking(move || scan_directory(&dir_path))
                .await
                .map_err(|e| e.to_string())??;
            Ok(Some(paths.into_iter().map(|p| p.to_string_lossy().to_string()).collect()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn cancel_photo_import(state: State<'_, ImportState>) -> Result<(), String> {
    state.generation.fetch_add(1, Ordering::SeqCst);
    state.cancel_flag.store(true, Ordering::SeqCst);
    if let Ok(mut guard) = state.active_project_id.lock() {
        *guard = None;
    }
    log::info!("Photo import cancellation requested by user or project close");
    Ok(())
}

async fn import_paths_internal(
    app: AppHandle, project_id: String, paths: Vec<PathBuf>, folder_id: Option<String>,
) -> Result<Vec<PhotoRow>, String> {
    let state = app.state::<ImportState>();
    let generation = state.generation.load(Ordering::SeqCst);
    let _busy = state.is_busy.lock().await;
    if state.generation.load(Ordering::SeqCst) != generation {
        return app.state::<Database>().get_photos_for_project(&project_id).map_err(|e| e.to_string());
    }
    state.cancel_flag.store(false, Ordering::SeqCst);
    *state.active_project_id.lock().map_err(|e| e.to_string())? = Some(project_id.clone());
    let worker_app = app.clone();
    let worker_project = project_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _assets = PHOTO_ASSET_JOB.lock().map_err(|_| "Photo worker is unavailable".to_string())?;
        let state = worker_app.state::<ImportState>();
        if state.generation.load(Ordering::SeqCst) != generation {
            return worker_app.state::<Database>().get_photos_for_project(&worker_project).map_err(|e| e.to_string());
        }
        import_paths_blocking(&worker_app, &worker_project, paths, folder_id, &state.cancel_flag)
    }).await.map_err(|e| e.to_string()).and_then(|result| result);
    *state.active_project_id.lock().map_err(|e| e.to_string())? = None;
    result
}

fn path_identity(path: &Path) -> String {
    let path = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let value = path.to_string_lossy().replace('\\', "/");
    #[cfg(windows)]
    { value.trim_start_matches("//?/").to_lowercase() }
    #[cfg(not(windows))]
    { value }
}

fn import_paths_blocking(
    app: &AppHandle, project_id: &str, paths: Vec<PathBuf>, folder_id: Option<String>,
    cancel: &AtomicBool,
) -> Result<Vec<PhotoRow>, String> {
    let db = app.state::<Database>();
    if db.get_project(project_id).map_err(|e| e.to_string())?.is_none() {
        return Err("The import project no longer exists.".to_string());
    }
    let existing = db.get_photos_for_project(project_id).map_err(|e| e.to_string())?;
    let by_path: std::collections::HashMap<String, PhotoRow> = existing.into_iter()
        .map(|photo| (path_identity(Path::new(&photo.file_path)), photo)).collect();
    if let Some(folder) = folder_id.as_deref() {
        if !db.get_folders_for_project(project_id).map_err(|e| e.to_string())?.iter().any(|f| f.id == folder) {
            return Err("The target folder no longer belongs to this project.".to_string());
        }
    }
    let cache_dir = get_cache_dir(app)?;
    let mut seen = std::collections::HashSet::new();
    let mut selected = Vec::new();
    for path in paths {
        if cancel.load(Ordering::SeqCst) { break; }
        let candidates = if path.is_dir() { scan_directory(&path)? } else { vec![path] };
        for path in candidates {
            if seen.insert(path_identity(&path)) { selected.push(path); }
        }
    }
    let total = selected.len();
    let mut failures = Vec::<serde_json::Value>::new();
    let mut rows = Vec::new();
    let mut process = Vec::new();
    let mut existing_ids = Vec::new();
    for path in selected {
        if cancel.load(Ordering::SeqCst) { break; }
        let meta = match extract_photo_metadata(&path) {
            Ok(meta) => meta,
            Err(error) => {
                failures.push(serde_json::json!({"file": path.to_string_lossy(), "message": error, "phase": "registration"}));
                continue;
            }
        };
        if let Some(photo) = by_path.get(&path_identity(&path)) {
            existing_ids.push(photo.id.clone());
            // Re-import refreshes the same source, including externally edited images.
            process.push((photo.id.clone(), path, meta));
            continue;
        }
        let id = Uuid::new_v4().to_string();
        let thumbnail = extract_embedded_thumbnail(&path, &cache_dir, &id);
        rows.push(PhotoRow {
            id: id.clone(), project_id: project_id.to_string(), file_path: meta.file_path.clone(),
            file_name: meta.file_name.clone(), file_size: meta.file_size, width: meta.width, height: meta.height,
            format: meta.format.clone(), thumbnail_path: thumbnail, thumbnail_base64: None, preview_path: None,
            is_favorite: false, used_count: 0, is_missing: false, created_at: chrono_now(), updated_at: chrono_now(),
        });
        process.push((id, path, meta));
    }
    // Publish UI items only after registration has committed successfully.
    if let Err(error) = db.add_photos_batch(&rows, folder_id.as_deref()) {
        cleanup_removed_photo_assets(&cache_dir, &rows.iter().map(|row| row.id.clone()).collect::<Vec<_>>());
        return Err(format!("Photo registration failed: {}", error));
    }
    if let Some(folder) = folder_id.as_deref() {
        db.add_photos_to_folder(folder, &existing_ids).map_err(|e| e.to_string())?;
    }
    for row in &rows { let _ = app.emit("photo-imported", row); }
    let completed = std::sync::Mutex::new(std::collections::HashSet::<String>::new());
    let preview_failures = std::sync::Mutex::new(Vec::<serde_json::Value>::new());
    let counter = AtomicUsize::new(0);
    let count = process.len();
    let pool = rayon::ThreadPoolBuilder::new().num_threads(2).build().map_err(|e| e.to_string())?;
    pool.install(|| {
        process.par_iter().for_each(|(id, path, meta)| {
            if cancel.load(Ordering::SeqCst) { return; }
            let result = (|| {
                let preview = generate_photo_preview(path, &cache_dir, id, cancel)?;
                if cancel.load(Ordering::SeqCst) { return Err("Cancelled".to_string()); }
                let thumbnail = thumbnail_for_preview(&cache_dir, id, &preview)?;
                db.update_photo_source(id, meta, &thumbnail, &preview).map_err(|e| e.to_string())?;
                completed.lock().unwrap().insert(id.clone());
                let _ = app.emit("photo-preview-ready", PhotoPreviewReadyPayload {
                    project_id: project_id.to_string(), id: id.clone(), thumbnail_path: thumbnail, preview_path: preview,
                });
                Ok::<(), String>(())
            })();
            if let Err(error) = result {
                if !cancel.load(Ordering::SeqCst) {
                    preview_failures.lock().unwrap().push(serde_json::json!({
                        "file": path.to_string_lossy(), "message": error, "phase": "preview"
                    }));
                }
            }
            let current = counter.fetch_add(1, Ordering::SeqCst) + 1;
            let _ = app.emit("photo-import-progress", ImportProgressPayload {
                project_id: project_id.to_string(), current, total: count,
                current_file: meta.file_name.clone(), percent: (current * 100 / count.max(1)) as u8,
            });
        });
    });
    let cancelled = cancel.load(Ordering::SeqCst);
    let mut purged = Vec::new();
    if cancelled {
        let completed = completed.lock().unwrap();
        let pending: Vec<String> = rows.iter().filter(|row| !completed.contains(&row.id)).map(|row| row.id.clone()).collect();
        purged = db.remove_photo_records(Some(project_id), &pending).map_err(|e| e.to_string())?;
        for warning in cleanup_removed_photo_assets(&cache_dir, &purged) { log::warn!("{}", warning); }
    }
    let preview_failures = preview_failures.into_inner().map_err(|e| e.to_string())?;
    let failed = failures.len();
    let preview_failed = preview_failures.len();
    failures.extend(preview_failures);
    let _ = app.emit("photo-import-complete", serde_json::json!({
        "projectId": project_id, "total": total, "imported": rows.len() - purged.len(),
        "existing": existing_ids.len(), "relinked": 0, "cancelled": cancelled, "purged": purged.len(),
        "failed": failed, "previewFailed": preview_failed, "failures": failures
    }));
    trim_process_memory();
    db.get_photos_for_project(project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project_photos(
    app: AppHandle,
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<PhotoRow>, String> {
    let photos = db.get_photos_for_project(&project_id).map_err(|e| e.to_string())?;
    // Portable projects may have previews outside the application cache. Grant only
    // their explicitly referenced, bounded image files, never an entire source folder.
    let scope = app.asset_protocol_scope();
    for photo in &photos {
        for path in [&photo.thumbnail_path, &photo.preview_path].into_iter().flatten() {
            if image::image_dimensions(path).map(|(w, h)| w.max(h) <= crate::photo_engine::CANVAS_PREVIEW_MAX_SIZE).unwrap_or(false) {
                scope.allow_file(path).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(photos)
}

#[tauri::command]
pub async fn generate_missing_previews(app: AppHandle, project_id: String) -> Result<Vec<PhotoRow>, String> {
    let photos = app.state::<Database>().get_photos_for_project(&project_id).map_err(|e| e.to_string())?;
    let generation = app.state::<ImportState>().generation.load(Ordering::SeqCst);
    let current_photos = photos.clone();
    tauri::async_runtime::spawn_blocking(move || {
        for candidate in photos {
            let Ok(_assets) = PHOTO_ASSET_JOB.lock() else { return; };
            if app.state::<ImportState>().generation.load(Ordering::SeqCst) != generation { return; }
            let db = app.state::<Database>();
            let Ok(Some(photo)) = db.get_photo(&candidate.id) else { continue; };
            if photo.is_missing || !Path::new(&photo.file_path).is_file() { continue; }
            let healthy = photo.thumbnail_path.as_ref().map(|p| image::image_dimensions(p)
                .map(|(w, h)| w.max(h) <= crate::photo_engine::FILMSTRIP_THUMBNAIL_MAX_SIZE).unwrap_or(false)).unwrap_or(false)
                && photo.preview_path.as_ref().map(|p| image::image_dimensions(p)
                    .map(|(w, h)| w.max(h) <= crate::photo_engine::CANVAS_PREVIEW_MAX_SIZE).unwrap_or(false)).unwrap_or(false);
            if healthy { continue; }
            if let Err(error) = refresh_photo_assets(&app, &photo) {
                log::warn!("Preview recovery failed for {}: {}", photo.file_name, error);
                let _ = app.emit("photo-processing-error", serde_json::json!({
                    "projectId": photo.project_id, "message": format!("Preview recovery failed for {}: {}", photo.file_name, error)
                }));
            }
        }
        trim_process_memory();
    });
    Ok(current_photos)
}

// Caller holds PHOTO_ASSET_JOB, covering source validation, publication, and database update.
fn refresh_photo_assets(app: &AppHandle, photo: &PhotoRow) -> Result<PhotoRow, String> {
    let path = Path::new(&photo.file_path);
    let meta = extract_photo_metadata(path)?;
    let processed = process_photo(path, &get_cache_dir(app)?, &photo.id)?;
    let thumbnail = processed.thumbnail_path.ok_or("Thumbnail generation failed")?;
    let preview = processed.preview_path.ok_or("Preview generation failed")?;
    let db = app.state::<Database>();
    db.update_photo_source(&photo.id, &meta, &thumbnail, &preview).map_err(|e| e.to_string())?;
    let _ = app.emit("photo-preview-ready", PhotoPreviewReadyPayload {
        project_id: photo.project_id.clone(), id: photo.id.clone(), thumbnail_path: thumbnail, preview_path: preview,
    });
    db.get_photo(&photo.id).map_err(|e| e.to_string())?.ok_or("Photo was removed".to_string())
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
pub async fn remove_photo(app: AppHandle, project_id: String, photo_id: String) -> Result<PhotoRemovalResult, String> {
    batch_delete_photos(app, project_id, vec![photo_id]).await
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
pub async fn regenerate_single_thumbnail(app: AppHandle, photo_id: String) -> Result<PhotoRow, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _assets = PHOTO_ASSET_JOB.lock().map_err(|_| "Photo worker is unavailable".to_string())?;
        let db = app.state::<Database>();
        let photo = db.get_photo(&photo_id).map_err(|e| e.to_string())?.ok_or("Photo was removed")?;
        if !Path::new(&photo.file_path).is_file() {
            db.update_photo_missing(&photo_id, true).map_err(|e| e.to_string())?;
            return Err("The original photo is missing. Locate it before rebuilding the preview.".to_string());
        }
        refresh_photo_assets(&app, &photo)
    }).await.map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelinkResult {
    photos: Vec<PhotoRow>,
    failures: Vec<String>,
}

#[tauri::command]
pub async fn relink_folder(app: AppHandle, project_id: String) -> Result<RelinkResult, String> {
    let folder = tauri::async_runtime::spawn_blocking(|| rfd::FileDialog::new()
        .set_title("Select Folder Containing Missing Photos").pick_folder()).await.map_err(|e| e.to_string())?;
    let Some(folder) = folder else {
        return Ok(RelinkResult { photos: app.state::<Database>().get_photos_for_project(&project_id).map_err(|e| e.to_string())?, failures: vec![] });
    };
    tauri::async_runtime::spawn_blocking(move || {
        let candidates = scan_directory(&folder)?;
        let _assets = PHOTO_ASSET_JOB.lock().map_err(|_| "Photo worker is unavailable".to_string())?;
        let db = app.state::<Database>();
        let photos = db.get_photos_for_project(&project_id).map_err(|e| e.to_string())?;
        let mut failures = Vec::new();
        for mut photo in photos {
            if Path::new(&photo.file_path).is_file() && !photo.is_missing { continue; }
            // Filename narrows the search; size and oriented dimensions validate candidates.
            let matches: Vec<_> = candidates.iter().filter(|p| p.file_name().and_then(|n| n.to_str())
                .map(|n| n.eq_ignore_ascii_case(&photo.file_name)).unwrap_or(false))
                .filter(|p| extract_photo_metadata(p).map(|m| m.file_size == photo.file_size
                    && m.width == photo.width && m.height == photo.height).unwrap_or(false)).collect();
            if matches.len() != 1 {
                failures.push(format!("{}: {} compatible matches found. Select a folder containing one matching original.", photo.file_name, matches.len()));
                continue;
            }
            photo.file_path = matches[0].to_string_lossy().to_string();
            if let Err(error) = refresh_photo_assets(&app, &photo) {
                failures.push(format!("{}: {}", photo.file_name, error));
            }
        }
        Ok(RelinkResult { photos: db.get_photos_for_project(&project_id).map_err(|e| e.to_string())?, failures })
    }).await.map_err(|e| e.to_string())?
}

// --- Batch Operations Commands ---

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoRemovalResult {
    removed_ids: Vec<String>,
    warnings: Vec<String>,
}

#[tauri::command]
pub async fn batch_delete_photos(app: AppHandle, project_id: String, photo_ids: Vec<String>) -> Result<PhotoRemovalResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _assets = PHOTO_ASSET_JOB.lock().map_err(|_| "Photo worker is unavailable".to_string())?;
        let db = app.state::<Database>();
        let removed_ids = db.remove_photo_records(Some(&project_id), &photo_ids).map_err(|e| e.to_string())?;
        // Cache failures do not turn an already committed removal into a failed delete.
        let warnings = match get_cache_dir(&app) {
            Ok(cache) => cleanup_removed_photo_assets(&cache, &removed_ids),
            Err(error) => vec![error],
        };
        Ok(PhotoRemovalResult { removed_ids, warnings })
    }).await.map_err(|e| e.to_string())?
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
