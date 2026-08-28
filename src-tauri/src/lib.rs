mod commands;
mod db;
mod photo_engine;

use tauri::Manager;
use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            log::info!("Single instance trigger: bringing main window to focus");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize SQLite database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            let db_path = app_data_dir.join("afsn_smart_album.db");

            let database = Database::init(db_path)
                .expect("Failed to initialize database");

            // Make database available as managed state
            app.manage(database);

            log::info!("AFSNSmartAlbum started successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_commands::get_app_info,
            commands::app_commands::get_db_status,
            commands::project_commands::create_project,
            commands::project_commands::get_project,
            commands::project_commands::list_recent_projects,
            commands::project_commands::delete_project,
            commands::project_commands::clear_recent_projects,
            commands::photo_commands::select_and_import_files,
            commands::photo_commands::select_and_import_folder,
            commands::photo_commands::import_file_paths,
            commands::photo_commands::get_project_photos,
            commands::photo_commands::toggle_photo_favorite,
            commands::photo_commands::remove_photo,
            commands::photo_commands::check_missing_photos,
            commands::photo_commands::relink_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
