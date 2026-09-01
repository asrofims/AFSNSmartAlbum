use serde::Serialize;
use tauri::State;

use crate::db::Database;

/// Application information returned to the frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub build_number: String,
    pub platform: String,
    pub db_schema_version: i32,
}

/// Database status information.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatus {
    pub connected: bool,
    pub schema_version: i32,
    pub expected_version: i32,
}

/// Get application info including version, platform, and database status.
#[tauri::command]
pub fn get_app_info(db: State<'_, Database>) -> Result<AppInfo, String> {
    let schema_version = db.get_schema_version().map_err(|e| e.to_string())?;

    Ok(AppInfo {
        version: "v1.0.13".to_string(),
        build_number: "1".to_string(),
        platform: std::env::consts::OS.to_string(),
        db_schema_version: schema_version,
    })
}

/// Get database connection status.
#[tauri::command]
pub fn get_db_status(db: State<'_, Database>) -> Result<DbStatus, String> {
    let schema_version = db.get_schema_version().map_err(|e| e.to_string())?;

    Ok(DbStatus {
        connected: true,
        schema_version,
        expected_version: Database::expected_version(),
    })
}
