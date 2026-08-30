use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

use crate::db::{AlbumPayload, Database, ProjectPackagePayload, ProjectRow};

#[derive(Default)]
pub struct LaunchState {
    pub pending_open_file: std::sync::Mutex<Option<String>>,
}

#[tauri::command]
pub fn get_initial_open_path(launch_state: State<'_, LaunchState>) -> Option<String> {
    let mut lock = launch_state.pending_open_file.lock().unwrap();
    lock.take()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub canvas_width: f64,
    pub canvas_height: f64,
    pub canvas_unit: String,
    pub canvas_dpi: i32,
    pub spacing_value: f64,
    pub spacing_unit: String,
    pub margin_enabled: Option<bool>,
    pub margin_value: Option<f64>,
    pub margin_unit: Option<String>,
    pub border_enabled: bool,
    pub border_width: f64,
    pub border_unit: String,
    pub border_color: String,
    pub background_type: String,
    pub background_color: String,
}

#[tauri::command]
pub fn create_project(db: State<'_, Database>, request: CreateProjectRequest) -> Result<ProjectRow, String> {
    log::info!("create_project received request: {:?}", request);

    // Validate input
    if request.name.trim().is_empty() {
        return Err("Project name cannot be empty".to_string());
    }
    if request.canvas_width <= 0.0 || request.canvas_height <= 0.0 {
        return Err("Canvas dimensions must be positive numbers".to_string());
    }
    if request.canvas_dpi <= 0 {
        return Err("DPI must be a positive number".to_string());
    }

    let id = Uuid::new_v4().to_string();

    let margin_enabled = request.margin_enabled.unwrap_or(true);
    let margin_value = request.margin_value.unwrap_or(10.0);
    let margin_unit = request.margin_unit.as_deref().unwrap_or("mm");

    db.create_project(
        &id,
        request.name.trim(),
        request.canvas_width,
        request.canvas_height,
        &request.canvas_unit,
        request.canvas_dpi,
        request.spacing_value,
        &request.spacing_unit,
        margin_enabled,
        margin_value,
        margin_unit,
        request.border_enabled,
        request.border_width,
        &request.border_unit,
        &request.border_color,
        &request.background_type,
        &request.background_color,
    ).map_err(|e| {
        log::error!("Database create_project error: {:?}", e);
        e.to_string()
    })?;

    log::info!("Project created with id: {}", id);

    db.get_project(&id)
        .map_err(|e| {
            log::error!("Database get_project error: {:?}", e);
            e.to_string()
        })?
        .ok_or_else(|| "Failed to retrieve created project".to_string())
}

#[tauri::command]
pub fn get_project(db: State<'_, Database>, id: String) -> Result<Option<ProjectRow>, String> {
    db.get_project(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_recent_projects(db: State<'_, Database>, limit: Option<i32>) -> Result<Vec<ProjectRow>, String> {
    let limit = limit.unwrap_or(10);
    db.list_recent_projects(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(db: State<'_, Database>, id: String) -> Result<(), String> {
    log::info!("delete_project: {}", id);
    db.delete_project(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_recent_projects(db: State<'_, Database>) -> Result<(), String> {
    log::info!("clear_recent_projects");
    db.clear_recent_projects().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project_spacing(
    db: State<'_, Database>,
    id: String,
    spacing_value: f64,
    spacing_unit: String,
) -> Result<(), String> {
    log::info!("update_project_spacing: id={}, value={}, unit={}", id, spacing_value, spacing_unit);
    db.update_project_spacing(&id, spacing_value, &spacing_unit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project_name(
    db: State<'_, Database>,
    id: String,
    name: String,
) -> Result<ProjectRow, String> {
    let clean_name = name.trim();
    if clean_name.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }
    log::info!("update_project_name: id={}, name={}", id, clean_name);

    let existing_proj = db.get_project(&id).map_err(|e| e.to_string())?
        .ok_or_else(|| "Project not found".to_string())?;

    let mut new_file_path = existing_proj.file_path.clone();

    // If an associated .afsn file exists on disk, rename it automatically (Option 1)
    if let Some(ref old_path_str) = existing_proj.file_path {
        let old_path = std::path::Path::new(old_path_str);
        if old_path.exists() {
            let parent_dir = old_path.parent().unwrap_or_else(|| std::path::Path::new(""));
            let safe_file_stem = clean_name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
            let target_file_name = format!("{}.afsn", safe_file_stem);
            let target_path = parent_dir.join(&target_file_name);

            if target_path != old_path {
                if target_path.exists() {
                    return Err(format!(
                        "Cannot rename file on disk: A file named '{}' already exists in the folder.",
                        target_file_name
                    ));
                }

                log::info!(
                    "Renaming .afsn file on disk from {:?} to {:?}",
                    old_path,
                    target_path
                );
                std::fs::rename(old_path, &target_path).map_err(|e| {
                    format!("Failed to rename file on disk (it may be open or locked): {}", e)
                })?;

                new_file_path = Some(target_path.to_string_lossy().to_string());
            }
        }
    }

    db.update_project_name_and_path(&id, clean_name, new_file_path.as_deref())
        .map_err(|e| e.to_string())?;

    // If an associated .afsn file exists, rewrite its internal JSON package with the updated project name!
    if let Some(ref path_str) = new_file_path {
        if std::path::Path::new(path_str).exists() {
            let _ = db.export_project_package(&id, path_str);
        }
    }

    db.get_project(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to reload updated project".to_string())
}

#[tauri::command]
pub fn update_project_name_and_path(
    db: State<'_, Database>,
    id: String,
    name: String,
    file_path: Option<String>,
) -> Result<(), String> {
    let clean_name = name.trim();
    if clean_name.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }
    log::info!("update_project_name_and_path: id={}, name={}, path={:?}", id, clean_name, file_path);
    db.update_project_name_and_path(&id, clean_name, file_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_album_structure(
    db: State<'_, Database>,
    album: AlbumPayload,
) -> Result<(), String> {
    log::info!("save_album_structure for project: {}", album.project_id);
    db.save_album_structure(&album)
        .map_err(|e| {
            log::error!("Failed to save album structure: {:?}", e);
            e.to_string()
        })
}

#[tauri::command]
pub fn load_album_structure(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Option<AlbumPayload>, String> {
    log::info!("load_album_structure for project: {}", project_id);
    db.load_album_structure(&project_id)
        .map_err(|e| {
            log::error!("Failed to load album structure: {:?}", e);
            e.to_string()
        })
}

#[tauri::command]
pub fn export_afsn_package(
    db: State<'_, Database>,
    project_id: String,
    target_path: String,
) -> Result<(), String> {
    log::info!("export_afsn_package: project_id={}, target_path={}", project_id, target_path);
    db.export_project_package(&project_id, &target_path)
        .map_err(|e| {
            log::error!("Failed to export .afsn package: {:?}", e);
            e.to_string()
        })
}

#[tauri::command]
pub fn import_afsn_package(
    db: State<'_, Database>,
    source_path: String,
) -> Result<ProjectPackagePayload, String> {
    log::info!("import_afsn_package: source_path={}", source_path);
    db.import_project_package(&source_path)
        .map_err(|e| {
            log::error!("Failed to import .afsn package: {:?}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn export_afsn_with_dialog(
    db: State<'_, Database>,
    project_id: String,
    suggested_name: Option<String>,
) -> Result<Option<String>, String> {
    let default_name = suggested_name.unwrap_or_else(|| "Album-Project".to_string());
    let fallback_name = default_name.clone();
    let file_path = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Export AFSNSmartAlbum Project (.afsn)")
            .set_file_name(&format!("{}.afsn", default_name))
            .add_filter("AFSNSmartAlbum Package (*.afsn)", &["afsn"])
            .save_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Some(mut path) = file_path {
        if path.extension().and_then(|ext| ext.to_str()) != Some("afsn") {
            path.set_extension("afsn");
        }
        let path_str = path.to_string_lossy().to_string();
        let new_name = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| fallback_name);

        // Automatically update the project name and file path in database!
        let _ = db.update_project_name_and_path(&project_id, &new_name, Some(&path_str));

        log::info!("export_afsn_with_dialog: exporting project {} ({}) to {}", project_id, new_name, path_str);
        db.export_project_package(&project_id, &path_str)
            .map_err(|e| {
                log::error!("Failed export_project_package: {:?}", e);
                e.to_string()
            })?;
        Ok(Some(path_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn export_bundled_package_with_dialog(
    db: State<'_, Database>,
    project_id: String,
    suggested_name: Option<String>,
) -> Result<Option<String>, String> {
    let default_name = suggested_name.unwrap_or_else(|| "Album-Complete-Package".to_string());
    let file_path = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Export Complete Album Package with Photos (.zip)")
            .set_file_name(&format!("{}-Package.zip", default_name))
            .add_filter("AFSNSmartAlbum Complete Archive (*.zip, *.afsnz)", &["zip", "afsnz"])
            .save_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Some(mut path) = file_path {
        let ext = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");
        if ext != "zip" && ext != "afsnz" {
            path.set_extension("zip");
        }
        let path_str = path.to_string_lossy().to_string();
        log::info!("export_bundled_package_with_dialog: exporting bundled package {} to {}", project_id, path_str);
        db.export_bundled_project_package(&project_id, &path_str)
            .map_err(|e| {
                log::error!("Failed export_bundled_project_package: {:?}", e);
                e.to_string()
            })?;
        Ok(Some(path_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn import_afsn_with_dialog(
    db: State<'_, Database>,
) -> Result<Option<ProjectPackagePayload>, String> {
    let file_path = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Open AFSNSmartAlbum Project or Package (.afsn, .zip)")
            .add_filter("AFSNSmartAlbum Supported Files (*.afsn, *.zip, *.afsnz)", &["afsn", "zip", "afsnz"])
            .pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Some(path) = file_path {
        let path_str = path.to_string_lossy().to_string();
        let package = db.import_project_package(&path_str)
            .map_err(|e| e.to_string())?;
        Ok(Some(package))
    } else {
        Ok(None)
    }
}
