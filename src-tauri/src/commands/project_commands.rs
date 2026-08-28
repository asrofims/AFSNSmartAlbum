use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

use crate::db::{Database, ProjectRow};

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
