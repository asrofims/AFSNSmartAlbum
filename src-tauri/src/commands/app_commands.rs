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
        version: "v1.0.17".to_string(),
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

/// System Font Information returned to frontend
#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontInfo {
    pub family: String,
    pub full_name: String,
    pub file_name: String,
}

#[cfg(target_os = "windows")]
mod win32_reg {
    #[link(name = "advapi32")]
    extern "system" {
        pub fn RegOpenKeyExW(
            hKey: isize,
            lpSubKey: *const u16,
            ulOptions: u32,
            samDesired: u32,
            phkResult: *mut isize,
        ) -> i32;

        pub fn RegEnumValueW(
            hKey: isize,
            dwIndex: u32,
            lpValueName: *mut u16,
            lpcchValueName: *mut u32,
            lpReserved: *mut u32,
            lpType: *mut u32,
            lpData: *mut u8,
            lpcbData: *mut u32,
        ) -> i32;

        pub fn RegCloseKey(hKey: isize) -> i32;
    }

    pub const HKEY_LOCAL_MACHINE: isize = -2147483646; // (LONG)0x80000002 as isize
    pub const HKEY_CURRENT_USER: isize = -2147483647;  // (LONG)0x80000001 as isize
    pub const KEY_READ: u32 = 0x20019;
}

/// Get all installed system fonts from Windows OS registry
#[tauri::command]
pub fn get_system_fonts() -> Result<Vec<SystemFontInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::collections::HashSet;

        let mut fonts: Vec<SystemFontInfo> = Vec::new();
        let mut seen_families = HashSet::new();

        let subkey: Vec<u16> = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts\0"
            .encode_utf16()
            .collect();

        // Scan both HKLM (system-wide) and HKCU (per-user installed fonts)
        for root_key in [win32_reg::HKEY_LOCAL_MACHINE, win32_reg::HKEY_CURRENT_USER] {
            let mut hkey: isize = 0;
            let status = unsafe {
                win32_reg::RegOpenKeyExW(
                    root_key,
                    subkey.as_ptr(),
                    0,
                    win32_reg::KEY_READ,
                    &mut hkey,
                )
            };

            if status == 0 && hkey != 0 {
                let mut index = 0;
                let mut name_buf = vec![0u16; 512];
                let mut data_buf = vec![0u8; 1024];

                loop {
                    let mut name_len = name_buf.len() as u32;
                    let mut data_len = data_buf.len() as u32;
                    let mut val_type = 0u32;

                    let enum_status = unsafe {
                        win32_reg::RegEnumValueW(
                            hkey,
                            index,
                            name_buf.as_mut_ptr(),
                            &mut name_len,
                            std::ptr::null_mut(),
                            &mut val_type,
                            data_buf.as_mut_ptr(),
                            &mut data_len,
                        )
                    };

                    if enum_status != 0 {
                        break;
                    }

                    let raw_name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
                    let raw_name = raw_name.trim();

                    // Extract clean family name by stripping suffixes like " (TrueType)", " (OpenType)"
                    let clean_family = raw_name
                        .replace(" (TrueType)", "")
                        .replace(" (OpenType)", "")
                        .replace(" (All res)", "")
                        .trim()
                        .to_string();

                    // Extract file name from REG_SZ (type 1)
                    let file_name = if val_type == 1 && data_len >= 2 {
                        let u16_slice = unsafe {
                            std::slice::from_raw_parts(
                                data_buf.as_ptr() as *const u16,
                                (data_len / 2) as usize,
                            )
                        };
                        let s = String::from_utf16_lossy(u16_slice);
                        s.trim_matches('\0').trim().to_string()
                    } else {
                        String::new()
                    };

                    if !clean_family.is_empty() && !seen_families.contains(&clean_family.to_lowercase()) {
                        seen_families.insert(clean_family.to_lowercase());
                        fonts.push(SystemFontInfo {
                            family: clean_family,
                            full_name: raw_name.to_string(),
                            file_name,
                        });
                    }

                    index += 1;
                }

                unsafe { win32_reg::RegCloseKey(hkey) };
            }
        }

        // Sort alphabetically (A-Z)
        fonts.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
        Ok(fonts)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_system_fonts_smoke() {
        let fonts = get_system_fonts().expect("Failed to get system fonts");
        #[cfg(target_os = "windows")]
        {
            assert!(!fonts.is_empty(), "Should find fonts on Windows system");
            assert!(
                fonts.iter().any(|f| f.family.to_lowercase().contains("arial") || f.family.to_lowercase().contains("segoe")),
                "Should include Arial or Segoe UI"
            );
        }
    }
}

