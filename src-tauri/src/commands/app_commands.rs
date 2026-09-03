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
        version: "v1.0.16".to_string(),
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

#[cfg(target_os = "windows")]
mod win32_color {
    #[link(name = "user32")]
    extern "system" {
        pub fn GetDC(hwnd: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        pub fn ReleaseDC(hwnd: *mut std::ffi::c_void, hdc: *mut std::ffi::c_void) -> i32;
        pub fn GetCursorPos(point: *mut POINT) -> i32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        pub fn GetPixel(hdc: *mut std::ffi::c_void, x: i32, y: i32) -> u32;
    }

    #[repr(C)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }
}

/// Sample exact pixel color from screen using native OS graphics API.
/// If x and y are provided, samples at that point; otherwise samples at current cursor position.
#[tauri::command]
pub fn sample_screen_color(x: Option<i32>, y: Option<i32>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let (px, py) = match (x, y) {
            (Some(x), Some(y)) => (x, y),
            _ => {
                let mut pt = win32_color::POINT { x: 0, y: 0 };
                win32_color::GetCursorPos(&mut pt);
                (pt.x, pt.y)
            }
        };

        let hdc = win32_color::GetDC(std::ptr::null_mut());
        if hdc.is_null() {
            return Err("Failed to get screen DC".to_string());
        }

        let colorref = win32_color::GetPixel(hdc, px, py);
        win32_color::ReleaseDC(std::ptr::null_mut(), hdc);

        if colorref == 0xFFFFFFFF {
            return Err("Invalid pixel coordinate".to_string());
        }

        // COLORREF is 0x00BBGGRR
        let r = (colorref & 0xFF) as u8;
        let g = ((colorref >> 8) & 0xFF) as u8;
        let b = ((colorref >> 16) & 0xFF) as u8;

        Ok(format!("#{:02X}{:02X}{:02X}", r, g, b))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (x, y);
        Ok("#FFFFFF".to_string())
    }
}

